import { Request, Response } from 'express';
import { OKRModel } from '../models/OKR';
import { UserModel } from '../models/User';
import { AppError, ErrorCode, createSuccessResponse, createErrorResponse } from '../utils/errors';
import { OperationLogModel } from '../models/OperationLog';
import { canTransition, validateStatusTransition, getAllowedTransitions, OKRStatus } from '../utils/okrStateMachine';
import { checkApprovalPermission, checkArchivePermission } from '../utils/permissionChecker';
import { query, withTransaction } from '../config/database';
import { OKR, OKRLevel, Role } from '../types';

// 获取审批流程快照
async function getWorkflowSnapshot(userRole: string): Promise<{
  approver_l1_role?: string;
  approver_l2_role?: string;
  approver_l3_role?: string;
  cc_roles?: string[];
}> {
  const result = await query(
    'SELECT approver_role_l1, approver_role_l2, approver_role_l3, cc_roles FROM workflows WHERE target_role = $1',
    [userRole]
  );
  
  if (result.rows.length === 0) {
    return {};
  }
  
  const workflow = result.rows[0];
  return {
    approver_l1_role: workflow.approver_role_l1,
    approver_l2_role: workflow.approver_role_l2,
    approver_l3_role: workflow.approver_role_l3,
    cc_roles: workflow.cc_roles || []
  };
}

/** 审批通过、进入下一阶段时清除「驳回理由」展示字段 */
function shouldClearStatusRejectReason(from: OKRStatus, to: OKRStatus): boolean {
  const clears: [OKRStatus, OKRStatus][] = [
    [OKRStatus.PENDING_MANAGER, OKRStatus.PENDING_GM],
    [OKRStatus.PENDING_MANAGER, OKRStatus.PUBLISHED],
    [OKRStatus.PENDING_GM, OKRStatus.PUBLISHED],
    [OKRStatus.PENDING_ASSESSMENT_APPROVAL, OKRStatus.PENDING_L2_APPROVAL],
    [OKRStatus.PENDING_ASSESSMENT_APPROVAL, OKRStatus.PENDING_ARCHIVE],
    [OKRStatus.PENDING_L2_APPROVAL, OKRStatus.PENDING_L3_APPROVAL],
    [OKRStatus.PENDING_L2_APPROVAL, OKRStatus.PENDING_ARCHIVE],
    [OKRStatus.PENDING_L3_APPROVAL, OKRStatus.PENDING_ARCHIVE],
  ];
  return clears.some(([f, t]) => f === from && t === to);
}

// 验证权重总和
function validateWeights(okr: Partial<OKR>): { valid: boolean; reason?: string } {
  if (!okr.objectives || !Array.isArray(okr.objectives)) {
    return { valid: true }; // 如果没有 objectives，跳过验证
  }
  
  // 如果 objectives 为空数组，允许（可能是初始化状态）
  if (okr.objectives.length === 0) {
    return { valid: true };
  }
  
  // 验证目标权重总和
  const totalWeight = okr.objectives.reduce((sum, obj) => sum + (obj.weight || 0), 0);
  if (Math.abs(totalWeight - 100) > 0.01) {
    return { valid: false, reason: `目标权重总和必须等于 100，当前为 ${totalWeight}` };
  }
  
  // 验证每个目标的关键结果权重总和
  for (const obj of okr.objectives) {
    if (obj.keyResults && Array.isArray(obj.keyResults) && obj.keyResults.length > 0) {
      const krTotalWeight = obj.keyResults.reduce((sum, kr) => sum + (kr.weight || 0), 0);
      if (krTotalWeight > 0 && Math.abs(krTotalWeight - 100) > 0.01) {
        return { valid: false, reason: `目标 "${obj.content}" 的关键结果权重总和必须等于 100，当前为 ${krTotalWeight}` };
      }
    }
  }
  
  return { valid: true };
}

export const getAllOKRs = async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string | undefined;
    const okrs = await OKRModel.findAll(userId);
    res.json(createSuccessResponse({ okrs }));
  } catch (error) {
    console.error('Get OKRs error:', error);
    throw new AppError(ErrorCode.INTERNAL_ERROR, '服务器错误', 500);
  }
};

export const getOKRById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const okr = await OKRModel.findById(id);
    if (!okr) {
      throw new AppError(ErrorCode.OKR_NOT_FOUND, 'OKR 不存在', 404);
    }
    res.json(createSuccessResponse({ okr }));
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    console.error('Get OKR error:', error);
    throw new AppError(ErrorCode.INTERNAL_ERROR, '服务器错误', 500);
  }
};

export const createOKR = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const okrData = req.body;
    
    // 验证权重
    const weightValidation = validateWeights(okrData);
    if (!weightValidation.valid) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, weightValidation.reason || '权重验证失败', 400);
    }
    
    // 获取用户信息
    const user = await UserModel.findById(okrData.userId || userId);
    if (!user) {
      throw new AppError(ErrorCode.USER_NOT_FOUND, '用户不存在', 404);
    }
    
    // 获取审批流程快照
    const workflowSnapshot = await getWorkflowSnapshot(user.role);
    
    // 创建 OKR
    const okr = await OKRModel.create({
      ...okrData,
      userId: okrData.userId || userId,
      status: okrData.status || OKRStatus.DRAFT,
      approver_l1_role: workflowSnapshot.approver_l1_role,
      approver_l2_role: workflowSnapshot.approver_l2_role,
      approver_l3_role: workflowSnapshot.approver_l3_role,
      cc_roles: workflowSnapshot.cc_roles
    }, userId);
    
    // 记录日志
    await OperationLogModel.create({
      id: `log-${Date.now()}`,
      userId,
      userName: user.name,
      action: 'CREATE_OKR',
      module: 'OKR',
      details: `创建 OKR: ${okr.title}`,
      ip: req.ip || '',
      timestamp: new Date().toISOString()
    });
    
    res.status(201).json(createSuccessResponse({ okr }));
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    console.error('Create OKR error:', error);
    throw new AppError(ErrorCode.INTERNAL_ERROR, '服务器错误', 500);
  }
};

export const updateOKR = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.userId!;
    const okrData = req.body;
    
    console.log(`[updateOKR] 开始更新 OKR: ${id}, 状态: ${okrData.status}, 版本: ${okrData.version}`);
    
    // 检查 OKR 是否存在
    const existing = await OKRModel.findById(id);
    if (!existing) {
      throw new AppError(ErrorCode.OKR_NOT_FOUND, 'OKR 不存在', 404);
    }

    // 如果用户尝试更改 OKR 类型（level），则需要基于“OKR 归属用户”的角色校验是否允许
    if (okrData.level && okrData.level !== existing.level) {
      const okrOwner = await UserModel.findById(existing.userId);
      if (!okrOwner) {
        throw new AppError(ErrorCode.USER_NOT_FOUND, 'OKR 归属用户不存在', 404);
      }

      const executiveRoles = [Role.VP_PRODUCT, Role.VP_TECH, Role.VP_MARKET, Role.PRESIDENT];
      const isExecutive = executiveRoles.includes(okrOwner.role as Role);
      const canCreateCompanyOKR = [Role.PRODUCT_GM, Role.TECH_GM, ...executiveRoles].includes(okrOwner.role as Role);

      const isCadreRes = await query(
        `SELECT 1
         FROM workflows
         WHERE approver_role_l1 = $1 OR approver_role_l2 = $1
         LIMIT 1`,
        [okrOwner.role]
      );
      const isManager = isCadreRes.rows.length > 0;
      const canCreateDepartmentOKR = isManager || isExecutive;
      const canCreatePersonalOKR = true;

      const allowedLevels: OKRLevel[] = [];
      if (canCreateCompanyOKR) allowedLevels.push(OKRLevel.COMPANY);
      if (canCreateDepartmentOKR) allowedLevels.push(OKRLevel.DEPARTMENT);
      if (canCreatePersonalOKR) allowedLevels.push(OKRLevel.PERSONAL);

      const newLevel = okrData.level as OKRLevel;
      if (!allowedLevels.includes(newLevel)) {
        throw new AppError(ErrorCode.FORBIDDEN, '当前用户不支持该 OKR 类型', 403);
      }
    }
    
    // 如果更新状态，验证状态转换
    if (okrData.status && okrData.status !== existing.status) {
      console.log(`[updateOKR] 状态转换: ${existing.status} -> ${okrData.status}`);
      
      // 验证状态转换是否允许
      if (!canTransition(existing.status as OKRStatus, okrData.status as OKRStatus)) {
        throw new AppError(
          ErrorCode.INVALID_STATUS_TRANSITION,
          `不允许从 ${existing.status} 转换到 ${okrData.status}`,
          400
        );
      }
      
      // 检查是否有 L2/L3 审批人
      const hasL2Approver = !!existing.approver_l2_role;
      const hasL3Approver = !!existing.approver_l3_role;
      
      // 验证前置条件
      const validation = validateStatusTransition({
        okr: {
          status: existing.status as OKRStatus,
          totalScore: existing.totalScore,
          overallSelfAssessment: existing.overallSelfAssessment,
          approver_l2_role: existing.approver_l2_role,
          approver_l3_role: existing.approver_l3_role
        },
        newStatus: okrData.status as OKRStatus,
        hasL2Approver,
        hasL3Approver
      });
      
      if (!validation.valid) {
        throw new AppError(ErrorCode.INVALID_STATUS_TRANSITION, validation.reason || '状态转换验证失败', 400);
      }
    }
    
    // 验证权重（如果有更新且不是空数组）
    if (okrData.objectives && Array.isArray(okrData.objectives) && okrData.objectives.length > 0) {
      const weightValidation = validateWeights(okrData);
      if (!weightValidation.valid) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, weightValidation.reason || '权重验证失败', 400);
      }
    }
    
    if (okrData.status && okrData.status !== existing.status) {
      if (existing.status === OKRStatus.DRAFT && okrData.status === OKRStatus.PENDING_MANAGER) {
        okrData.statusRejectReason = null;
      }
      if (existing.status === OKRStatus.PUBLISHED && okrData.status === OKRStatus.PENDING_ASSESSMENT_APPROVAL) {
        okrData.statusRejectReason = null;
      }
    }

    console.log(`[updateOKR] 开始执行数据库更新`);
    
    // 更新 OKR（包含版本控制）
    const okr = await OKRModel.update(id, okrData, userId, okrData.version);
    
    console.log(`[updateOKR] 数据库更新完成，新状态: ${okr.status}`);
    
    // 记录日志
    const user = await UserModel.findById(userId);
    await OperationLogModel.create({
      id: `log-${Date.now()}`,
      userId,
      userName: user?.name || 'Unknown',
      action: 'UPDATE_OKR',
      module: 'OKR',
      details: `更新 OKR: ${okr.title}${okrData.status ? ` (状态: ${existing.status} -> ${okrData.status})` : ''}`,
      ip: req.ip || '',
      timestamp: new Date().toISOString()
    });
    
    console.log(`[updateOKR] 更新完成，返回响应`);
    res.json(createSuccessResponse({ okr }));
  } catch (error) {
    if (error instanceof AppError) {
      console.error(`[updateOKR] AppError: ${error.message}, statusCode: ${error.statusCode}`);
      // 直接返回错误响应，而不是抛出
      return res.status(error.statusCode).json(createErrorResponse(error));
    }
    if (error instanceof Error && error.message.includes('版本冲突')) {
      console.error(`[updateOKR] 版本冲突: ${error.message}`);
      const versionError = new AppError(ErrorCode.VERSION_CONFLICT, error.message, 409);
      return res.status(409).json(createErrorResponse(versionError));
    }
    console.error('[updateOKR] 未知错误:', error);
    const internalError = new AppError(ErrorCode.INTERNAL_ERROR, '服务器错误', 500);
    return res.status(500).json(createErrorResponse(internalError));
  }
};

export const deleteOKR = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.userId!;
    
    const okr = await OKRModel.findById(id);
    if (!okr) {
      throw new AppError(ErrorCode.OKR_NOT_FOUND, 'OKR 不存在', 404);
    }
    
    await OKRModel.delete(id);
    
    // 记录日志
    const user = await UserModel.findById(userId);
    await OperationLogModel.create({
      id: `log-${Date.now()}`,
      userId,
      userName: user?.name || 'Unknown',
      action: 'DELETE_OKR',
      module: 'OKR',
      details: `删除 OKR: ${okr.title}`,
      ip: req.ip || '',
      timestamp: new Date().toISOString()
    });
    
    res.json(createSuccessResponse());
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    console.error('Delete OKR error:', error);
    throw new AppError(ErrorCode.INTERNAL_ERROR, '服务器错误', 500);
  }
};

export const updateOKRStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.userId!;
    const { status, version, statusRejectReason: bodyRejectReason, ...otherData } = req.body;
    const reasonTrim = typeof bodyRejectReason === 'string' ? bodyRejectReason.trim() : '';
    
    if (!status) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, '状态不能为空', 400);
    }
    
    const okr = await OKRModel.findById(id);
    if (!okr) {
      throw new AppError(ErrorCode.OKR_NOT_FOUND, 'OKR 不存在', 404);
    }
    
    const isAdmin = req.userRole === 'ADMIN';
    const isResetToDraft = status === OKRStatus.DRAFT;

    // 验证状态转换 (管理员重置为草稿时允许绕过严格校验)
    if (!(isAdmin && isResetToDraft) && !canTransition(okr.status as OKRStatus, status as OKRStatus)) {
      throw new AppError(
        ErrorCode.INVALID_STATUS_TRANSITION,
        `不允许从 ${okr.status} 转换到 ${status}`,
        400
      );
    }
    
    // 检查是否有 L2/L3 审批人
    const hasL2Approver = !!okr.approver_l2_role;
    const hasL3Approver = !!okr.approver_l3_role;
    
    // 验证前置条件 (管理员重置为草稿时允许绕过)
    if (!(isAdmin && isResetToDraft)) {
      const validation = validateStatusTransition({
        okr: {
          status: okr.status as OKRStatus,
          totalScore: okr.totalScore,
          overallSelfAssessment: okr.overallSelfAssessment,
          approver_l2_role: okr.approver_l2_role,
          approver_l3_role: okr.approver_l3_role
        },
        newStatus: status as OKRStatus,
        hasL2Approver,
        hasL3Approver
      });
      
      if (!validation.valid) {
        throw new AppError(ErrorCode.INVALID_STATUS_TRANSITION, validation.reason || '状态转换验证失败', 400);
      }
    }
    
    const updateData: any = { status, ...otherData };
    delete updateData.statusRejectReason;

    if (shouldClearStatusRejectReason(okr.status as OKRStatus, status as OKRStatus)) {
      updateData.statusRejectReason = null;
    } else {
      const isCreationReject =
        status === OKRStatus.DRAFT &&
        (okr.status === OKRStatus.PENDING_MANAGER || okr.status === OKRStatus.PENDING_GM);

      const isAssessmentReject =
        (status === OKRStatus.PUBLISHED &&
          [
            OKRStatus.PENDING_L2_APPROVAL,
            OKRStatus.PENDING_L3_APPROVAL,
            OKRStatus.PENDING_ASSESSMENT_APPROVAL,
          ].includes(okr.status as OKRStatus)) ||
        (status === OKRStatus.PENDING_ASSESSMENT_APPROVAL &&
          okr.status === OKRStatus.PENDING_ASSESSMENT_APPROVAL);

      if (isCreationReject) {
        if (isAdmin && !reasonTrim) {
          updateData.statusRejectReason = null;
        } else if (!reasonTrim) {
          throw new AppError(ErrorCode.VALIDATION_ERROR, '请填写驳回理由', 400);
        } else {
          updateData.statusRejectReason = reasonTrim;
        }
      } else if (isAssessmentReject) {
        if (!reasonTrim) {
          throw new AppError(ErrorCode.VALIDATION_ERROR, '请填写驳回理由', 400);
        }
        updateData.statusRejectReason = reasonTrim;
      } else if (isAdmin && isResetToDraft && !isCreationReject) {
        updateData.statusRejectReason = reasonTrim || null;
      }
    }

    // 如果重置为草稿，强制清除绩效归档标记和评分，允许重新编辑
    if (isResetToDraft) {
      updateData.isPerformanceArchived = false;
      updateData.totalScore = null;
      updateData.finalGrade = null;
    }

    const updatedOKR = await OKRModel.update(id, updateData, userId, version);
    
    // 记录日志
    const user = await UserModel.findById(userId);
    await OperationLogModel.create({
      id: `log-${Date.now()}`,
      userId,
      userName: user?.name || 'Unknown',
      action: 'UPDATE_OKR_STATUS',
      module: 'OKR',
      details: `更新 OKR 状态: ${okr.status} -> ${status}`,
      ip: req.ip || '',
      timestamp: new Date().toISOString()
    });
    
    res.json(createSuccessResponse({ okr: updatedOKR }));
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error;
    }
    if (error.message && error.message.includes('版本冲突')) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, '版本冲突，请刷新后重试', 409);
    }
    console.error('Update OKR status error:', error);
    throw new AppError(ErrorCode.INTERNAL_ERROR, '服务器错误', 500);
  }
};

/**
 * 移动“我的 OKR”卡片优先级：与相邻 OKR 交换 display_order。
 * - direction=up：向上（交换到前一位）
 * - direction=down：向下（交换到后一位）
 *
 * 兼容管理员“切换视角/预览模式”：
 * - 若请求体带 targetUserId，则只有系统管理员可对其他用户的 OKR 进行移动
 */
export const moveOKRPriority = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tokenUserId = req.userId!;
    const tokenUserRole = req.userRole;
    const { direction, targetUserId } = req.body || {};

    const effectiveUserId = targetUserId || tokenUserId;
    if (effectiveUserId !== tokenUserId && tokenUserRole !== 'ADMIN') {
      throw new AppError(ErrorCode.FORBIDDEN, '只有系统管理员可以为其他用户调整 OKR 优先级', 403);
    }

    if (direction !== 'up' && direction !== 'down') {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'direction 必须为 up 或 down', 400);
    }

    const updated = await withTransaction(async (client) => {
      // 锁定目标 OKR，避免并发移动导致顺序错乱
      const targetRes = await client.query(
        `SELECT id, user_id, display_order
         FROM okrs
         WHERE id = $1 AND user_id = $2
         FOR UPDATE`,
        [id, effectiveUserId]
      );

      if (targetRes.rows.length === 0) {
        return null;
      }

      const target = targetRes.rows[0];
      const targetOrder = target.display_order as number;

      const neighborRes = await client.query(
        direction === 'up'
          ? `SELECT id, display_order
             FROM okrs
             WHERE user_id = $1 AND display_order < $2
             ORDER BY display_order DESC, created_at DESC, id DESC
             LIMIT 1
             FOR UPDATE`
          : `SELECT id, display_order
             FROM okrs
             WHERE user_id = $1 AND display_order > $2
             ORDER BY display_order ASC, created_at DESC, id DESC
             LIMIT 1
             FOR UPDATE`,
        direction === 'up' ? [effectiveUserId, targetOrder] : [effectiveUserId, targetOrder]
      );

      if (neighborRes.rows.length === 0) {
        return target;
      }

      const neighbor = neighborRes.rows[0];
      const neighborId = neighbor.id as string;
      const neighborOrder = neighbor.display_order as number;

      // 交换两个 display_order
      await client.query(`UPDATE okrs SET display_order = $1 WHERE id = $2`, [neighborOrder, id]);
      await client.query(`UPDATE okrs SET display_order = $1 WHERE id = $2`, [targetOrder, neighborId]);

      const updatedRes = await client.query(
        `SELECT id, user_id, display_order, created_at
         FROM okrs
         WHERE id = $1`,
        [id]
      );
      return updatedRes.rows[0] || target;
    });

    if (!updated) {
      throw new AppError(ErrorCode.OKR_NOT_FOUND, 'OKR 不存在或不属于该用户', 404);
    }

    await OperationLogModel.create({
      id: `log-${Date.now()}`,
      userId: tokenUserId,
      userName: (await UserModel.findById(tokenUserId))?.name || 'Unknown',
      action: 'MOVE_OKR_PRIORITY',
      module: 'OKR',
      details: `移动 OKR(${id}) 优先级：${direction}`,
      ip: req.ip || '',
      timestamp: new Date().toISOString()
    });

    return res.json(createSuccessResponse({ okrId: id, updated }));
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    throw new AppError(ErrorCode.INTERNAL_ERROR, error?.message || '调整 OKR 优先级失败', 500);
  }
};

/**
 * 合并多个 OKR 为一个（前端“我的 OKR”多选整合场景）
 *
 * 设计目标：
 * - 新建一个目标 OKR（DRAFT）
 * - 将被合并的源 OKR 直接删除（合并成功后原内容消失，避免多次审批）
 * - 新 OKR 的 objectives 为源 OKR objectives 的扁平化，并按总权重重新缩放到 100
 */
export const mergeOKRs = async (req: Request, res: Response) => {
  try {
    const tokenUserId = req.userId!;
    const tokenUserRole = req.userRole;

    const { okrIds, targetUserId } = req.body || {};
    if (!Array.isArray(okrIds) || okrIds.length < 2) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, '请至少选择 2 个 OKR 进行合并', 400);
    }

    const effectiveUserId: string = targetUserId || tokenUserId;
    if (effectiveUserId !== tokenUserId && tokenUserRole !== 'ADMIN') {
      throw new AppError(ErrorCode.FORBIDDEN, '只有系统管理员可以为其他用户合并 OKR', 403);
    }

    const uniqIds = Array.from(new Set(okrIds)).filter(Boolean);
    const okrs = await Promise.all(
      uniqIds.map(async (id) => {
        const item = await OKRModel.findById(id);
        return item;
      })
    );

    if (okrs.some((o) => !o)) {
      throw new AppError(ErrorCode.OKR_NOT_FOUND, '存在无法找到的 OKR', 404);
    }

    const typedOKRs = okrs as OKR[];

    // 校验归属和状态
    for (const o of typedOKRs) {
      if (o.userId !== effectiveUserId) {
        throw new AppError(ErrorCode.FORBIDDEN, '只能合并属于当前用户的 OKR', 403);
      }
      if (o.status !== OKRStatus.DRAFT) {
        throw new AppError(
          ErrorCode.VALIDATION_ERROR,
          '只能合并草稿状态（DRAFT）的 OKR',
          400
        );
      }
    }

    // 合并的一致性：如 level/period 不同，则以第一个 OKR 为准继续合并。
    // 这样前端“多选合并”的体验更符合直觉。
    const first = typedOKRs[0];

    // 扁平化 objectives，并缩放 objective.weight 总和到 100
    const mergedObjectivesRaw = typedOKRs.flatMap((o) => o.objectives || []);
    if (mergedObjectivesRaw.length === 0) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, '未识别到可合并的 objectives', 400);
    }

    const totalObjWeight = mergedObjectivesRaw.reduce((sum, obj) => sum + (Number(obj.weight) || 0), 0);
    if (totalObjWeight <= 0) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, '合并后的目标权重总和无效', 400);
    }

    const factor = 100 / totalObjWeight;

    const mergedObjectives = mergedObjectivesRaw.map((obj) => ({
      ...obj,
      // 为避免与旧 OKR id 冲突，给 objective/kr 重新生成 id（只影响前端 key，后端不依赖其唯一性）
      id: `obj-merged-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      weight: (Number(obj.weight) || 0) * factor,
      keyResults: (obj.keyResults || []).map((kr) => ({
        ...kr,
        id: `kr-merged-${Date.now()}-${Math.random().toString(36).slice(2)}`
      }))
    }));

    // Peer Reviewers：取并集，避免合并后丢失已邀请的协作方
    const mergedPeerReviewers = Array.from(
      new Set(typedOKRs.flatMap((o) => o.peerReviewers || []))
    );

    // 重新生成 title
    const title = `整合 OKR（${typedOKRs.length} 个）`;

    const currentUser = await UserModel.findById(effectiveUserId);
    if (!currentUser) {
      throw new AppError(ErrorCode.USER_NOT_FOUND, '用户不存在', 404);
    }

    const workflowSnapshot = await getWorkflowSnapshot(currentUser.role as string);

    const newOKR = await OKRModel.create(
      {
        userId: effectiveUserId,
        title,
        period: first.period,
        level: first.level as OKRLevel,
        status: OKRStatus.DRAFT,
        objectives: mergedObjectives as any,
        peerReviewers: mergedPeerReviewers,
        approver_l1_role: workflowSnapshot.approver_l1_role,
        approver_l2_role: workflowSnapshot.approver_l2_role,
        approver_l3_role: workflowSnapshot.approver_l3_role,
        cc_roles: workflowSnapshot.cc_roles
      },
      effectiveUserId
    );

    // 删除源 OKR，避免再次审批（同时满足“原内容删除”的需求）
    for (const src of typedOKRs) {
      await OKRModel.delete(src.id);
    }

    // 写日志
    await OperationLogModel.create({
      id: `log-${Date.now()}`,
      userId: tokenUserId,
      userName: (await UserModel.findById(tokenUserId))?.name || 'Unknown',
      action: 'MERGE_OKR',
      module: 'OKR',
      details: `合并 OKR: ${typedOKRs.map((o) => o.id).join(', ')} -> ${newOKR.id}`,
      ip: req.ip || '',
      timestamp: new Date().toISOString()
    });

    return res.json(createSuccessResponse({ okr: newOKR }));
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    throw new AppError(ErrorCode.INTERNAL_ERROR, error?.message || '合并 OKR 失败', 500);
  }
};

export const approveOKR = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.userId!;
    const { action } = req.body; // 'approve' or 'reject'
    
    const okr = await OKRModel.findById(id);
    if (!okr) {
      throw new AppError(ErrorCode.OKR_NOT_FOUND, 'OKR 不存在', 404);
    }
    
    const user = await UserModel.findById(userId);
    if (!user) {
      throw new AppError(ErrorCode.USER_NOT_FOUND, '用户不存在', 404);
    }
    
    // 检查权限
    const permission = await checkApprovalPermission(
      { id: userId, role: user.role, department: user.department || null },
      { 
        id, 
        user_id: okr.userId,
        status: okr.status as OKRStatus,
        approver_l1_role: okr.approver_l1_role || null,
        approver_l2_role: okr.approver_l2_role || null,
        approver_l3_role: okr.approver_l3_role || null,
        department: okr.department || null
      },
      action
    );
    
    if (!permission.canApprove && action === 'approve') {
      throw new AppError(ErrorCode.NO_APPROVAL_PERMISSION, permission.reason || '没有审批权限', 403);
    }
    
    if (!permission.canReject && action === 'reject') {
      throw new AppError(ErrorCode.NO_APPROVAL_PERMISSION, permission.reason || '没有驳回权限', 403);
    }
    
    // 确定下一个状态
    let nextStatus: OKRStatus;
    const currentStatus = okr.status as OKRStatus;
    
    if (action === 'reject') {
      // 驳回：根据当前状态返回到上一个状态
      if (currentStatus === OKRStatus.PENDING_MANAGER || currentStatus === OKRStatus.PENDING_ASSESSMENT_APPROVAL) {
        nextStatus = OKRStatus.DRAFT;
      } else if (currentStatus === OKRStatus.PENDING_GM || currentStatus === OKRStatus.PENDING_L2_APPROVAL) {
        nextStatus = OKRStatus.PENDING_MANAGER;
      } else if (currentStatus === OKRStatus.PENDING_L3_APPROVAL) {
        nextStatus = OKRStatus.PENDING_L2_APPROVAL;
      } else {
        throw new AppError(ErrorCode.INVALID_STATUS_TRANSITION, '当前状态不允许驳回', 400);
      }
    } else {
      // 审批通过：根据当前状态和审批级别确定下一个状态
      if (currentStatus === OKRStatus.PENDING_MANAGER) {
        nextStatus = okr.approver_l2_role ? OKRStatus.PENDING_GM : OKRStatus.PUBLISHED;
      } else if (currentStatus === OKRStatus.PENDING_GM) {
        nextStatus = OKRStatus.PUBLISHED;
      } else if (currentStatus === OKRStatus.PENDING_ASSESSMENT_APPROVAL) {
        nextStatus = okr.approver_l2_role ? OKRStatus.PENDING_L2_APPROVAL : OKRStatus.PENDING_ARCHIVE;
      } else if (currentStatus === OKRStatus.PENDING_L2_APPROVAL) {
        nextStatus = okr.approver_l3_role ? OKRStatus.PENDING_L3_APPROVAL : OKRStatus.PENDING_ARCHIVE;
      } else if (currentStatus === OKRStatus.PENDING_L3_APPROVAL) {
        nextStatus = OKRStatus.PENDING_ARCHIVE;
      } else {
        throw new AppError(ErrorCode.INVALID_STATUS_TRANSITION, '当前状态不允许审批', 400);
      }
    }
    
    // 更新状态
    const updatedOKR = await OKRModel.updateStatus(id, nextStatus, userId);
    
    // 记录日志
    await OperationLogModel.create({
      id: `log-${Date.now()}`,
      userId,
      userName: user.name,
      action: action === 'approve' ? 'APPROVE_OKR' : 'REJECT_OKR',
      module: 'OKR',
      details: `${action === 'approve' ? '审批通过' : '驳回'} OKR: ${okr.title} (${okr.status} -> ${nextStatus})`,
      ip: req.ip || '',
      timestamp: new Date().toISOString()
    });
    
    res.json(createSuccessResponse({ okr: updatedOKR }));
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    console.error('Approve OKR error:', error);
    throw new AppError(ErrorCode.INTERNAL_ERROR, '服务器错误', 500);
  }
};

export const archiveOKR = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.userId!;
    
    const okr = await OKRModel.findById(id);
    if (!okr) {
      throw new AppError(ErrorCode.OKR_NOT_FOUND, 'OKR 不存在', 404);
    }
    
    const user = await UserModel.findById(userId);
    if (!user) {
      throw new AppError(ErrorCode.USER_NOT_FOUND, '用户不存在', 404);
    }
    
    // 检查归档权限
    const canArchive = checkArchivePermission(
      { id: userId, role: user.role, department: user.department || null },
      {
        id,
        user_id: okr.userId,
        status: okr.status as OKRStatus,
        approver_l1_role: okr.approver_l1_role || null,
        approver_l2_role: okr.approver_l2_role || null,
        approver_l3_role: okr.approver_l3_role || null,
        department: okr.department || null
      }
    );
    
    if (!canArchive) {
      throw new AppError(ErrorCode.NO_APPROVAL_PERMISSION, '没有归档权限', 403);
    }
    
    // 更新状态为 CLOSED 并标记为已归档
    const updatedOKR = await OKRModel.update(id, {
      status: OKRStatus.CLOSED,
      isPerformanceArchived: true
    }, userId);
    
    // 记录日志
    await OperationLogModel.create({
      id: `log-${Date.now()}`,
      userId,
      userName: user.name,
      action: 'ARCHIVE_OKR',
      module: 'OKR',
      details: `归档 OKR: ${okr.title}`,
      ip: req.ip || '',
      timestamp: new Date().toISOString()
    });
    
    res.json(createSuccessResponse({ okr: updatedOKR }));
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    console.error('Archive OKR error:', error);
    throw new AppError(ErrorCode.INTERNAL_ERROR, '服务器错误', 500);
  }
};
