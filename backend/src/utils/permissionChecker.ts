// 权限验证工具类
import { Role } from '../types';
import { OKRStatus } from './okrStateMachine';

export interface ApprovalPermission {
  canApprove: boolean;
  canReject: boolean;
  reason?: string;
}

export interface OKR {
  id: string;
  user_id: string;
  status: OKRStatus;
  approver_l1_role?: string | null;
  approver_l2_role?: string | null;
  approver_l3_role?: string | null;
  department?: string | null;
}

export interface User {
  id: string;
  role: string;
  department?: string | null;
}

// 全局角色列表（可以跨部门审批）
const GLOBAL_ROLES = [
  Role.PRODUCT_GM,
  Role.TECH_GM,
  Role.VP_PRODUCT,
  Role.VP_TECH,
  Role.VP_MARKET,
  Role.PRESIDENT
];

export function isGlobalRole(role: string): boolean {
  return GLOBAL_ROLES.includes(role as Role);
}

export async function checkApprovalPermission(
  user: User,
  okr: OKR,
  action: 'approve' | 'reject'
): Promise<ApprovalPermission> {
  // 1. 检查当前状态是否允许审批
  const allowedStatuses = [
    OKRStatus.PENDING_MANAGER,
    OKRStatus.PENDING_GM,
    OKRStatus.PENDING_ASSESSMENT_APPROVAL,
    OKRStatus.PENDING_L2_APPROVAL,
    OKRStatus.PENDING_L3_APPROVAL
  ];
  
  if (!allowedStatuses.includes(okr.status)) {
    return { 
      canApprove: false, 
      canReject: false, 
      reason: '当前状态不允许审批' 
    };
  }
  
  // 2. 管理员特殊权限
  if (user.role === Role.ADMIN) {
    return { canApprove: true, canReject: true };
  }
  
  // 3. 根据状态和角色验证权限
  let requiredRole: string | null = null;
  let isDepartmentMatchRequired = false;
  
  switch (okr.status) {
    case OKRStatus.PENDING_MANAGER:
      requiredRole = okr.approver_l1_role || null;
      isDepartmentMatchRequired = true;
      break;
      
    case OKRStatus.PENDING_GM:
      requiredRole = okr.approver_l2_role || null;
      break;
      
    case OKRStatus.PENDING_ASSESSMENT_APPROVAL:
      requiredRole = okr.approver_l1_role || null;
      isDepartmentMatchRequired = true;
      break;
      
    case OKRStatus.PENDING_L2_APPROVAL:
      requiredRole = okr.approver_l2_role || null;
      break;
      
    case OKRStatus.PENDING_L3_APPROVAL:
      requiredRole = okr.approver_l3_role || null;
      break;
  }
  
  if (!requiredRole) {
    return { 
      canApprove: false, 
      canReject: false, 
      reason: '没有配置审批人' 
    };
  }
  
  // 4. 验证角色匹配
  if (user.role !== requiredRole) {
    return { 
      canApprove: false, 
      canReject: false, 
      reason: `不是${getRoleLabel(okr.status)}审批人` 
    };
  }
  
  // 5. 验证部门匹配（如果需要）
  if (isDepartmentMatchRequired && okr.department && user.department) {
    if (okr.department !== user.department && !isGlobalRole(user.role)) {
      return { 
        canApprove: false, 
        canReject: false, 
        reason: '部门不匹配' 
      };
    }
  }
  
  return { canApprove: true, canReject: true };
}

function getRoleLabel(status: OKRStatus): string {
  switch (status) {
    case OKRStatus.PENDING_MANAGER:
    case OKRStatus.PENDING_ASSESSMENT_APPROVAL:
      return '一级';
    case OKRStatus.PENDING_GM:
    case OKRStatus.PENDING_L2_APPROVAL:
      return '二级';
    case OKRStatus.PENDING_L3_APPROVAL:
      return '三级';
    default:
      return '';
  }
}

// 检查归档权限
export function checkArchivePermission(user: User, okr: OKR): boolean {
  if (user.role === Role.ADMIN) {
    return true;
  }
  
  if (user.role === Role.HRBP && okr.status === OKRStatus.PENDING_ARCHIVE) {
    return true;
  }
  
  return false;
}
