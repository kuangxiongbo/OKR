// 状态机工具类
export enum OKRStatus {
  DRAFT = 'DRAFT',
  PENDING_MANAGER = 'PENDING_MANAGER',
  PENDING_GM = 'PENDING_GM',
  PUBLISHED = 'PUBLISHED',
  PENDING_ASSESSMENT_APPROVAL = 'PENDING_ASSESSMENT_APPROVAL',
  GRADING = 'GRADING',
  PENDING_L2_APPROVAL = 'PENDING_L2_APPROVAL',
  PENDING_L3_APPROVAL = 'PENDING_L3_APPROVAL',
  PENDING_ARCHIVE = 'PENDING_ARCHIVE',
  CLOSED = 'CLOSED'
}

// 状态转换规则
export const STATUS_TRANSITIONS: Record<OKRStatus, OKRStatus[]> = {
  [OKRStatus.DRAFT]: [OKRStatus.PENDING_MANAGER, OKRStatus.PUBLISHED],
  [OKRStatus.PENDING_MANAGER]: [OKRStatus.DRAFT, OKRStatus.PENDING_GM, OKRStatus.PUBLISHED],
  [OKRStatus.PENDING_GM]: [OKRStatus.DRAFT, OKRStatus.PUBLISHED],
  [OKRStatus.PUBLISHED]: [OKRStatus.PENDING_ASSESSMENT_APPROVAL, OKRStatus.DRAFT],
  [OKRStatus.PENDING_ASSESSMENT_APPROVAL]: [
    OKRStatus.PENDING_L2_APPROVAL,
    OKRStatus.PENDING_ARCHIVE,
    OKRStatus.PUBLISHED, // 允许驳回，退回到待提交自评状态
    OKRStatus.PENDING_ASSESSMENT_APPROVAL, // 允许驳回（状态不变，但会记录）
    OKRStatus.DRAFT // 允许管理员重置为草稿
  ],
  [OKRStatus.GRADING]: [OKRStatus.PENDING_ASSESSMENT_APPROVAL, OKRStatus.DRAFT],
  [OKRStatus.PENDING_L2_APPROVAL]: [
    OKRStatus.PENDING_L3_APPROVAL,
    OKRStatus.PENDING_ARCHIVE,
    OKRStatus.PUBLISHED, // 允许驳回，退回到待提交自评状态
    OKRStatus.DRAFT // 允许管理员重置为草稿
  ],
  [OKRStatus.PENDING_L3_APPROVAL]: [
    OKRStatus.PENDING_ARCHIVE,
    OKRStatus.PUBLISHED, // 允许驳回，退回到待提交自评状态
    OKRStatus.DRAFT // 允许管理员重置为草稿
  ],
  [OKRStatus.PENDING_ARCHIVE]: [
    OKRStatus.CLOSED,
    OKRStatus.PENDING_ASSESSMENT_APPROVAL, // 允许一票否决，退回至评分阶段
    OKRStatus.DRAFT // 允许管理员重置为草稿
  ],
  [OKRStatus.CLOSED]: [OKRStatus.DRAFT] // 允许从终态重置（仅限管理员/特权操作）
};

// 验证状态转换是否允许
export function canTransition(from: OKRStatus, to: OKRStatus): boolean {
  return STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

// 获取允许的状态转换
export function getAllowedTransitions(currentStatus: OKRStatus): OKRStatus[] {
  return STATUS_TRANSITIONS[currentStatus] ?? [];
}

// 状态转换前置条件验证
export interface StatusTransitionContext {
  okr: {
    status: OKRStatus;
    totalScore?: number | null;
    overallSelfAssessment?: { score?: number; comment?: string } | null;
    approver_l2_role?: string | null;
    approver_l3_role?: string | null;
  };
  newStatus: OKRStatus;
  hasL2Approver: boolean;
  hasL3Approver: boolean;
}

export function validateStatusTransition(context: StatusTransitionContext): {
  valid: boolean;
  reason?: string;
} {
  const { okr, newStatus } = context;
  
  // 1. 检查状态转换是否允许
  if (!canTransition(okr.status, newStatus)) {
    return { 
      valid: false, 
      reason: `不允许从 ${okr.status} 转换到 ${newStatus}` 
    };
  }
  
  // 2. 检查前置条件
  switch (newStatus) {
    case OKRStatus.PENDING_ASSESSMENT_APPROVAL:
      // 如果是驳回操作（从 PENDING_L2_APPROVAL、PENDING_L3_APPROVAL 或 PENDING_ARCHIVE 退回），不需要检查自评总结
      // 因为这是退回操作（包括一票否决），不是提交自评
      if (okr.status !== OKRStatus.PENDING_L2_APPROVAL && 
          okr.status !== OKRStatus.PENDING_L3_APPROVAL &&
          okr.status !== OKRStatus.PENDING_ARCHIVE) {
        if (!okr.overallSelfAssessment?.comment?.trim()) {
          return { 
            valid: false, 
            reason: '提交自评必须填写整体自评总结' 
          };
        }
      }
      break;
      
    case OKRStatus.PUBLISHED:
      // 如果是驳回操作（从 PENDING_ASSESSMENT_APPROVAL、PENDING_L2_APPROVAL 或 PENDING_L3_APPROVAL 退回），允许
      // 不需要检查任何前置条件，因为这是退回操作
      break;
      
    case OKRStatus.PENDING_L2_APPROVAL:
      if (!okr.totalScore && okr.totalScore !== 0) {
        return { 
          valid: false, 
          reason: '一级评分必须完成' 
        };
      }
      if (!context.hasL2Approver) {
        return { 
          valid: false, 
          reason: '没有配置二级审批人' 
        };
      }
      break;
      
    case OKRStatus.PENDING_L3_APPROVAL:
      if (!context.hasL3Approver) {
        return { 
          valid: false, 
          reason: '没有配置三级审批人' 
        };
      }
      break;
      
    case OKRStatus.PENDING_ARCHIVE:
      // 如果是从 PENDING_L2_APPROVAL 转换且没有 L3，允许
      if (okr.status === OKRStatus.PENDING_L2_APPROVAL && !context.hasL3Approver) {
        break;
      }
      // 如果是从 PENDING_L3_APPROVAL 转换，允许
      if (okr.status === OKRStatus.PENDING_L3_APPROVAL) {
        break;
      }
      // 其他情况需要完成评分
      if (!okr.totalScore && okr.totalScore !== 0) {
        return { 
          valid: false, 
          reason: '归档前必须完成评分' 
        };
      }
      break;
  }
  
  return { valid: true };
}
