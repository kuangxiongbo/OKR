/**
 * DataSyncManager 使用示例
 * 
 * 展示如何使用系统化的数据同步机制来管理各种数据实体
 */

import { DataSyncManager, DataSyncConfig, SyncableEntity } from './dataSync';
import { usersAPI, okrsAPI, workflowsAPI, gradeConfigsAPI, departmentsAPI, customRolesAPI } from './api';
import { User, OKR, ApprovalWorkflow, GradeConfiguration } from '../types';

// ============================================
// 示例 1: Users 数据同步
// ============================================

// 1. 定义缓存和状态
let usersCache: User[] = [];
const usersCacheState = {
    loading: false,
    lastFetch: 0,
    error: null as Error | null
};

// 2. 创建配置
const usersSyncConfig: DataSyncConfig<User> = {
    cacheKey: 'alignflow_users',
    cache: usersCache,
    cacheState: usersCacheState,
    apiGetAll: usersAPI.getAll,
    apiCreate: usersAPI.create,
    apiUpdate: usersAPI.update,
    apiDelete: usersAPI.delete,
    dataPath: 'users',
    initialData: [], // 从 INITIAL_USERS 导入
    onUpdate: () => {
        // 自定义更新逻辑，例如通知用户订阅者
        // notifyUserSubscribers();
    },
    isExisting: (cache, entity) => {
        return cache.some(u => u.id === entity.id);
    },
    mergeStrategy: 'replace' // 或 'merge'
};

// 3. 创建管理器实例
const usersSyncManager = new DataSyncManager<User>(usersSyncConfig);

// 4. 导出使用函数（保持原有 API 不变）
export const getUsers = (): User[] => {
    return usersSyncManager.getAll();
};

export const saveUser = async (user: User): Promise<void> => {
    await usersSyncManager.save(user);
};

export const deleteUser = async (id: string): Promise<void> => {
    await usersSyncManager.delete(id);
};

// ============================================
// 示例 2: OKRs 数据同步（带自定义逻辑）
// ============================================

let okrsCache: OKR[] = [];
const okrsCacheState = {
    loading: false,
    lastFetch: 0,
    error: null as Error | null
};

const okrsSyncConfig: DataSyncConfig<OKR> = {
    cacheKey: 'alignflow_okrs',
    cache: okrsCache,
    cacheState: okrsCacheState,
    apiGetAll: okrsAPI.getAll,
    apiCreate: okrsAPI.create,
    apiUpdate: okrsAPI.update,
    apiDelete: okrsAPI.delete,
    dataPath: 'okrs',
    initialData: [], // 从 INITIAL_OKRS 导入
    beforeSave: async (okr) => {
        // 保存前的数据转换，例如添加版本号
        return { ...okr, version: okr.version || 1 };
    },
    afterSave: (localOKR, serverOKR) => {
        // 保存后的处理，例如记录日志
        // addLog('SAVE_OKR', 'OKR', `保存 OKR: ${serverOKR.title}`);
    },
    isExisting: (cache, okr) => {
        // 自定义判断逻辑：检查缓存中是否存在
        return cache.some(o => o.id === okr.id);
    },
    mergeStrategy: 'replace'
};

const okrsSyncManager = new DataSyncManager<OKR>(okrsSyncConfig);

export const getOKRs = (): OKR[] => {
    return okrsSyncManager.getAll();
};

export const saveOKR = async (okr: OKR): Promise<void> => {
    await okrsSyncManager.save(okr);
};

export const deleteOKR = async (id: string): Promise<void> => {
    await okrsSyncManager.delete(id);
};

// ============================================
// 示例 3: Workflows 数据同步（批量操作）
// ============================================

let workflowsCache: ApprovalWorkflow[] = [];
const workflowsCacheState = {
    loading: false,
    lastFetch: 0,
    error: null as Error | null
};

const workflowsSyncConfig: DataSyncConfig<ApprovalWorkflow> = {
    cacheKey: 'alignflow_workflows',
    cache: workflowsCache,
    cacheState: workflowsCacheState,
    apiGetAll: workflowsAPI.getAll,
    apiCreate: workflowsAPI.create,
    apiUpdate: async (targetRole, workflow) => {
        // Workflows 使用 targetRole 作为 ID，需要先删除再创建
        await workflowsAPI.delete(targetRole);
        return await workflowsAPI.create(workflow);
    },
    apiDelete: workflowsAPI.delete,
    dataPath: 'workflows',
    initialData: [], // 从 DEFAULT_WORKFLOWS 导入
    isExisting: (cache, workflow) => {
        return cache.some(w => w.targetRole === workflow.targetRole);
    }
};

const workflowsSyncManager = new DataSyncManager<ApprovalWorkflow>(workflowsSyncConfig);

export const getWorkflows = (): ApprovalWorkflow[] => {
    return workflowsSyncManager.getAll();
};

export const saveWorkflow = async (workflow: ApprovalWorkflow): Promise<void> => {
    await workflowsSyncManager.save(workflow);
};

// ============================================
// 示例 4: GradeConfigs 数据同步（数组整体保存）
// ============================================

let gradeConfigsCache: GradeConfiguration[] = [];
const gradeConfigsCacheState = {
    loading: false,
    lastFetch: 0,
    error: null as Error | null
};

// 对于数组整体保存的情况，可以创建一个包装器
class GradeConfigsSyncManager {
    private manager: DataSyncManager<GradeConfiguration>;
    
    constructor() {
        // 注意：这里需要特殊处理，因为 gradeConfigs 是整体保存的
        // 可以创建一个虚拟的"容器"实体来管理整个数组
        // 或者扩展 DataSyncManager 支持数组整体操作
    }
    
    async saveAll(configs: GradeConfiguration[]): Promise<void> {
        // 实现整体保存逻辑
    }
}

// ============================================
// 迁移指南
// ============================================

/**
 * 从现有代码迁移到 DataSyncManager 的步骤：
 * 
 * 1. 识别数据实体
 *    - 找出所有需要同步的数据类型（Users, OKRs, Workflows 等）
 * 
 * 2. 创建配置
 *    - 定义缓存变量和状态
 *    - 配置 API 调用函数
 *    - 设置数据路径和初始数据
 * 
 * 3. 创建管理器实例
 *    - 使用配置创建 DataSyncManager 实例
 * 
 * 4. 替换现有函数
 *    - 将 getXxx() 替换为 manager.getAll()
 *    - 将 saveXxx() 替换为 manager.save()
 *    - 将 deleteXxx() 替换为 manager.delete()
 * 
 * 5. 测试验证
 *    - 确保数据保存和同步正常工作
 *    - 确保缓存更新正确
 *    - 确保错误处理正确
 * 
 * 6. 清理旧代码
 *    - 删除重复的缓存管理代码
 *    - 删除重复的同步逻辑
 */
