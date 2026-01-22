
// ... (imports remain the same)
import { 
    User, OKR, OKRStatus, Role, INITIAL_USERS, DEPARTMENTS, ROLE_NAMES, 
    ApprovalWorkflow, GradeConfiguration, FinalGrade, OperationLog, 
    WeComConfig, SSOConfig, OKRLevel, Objective, KeyResult,
    OKRStatus as Status
} from '../types';

// ... (Storage Keys, Event Dispatcher, INITIAL_OKRS, initializeData, User Services remain the same)
const STORAGE_KEYS = {
    USERS: 'alignflow_users',
    OKRS: 'alignflow_okrs',
    CURRENT_USER_ID: 'alignflow_current_user_id',
    IMPERSONATOR_ID: 'alignflow_impersonator_id',
    WORKFLOWS: 'alignflow_workflows',
    GRADE_CONFIGS: 'alignflow_grade_configs',
    LOGS: 'alignflow_logs',
    WECOM_CONFIG: 'alignflow_wecom_config',
    SSO_CONFIG: 'alignflow_sso_config',
    DEPARTMENTS: 'alignflow_departments',
    CUSTOM_ROLES: 'alignflow_custom_roles'
};

const DATA_UPDATE_EVENT = 'alignflow_data_updated';
const dispatchUpdate = () => {
    window.dispatchEvent(new Event(DATA_UPDATE_EVENT));
};

export const INITIAL_OKRS: OKR[] = [
    {
        id: 'okr-company-2024',
        userId: 'u20', // CEO
        userName: '周总裁',
        level: OKRLevel.COMPANY,
        department: '总裁办',
        title: '2024年公司战略：实现市场与技术双重突破',
        period: '2024 全年',
        status: OKRStatus.PUBLISHED,
        objectives: [
            {
                id: 'obj-c1',
                content: '核心业务市场占有率达到行业第一',
                weight: 60,
                keyResults: [
                    { id: 'kr-c1-1', content: '年度营收突破 10 亿', weight: 50 },
                    { id: 'kr-c1-2', content: '新增 50 家标杆客户', weight: 50 }
                ]
            },
            {
                id: 'obj-c2',
                content: '构建下一代数据安全技术底座',
                weight: 40,
                keyResults: [
                    { id: 'kr-c2-1', content: '发布 AI 驱动的安全网关 2.0', weight: 100 }
                ]
            }
        ],
        createdAt: new Date().toISOString()
    },
    {
        id: 'okr-dept-pwd-h1',
        userId: 'u3', // Business Head
        userName: '张业务',
        level: OKRLevel.DEPARTMENT,
        department: '密码服务业务线',
        title: '密码业务线 H1：深化行业渗透',
        period: '2024 上半年',
        status: OKRStatus.PUBLISHED,
        parentOKRId: 'okr-company-2024', // Align to Company
        objectives: [
            {
                id: 'obj-d1',
                content: '完成金融行业深度覆盖',
                weight: 70,
                keyResults: [
                    { id: 'kr-d1-1', content: '签约 10 家省级银行', weight: 50 },
                    { id: 'kr-d1-2', content: '客户满意度评分维持在 9.5 分以上', weight: 50 }
                ]
            },
            {
                id: 'obj-d2',
                content: '提升团队交付效率',
                weight: 30,
                keyResults: [
                    { id: 'kr-d2-1', content: '项目平均交付周期缩短 20%', weight: 100 }
                ]
            }
        ],
        createdAt: new Date().toISOString()
    },
    {
        id: 'okr-personal-u1-q1',
        userId: 'u1', // Employee
        userName: '王小工',
        level: OKRLevel.PERSONAL,
        department: '密码服务业务线',
        title: 'Q1 个人目标：核心模块重构与交付',
        period: '2024 上半年',
        status: OKRStatus.PUBLISHED,
        parentOKRId: 'okr-dept-pwd-h1', // Align to Dept
        objectives: [
            {
                id: 'obj-p1',
                content: '按时高质量交付加密引擎 3.0',
                weight: 80,
                keyResults: [
                    { id: 'kr-p1-1', content: '完成核心算法模块代码重构', weight: 60 },
                    { id: 'kr-p1-2', content: '单元测试覆盖率达到 90%', weight: 40 }
                ]
            },
            {
                id: 'obj-p2',
                content: '技术影响力建设',
                weight: 20,
                keyResults: [
                    { id: 'kr-p2-1', content: '在技术分享会进行 1 次主题分享', weight: 100 }
                ]
            }
        ],
        createdAt: new Date().toISOString()
    }
];

const initializeData = () => {
    if (!localStorage.getItem(STORAGE_KEYS.USERS)) {
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(INITIAL_USERS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.OKRS)) {
        localStorage.setItem(STORAGE_KEYS.OKRS, JSON.stringify(INITIAL_OKRS));
    }
};

initializeData();

export const getUsers = (): User[] => {
    const stored = localStorage.getItem(STORAGE_KEYS.USERS);
    return stored ? JSON.parse(stored) : INITIAL_USERS;
};

export const saveUser = (user: User) => {
    const users = getUsers();
    const idx = users.findIndex(u => u.id === user.id);
    if (idx >= 0) {
        users[idx] = user;
    } else {
        users.push(user);
    }
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    
    const current = getCurrentUser();
    if (current && current.id === user.id) {
        notifyUserSubscribers();
    }
    dispatchUpdate();
};

export const deleteUser = (id: string) => {
    const users = getUsers().filter(u => u.id !== id);
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    dispatchUpdate();
};

let userSubscribers: ((user: User | null) => void)[] = [];

export const subscribeToUser = (callback: (user: User | null) => void) => {
    userSubscribers.push(callback);
    return () => {
        userSubscribers = userSubscribers.filter(cb => cb !== callback);
    };
};

const notifyUserSubscribers = () => {
    const user = getCurrentUser();
    userSubscribers.forEach(cb => cb(user));
};

export const getCurrentUser = (): User | null => {
    const id = localStorage.getItem(STORAGE_KEYS.CURRENT_USER_ID);
    if (!id) return null;
    const users = getUsers();
    return users.find(u => u.id === id) || null;
};

export const login = (account: string, pass: string) => {
    const users = getUsers();
    const user = users.find(u => u.account === account && u.password === pass);
    if (user) {
        localStorage.setItem(STORAGE_KEYS.CURRENT_USER_ID, user.id);
        notifyUserSubscribers();
        addLog('LOGIN', 'AUTH', `用户登录: ${user.name}`);
        return { success: true };
    }
    return { success: false, message: '账号或密码错误' };
};

export const logout = () => {
    const u = getCurrentUser();
    if (u) addLog('LOGOUT', 'AUTH', `用户登出: ${u.name}`);
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER_ID);
    localStorage.removeItem(STORAGE_KEYS.IMPERSONATOR_ID);
    notifyUserSubscribers();
};

export const getImpersonator = (): User | null => {
    const id = localStorage.getItem(STORAGE_KEYS.IMPERSONATOR_ID);
    if (!id) return null;
    const users = getUsers();
    return users.find(u => u.id === id) || null;
};

export const switchPerspective = (targetUserId: string) => {
    const currentUser = getCurrentUser();
    const impersonatorId = localStorage.getItem(STORAGE_KEYS.IMPERSONATOR_ID);
    
    if (!impersonatorId) {
        if (currentUser?.role === Role.ADMIN) {
            localStorage.setItem(STORAGE_KEYS.IMPERSONATOR_ID, currentUser.id);
        } else {
            console.warn("Only admin can switch perspective");
            return;
        }
    }
    
    if (impersonatorId && targetUserId === impersonatorId) {
        localStorage.removeItem(STORAGE_KEYS.IMPERSONATOR_ID);
    }
    
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER_ID, targetUserId);
    notifyUserSubscribers();
    dispatchUpdate();
};

export const getDepartments = (): string[] => {
    const stored = localStorage.getItem(STORAGE_KEYS.DEPARTMENTS);
    if (stored) return JSON.parse(stored);
    return Array.from(DEPARTMENTS);
};

export const addDepartment = (name: string) => {
    const depts = getDepartments();
    if (!depts.includes(name)) {
        depts.push(name);
        localStorage.setItem(STORAGE_KEYS.DEPARTMENTS, JSON.stringify(depts));
    }
};

export const getRoles = (): {value: string, label: string}[] => {
    const stored = localStorage.getItem(STORAGE_KEYS.CUSTOM_ROLES);
    const customs = stored ? JSON.parse(stored) : [];
    
    const builtIn = Object.entries(ROLE_NAMES).map(([key, label]) => ({
        value: key,
        label: label
    }));
    
    return [...builtIn, ...customs];
};

export const addRole = (key: string, label: string) => {
    const stored = localStorage.getItem(STORAGE_KEYS.CUSTOM_ROLES);
    const customs = stored ? JSON.parse(stored) : [];
    if (!customs.find((r: any) => r.value === key)) {
        customs.push({ value: key, label });
        localStorage.setItem(STORAGE_KEYS.CUSTOM_ROLES, JSON.stringify(customs));
        dispatchUpdate();
    }
};

export const updateCustomRole = (key: string, newLabel: string) => {
    const stored = localStorage.getItem(STORAGE_KEYS.CUSTOM_ROLES);
    if (!stored) return;
    let customs = JSON.parse(stored);
    const idx = customs.findIndex((r: any) => r.value === key);
    if (idx >= 0) {
        customs[idx].label = newLabel;
        localStorage.setItem(STORAGE_KEYS.CUSTOM_ROLES, JSON.stringify(customs));
        dispatchUpdate();
    }
};

export const deleteCustomRole = (key: string) => {
    const stored = localStorage.getItem(STORAGE_KEYS.CUSTOM_ROLES);
    if (!stored) return;
    let customs = JSON.parse(stored);
    customs = customs.filter((r: any) => r.value !== key);
    localStorage.setItem(STORAGE_KEYS.CUSTOM_ROLES, JSON.stringify(customs));
    
    let workflows = getWorkflows();
    workflows = workflows.filter(w => w.targetRole !== key);
    saveAllWorkflows(workflows);
};

export const getOKRs = (): OKR[] => {
    const stored = localStorage.getItem(STORAGE_KEYS.OKRS);
    return stored ? JSON.parse(stored) : INITIAL_OKRS;
};

export const saveOKR = (okr: OKR) => {
    const okrs = getOKRs();
    const idx = okrs.findIndex(o => o.id === okr.id);
    if (idx >= 0) {
        okrs[idx] = okr;
    } else {
        okrs.push(okr);
    }
    localStorage.setItem(STORAGE_KEYS.OKRS, JSON.stringify(okrs));
    dispatchUpdate();
};

export const deleteOKR = (id: string) => {
    const okrs = getOKRs().filter(o => o.id !== id);
    localStorage.setItem(STORAGE_KEYS.OKRS, JSON.stringify(okrs));
    dispatchUpdate();
};

export const createOKR = (user: User, level: OKRLevel): OKR => {
    const now = new Date();
    const year = now.getFullYear();
    let defaultPeriod = '';

    if (level === OKRLevel.COMPANY) {
        defaultPeriod = `${year} 全年`;
    } else {
        const month = now.getMonth();
        defaultPeriod = month < 6 ? `${year} 上半年` : `${year} 下半年`;
    }

    return {
        id: `okr-${Date.now()}`,
        userId: user.id,
        userName: user.name,
        level: level,
        department: user.department,
        title: `${user.name}的${level === OKRLevel.COMPANY ? '公司' : (level === OKRLevel.DEPARTMENT ? '部门' : '个人')}目标`,
        period: defaultPeriod,
        status: OKRStatus.DRAFT,
        objectives: [],
        createdAt: new Date().toISOString()
    };
};

export const updateOKRStatus = (id: string, status: OKRStatus) => {
    const okrs = getOKRs();
    const okr = okrs.find(o => o.id === id);
    if (okr) {
        okr.status = status;
        saveOKR(okr);
        
        const currentUser = getCurrentUser();
        addLog('UPDATE_STATUS', 'OKR', `OKR "${okr.title}" 状态变更为 ${status}`, currentUser?.id, currentUser?.name);
    }
};

export const calculateObjScoreFromKRs = (obj: Objective): number => {
    if (!obj.keyResults || obj.keyResults.length === 0) return 0;
    let total = 0;
    obj.keyResults.forEach(kr => {
        total += (kr.managerScore || 0) * (kr.weight / 100);
    });
    return Math.round(total * 10) / 10;
};

export const calculateOKRTotalScore = (okr: OKR): number => {
    let total = 0;
    okr.objectives.forEach(obj => {
        const objScore = obj.managerScore !== undefined ? obj.managerScore : calculateObjScoreFromKRs(obj);
        total += objScore * (obj.weight / 100);
    });
    return Math.round(total * 10) / 10;
};

const DEFAULT_GRADE_CONFIGS: GradeConfiguration[] = [
    { grade: FinalGrade.S, minScore: 100, maxScore: 120, quota: 20, description: '远超预期' },
    { grade: FinalGrade.A, minScore: 90, maxScore: 99, quota: 60, description: '符合预期' },
    { grade: FinalGrade.B, minScore: 70, maxScore: 89, quota: 15, description: '需要改进' },
    { grade: FinalGrade.C, minScore: 0, maxScore: 69, quota: 5, description: '不合格' }
];

export const getGradeConfigs = (): GradeConfiguration[] => {
    const stored = localStorage.getItem(STORAGE_KEYS.GRADE_CONFIGS);
    return stored ? JSON.parse(stored) : DEFAULT_GRADE_CONFIGS;
};

export const saveGradeConfigs = (configs: GradeConfiguration[]) => {
    localStorage.setItem(STORAGE_KEYS.GRADE_CONFIGS, JSON.stringify(configs));
    dispatchUpdate();
};

export const determineGrade = (score: number): FinalGrade => {
    const configs = getGradeConfigs();
    for (const cfg of configs) {
        if (score >= cfg.minScore && score <= cfg.maxScore) {
            return cfg.grade;
        }
    }
    return FinalGrade.B;
};

// --- Workflows ---

const DEFAULT_WORKFLOWS: ApprovalWorkflow[] = [
    // 1. 产品员工: 业务负责人 (L1) -> 产品总经理 (L2)
    { 
        targetRole: Role.PRODUCT_EMPLOYEE, 
        approverRoleL1: Role.BUSINESS_HEAD, 
        approverRoleL2: Role.PRODUCT_GM 
    },
    // 2. 研发员工: 邀请技术经理 -> 研发负责人 (L1) -> 研发总经理 (L2)
    { 
        targetRole: Role.RD_EMPLOYEE, 
        ccRoles: [Role.TECH_MANAGER], 
        approverRoleL1: Role.TECH_HEAD, 
        approverRoleL2: Role.TECH_GM 
    },
    // 3. 测试员工
    { 
        targetRole: Role.QA_EMPLOYEE, 
        ccRoles: [Role.QA_MANAGER, Role.QA_HEAD], 
        approverRoleL1: Role.TECH_HEAD, 
        approverRoleL2: Role.TECH_GM 
    },
    // 4. 项目管理员
    { 
        targetRole: Role.PROJECT_MANAGER, 
        approverRoleL1: Role.TECH_HEAD, 
        approverRoleL2: Role.QUALITY_GM 
    },
    // 5. 职能部门负责人
    { 
        targetRole: Role.QA_HEAD, 
        ccRoles: [Role.TECH_HEAD], 
        approverRoleL1: Role.TECH_GM, 
        approverRoleL2: null 
    },
    // 6. VP & Executives
    { targetRole: Role.VP_TECH, approverRoleL1: Role.PRESIDENT, approverRoleL2: null },
    { targetRole: Role.VP_PRODUCT, approverRoleL1: Role.PRESIDENT, approverRoleL2: null },
    { targetRole: Role.VP_MARKET, approverRoleL1: Role.PRESIDENT, approverRoleL2: null },
    
    // 7. General Managers
    { targetRole: Role.QUALITY_GM, approverRoleL1: Role.VP_PRODUCT, approverRoleL2: null },
    { targetRole: Role.PROJECT_DEPT_GM, approverRoleL1: Role.VP_MARKET, approverRoleL2: null },
    { targetRole: Role.PRODUCT_GM, approverRoleL1: Role.VP_PRODUCT, approverRoleL2: null },
    { targetRole: Role.TECH_GM, approverRoleL1: Role.VP_TECH, approverRoleL2: null },
    
    // 8. Others
    { targetRole: Role.HRBP, approverRoleL1: Role.PRESIDENT, approverRoleL2: null },
    { targetRole: Role.TECH_EXPERT, approverRoleL1: Role.GENERAL_OFFICE_DIRECTOR, approverRoleL2: null },
    { targetRole: Role.GENERAL_OFFICE_DIRECTOR, approverRoleL1: Role.VP_TECH, approverRoleL2: null },
    { targetRole: Role.EMPLOYEE, approverRoleL1: Role.HRBP, approverRoleL2: null },
    { targetRole: Role.TECH_MANAGER, ccRoles: [], approverRoleL1: Role.TECH_HEAD, approverRoleL2: Role.TECH_GM },

    // Business Heads (Submitter) -> Product GM (L1) -> VP Product (L2)
    // This allows Team Submissions (owned by Business Head) to flow to VP
    { 
        targetRole: Role.BUSINESS_HEAD, 
        approverRoleL1: Role.PRODUCT_GM, 
        approverRoleL2: Role.VP_PRODUCT 
    },
    { 
        targetRole: Role.TECH_HEAD, 
        approverRoleL1: Role.TECH_GM, 
        approverRoleL2: Role.VP_TECH 
    },
];

export const getWorkflows = (): ApprovalWorkflow[] => {
    const stored = localStorage.getItem(STORAGE_KEYS.WORKFLOWS);
    if (stored) return JSON.parse(stored);
    return DEFAULT_WORKFLOWS;
};

const saveAllWorkflows = (workflows: ApprovalWorkflow[]) => {
    localStorage.setItem(STORAGE_KEYS.WORKFLOWS, JSON.stringify(workflows));
    dispatchUpdate();
};

export const saveWorkflow = (workflow: ApprovalWorkflow) => {
    const flows = getWorkflows();
    const idx = flows.findIndex(w => w.targetRole === workflow.targetRole);
    if (idx >= 0) {
        flows[idx] = workflow;
    } else {
        flows.push(workflow);
    }
    saveAllWorkflows(flows);
};

export const deleteWorkflow = (targetRole: string) => {
    let flows = getWorkflows();
    flows = flows.filter(w => w.targetRole !== targetRole);
    saveAllWorkflows(flows);
};

export const getApproverRoles = (okr: OKR): { l1: Role | string | null, l2: Role | string | null, l3: Role | string | null, cc: (Role | string)[] } => {
    if (!okr) return { l1: null, l2: null, l3: null, cc: [] };
    
    const users = getUsers();
    const user = users.find(u => u.id === okr.userId);
    if (!user) return { l1: null, l2: null, l3: null, cc: [] };

    const workflows = getWorkflows();
    let wf = workflows.find(w => w.targetRole === user.role);

    // Fallback only if no workflow matches user role.
    // DEFAULT_WORKFLOWS covers key roles including BUSINESS_HEAD.
    if (!wf) {
        return { l1: Role.HRBP, l2: null, l3: null, cc: [] };
    }

    return { 
        l1: wf.approverRoleL1, 
        l2: wf.approverRoleL2 || null, 
        l3: wf.approverRoleL3 || null,
        cc: wf.ccRoles || []
    };
};

// ... (Rest of the file including isCadre, getLogs, addLog, getWeComConfig, saveWeComConfig, getSSOConfig, saveSSOConfig, getBadgeCounts)
export const isCadre = (role: string): boolean => {
    const workflows = getWorkflows();
    return workflows.some(w => w.approverRoleL1 === role || w.approverRoleL2 === role);
};

export const getLogs = (): OperationLog[] => {
    const stored = localStorage.getItem(STORAGE_KEYS.LOGS);
    return stored ? JSON.parse(stored) : [];
};

export const addLog = (action: string, module: string, details: string, userId?: string, userName?: string) => {
    const logs = getLogs();
    const u = getCurrentUser();
    const newLog: OperationLog = {
        id: `log-${Date.now()}`,
        userId: userId || u?.id || 'system',
        userName: userName || u?.name || 'System',
        action,
        module,
        details,
        timestamp: new Date().toISOString()
    };
    logs.unshift(newLog); 
    localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(logs));
};

export const getWeComConfig = (): WeComConfig => {
    const stored = localStorage.getItem(STORAGE_KEYS.WECOM_CONFIG);
    return stored ? JSON.parse(stored) : { corpId: '', agentId: '', secret: '', enabled: false };
};

export const saveWeComConfig = (cfg: WeComConfig) => {
    localStorage.setItem(STORAGE_KEYS.WECOM_CONFIG, JSON.stringify(cfg));
    dispatchUpdate();
};

export const getSSOConfig = (): SSOConfig => {
    const stored = localStorage.getItem(STORAGE_KEYS.SSO_CONFIG);
    return stored ? JSON.parse(stored) : { metadataUrl: '', clientId: '', clientSecret: '', enabled: false };
};

export const saveSSOConfig = (cfg: SSOConfig) => {
    localStorage.setItem(STORAGE_KEYS.SSO_CONFIG, JSON.stringify(cfg));
    dispatchUpdate();
};

export const getBadgeCounts = (user: User) => {
    const okrs = getOKRs();
    
    const relevantOkrs = okrs.filter(o => o.userId !== user.id && !o.isPerformanceArchived); 

    let approvalCount = okrs.filter(okr => {
        if (user.role === Role.ADMIN) return okr.status === OKRStatus.PENDING_MANAGER || okr.status === OKRStatus.PENDING_GM;
        if (okr.status !== OKRStatus.PENDING_MANAGER && okr.status !== OKRStatus.PENDING_GM) return false;
        
        const { l1, l2 } = getApproverRoles(okr);
        const isDepartmentMatch = user.department === okr.department;
         const isGlobalRole = [
            Role.PRODUCT_GM, Role.TECH_GM, Role.VP_PRODUCT,
            Role.VP_TECH, Role.VP_MARKET, Role.PRESIDENT
        ].includes(user.role as Role);

        if (okr.status === OKRStatus.PENDING_MANAGER) {
            return user.role === l1 && (isDepartmentMatch || isGlobalRole);
        } else if (okr.status === OKRStatus.PENDING_GM) {
            return l2 && user.role === l2;
        }
        
        return false;
    }).length;

    const creationSuggestionCount = okrs.filter(o => {
        if (o.userId === user.id) return false;
        if (o.status !== OKRStatus.PENDING_MANAGER && o.status !== OKRStatus.PENDING_GM) return false;
        
        const isPeer = o.peerReviewers?.includes(user.id);
        const { cc } = getApproverRoles(o);
        const isCC = cc.includes(user.role);
        
        return isPeer || isCC;
    }).length;
    
    const self = okrs.filter(o => o.userId === user.id && o.status === OKRStatus.PUBLISHED && !o.isPerformanceArchived).length;
    
    const assessmentPhaseFeedbackCount = relevantOkrs.filter(o => {
        const isAssessmentPhase = 
            o.status === OKRStatus.PENDING_ASSESSMENT_APPROVAL || 
            o.status === OKRStatus.GRADING || 
            o.status === OKRStatus.PENDING_L2_APPROVAL ||
            o.status === OKRStatus.PENDING_L3_APPROVAL;

        if (!isAssessmentPhase) return false;

        const isPeer = o.peerReviewers?.includes(user.id);
        const { cc } = getApproverRoles(o);
        const isCC = cc.includes(user.role);

        return isPeer || isCC;
    }).length;

    let managerActionCount = 0;

    const l1Pending = relevantOkrs.filter(o => {
        if (o.status !== OKRStatus.PENDING_ASSESSMENT_APPROVAL) return false;
        const { l1 } = getApproverRoles(o);
        if (user.isPrimaryApprover && o.department === user.department) return true;
        return user.role === l1 && (o.department === user.department || isCadre(user.role)); 
    });
    
    const l2Pending = relevantOkrs.filter(o => {
        if (o.status !== OKRStatus.PENDING_L2_APPROVAL) return false;
        const { l2 } = getApproverRoles(o);
        return user.role === l2;
    });

    const l3Pending = relevantOkrs.filter(o => {
        if (o.status !== OKRStatus.PENDING_L3_APPROVAL) return false;
        const { l3 } = getApproverRoles(o);
        return user.role === l3;
    });

    managerActionCount = l1Pending.length + l2Pending.length + l3Pending.length;

    return {
        approvals: approvalCount + creationSuggestionCount,
        assessments: self + assessmentPhaseFeedbackCount + managerActionCount
    };
};
