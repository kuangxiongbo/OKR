import { 
    User, OKR, OKRStatus, Role, INITIAL_USERS, DEPARTMENTS, ROLE_NAMES, 
    ApprovalWorkflow, GradeConfiguration, FinalGrade, OperationLog, 
    WeComConfig, SSOConfig, OKRLevel, Objective, KeyResult,
    OKRStatus as Status
} from '../types';
import { 
    usersAPI, okrsAPI, workflowsAPI, gradeConfigsAPI, 
    departmentsAPI, customRolesAPI, logsAPI, authAPI, removeToken 
} from './api';

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
        department: '密码服务线',
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
        department: '密码服务线',
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

// ==================== 内存缓存层 ====================
// 内存缓存（主要数据源）
let usersCache: User[] = [];
let okrsCache: OKR[] = [];
let workflowsCache: ApprovalWorkflow[] = [];
let gradeConfigsCache: GradeConfiguration[] = [];
let departmentsCache: string[] = [];
let customRolesCache: {value: string, label: string}[] = [];
let logsCache: OperationLog[] = [];

// 缓存状态管理
interface CacheState {
    loading: boolean;
    lastFetch: number;
    error: Error | null;
}

const cacheState: Record<string, CacheState> = {
    users: { loading: false, lastFetch: 0, error: null },
    okrs: { loading: false, lastFetch: 0, error: null },
    workflows: { loading: false, lastFetch: 0, error: null },
    gradeConfigs: { loading: false, lastFetch: 0, error: null },
    departments: { loading: false, lastFetch: 0, error: null },
    customRoles: { loading: false, lastFetch: 0, error: null },
    logs: { loading: false, lastFetch: 0, error: null },
};

// 缓存过期时间（5分钟）
const CACHE_TTL = 5 * 60 * 1000;

// ==================== 后台自动刷新函数 ====================

// 刷新用户列表
const refreshUsersInBackground = async () => {
    if (cacheState.users.loading) return;
    
    // 检查用户是否已登录，未登录时不调用 API
    const token = localStorage.getItem('okr_token');
    if (!token) {
        return;
    }
    
    cacheState.users.loading = true;
    try {
        const result = await usersAPI.getAll();
        if (result.success && result.data?.users) {
            usersCache = result.data.users;
            cacheState.users.lastFetch = Date.now();
            cacheState.users.error = null;
            notifyUserSubscribers();
            dispatchUpdate();
        }
    } catch (error: any) {
        cacheState.users.error = error;
        // 静默处理错误，不影响用户体验
        // 只在开发环境且错误不是连接拒绝时输出
        if (process.env.NODE_ENV === 'development' && !error.message?.includes('Failed to fetch')) {
            console.warn('刷新用户列表失败:', error);
        }
    } finally {
        cacheState.users.loading = false;
    }
};

// 刷新 OKR 列表
export const refreshOKRsInBackground = async (): Promise<void> => {
    if (cacheState.okrs.loading) {
        // 如果正在加载，等待加载完成
        while (cacheState.okrs.loading) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        return;
    }
    
    // 检查用户是否已登录，未登录时不调用 API
    const token = localStorage.getItem('okr_token');
    if (!token) {
        return;
    }
    
    cacheState.okrs.loading = true;
    try {
        // 获取所有 OKR（不按用户过滤，确保数据完整，避免遗漏）
        const result = await okrsAPI.getAll();
        if (result.success && result.data?.okrs) {
            // 用服务器返回的数据完全替换缓存（确保与服务端一致）
            okrsCache = result.data.okrs;
            cacheState.okrs.lastFetch = Date.now();
            cacheState.okrs.error = null;
            dispatchUpdate();
        }
    } catch (error: any) {
        cacheState.okrs.error = error;
        // 静默处理错误，不影响用户体验
        // 只在开发环境且错误不是连接拒绝时输出
        if (process.env.NODE_ENV === 'development' && !error.message?.includes('Failed to fetch')) {
            console.warn('刷新 OKR 列表失败:', error);
        }
    } finally {
        cacheState.okrs.loading = false;
    }
};

// 刷新审批流程
const refreshWorkflowsInBackground = async () => {
    if (cacheState.workflows.loading) return;
    
    // 检查用户是否已登录，未登录时不调用 API
    const token = localStorage.getItem('okr_token');
    if (!token) {
        return;
    }
    
    cacheState.workflows.loading = true;
    try {
        const result = await workflowsAPI.getAll();
        if (result.success && result.data?.workflows) {
            workflowsCache = result.data.workflows;
            cacheState.workflows.lastFetch = Date.now();
            cacheState.workflows.error = null;
            dispatchUpdate();
        }
    } catch (error: any) {
        cacheState.workflows.error = error;
        // 静默处理错误，不影响用户体验
        // 只在开发环境且错误不是连接拒绝时输出
        if (process.env.NODE_ENV === 'development' && !error.message?.includes('Failed to fetch')) {
            console.warn('刷新审批流程失败:', error);
        }
    } finally {
        cacheState.workflows.loading = false;
    }
};

// 刷新绩效等级配置
const refreshGradeConfigsInBackground = async () => {
    if (cacheState.gradeConfigs.loading) return;
    
    // 检查用户是否已登录，未登录时不调用 API
    const token = localStorage.getItem('okr_token');
    if (!token) {
        return;
    }
    
    cacheState.gradeConfigs.loading = true;
    try {
        const result = await gradeConfigsAPI.getAll();
        if (result.success && result.data?.configs) {
            gradeConfigsCache = result.data.configs;
            cacheState.gradeConfigs.lastFetch = Date.now();
            cacheState.gradeConfigs.error = null;
            dispatchUpdate();
        }
    } catch (error: any) {
        cacheState.gradeConfigs.error = error;
        // 静默处理错误，不影响用户体验
        // 只在开发环境且错误不是连接拒绝时输出
        if (process.env.NODE_ENV === 'development' && !error.message?.includes('Failed to fetch')) {
            console.warn('刷新绩效等级配置失败:', error);
        }
    } finally {
        cacheState.gradeConfigs.loading = false;
    }
};

// 刷新部门列表
const refreshDepartmentsInBackground = async () => {
    if (cacheState.departments.loading) return;
    
    // 检查用户是否已登录，未登录时不调用 API
    const token = localStorage.getItem('okr_token');
    if (!token) {
        return;
    }
    
    cacheState.departments.loading = true;
    try {
        const result = await departmentsAPI.getAll();
        if (result.success && result.data?.departments) {
            departmentsCache = result.data.departments;
            cacheState.departments.lastFetch = Date.now();
            cacheState.departments.error = null;
            dispatchUpdate();
        }
    } catch (error: any) {
        cacheState.departments.error = error;
        // 静默处理错误，不影响用户体验
        // 只在开发环境且错误不是连接拒绝时输出
        if (process.env.NODE_ENV === 'development' && !error.message?.includes('Failed to fetch')) {
            console.warn('刷新部门列表失败:', error);
        }
    } finally {
        cacheState.departments.loading = false;
    }
};

// 刷新自定义角色
const refreshCustomRolesInBackground = async () => {
    if (cacheState.customRoles.loading) return;
    
    // 检查用户是否已登录，未登录时不调用 API
    const token = localStorage.getItem('okr_token');
    if (!token) {
        return;
    }
    
    cacheState.customRoles.loading = true;
    try {
        const result = await customRolesAPI.getAll();
        if (result.success && result.data?.roles) {
            customRolesCache = result.data.roles;
            cacheState.customRoles.lastFetch = Date.now();
            cacheState.customRoles.error = null;
            dispatchUpdate();
        }
    } catch (error: any) {
        cacheState.customRoles.error = error;
        // 静默处理错误，不影响用户体验
        // 只在开发环境且错误不是连接拒绝时输出
        if (process.env.NODE_ENV === 'development' && !error.message?.includes('Failed to fetch')) {
            console.warn('刷新自定义角色失败:', error);
        }
    } finally {
        cacheState.customRoles.loading = false;
    }
};

// 刷新操作日志
const refreshLogsInBackground = async () => {
    if (cacheState.logs.loading) return;
    
    // 检查用户是否已登录，未登录时不调用 API
    const token = localStorage.getItem('okr_token');
    if (!token) {
        return;
    }
    
    cacheState.logs.loading = true;
    try {
        const result = await logsAPI.getAll(100);
        if (result.success && result.data?.logs) {
            logsCache = result.data.logs;
            cacheState.logs.lastFetch = Date.now();
            cacheState.logs.error = null;
            dispatchUpdate();
        }
    } catch (error: any) {
        cacheState.logs.error = error;
        // 静默处理错误，不影响用户体验
        // 只在开发环境且错误不是连接拒绝时输出
        if (process.env.NODE_ENV === 'development' && !error.message?.includes('Failed to fetch')) {
            console.warn('刷新操作日志失败:', error);
        }
    } finally {
        cacheState.logs.loading = false;
    }
};

// ==================== 初始化函数 ====================

/** 判定 API 错误是否应结束本地登录态（避免 ProtectedRoute 永远「加载中」） */
const shouldClearSessionOnApiError = (error: unknown): boolean => {
    const msg = String((error as Error)?.message || error);
    return (
        msg.includes('401') ||
        msg.includes('403') ||
        msg.includes('404') ||
        msg.includes('未授权') ||
        msg.includes('令牌') ||
        msg.includes('认证') ||
        msg.includes('用户不存在')
    );
};

/** 清除 token 与当前用户 id，并通知 useCurrentUser */
export const clearInvalidAuthSession = () => {
    removeToken();
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER_ID);
    localStorage.removeItem(STORAGE_KEYS.IMPERSONATOR_ID);
    notifyUserSubscribers();
};

// 初始化数据（从后端 API 加载）
export const initializeDataFromAPI = async () => {
    // 检查用户是否已登录
    const currentUserId = localStorage.getItem(STORAGE_KEYS.CURRENT_USER_ID);
    const token = localStorage.getItem('okr_token');
    
    // 如果用户未登录，只从 localStorage 恢复数据，不调用 API
    if (!currentUserId || !token) {
        console.log('用户未登录，跳过 API 初始化');
        return;
    }
    
    // 如果用户已登录，先尝试拿到当前用户信息（不落地到 localStorage）
    if (currentUserId && token) {
        try {
            const result = await authAPI.getCurrentUser();
            if (result.success && result.data?.user) {
                const user = result.data.user;
                const idx = usersCache.findIndex(u => u.id === user.id);
                if (idx >= 0) usersCache[idx] = user;
                else usersCache.push(user);
                notifyUserSubscribers();
            }
        } catch (error) {
            if (process.env.NODE_ENV === 'development') {
                console.warn('获取当前用户失败:', error);
            }
            if (shouldClearSessionOnApiError(error)) {
                clearInvalidAuthSession();
            }
        }
    }
    
    // 然后从 API 刷新（获取最新数据）
    try {
        await Promise.all([
            refreshUsersInBackground(),
            refreshOKRsInBackground(),
            refreshWorkflowsInBackground(),
            refreshGradeConfigsInBackground(),
            refreshDepartmentsInBackground(),
            refreshCustomRolesInBackground(),
            refreshLogsInBackground(),
        ]);
    } catch (error) {
        // 静默失败，不影响应用启动
        if (process.env.NODE_ENV === 'development') {
            console.warn('初始化数据失败:', error);
        }
    }
};

export const getUsers = (): User[] => {
    // 后台自动刷新（如果缓存过期或为空）
    if (usersCache.length === 0 || Date.now() - cacheState.users.lastFetch > CACHE_TTL) {
        refreshUsersInBackground();
    }
    
    return usersCache;
};

export const saveUser = async (user: User) => {
    // 以数据库为准：先写入后端成功，再更新本地内存缓存/界面
    if (!localStorage.getItem('okr_token')) {
        throw new Error('未登录');
    }

    try {
        let serverUser: User | undefined;

        // 先尝试更新；若用户不存在（404），再创建
        try {
            const result = await usersAPI.update(user.id, user);
            serverUser = result?.data?.user;
        } catch (error: any) {
            const msg = String(error?.message || error);
            if (msg.includes('用户不存在') || msg.includes('404') || msg.includes('NOT_FOUND')) {
                const result = await usersAPI.create(user);
                serverUser = result?.data?.user;
            } else {
                throw error;
            }
        }

        if (!serverUser) {
            throw new Error('保存用户失败：未收到后端返回的用户数据');
        }

        const idx = usersCache.findIndex(u => u.id === serverUser!.id);
        if (idx >= 0) usersCache[idx] = serverUser!;
        else usersCache.push(serverUser!);

        cacheState.users.lastFetch = Date.now();
        notifyUserSubscribers();
        dispatchUpdate();
    } catch (error) {
        console.error('保存用户到服务器失败:', error);
        throw error;
    }
};

export const deleteUser = async (id: string) => {
    // 以数据库为准：先删除后端成功，再更新本地内存缓存/界面
    if (!localStorage.getItem('okr_token')) {
        throw new Error('未登录');
    }

    try {
        await usersAPI.delete(id);
        usersCache = usersCache.filter(u => u.id !== id);
        cacheState.users.lastFetch = Date.now();
        notifyUserSubscribers();
        dispatchUpdate();
    } catch (error) {
        console.error('删除用户失败:', error);
        throw error;
    }
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

    // 先用内存缓存尝试
    const users = getUsers();
    const cachedUser = users.find(u => u.id === id) || null;
    if (cachedUser) return cachedUser;

    // 缓存缺失时：以数据库为准兜底拉取当前用户，避免 ProtectedRoute 永远加载
    const token = localStorage.getItem('okr_token');
    if (!token) return null;

    // 防并发请求
    if (!(getCurrentUser as any)._inFlight) {
        (getCurrentUser as any)._inFlight = true;
        usersAPI.getById(id)
            .then((result: any) => {
                const serverUser = result?.success ? result?.data?.user : undefined;
                if (!serverUser) return;
                const idx = usersCache.findIndex(u => u.id === serverUser.id);
                if (idx >= 0) usersCache[idx] = serverUser;
                else usersCache.push(serverUser);
                cacheState.users.lastFetch = Date.now();
                notifyUserSubscribers();
                dispatchUpdate();
            })
            .catch((error) => {
                if (shouldClearSessionOnApiError(error)) {
                    clearInvalidAuthSession();
                }
            })
            .finally(() => {
                (getCurrentUser as any)._inFlight = false;
            });
    }

    return null;
};

export const login = async (account: string, pass: string) => {
    try {
        const result = await authAPI.login(account, pass);
        if (result.success && result.data?.user) {
            const user = result.data.user;
            
            // 先更新用户缓存（确保 getCurrentUser 能找到用户）
            const users = getUsers();
            const idx = users.findIndex(u => u.id === user.id);
            if (idx >= 0) {
                users[idx] = user;
            } else {
                users.push(user);
            }
            usersCache = users;
            
            // 然后设置当前用户 ID（这样 getCurrentUser 能立即找到用户）
            localStorage.setItem(STORAGE_KEYS.CURRENT_USER_ID, user.id);
            
            // 通知订阅者（触发 useCurrentUser hook 更新）
            notifyUserSubscribers();
            addLog('LOGIN', 'AUTH', `用户登录: ${user.name}`);
            return { success: true };
        }
        return { success: false, message: result.error?.message || '账号或密码错误' };
    } catch (error: any) {
        console.error('登录失败:', error);
        return { success: false, message: error.message || '登录失败' };
    }
};

export const logout = () => {
    const u = getCurrentUser();
    if (u) addLog('LOGOUT', 'AUTH', `用户登出: ${u.name}`);
    removeToken();
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
    // 后台自动刷新（如果缓存过期或为空）
    if (departmentsCache.length === 0 || Date.now() - cacheState.departments.lastFetch > CACHE_TTL) {
        refreshDepartmentsInBackground();
    }
    
    return departmentsCache.length > 0 ? departmentsCache : Array.from(DEPARTMENTS);
};

export const addDepartment = async (name: string) => {
    if (!localStorage.getItem('okr_token')) {
        throw new Error('未登录');
    }

    const depts = getDepartments();
    if (depts.includes(name)) return;

    try {
        await departmentsAPI.create(name);
        departmentsCache = Array.from(new Set([...depts, name]));
        cacheState.departments.lastFetch = Date.now();
        dispatchUpdate();
    } catch (error) {
        console.error('添加部门到服务器失败:', error);
        throw error;
    }
};

export const updateDepartment = async (oldName: string, newName: string) => {
    if (!localStorage.getItem('okr_token')) {
        throw new Error('未登录');
    }

    const target = newName.trim();
    if (!target || oldName === target) return;

    try {
        await departmentsAPI.update(oldName, target);
        departmentsCache = getDepartments().map(d => d === oldName ? target : d);
        usersCache = usersCache.map(u => u.department === oldName ? { ...u, department: target } : u);
        cacheState.departments.lastFetch = Date.now();
        cacheState.users.lastFetch = Date.now();
        notifyUserSubscribers();
        dispatchUpdate();
    } catch (error) {
        console.error('更新部门到服务器失败:', error);
        throw error;
    }
};

export const deleteDepartment = async (name: string) => {
    if (!localStorage.getItem('okr_token')) {
        throw new Error('未登录');
    }

    try {
        await departmentsAPI.delete(name);
        departmentsCache = getDepartments().filter(d => d !== name);
        cacheState.departments.lastFetch = Date.now();
        dispatchUpdate();
    } catch (error) {
        console.error('删除部门失败:', error);
        throw error;
    }
};

export const getRoles = (): {value: string, label: string}[] => {
    // 后台自动刷新（如果缓存过期或为空）
    if (customRolesCache.length === 0 || Date.now() - cacheState.customRoles.lastFetch > CACHE_TTL) {
        refreshCustomRolesInBackground();
    }
    
    const builtIn = Object.entries(ROLE_NAMES).map(([key, label]) => ({
        value: key,
        label: label
    }));
    
    return [...builtIn, ...customRolesCache];
};

export const addRole = async (key: string, label: string) => {
    if (!localStorage.getItem('okr_token')) {
        throw new Error('未登录');
    }

    if (customRolesCache.some(r => r.value === key)) return;

    try {
        const result = await customRolesAPI.create({ value: key, label });
        if (!result.success) {
            throw new Error('添加自定义角色失败');
        }

        const serverRole = result.data?.role;
        if (serverRole && typeof serverRole === 'object' && 'value' in serverRole) {
            customRolesCache = [...customRolesCache, { value: serverRole.value, label: serverRole.label }];
        } else {
            await refreshCustomRolesInBackground();
        }

        cacheState.customRoles.lastFetch = Date.now();
        dispatchUpdate();
    } catch (error) {
        console.error('添加自定义角色到服务器失败:', error);
        throw error;
    }
};

export const updateCustomRole = async (key: string, newLabel: string) => {
    if (!localStorage.getItem('okr_token')) {
        throw new Error('未登录');
    }

    if (!customRolesCache.some(r => r.value === key)) return;

    try {
        const result = await customRolesAPI.update(key, newLabel);
        if (!result.success) {
            throw new Error('更新自定义角色失败');
        }

        const idx = customRolesCache.findIndex(r => r.value === key);
        if (idx >= 0) customRolesCache[idx] = { ...customRolesCache[idx], label: newLabel };

        cacheState.customRoles.lastFetch = Date.now();
        dispatchUpdate();
    } catch (error) {
        console.error('更新自定义角色到服务器失败:', error);
        throw error;
    }
};

export const deleteCustomRole = async (key: string) => {
    if (!localStorage.getItem('okr_token')) {
        throw new Error('未登录');
    }

    try {
        await customRolesAPI.delete(key);
        customRolesCache = customRolesCache.filter(r => r.value !== key);
        cacheState.customRoles.lastFetch = Date.now();
        dispatchUpdate();

        // 同步删除该角色对应的审批流程配置
        const workflows = getWorkflows().filter(w => w.targetRole !== key);
        await saveAllWorkflows(workflows);
    } catch (error) {
        console.error('删除自定义角色到服务器失败:', error);
        throw error;
    }
};

export const getOKRs = (): OKR[] => {
    // 后台自动刷新（如果缓存过期或为空）
    if (okrsCache.length === 0 || Date.now() - cacheState.okrs.lastFetch > CACHE_TTL) {
        refreshOKRsInBackground();
    }
    
    return okrsCache;
};

export const saveOKR = async (okr: OKR) => {
    try {
        if (!localStorage.getItem('okr_token')) {
            throw new Error('未登录');
        }

        const applyServerOKRToCache = (serverOKR: OKR) => {
            const idx = okrsCache.findIndex(o => o.id === serverOKR.id);
            if (idx >= 0) okrsCache[idx] = serverOKR;
            else okrsCache.push(serverOKR);
            cacheState.okrs.lastFetch = Date.now();
            dispatchUpdate();
        };

        let serverOKR: OKR | undefined;

        // 新创建的 OKR 在前端通常没有 version，需要走 create
        if (okr.version === undefined) {
            const result = await okrsAPI.create(okr);
            if (!result.success || !result.data?.okr) {
                throw new Error(`API 返回失败: ${JSON.stringify(result)}`);
            }
            serverOKR = result.data.okr;
            applyServerOKRToCache(serverOKR);
            return;
        }

        // 有 version：优先 update，失败时处理 404/版本冲突
        try {
            const result = await okrsAPI.update(okr.id, { ...okr, version: okr.version });
            if (!result.success || !result.data?.okr) {
                throw new Error(`API 返回失败: ${JSON.stringify(result)}`);
            }
            serverOKR = result.data.okr;
            applyServerOKRToCache(serverOKR);
            return;
        } catch (apiError: any) {
            const msg = String(apiError?.message || apiError);

            // OKR 不存在 => 创建
            if (msg.includes('OKR 不存在') || msg.includes('404') || msg.includes('NOT_FOUND')) {
                const result = await okrsAPI.create(okr);
                if (!result.success || !result.data?.okr) {
                    throw new Error(`API 返回失败: ${JSON.stringify(result)}`);
                }
                serverOKR = result.data.okr;
                applyServerOKRToCache(serverOKR);
                return;
            }

            // 版本冲突 => 拉取最新 version 后重试一次
            if (msg.includes('版本冲突') || msg.includes('409') || msg.includes('VERSION_CONFLICT') || msg.includes('Conflict')) {
                const latestResult = await okrsAPI.getById(okr.id);
                if (!latestResult.success || !latestResult.data?.okr) {
                    throw apiError;
                }
                const latestOKR = latestResult.data.okr;
                const retryResult = await okrsAPI.update(okr.id, { ...okr, version: latestOKR.version });
                if (!retryResult.success || !retryResult.data?.okr) {
                    throw new Error(`API 返回失败: ${JSON.stringify(retryResult)}`);
                }
                serverOKR = retryResult.data.okr;
                applyServerOKRToCache(serverOKR);
                return;
            }

            throw apiError;
        }
    } catch (error: any) {
        console.error('[saveOKR] 保存失败:', error);
        throw error;
    }
};

export const deleteOKR = async (id: string) => {
    if (!localStorage.getItem('okr_token')) {
        throw new Error('未登录');
    }

    try {
        await okrsAPI.delete(id);
        okrsCache = okrsCache.filter(o => o.id !== id);
        cacheState.okrs.lastFetch = Date.now();
        dispatchUpdate();
    } catch (error) {
        console.error('删除 OKR 失败:', error);
        throw error;
    }
};

export const importMyOKRByAI = async (payload: {
  textContent?: string;
  fileName?: string;
  mimeType?: string;
  imageBase64?: string;
  imageList?: Array<{ base64: string; mimeType?: string }>;
  fileBase64?: string;
  importLevel?: 'COMPANY' | 'DEPARTMENT' | 'PERSONAL';
}) => {
    if (!localStorage.getItem('okr_token')) {
        throw new Error('未登录');
    }

    // 导入归属：始终以“当前视角用户”为准（管理员预览时会把目标用户传给后端）
    const currentViewUserId = localStorage.getItem(STORAGE_KEYS.CURRENT_USER_ID) || getCurrentUser()?.id;
    const reqPayload = currentViewUserId ? { ...payload, importUserId: currentViewUserId } : payload;

    const result = await okrsAPI.importByAI(reqPayload as any);
    if (!result.success || !result.data?.okr) {
        throw new Error('AI 导入失败');
    }
    const serverOKR = result.data.okr;
    const idx = okrsCache.findIndex(o => o.id === serverOKR.id);
    if (idx >= 0) okrsCache[idx] = serverOKR;
    else okrsCache.push(serverOKR);
    cacheState.okrs.lastFetch = Date.now();
    dispatchUpdate();
    return serverOKR;
};

/**
 * 在“我的 OKR”列表中，上下移动卡片优先级。
 * - 使用 display_order 作为持久化字段
 * - 当管理员切换视角/预览模式时，需要把 targetUserId 传给后端
 */
export const moveOKRPriority = async (
  okrId: string,
  direction: 'up' | 'down'
): Promise<void> => {
  if (!localStorage.getItem('okr_token')) {
    throw new Error('未登录');
  }

  const targetUserId = localStorage.getItem(STORAGE_KEYS.CURRENT_USER_ID) || getCurrentUser()?.id;
  if (!targetUserId) {
    throw new Error('无法获取当前视角用户');
  }

  // request() 在 HTTP 非 2xx 时会直接 throw，所以这里无需读取 result.error
  await okrsAPI.movePriority(okrId, { direction, targetUserId });

  // 直接刷新缓存，确保 UI 顺序立刻生效
  const allRes = await okrsAPI.getAll();
  if (allRes.success && allRes.data?.okrs) {
    okrsCache = allRes.data.okrs;
    cacheState.okrs.lastFetch = Date.now();
    dispatchUpdate();
  }
};

/**
 * 将多个 OKR 合并为一个新的 OKR。
 * 由后端完成 objectives 扁平化/权重缩放，并把源 OKR 置为 CLOSED，避免多次审批。
 */
export const mergeMyOKRs = async (okrIds: string[]): Promise<void> => {
  if (!localStorage.getItem('okr_token')) {
    throw new Error('未登录');
  }
  if (!okrIds || okrIds.length < 2) {
    throw new Error('请至少选择 2 个 OKR');
  }

  const targetUserId = localStorage.getItem(STORAGE_KEYS.CURRENT_USER_ID) || getCurrentUser()?.id;
  if (!targetUserId) {
    throw new Error('无法获取当前视角用户');
  }

  await okrsAPI.mergeOKRs({ okrIds, targetUserId });

  // 刷新全量 OKR 缓存，保证列表顺序与其他页面一致
  const allRes = await okrsAPI.getAll();
  if (allRes.success && allRes.data?.okrs) {
    okrsCache = allRes.data.okrs;
    cacheState.okrs.lastFetch = Date.now();
    dispatchUpdate();
  }
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

export const updateOKRStatus = async (id: string, status: OKRStatus) => {
    console.log('[updateOKRStatus] 开始更新状态:', id, '新状态:', status);
    
    // 从缓存中获取最新的 OKR（包含更新后的版本号）
    const okrs = getOKRs();
    const okr = okrs.find(o => o.id === id);
    if (!okr) {
        console.error('[updateOKRStatus] 无法找到 OKR:', id);
        throw new Error(`无法找到 OKR: ${id}`);
    }
    
    // 检查用户是否已登录
    const token = localStorage.getItem('okr_token');
    if (!token) {
        throw new Error('未登录');
    }
    
    // 使用专门的更新状态 API，支持版本冲突重试
    const maxRetries = 3;
    let retryCount = 0;
    
    while (retryCount < maxRetries) {
        try {
            // 每次重试前都重新获取最新的版本号
            const currentOKRs = getOKRs();
            const currentOKR = currentOKRs.find(o => o.id === id);
            if (!currentOKR) {
                throw new Error(`无法找到 OKR: ${id}`);
            }
            
            const versionToSend = currentOKR.version ?? okr.version ?? 1;
            console.log(`[updateOKRStatus] 尝试 ${retryCount + 1}/${maxRetries}, 版本号: ${versionToSend}`);
            
            const result = await okrsAPI.updateStatus(id, status, versionToSend);
            console.log('[updateOKRStatus] API 响应:', result);
            
            if (result.success && result.data?.okr) {
                // 用服务器返回的最新数据更新缓存
                const serverOKR = result.data.okr;
                const cacheIdx = okrsCache.findIndex(o => o.id === serverOKR.id);
                if (cacheIdx >= 0) {
                    okrsCache[cacheIdx] = serverOKR;
                } else {
                    okrsCache.push(serverOKR);
                }
                cacheState.okrs.lastFetch = Date.now();
                dispatchUpdate();
                console.log('[updateOKRStatus] 更新完成，服务器返回的 OKR:', serverOKR);
                
                const currentUser = getCurrentUser();
                addLog('UPDATE_STATUS', 'OKR', `OKR "${serverOKR.title}" 状态变更为 ${status}`, currentUser?.id, currentUser?.name);
                return; // 成功，退出重试循环
            } else {
                console.error('[updateOKRStatus] API 返回失败:', result);
                throw new Error(`API 返回失败: ${JSON.stringify(result)}`);
            }
        } catch (error: any) {
            // 检查是否是版本冲突错误
            const isVersionConflict = error.message && (
                error.message.includes('版本冲突') || 
                error.message.includes('409') || 
                error.message.includes('VERSION_CONFLICT') ||
                error.message.includes('Conflict')
            );
            
            if (isVersionConflict && retryCount < maxRetries - 1) {
                // 版本冲突：从服务器获取最新版本号，然后重试
                console.log(`[updateOKRStatus] 版本冲突，刷新缓存后重试 (${retryCount + 1}/${maxRetries}):`, id);
                try {
                    // 从服务器获取最新的 OKR（包含最新版本号）
                    const latestResult = await okrsAPI.getById(id);
                    if (latestResult.success && latestResult.data?.okr) {
                        const latestOKR = latestResult.data.okr;
                        // 更新缓存
                        const cacheIdx = okrsCache.findIndex(o => o.id === latestOKR.id);
                        if (cacheIdx >= 0) {
                            okrsCache[cacheIdx] = latestOKR;
                        } else {
                            okrsCache.push(latestOKR);
                        }
                        console.log(`[updateOKRStatus] 已刷新缓存，最新版本号: ${latestOKR.version}`);
                        retryCount++;
                        // 继续重试
                        continue;
                    }
                } catch (refreshError) {
                    console.error('[updateOKRStatus] 刷新缓存失败:', refreshError);
                }
            }
            
            // 如果不是版本冲突，或者重试次数已用完，抛出错误
            console.error('[updateOKRStatus] API 调用失败:', error);
            throw error;
        }
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
    // 后台自动刷新（如果缓存过期或为空）
    if (gradeConfigsCache.length === 0 || Date.now() - cacheState.gradeConfigs.lastFetch > CACHE_TTL) {
        refreshGradeConfigsInBackground();
    }
    
    return gradeConfigsCache.length > 0 ? gradeConfigsCache : DEFAULT_GRADE_CONFIGS;
};

export const saveGradeConfigs = async (configs: GradeConfiguration[]) => {
    if (!localStorage.getItem('okr_token')) {
        throw new Error('未登录');
    }

    try {
        await gradeConfigsAPI.saveAll(configs);
        gradeConfigsCache = configs;
        cacheState.gradeConfigs.lastFetch = Date.now();
        dispatchUpdate();
    } catch (error) {
        console.error('保存绩效等级配置到服务器失败:', error);
        throw error;
    }
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
    // 后台自动刷新（如果缓存过期或为空）
    if (workflowsCache.length === 0 || Date.now() - cacheState.workflows.lastFetch > CACHE_TTL) {
        refreshWorkflowsInBackground();
    }
    
    return workflowsCache.length > 0 ? workflowsCache : DEFAULT_WORKFLOWS;
};

const saveAllWorkflows = async (workflows: ApprovalWorkflow[]) => {
    if (!localStorage.getItem('okr_token')) {
        throw new Error('未登录');
    }

    // 先刷新，确保能拿到服务器端完整的现有流程列表，避免创建时撞唯一约束
    await refreshWorkflowsInBackground();

    if (workflowsCache.length === 0) {
        throw new Error('未能从服务器加载审批流程，无法保存');
    }

    // 后台同步到服务器（需要逐个保存）
    try {
        // 先删除所有现有流程
        for (const wf of workflowsCache) {
            await workflowsAPI.delete(wf.targetRole);
        }

        // 然后创建新流程
        for (const wf of workflows) {
            await workflowsAPI.create(wf);
        }

        workflowsCache = workflows;
        cacheState.workflows.lastFetch = Date.now();
        dispatchUpdate();
    } catch (error) {
        console.error('保存审批流程到服务器失败:', error);
        throw error;
    }
};

export const saveWorkflow = async (workflow: ApprovalWorkflow) => {
    const flows = getWorkflows();
    const idx = flows.findIndex(w => w.targetRole === workflow.targetRole);
    if (idx >= 0) {
        flows[idx] = workflow;
    } else {
        flows.push(workflow);
    }
    await saveAllWorkflows(flows);
};

export const deleteWorkflow = async (targetRole: string) => {
    let flows = getWorkflows();
    flows = flows.filter(w => w.targetRole !== targetRole);
    // 等待保存完成，确保数据已从服务器删除
    await saveAllWorkflows(flows);
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
    // 后台自动刷新（如果缓存过期或为空）
    if (logsCache.length === 0 || Date.now() - cacheState.logs.lastFetch > CACHE_TTL) {
        refreshLogsInBackground();
    }
    
    return logsCache;
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
    logsCache = logs;
    cacheState.logs.lastFetch = Date.now();
    dispatchUpdate();
};

export const getWeComConfig = (): WeComConfig => {
    // 不再从本地缓存读取：配置以数据库为准
    return { corpId: '', agentId: '', secret: '', enabled: false };
};

export const saveWeComConfig = async (cfg: WeComConfig) => {
    try {
        // 保存到后端
        const { configsAPI } = await import('./api');
        const result = await configsAPI.saveWeCom(cfg);
        if (result.success && result.data?.config) {
            dispatchUpdate();
        } else {
            throw new Error('保存配置失败');
        }
    } catch (error: any) {
        console.error('保存企业微信配置失败:', error);
        throw error;
    }
};

export const getSSOConfig = (): SSOConfig => {
    // 不再从本地缓存读取：配置以数据库为准
    return { metadataUrl: '', clientId: '', clientSecret: '', enabled: false };
};

export const saveSSOConfig = async (cfg: SSOConfig) => {
    try {
        // 保存到后端
        const { configsAPI } = await import('./api');
        const result = await configsAPI.saveSSO(cfg);
        if (result.success && result.data?.config) {
            dispatchUpdate();
        } else {
            throw new Error('保存配置失败');
        }
    } catch (error: any) {
        console.error('保存 SSO 配置失败:', error);
        throw error;
    }
};

export const getBadgeCounts = (user: User) => {
    const okrs = getOKRs();
    const workflows = getWorkflows();
    
    // Helper function to check if user is a cadre (leader)
    const isCadreRole = (r: Role | string) => workflows.some(w => w.approverRoleL1 === r || w.approverRoleL2 === r);
    
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
    
    // 1. 我的绩效：自己的 OKR 在 PUBLISHED 状态且未归档（与页面内 myActionCount 逻辑完全一致）
    // 页面内：myActionCount = myOKRs.filter(o => o.status === OKRStatus.PUBLISHED).length;
    // 注意：页面内 myOKRs 已经过滤了所有状态，但 myActionCount 只计算 PUBLISHED 状态
    const self = okrs.filter(o => 
        o.userId === user.id && 
        o.status === OKRStatus.PUBLISHED && 
        !o.isPerformanceArchived
    ).length;
    
    // 2. 受邀协作评估：评估阶段的协作反馈（Peer Review 或 CC）
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

    // 3. 团队成员评估和直属&跨级团队评估：需要处理的待办数量
    // 使用与页面内相同的逻辑计算
    const getActionCount = (list: OKR[]) => {
        if (user.role === Role.ADMIN) return 0;
        const activeList = list.filter(o => !o.isPerformanceArchived);
        return activeList.filter(o => {
            const { l1, l2, l3 } = getApproverRoles(o);
            if (user.role === l1 && o.status === OKRStatus.PENDING_ASSESSMENT_APPROVAL) return true;
            if (user.role === l2 && o.status === OKRStatus.PENDING_L2_APPROVAL) return true;
            if (user.role === l3 && o.status === OKRStatus.PENDING_L3_APPROVAL) return true;
            if (user.role === Role.PRESIDENT && o.level === OKRLevel.DEPARTMENT && o.status === OKRStatus.PENDING_ASSESSMENT_APPROVAL) return true;
            return false;
        }).length;
    };

    // 获取所有可访问的团队 OKR（与页面内逻辑一致）
    const isManagerOrApprover = user.role === Role.ADMIN || workflows.some(w => 
        w.approverRoleL1 === user.role || 
        w.approverRoleL2 === user.role || 
        w.approverRoleL3 === user.role
    );
    
    const isCrossLevelApprover = user.role === Role.ADMIN || workflows.some(w => w.approverRoleL2 === user.role || w.approverRoleL3 === user.role);
    
    const isDeptHead = [Role.BUSINESS_HEAD, Role.TECH_HEAD, Role.QA_HEAD].includes(user.role as Role);
    const isTeamPrimaryLead = user.isPrimaryApprover || false;
    
    // 计算跨级管理的部门（简化版，与页面内逻辑保持一致）
    const allUsers = getUsers();
    const crossLevelManagedDepts = new Set<string>();
    if (isCrossLevelApprover || user.role === Role.PRESIDENT) {
        if (user.role === Role.ADMIN || user.role === Role.PRESIDENT) {
            allUsers.forEach(u => { if (u.department) crossLevelManagedDepts.add(u.department); });
        } else {
            allUsers.forEach(u => {
                if (u.id === user.id) return;
                const dummyOKR: OKR = { 
                    id: 'temp', userId: u.id, userName: u.name, level: OKRLevel.PERSONAL, 
                    department: u.department, title: 'dummy', period: '', status: OKRStatus.DRAFT, 
                    objectives: [], createdAt: '' 
                };
                const { l1, l2, l3 } = getApproverRoles(dummyOKR);
                if (l2 === user.role || l3 === user.role || l1 === user.role) {
                    if (u.department) crossLevelManagedDepts.add(u.department);
                }
            });
            if (user.department) crossLevelManagedDepts.add(user.department);
        }
    }

    const allAccessibleTeamOKRs = isManagerOrApprover
        ? okrs.filter(o => {
            if (o.userId === user.id) return false;
            if (user.role === Role.ADMIN || user.role === Role.PRESIDENT) return true;
            
            const isSubmitted = o.status !== OKRStatus.DRAFT && o.status !== OKRStatus.PENDING_MANAGER && o.status !== OKRStatus.PENDING_GM;
            if (!isSubmitted) return false;
            
            const { l1, l2, l3 } = getApproverRoles(o);
            let isL1Approver = user.role === l1;
            if (isL1Approver && isDeptHead && o.department !== user.department) isL1Approver = false;
            
            const isCrossApprover = (user.role === l2 || user.role === l3);
            const isDeptView = isDeptHead && o.department === user.department;
            const isCrossDeptView = isCrossLevelApprover && crossLevelManagedDepts.has(o.department || '');
            const isPrimaryView = isTeamPrimaryLead && o.department === user.department;
            
            return isL1Approver || isCrossApprover || isDeptView || isCrossDeptView || isPrimaryView;
        })
        : [];

    // 区分成员和干部
    const leaderOKRs = allAccessibleTeamOKRs.filter(o => {
        const targetUser = allUsers.find(u => u.id === o.userId);
        return targetUser && isCadreRole(targetUser.role);
    });
    
    const memberOKRs = allAccessibleTeamOKRs.filter(o => {
        const targetUser = allUsers.find(u => u.id === o.userId);
        return targetUser && !isCadreRole(targetUser.role);
    });

    // 计算需要处理的数量（与页面内逻辑完全一致）
    const memberActionCount = getActionCount(memberOKRs);
    const leaderActionCount = getActionCount(leaderOKRs);

    // 总评估数量 = 我的绩效 + 受邀协作评估 + 团队成员评估 + 直属&跨级团队评估
    const totalAssessmentCount = self + assessmentPhaseFeedbackCount + memberActionCount + leaderActionCount;

    return {
        approvals: approvalCount + creationSuggestionCount,
        assessments: totalAssessmentCount
    };
};
