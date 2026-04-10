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

// 组织架构定义：按业务线对应
export const DEPARTMENTS = [
  '密码服务线',
  '数据安全线-1组',
  '数据安全线-2组',
  '基础设施线',
  '生态合作线',
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

// 后端 User 接口：包含 password、source(WECHAT)、ssoAttributes 等后端专用字段
export interface User {
  id: string;
  name: string;
  account?: string; // 登录账号
  password?: string | null; // 密码 (后端可存储哈希或 null)
  role: Role | string;
  department: string;
  avatar: string;
  source?: 'LOCAL' | 'WECOM' | 'SSO' | 'WECHAT';
  email?: string;
  ssoConnected?: boolean;
  isPrimaryApprover?: boolean; // First Responsible Person for the team/role
  ssoAttributes?: Record<string, unknown>; // SSO 属性 (如 SAML attributes)
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

export interface AIConfig {
  enabled: boolean;
  provider: 'LOCAL' | 'QWEN';
  local?: {
    baseUrl: string;
    apiKey?: string;
    model: string;
  };
  qwen?: {
    apiKey: string;
    model: string;
    baseUrl?: string;
  };
}

export interface KeyResult {
  id: string;
  content: string;
  weight: number;
  selfScore?: number; // 0-100
  selfComment?: string; // KR Level Self Comment
  managerScore?: number; // 0-100
  gmScore?: number; // 0-100
  managerComment?: string; // Manager specific comment on KR
}

export interface Objective {
  id: string;
  content: string;
  weight: number;
  keyResults: KeyResult[];
  selfScore?: number; // Objective Level Self Score
  selfComment?: string; // Objective Level Self Comment
  managerScore?: number; // Manager Score for Objective (Calculated or Overridden)
  managerComment?: string; // Manager Comment for Objective
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

  // 审批流程相关字段（数据库使用 snake_case）
  // 注意：前端/业务逻辑仍通过 camelCase 的 OKR 对象展示；此处为兼容后端模型映射。
  approver_l1_role?: string | null;
  approver_l2_role?: string | null;
  approver_l3_role?: string | null;
  cc_roles?: string[];

  // Overall Assessment (Mandatory for Self Assessment)
  overallSelfAssessment?: OverallAssessment;

  // Manager Overall Assessment
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
  /** 驳回理由（定稿/考核驳回），映射 status_reject_reason */
  statusRejectReason?: string | null;

  isPerformanceArchived?: boolean; // Indicates performance assessment is finalized independently of OKR status
  /**
   * 显示优先级（从上到下）：数字越小越靠前。
   * 用于“我的 OKR”手动上下调整卡片优先级。
   */
  displayOrder?: number;
  version?: number;
}

// 初始用户：按业务架构图；账号=姓全拼+名每个字的首字母@myibc.net，密码 Gw1admin.
export const INITIAL_USERS: User[] = [
  { id: 'u8', name: '系统管理员', account: 'admin', password: 'Gw1admin.', role: Role.ADMIN, department: '系统管理组', avatar: '', source: 'LOCAL' },
  { id: 'u-kuangxb', name: '匡雄波', account: 'kuangxb@myibc.net', password: 'Gw1admin.', role: Role.RD_EMPLOYEE, department: '密码服务线', avatar: '', source: 'LOCAL' },

  // 密码服务线
  { id: 'u1', name: '杜祥杰', account: 'duxj@myibc.net', password: 'Gw1admin.', role: Role.BUSINESS_HEAD, department: '密码服务线', avatar: '', source: 'LOCAL' },
  { id: 'u2', name: '姚茂洋', account: 'yaomy@myibc.net', password: 'Gw1admin.', role: Role.TECH_HEAD, department: '密码服务线', avatar: '', source: 'LOCAL' },
  { id: 'u3', name: '何曾洁', account: 'hecj@myibc.net', password: 'Gw1admin.', role: Role.PRODUCT_EMPLOYEE, department: '密码服务线', avatar: '', source: 'LOCAL' },
  { id: 'u4', name: '张健', account: 'zhangj@myibc.net', password: 'Gw1admin.', role: Role.RD_EMPLOYEE, department: '密码服务线', avatar: '', source: 'LOCAL' },
  { id: 'u5', name: '陈晓东', account: 'chenxd@myibc.net', password: 'Gw1admin.', role: Role.RD_EMPLOYEE, department: '密码服务线', avatar: '', source: 'LOCAL' },
  { id: 'u6', name: '陈刚平', account: 'chengp@myibc.net', password: 'Gw1admin.', role: Role.RD_EMPLOYEE, department: '密码服务线', avatar: '', source: 'LOCAL' },
  { id: 'u7', name: '陈岳民', account: 'chenym@myibc.net', password: 'Gw1admin.', role: Role.RD_EMPLOYEE, department: '密码服务线', avatar: '', source: 'LOCAL' },
  { id: 'u9', name: '李燕南', account: 'liyn@myibc.net', password: 'Gw1admin.', role: Role.RD_EMPLOYEE, department: '密码服务线', avatar: '', source: 'LOCAL' },
  { id: 'u10', name: '苏礼洁', account: 'sulj@myibc.net', password: 'Gw1admin.', role: Role.QA_EMPLOYEE, department: '密码服务线', avatar: '', source: 'LOCAL' },
  { id: 'u11', name: '李丹柳', account: 'lidl@myibc.net', password: 'Gw1admin.', role: Role.QA_EMPLOYEE, department: '密码服务线', avatar: '', source: 'LOCAL' },
  { id: 'u12', name: '甘玉华', account: 'ganyh@myibc.net', password: 'Gw1admin.', role: Role.QA_EMPLOYEE, department: '密码服务线', avatar: '', source: 'LOCAL' },

  // 数据安全线 - 1组
  { id: 'u13', name: '谭泽顺', account: 'tanzs@myibc.net', password: 'Gw1admin.', role: Role.BUSINESS_HEAD, department: '数据安全线-1组', avatar: '', source: 'LOCAL' },
  { id: 'u14', name: '段振亮', account: 'duanzl@myibc.net', password: 'Gw1admin.', role: Role.TECH_HEAD, department: '数据安全线-1组', avatar: '', source: 'LOCAL' },
  { id: 'u15', name: '周回香', account: 'zhouhx@myibc.net', password: 'Gw1admin.', role: Role.PROJECT_MANAGER, department: '数据安全线-1组', avatar: '', source: 'LOCAL' },
  { id: 'u16', name: '王瑾', account: 'wangj@myibc.net', password: 'Gw1admin.', role: Role.BUSINESS_HEAD, department: '数据安全线-2组', avatar: '', source: 'LOCAL' },
  { id: 'u17', name: '毛建辉', account: 'maojh@myibc.net', password: 'Gw1admin.', role: Role.TECH_HEAD, department: '数据安全线-2组', avatar: '', source: 'LOCAL' },
  { id: 'u18', name: '陈伟胜', account: 'chenws@myibc.net', password: 'Gw1admin.', role: Role.RD_EMPLOYEE, department: '数据安全线-1组', avatar: '', source: 'LOCAL' },
  { id: 'u19', name: '张毛星', account: 'zhangmx@myibc.net', password: 'Gw1admin.', role: Role.RD_EMPLOYEE, department: '数据安全线-1组', avatar: '', source: 'LOCAL' },
  { id: 'u20', name: '曾旭坤', account: 'zengxk@myibc.net', password: 'Gw1admin.', role: Role.RD_EMPLOYEE, department: '数据安全线-1组', avatar: '', source: 'LOCAL' },
  { id: 'u21', name: '朱俊', account: 'zhuj@myibc.net', password: 'Gw1admin.', role: Role.RD_EMPLOYEE, department: '数据安全线-1组', avatar: '', source: 'LOCAL' },
  { id: 'u22', name: '万晔', account: 'wany@myibc.net', password: 'Gw1admin.', role: Role.RD_EMPLOYEE, department: '数据安全线-1组', avatar: '', source: 'LOCAL' },
  { id: 'u23', name: '欧阳磊', account: 'ouyangl@myibc.net', password: 'Gw1admin.', role: Role.RD_EMPLOYEE, department: '数据安全线-1组', avatar: '', source: 'LOCAL' },
  { id: 'u24', name: '叶星', account: 'yex@myibc.net', password: 'Gw1admin.', role: Role.RD_EMPLOYEE, department: '数据安全线-1组', avatar: '', source: 'LOCAL' },
  { id: 'u25', name: '周广图', account: 'zhougt@myibc.net', password: 'Gw1admin.', role: Role.RD_EMPLOYEE, department: '数据安全线-1组', avatar: '', source: 'LOCAL' },
  { id: 'u26', name: '轩辰龙', account: 'xuancl@myibc.net', password: 'Gw1admin.', role: Role.RD_EMPLOYEE, department: '数据安全线-1组', avatar: '', source: 'LOCAL' },
  { id: 'u27', name: '鲁伟', account: 'luw@myibc.net', password: 'Gw1admin.', role: Role.RD_EMPLOYEE, department: '数据安全线-1组', avatar: '', source: 'LOCAL' },
  { id: 'u28', name: '李天伦', account: 'litl@myibc.net', password: 'Gw1admin.', role: Role.RD_EMPLOYEE, department: '数据安全线-1组', avatar: '', source: 'LOCAL' },
  { id: 'u29', name: '陈欣荣', account: 'chenxr@myibc.net', password: 'Gw1admin.', role: Role.RD_EMPLOYEE, department: '数据安全线-1组', avatar: '', source: 'LOCAL' },
  { id: 'u30', name: '陈赛', account: 'chens@myibc.net', password: 'Gw1admin.', role: Role.QA_EMPLOYEE, department: '数据安全线-1组', avatar: '', source: 'LOCAL' },
  { id: 'u31', name: '鲁双', account: 'lush@myibc.net', password: 'Gw1admin.', role: Role.QA_EMPLOYEE, department: '数据安全线-1组', avatar: '', source: 'LOCAL' },
  { id: 'u32', name: '卢秋印', account: 'luqy@myibc.net', password: 'Gw1admin.', role: Role.QA_EMPLOYEE, department: '数据安全线-1组', avatar: '', source: 'LOCAL' },
  { id: 'u33', name: '卢静', account: 'luj@myibc.net', password: 'Gw1admin.', role: Role.QA_EMPLOYEE, department: '数据安全线-1组', avatar: '', source: 'LOCAL' },

  // 基础设施线
  { id: 'u34', name: '陈凤霞', account: 'chenfx@myibc.net', password: 'Gw1admin.', role: Role.BUSINESS_HEAD, department: '基础设施线', avatar: '', source: 'LOCAL' },
  { id: 'u35', name: '江亮', account: 'jiangl@myibc.net', password: 'Gw1admin.', role: Role.TECH_HEAD, department: '基础设施线', avatar: '', source: 'LOCAL' },
  { id: 'u36', name: '孙莉芸', account: 'sunly@myibc.net', password: 'Gw1admin.', role: Role.PRODUCT_EMPLOYEE, department: '基础设施线', avatar: '', source: 'LOCAL' },
  { id: 'u37', name: '欧阳涛', account: 'ouyangt@myibc.net', password: 'Gw1admin.', role: Role.RD_EMPLOYEE, department: '基础设施线', avatar: '', source: 'LOCAL' },
  { id: 'u38', name: '庄坤铎', account: 'zhuangkd@myibc.net', password: 'Gw1admin.', role: Role.RD_EMPLOYEE, department: '基础设施线', avatar: '', source: 'LOCAL' },
  { id: 'u39', name: '杨海峰', account: 'yanghf@myibc.net', password: 'Gw1admin.', role: Role.RD_EMPLOYEE, department: '基础设施线', avatar: '', source: 'LOCAL' },
  { id: 'u40', name: '刘赵新', account: 'liuzx@myibc.net', password: 'Gw1admin.', role: Role.RD_EMPLOYEE, department: '基础设施线', avatar: '', source: 'LOCAL' },
  { id: 'u41', name: '宁竞', account: 'ningj@myibc.net', password: 'Gw1admin.', role: Role.RD_EMPLOYEE, department: '基础设施线', avatar: '', source: 'LOCAL' },
  { id: 'u42', name: '聂健', account: 'niej@myibc.net', password: 'Gw1admin.', role: Role.RD_EMPLOYEE, department: '基础设施线', avatar: '', source: 'LOCAL' },
  { id: 'u43', name: '黎江', account: 'lij@myibc.net', password: 'Gw1admin.', role: Role.RD_EMPLOYEE, department: '基础设施线', avatar: '', source: 'LOCAL' },
  { id: 'u44', name: '段玉威', account: 'duanyw@myibc.net', password: 'Gw1admin.', role: Role.RD_EMPLOYEE, department: '基础设施线', avatar: '', source: 'LOCAL' },
  { id: 'u45', name: '魏志威', account: 'weizw@myibc.net', password: 'Gw1admin.', role: Role.RD_EMPLOYEE, department: '基础设施线', avatar: '', source: 'LOCAL' },
  { id: 'u46', name: '杨君香', account: 'yangjx@myibc.net', password: 'Gw1admin.', role: Role.RD_EMPLOYEE, department: '基础设施线', avatar: '', source: 'LOCAL' },
  { id: 'u47', name: '郭正', account: 'guoz@myibc.net', password: 'Gw1admin.', role: Role.RD_EMPLOYEE, department: '基础设施线', avatar: '', source: 'LOCAL' },
  { id: 'u48', name: '刘佳奇', account: 'liujq@myibc.net', password: 'Gw1admin.', role: Role.RD_EMPLOYEE, department: '基础设施线', avatar: '', source: 'LOCAL' },
  { id: 'u49', name: '凌艳姣', account: 'lingyj@myibc.net', password: 'Gw1admin.', role: Role.QA_EMPLOYEE, department: '基础设施线', avatar: '', source: 'LOCAL' },
  { id: 'u50', name: '黎兴', account: 'lix@myibc.net', password: 'Gw1admin.', role: Role.QA_EMPLOYEE, department: '基础设施线', avatar: '', source: 'LOCAL' },
  { id: 'u51', name: '温宁', account: 'wenn@myibc.net', password: 'Gw1admin.', role: Role.QA_EMPLOYEE, department: '基础设施线', avatar: '', source: 'LOCAL' },

  // 生态合作线
  { id: 'u52', name: '盛莉', account: 'shengl@myibc.net', password: 'Gw1admin.', role: Role.BUSINESS_HEAD, department: '生态合作线', avatar: '', source: 'LOCAL' },
  { id: 'u53', name: '吴福印', account: 'wufy@myibc.net', password: 'Gw1admin.', role: Role.TECH_HEAD, department: '生态合作线', avatar: '', source: 'LOCAL' },
  { id: 'u54', name: '熊开新', account: 'xiongkx@myibc.net', password: 'Gw1admin.', role: Role.RD_EMPLOYEE, department: '生态合作线', avatar: '', source: 'LOCAL' },
  { id: 'u55', name: '程果', account: 'chengg@myibc.net', password: 'Gw1admin.', role: Role.RD_EMPLOYEE, department: '生态合作线', avatar: '', source: 'LOCAL' },

  // 新增人员（来自组织架构截图）
  { id: 'u56', name: '蔡先勇', account: 'caixy@myibc.net', password: 'Gw1admin.', role: Role.RD_EMPLOYEE, department: '总体办', avatar: '', source: 'LOCAL' },
  { id: 'u57', name: '杜峰', account: 'duf@myibc.net', password: 'Gw1admin.', role: Role.RD_EMPLOYEE, department: '总体办', avatar: '', source: 'LOCAL' },
  { id: 'u58', name: 'Michael', account: 'michael@myibc.net', password: 'Gw1admin.', role: Role.RD_EMPLOYEE, department: '总体办', avatar: '', source: 'LOCAL' },
  { id: 'u59', name: '周枭淳', account: 'zhouxc@myibc.net', password: 'Gw1admin.', role: Role.RD_EMPLOYEE, department: '总体办', avatar: '', source: 'LOCAL' },
  { id: 'u60', name: '陈嘉雯', account: 'chenjw@myibc.net', password: 'Gw1admin.', role: Role.HRBP, department: 'HR部门', avatar: '', source: 'LOCAL' },
  { id: 'u61', name: '梁璐璐', account: 'liangll@myibc.net', password: 'Gw1admin.', role: Role.HRBP, department: 'HR部门', avatar: '', source: 'LOCAL' },
  { id: 'u62', name: '栾玉', account: 'luany@myibc.net', password: 'Gw1admin.', role: Role.HRBP, department: 'HR部门', avatar: '', source: 'LOCAL' },
  { id: 'u63', name: '喻蓉', account: 'yur@myibc.net', password: 'Gw1admin.', role: Role.PRODUCT_EMPLOYEE, department: '产品部', avatar: '', source: 'LOCAL' },
  { id: 'u64', name: '邱婧', account: 'qiuj@myibc.net', password: 'Gw1admin.', role: Role.RD_EMPLOYEE, department: '总体办', avatar: '', source: 'LOCAL' },
  { id: 'u65', name: '夏玲', account: 'xial@myibc.net', password: 'Gw1admin.', role: Role.RD_EMPLOYEE, department: '总体办', avatar: '', source: 'LOCAL' },
];
