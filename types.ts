
export enum Role {
  EMPLOYEE = 'EMPLOYEE', // 普通员工 (保留用于兼容)
  RD_EMPLOYEE = 'RD_EMPLOYEE', // 研发员工
  QA_EMPLOYEE = 'QA_EMPLOYEE', // 测试员工
  QA_MANAGER = 'QA_MANAGER', // 测试负责人 (业务线内)
  PRODUCT_EMPLOYEE = 'PRODUCT_EMPLOYEE', // 产品员工
  PROJECT_MANAGER = 'PROJECT_MANAGER', // 项目管理员
  
  TECH_MANAGER = 'TECH_MANAGER', // 技术经理 (新增)

  TECH_EXPERT = 'TECH_EXPERT', // 技术专家
  GENERAL_OFFICE_DIRECTOR = 'GENERAL_OFFICE_DIRECTOR', // 总体办主任

  HRBP = 'HRBP', // HRBP
  BUSINESS_HEAD = 'BUSINESS_HEAD', // 业务线负责人
  TECH_HEAD = 'TECH_HEAD', // 业务线研发负责人
  QA_HEAD = 'QA_HEAD', // 测试部负责人 (职能线)
  PRODUCT_GM = 'PRODUCT_GM', // 产品总经理
  TECH_GM = 'TECH_GM', // 研发总经理
  QUALITY_GM = 'QUALITY_GM', // 质量部总经理
  PROJECT_DEPT_GM = 'PROJECT_DEPT_GM', // 项目部总经理
  
  // New Executive Roles
  VP_PRODUCT = 'VP_PRODUCT', // 副总裁（产品）
  VP_TECH = 'VP_TECH',       // 副总裁（技术）
  VP_MARKET = 'VP_MARKET',   // 副总裁（市场）
  PRESIDENT = 'PRESIDENT',   // 总裁
  
  ADMIN = 'ADMIN' // 系统管理员
}

export const ROLE_NAMES: Record<string, string> = {
  [Role.EMPLOYEE]: '普通员工',
  [Role.RD_EMPLOYEE]: '研发员工',
  [Role.QA_EMPLOYEE]: '测试员工',
  [Role.QA_MANAGER]: '测试负责人', // 业务线测试主管
  [Role.PRODUCT_EMPLOYEE]: '产品员工',
  [Role.PROJECT_MANAGER]: '项目管理员',
  
  [Role.TECH_MANAGER]: '技术经理',

  [Role.TECH_EXPERT]: '技术专家',
  [Role.GENERAL_OFFICE_DIRECTOR]: '总体办主任',
  
  [Role.HRBP]: 'HRBP',
  [Role.BUSINESS_HEAD]: '业务负责人',
  [Role.TECH_HEAD]: '研发负责人',
  [Role.QA_HEAD]: '测试部负责人', // 职能部门主管
  [Role.PRODUCT_GM]: '产品总经理',
  [Role.TECH_GM]: '研发总经理',
  [Role.QUALITY_GM]: '质量部总经理',
  [Role.PROJECT_DEPT_GM]: '项目部总经理',

  [Role.VP_PRODUCT]: '副总裁（产品）',
  [Role.VP_TECH]: '副总裁（技术）',
  [Role.VP_MARKET]: '副总裁（市场）',
  [Role.PRESIDENT]: '总裁',

  [Role.ADMIN]: '系统管理员'
};

export enum OKRLevel {
  COMPANY = 'COMPANY',
  DEPARTMENT = 'DEPARTMENT',
  PERSONAL = 'PERSONAL'
}

export enum OKRStatus {
  DRAFT = 'DRAFT',
  PENDING_MANAGER = 'PENDING_MANAGER', // 等待一级审批 (创建)
  PENDING_GM = 'PENDING_GM',           // 等待二级审批 (创建)
  PUBLISHED = 'PUBLISHED',             // 已发布 (执行中/待自评)
  PENDING_ASSESSMENT_APPROVAL = 'PENDING_ASSESSMENT_APPROVAL', // 自评提交，待一级主管评分
  GRADING = 'GRADING',                 // 评分中 (中间状态，通常用于草稿)
  PENDING_L2_APPROVAL = 'PENDING_L2_APPROVAL', // 一级评分完成，待二级审批确认
  PENDING_L3_APPROVAL = 'PENDING_L3_APPROVAL', // 二级审批完成，待三级审批确认 (新增)
  PENDING_ARCHIVE = 'PENDING_ARCHIVE', // 审批完成，等待 HRBP/管理员 归档
  CLOSED = 'CLOSED'                    // 已归档 (员工可见结果)
}

export enum FinalGrade {
  S = 'S',
  A = 'A',
  B = 'B',
  C = 'C',
  PENDING = '待定'
}

// 组织架构定义 (Default)
export const DEPARTMENTS = [
  '密码服务业务线',
  '数据安全业务线-1组',
  '数据安全业务线-2组',
  '基础业务线',
  '生态业务线',
  '产品部',
  '研发部',
  '总体办',
  '质量部',
  '项目部',
  'HR部门',
  '总裁办' 
] as const;

export interface ApprovalWorkflow {
  targetRole: Role | string; // 针对哪种角色的员工设置的流程
  ccRoles?: (Role | string)[]; // 默认抄送/协作角色 (Array)
  approverRoleL1: Role | string; // 一级审批人角色
  approverRoleL2: Role | string | null; // 二级审批人角色 (可为空)
  approverRoleL3?: Role | string | null; // 三级审批人角色 (可为空)
}

export interface GradeConfiguration {
    grade: FinalGrade;
    minScore: number;
    maxScore: number; // Inclusive
    description?: string;
    quota: number; // Percentage (0-100)
}

export interface User {
  id: string;
  name: string;
  account?: string; // 登录账号
  password?: string; // 密码
  role: Role | string;
  department: string;
  avatar: string;
  source?: 'LOCAL' | 'WECOM' | 'SSO';
  email?: string;
  ssoConnected?: boolean;
  isPrimaryApprover?: boolean; // New: First Responsible Person for the team/role
}

export interface OperationLog {
    id: string;
    userId: string;
    userName: string;
    action: string;      // e.g. 'LOGIN', 'CREATE_USER', 'DELETE_OKR'
    module: string;      // e.g. 'AUTH', 'USER_MGMT', 'OKR_MGMT'
    details: string;
    timestamp: string;
    ip?: string;
}

export interface WeComConfig {
    corpId: string;
    agentId: string;
    secret: string;
    enabled: boolean;
}

export interface SSOConfig {
    metadataUrl: string;
    clientId: string;
    clientSecret: string;
    enabled: boolean;
}

export interface KeyResult {
  id: string;
  content: string;
  weight: number; 
  selfScore?: number; // 0-100
  selfComment?: string; // KR Level Self Comment
  managerScore?: number; // 0-100
  gmScore?: number; // 0-100
  managerComment?: string; // New: Manager specific comment on KR
}

export interface Objective {
  id: string;
  content: string;
  weight: number; 
  keyResults: KeyResult[];
  selfScore?: number; // Objective Level Self Score
  selfComment?: string; // Objective Level Self Comment
  managerScore?: number; // New: Manager Score for Objective (Calculated or Overridden)
  managerComment?: string; // New: Manager Comment for Objective
}

export interface OverallAssessment {
    score: number;
    comment: string;
}

export interface PeerFeedback {
    author: string;
    score?: number;
    comment: string;
}

export interface CCFeedback {
    userId: string;
    userName: string;
    role: string;
    comment: string;
    recommendedGrade?: FinalGrade;
    createdAt: string;
}

export interface OKR {
  id: string;
  userId: string;
  userName: string;
  level: OKRLevel;
  department?: string; 
  title: string;
  period: string; 
  status: OKRStatus;
  objectives: Objective[];
  
  parentOKRId?: string; // Link to Parent OKR (Alignment)

  // Overall Assessment (Mandatory for Self Assessment)
  overallSelfAssessment?: OverallAssessment;
  
  // Manager Overall Assessment (Added)
  overallManagerAssessment?: OverallAssessment;

  finalGrade?: FinalGrade;
  totalScore?: number; // Calculated total score
  createdAt: string;
  managerApprovedAt?: string;
  gmApprovedAt?: string;
  peerReviewers?: string[];
  peerFeedback?: PeerFeedback[]; // 360 Feedback
  ccFeedback?: CCFeedback[]; // CC Role Feedback
  adjustmentReason?: string; // L2/L3/Cross-level adjustment reason
  
  isPerformanceArchived?: boolean; // New: Indicates performance assessment is finalized independently of OKR status
}

// INITIAL_USERS remains the same (omitted for brevity as it is just constant data)
export const INITIAL_USERS: User[] = [
  { id: 'u1', name: '王小工', account: 'wangxiaogong', password: 'Gw1admin.', role: Role.RD_EMPLOYEE, department: '密码服务业务线', avatar: 'https://picsum.photos/id/1011/200/200', source: 'LOCAL' },
  { id: 'u2', name: '李研发', account: 'liyanfa', password: 'Gw1admin.', role: Role.TECH_HEAD, department: '密码服务业务线', avatar: 'https://picsum.photos/id/1012/200/200', source: 'LOCAL' },
  { id: 'u3', name: '张业务', account: 'zhangyewu', password: 'Gw1admin.', role: Role.BUSINESS_HEAD, department: '密码服务业务线', avatar: 'https://picsum.photos/id/1013/200/200', source: 'LOCAL' },
  { id: 'u4', name: '赵产总', account: 'zhaochanzong', password: 'Gw1admin.', role: Role.PRODUCT_GM, department: '产品部', avatar: 'https://picsum.photos/id/1025/200/200', source: 'LOCAL' },
  { id: 'u5', name: '孙研总', account: 'sunyanzong', password: 'Gw1admin.', role: Role.TECH_GM, department: '研发部', avatar: 'https://picsum.photos/id/1003/200/200', source: 'LOCAL' },
  
  // Executive Roles
  { id: 'u6', name: '钱副总(产品)', account: 'qianproduct', password: 'Gw1admin.', role: Role.VP_PRODUCT, department: '总裁办', avatar: 'https://ui-avatars.com/api/?name=VP+Product&background=random', source: 'LOCAL' },
  { id: 'u18', name: '孙副总(技术)', account: 'suntech', password: 'Gw1admin.', role: Role.VP_TECH, department: '总裁办', avatar: 'https://ui-avatars.com/api/?name=VP+Tech&background=random', source: 'LOCAL' },
  { id: 'u19', name: '李副总(市场)', account: 'limarket', password: 'Gw1admin.', role: Role.VP_MARKET, department: '总裁办', avatar: 'https://ui-avatars.com/api/?name=VP+Market&background=random', source: 'LOCAL' },
  { id: 'u20', name: '周总裁', account: 'zhouceo', password: 'Gw1admin.', role: Role.PRESIDENT, department: '总裁办', avatar: 'https://ui-avatars.com/api/?name=CEO&background=000&color=fff', source: 'LOCAL' },

  { id: 'u7', name: '周HRBP', account: 'zhouhrbp', password: 'Gw1admin.', role: Role.HRBP, department: 'HR部门', avatar: 'https://picsum.photos/id/1027/200/200', source: 'LOCAL' },
  { id: 'u8', name: '系统管理员', account: 'admin', password: 'Gw1admin.', role: Role.ADMIN, department: '系统管理组', avatar: 'https://ui-avatars.com/api/?name=Admin&background=000&color=fff', source: 'LOCAL' },
  { id: 'u9', name: '郑产品', account: 'zhengchanpin', password: 'Gw1admin.', role: Role.PRODUCT_EMPLOYEE, department: '密码服务业务线', avatar: 'https://ui-avatars.com/api/?name=Product+User&background=random', source: 'LOCAL' },
  
  // 数据安全业务线 1 Staff
  { id: 'u10', name: '吴研发', account: 'wuyanfa', password: 'Gw1admin.', role: Role.RD_EMPLOYEE, department: '数据安全业务线-1组', avatar: 'https://ui-avatars.com/api/?name=Dev+User&background=random', source: 'LOCAL' },
  { id: 'u21', name: '钱数安', account: 'qianshuan', password: 'Gw1admin.', role: Role.BUSINESS_HEAD, department: '数据安全业务线-1组', avatar: 'https://ui-avatars.com/api/?name=DS+Biz&background=random', source: 'LOCAL' },
  { id: 'u22', name: '赵数研', account: 'zhaoshuyan', password: 'Gw1admin.', role: Role.TECH_HEAD, department: '数据安全业务线-1组', avatar: 'https://ui-avatars.com/api/?name=DS+Tech&background=random', source: 'LOCAL' },
  { id: 'u23', name: '孙数产', account: 'sunshuchan', password: 'Gw1admin.', role: Role.PRODUCT_EMPLOYEE, department: '数据安全业务线-1组', avatar: 'https://ui-avatars.com/api/?name=DS+Prod&background=random', source: 'LOCAL' },
  { id: 'u24', name: '李数测', account: 'lishuce', password: 'Gw1admin.', role: Role.QA_EMPLOYEE, department: '数据安全业务线-1组', avatar: 'https://ui-avatars.com/api/?name=DS+QA&background=random', source: 'LOCAL' },
  { id: 'u25', name: '周数项', account: 'zhoushuxiang', password: 'Gw1admin.', role: Role.PROJECT_MANAGER, department: '数据安全业务线-1组', avatar: 'https://ui-avatars.com/api/?name=DS+PM&background=random', source: 'LOCAL' },
  { id: 'u26', name: '吴数头', account: 'wushutou', password: 'Gw1admin.', role: Role.QA_MANAGER, department: '数据安全业务线-1组', avatar: 'https://ui-avatars.com/api/?name=DS+QAMgr&background=random', source: 'LOCAL' },

  { id: 'u11', name: '陈测试', account: 'chenteshi', password: 'Gw1admin.', role: Role.QA_EMPLOYEE, department: '密码服务业务线', avatar: 'https://ui-avatars.com/api/?name=QA+User&background=random', source: 'LOCAL' },
  { id: 'u12', name: '冯项目', account: 'fengxiangmu', password: 'Gw1admin.', role: Role.PROJECT_MANAGER, department: '密码服务业务线', avatar: 'https://ui-avatars.com/api/?name=PM+User&background=random', source: 'LOCAL' },
  { id: 'u13', name: '赵专家', account: 'zhaozhuanjia', password: 'Gw1admin.', role: Role.TECH_EXPERT, department: '总体办', avatar: 'https://ui-avatars.com/api/?name=Expert&background=random', source: 'LOCAL' },
  { id: 'u14', name: '孙主任', account: 'sunzhuren', password: 'Gw1admin.', role: Role.GENERAL_OFFICE_DIRECTOR, department: '总体办', avatar: 'https://ui-avatars.com/api/?name=Director&background=random', source: 'LOCAL' },
  { id: 'u15', name: '吴质总', account: 'wuzhizong', password: 'Gw1admin.', role: Role.QUALITY_GM, department: '质量部', avatar: 'https://ui-avatars.com/api/?name=Qual+GM&background=random', source: 'LOCAL' },
  { id: 'u16', name: '郑项总', account: 'zhengxiangzong', password: 'Gw1admin.', role: Role.PROJECT_DEPT_GM, department: '项目部', avatar: 'https://ui-avatars.com/api/?name=Proj+GM&background=random', source: 'LOCAL' },
  { id: 'u27', name: '周测主', account: 'zhoucezhu', password: 'Gw1admin.', role: Role.QA_HEAD, department: '密码服务业务线', avatar: 'https://ui-avatars.com/api/?name=QA+Mgr&background=random', source: 'LOCAL' },
  
  // Added a Tech Manager for demo purposes
  { id: 'u28', name: '钱技经', account: 'qianjijing', password: 'Gw1admin.', role: Role.TECH_MANAGER, department: '密码服务业务线', avatar: 'https://ui-avatars.com/api/?name=Tech+Mgr&background=random', source: 'LOCAL' },
];
