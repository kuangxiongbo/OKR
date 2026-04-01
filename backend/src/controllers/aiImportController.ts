import { Request, Response } from 'express';
import { createSuccessResponse, AppError, ErrorCode } from '../utils/errors';
import { parseOKRByAI } from '../services/aiImportService';
import { UserModel } from '../models/User';
import { OKRModel } from '../models/OKR';
import { query } from '../config/database';
import { OKRStatus } from '../utils/okrStateMachine';
import { OKRLevel, Role } from '../types';

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
  if (result.rows.length === 0) return {};
  const row = result.rows[0];
  return {
    approver_l1_role: row.approver_role_l1,
    approver_l2_role: row.approver_role_l2,
    approver_l3_role: row.approver_role_l3,
    cc_roles: row.cc_roles || []
  };
}

export const importOKRByAI = async (req: Request, res: Response) => {
  try {
    const tokenUserId = req.userId!;
    const tokenUserRole = req.userRole;
    const {
      textContent,
      fileName,
      mimeType,
      imageBase64,
      imageList,
      fileBase64,
      importUserId,
      importLevel
    } = req.body || {};

    // 系统管理员在“切换视角/预览模式”下导入时，允许前端指定导入归属用户（默认仍使用 token 用户）
    const effectiveUserId = importUserId || tokenUserId;
    if (effectiveUserId !== tokenUserId && tokenUserRole !== 'ADMIN') {
      throw new AppError(ErrorCode.FORBIDDEN, '只有系统管理员可以为其他用户导入 OKR', 403);
    }
    if (!textContent && !imageBase64 && !(Array.isArray(imageList) && imageList.length > 0) && !fileBase64) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, '请提供截图或文本内容', 400);
    }

    const currentUser = await UserModel.findById(effectiveUserId);
    if (!currentUser) {
      throw new AppError(ErrorCode.USER_NOT_FOUND, '用户不存在', 404);
    }

    // 根据“当前用户可创建的 OKR 类型”推导导入 level，避免导入后类型不一致难以修正
    const executiveRoles = [Role.VP_PRODUCT, Role.VP_TECH, Role.VP_MARKET, Role.PRESIDENT];
    const isExecutive = executiveRoles.includes(currentUser.role as Role);
    const canCreateCompanyOKR = [Role.PRODUCT_GM, Role.TECH_GM, ...executiveRoles].includes(currentUser.role as Role);

    const isCadreRes = await query(
      `SELECT 1
       FROM workflows
       WHERE approver_role_l1 = $1 OR approver_role_l2 = $1
       LIMIT 1`,
      [currentUser.role]
    );
    const isManager = isCadreRes.rows.length > 0;
    const canCreateDepartmentOKR = isManager || isExecutive;
    const canCreatePersonalOKR = true;

    const allowedLevels: OKRLevel[] = [];
    if (canCreateCompanyOKR) allowedLevels.push(OKRLevel.COMPANY);
    if (canCreateDepartmentOKR) allowedLevels.push(OKRLevel.DEPARTMENT);
    if (canCreatePersonalOKR) allowedLevels.push(OKRLevel.PERSONAL);

    const pickDefaultLevel = (): OKRLevel => {
      // 与前端创建菜单一致的优先级：公司 -> 部门 -> 个人
      if (canCreateCompanyOKR) return OKRLevel.COMPANY;
      if (canCreateDepartmentOKR) return OKRLevel.DEPARTMENT;
      return OKRLevel.PERSONAL;
    };

    const requestedLevel = (importLevel || pickDefaultLevel()) as OKRLevel;
    if (!allowedLevels.includes(requestedLevel)) {
      throw new AppError(ErrorCode.FORBIDDEN, '当前用户不支持该 OKR 类型', 403);
    }

    const parsed = await parseOKRByAI({ textContent, fileName, mimeType, imageBase64, imageList, fileBase64 });
    const wf = await getWorkflowSnapshot(currentUser.role);

    // 周期修正逻辑：根据当前时间自动确定，忽略 AI 识别结果以提高准确性
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-11
    let finalPeriod = '';

    if (requestedLevel === OKRLevel.COMPANY) {
      finalPeriod = `${year} 全年`;
    } else {
      // 1-6月 (Index 0-5) 归为上半年，7-12月 (Index 6-11) 归为下半年
      finalPeriod = month <= 5 ? `${year} 上半年` : `${year} 下半年`;
    }

    const okr = await OKRModel.create(
      {
        userId: effectiveUserId,
        title: parsed.title,
        period: finalPeriod,
        level: requestedLevel,
        status: OKRStatus.DRAFT as any,
        objectives: parsed.objectives as any,
        approver_l1_role: wf.approver_l1_role,
        approver_l2_role: wf.approver_l2_role,
        approver_l3_role: wf.approver_l3_role,
        cc_roles: wf.cc_roles
      },
      effectiveUserId
    );

    return res.json(createSuccessResponse({ okr, parsed }));
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    throw new AppError(ErrorCode.INTERNAL_ERROR, error?.message || 'AI 导入失败', 500);
  }
};
