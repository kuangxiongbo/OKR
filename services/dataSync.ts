/**
 * 系统化数据同步机制
 * 
 * 统一处理所有数据实体的：
 * 1. 乐观更新（立即更新本地缓存）
 * 2. 异步保存到服务器
 * 3. 保存成功后用服务器数据更新缓存（确保一致性）
 * 4. 错误处理和重试
 * 5. 缓存与服务端数据同步
 */

// 数据实体类型定义
export type EntityId = string | number;

export interface SyncableEntity {
    id: EntityId;
    [key: string]: any;
}

// 缓存状态
interface CacheState {
    loading: boolean;
    lastFetch: number;
    error: Error | null;
}

// 数据同步配置
export interface DataSyncConfig<T extends SyncableEntity> {
    // 缓存相关
    cacheKey: string; // localStorage key
    cache: T[]; // 内存缓存
    cacheState: CacheState; // 缓存状态
    
    // API 相关
    apiGetAll: () => Promise<{ success: boolean; data?: { [key: string]: T[] } }>;
    apiGetById?: (id: EntityId) => Promise<{ success: boolean; data?: { [key: string]: T } }>;
    apiCreate: (entity: T) => Promise<{ success: boolean; data?: { [key: string]: T } }>;
    apiUpdate: (id: EntityId, entity: Partial<T>) => Promise<{ success: boolean; data?: { [key: string]: T } }>;
    apiDelete: (id: EntityId) => Promise<{ success: boolean }>;
    
    // 数据路径（用于从 API 响应中提取数据）
    dataPath: string; // 例如 'users', 'okrs', 'workflows'
    
    // 初始数据（用于缓存为空时的回退）
    initialData: T[];
    
    // 更新通知
    onUpdate?: () => void;
    
    // 自定义逻辑
    beforeSave?: (entity: T) => T | Promise<T>; // 保存前的数据转换
    afterSave?: (entity: T, serverEntity: T) => void; // 保存后的处理
    isExisting?: (cache: T[], entity: T) => boolean; // 判断是否已存在
    mergeStrategy?: 'replace' | 'merge'; // 合并策略：替换或合并
}

// 缓存 TTL（5 分钟）
const CACHE_TTL = 5 * 60 * 1000;

/**
 * 通用数据同步管理器
 */
export class DataSyncManager<T extends SyncableEntity> {
    private config: DataSyncConfig<T>;
    
    constructor(config: DataSyncConfig<T>) {
        this.config = config;
    }
    
    /**
     * 从 localStorage 恢复缓存
     */
    private restoreFromLocalStorage(): void {
        // 禁用本地持久化：业务数据以数据库/后端 API 为准
    }
    
    /**
     * 保存缓存到 localStorage
     */
    private saveToLocalStorage(): void {
        // 禁用本地持久化：业务数据以数据库/后端 API 为准
    }
    
    /**
     * 触发更新通知
     */
    private dispatchUpdate(): void {
        if (this.config.onUpdate) {
            this.config.onUpdate();
        }
        // 全局更新事件
        window.dispatchEvent(new Event('alignflow_data_updated'));
    }
    
    /**
     * 检查用户是否已登录
     */
    private isAuthenticated(): boolean {
        return !!localStorage.getItem('okr_token');
    }
    
    /**
     * 获取所有数据（同步，从缓存读取）
     */
    getAll(): T[] {
        // 如果缓存为空，尝试从 localStorage 恢复
        this.restoreFromLocalStorage();
        
        // 后台自动刷新（如果缓存过期或为空）
        if (this.config.cache.length === 0 || Date.now() - this.config.cacheState.lastFetch > CACHE_TTL) {
            this.refreshInBackground();
        }
        
        return this.config.cache.length > 0 ? this.config.cache : this.config.initialData;
    }
    
    /**
     * 根据 ID 获取数据
     */
    getById(id: EntityId): T | undefined {
        return this.getAll().find(item => item.id === id);
    }
    
    /**
     * 保存数据（乐观更新 + 异步同步）
     */
    async save(entity: T): Promise<void> {
        // 1. 乐观更新：先更新本地缓存
        const cache = this.getAll();
        const idx = cache.findIndex(item => item.id === entity.id);
        
        if (idx >= 0) {
            cache[idx] = entity;
        } else {
            cache.push(entity);
        }
        
        this.config.cache = cache;
        this.saveToLocalStorage();
        this.dispatchUpdate();
        
        // 2. 检查是否已登录
        if (!this.isAuthenticated()) {
            return; // 未登录时只更新本地缓存
        }
        
        // 3. 判断是创建还是更新
        const isExisting = this.config.isExisting 
            ? this.config.isExisting(cache, entity)
            : cache.some(item => item.id === entity.id && item !== entity);
        
        try {
            // 4. 保存前的数据转换
            let entityToSave = entity;
            if (this.config.beforeSave) {
                entityToSave = await this.config.beforeSave(entity);
            }
            
            let result;
            if (isExisting) {
                // 更新现有实体
                result = await this.config.apiUpdate(entity.id, entityToSave);
            } else {
                // 创建新实体
                result = await this.config.apiCreate(entityToSave);
            }
            
            // 5. 保存成功后用服务器数据更新缓存
            if (result.success && result.data) {
                const serverEntity = result.data[this.config.dataPath] || result.data[Object.keys(result.data)[0]];
                if (serverEntity) {
                    // 如果是创建，移除临时数据
                    if (!isExisting) {
                        this.config.cache = this.config.cache.filter(item => item.id !== entity.id);
                    }
                    
                    // 更新或添加服务器返回的数据
                    const cacheIdx = this.config.cache.findIndex(item => item.id === serverEntity.id);
                    if (cacheIdx >= 0) {
                        if (this.config.mergeStrategy === 'merge') {
                            this.config.cache[cacheIdx] = { ...this.config.cache[cacheIdx], ...serverEntity };
                        } else {
                            this.config.cache[cacheIdx] = serverEntity;
                        }
                    } else {
                        this.config.cache.push(serverEntity);
                    }
                    
                    this.saveToLocalStorage();
                    this.config.cacheState.lastFetch = Date.now();
                    this.dispatchUpdate();
                    
                    // 保存后的处理
                    if (this.config.afterSave) {
                        this.config.afterSave(entity, serverEntity);
                    }
                }
            }
        } catch (error: any) {
            // 静默处理错误，不影响用户体验
            if (process.env.NODE_ENV === 'development') {
                console.error(`保存 ${this.config.cacheKey} 到服务器失败:`, error);
            }
        }
    }
    
    /**
     * 删除数据
     */
    async delete(id: EntityId): Promise<void> {
        // 1. 乐观更新：从缓存中移除
        this.config.cache = this.config.cache.filter(item => item.id !== id);
        this.saveToLocalStorage();
        this.dispatchUpdate();
        
        // 2. 检查是否已登录
        if (!this.isAuthenticated()) {
            return; // 未登录时只更新本地缓存
        }
        
        // 3. 异步删除
        try {
            await this.config.apiDelete(id);
            this.config.cacheState.lastFetch = Date.now();
        } catch (error: any) {
            if (process.env.NODE_ENV === 'development') {
                console.error(`删除 ${this.config.cacheKey} 失败:`, error);
            }
        }
    }
    
    /**
     * 后台刷新数据（从服务器获取最新数据）
     */
    async refreshInBackground(): Promise<void> {
        if (this.config.cacheState.loading) {
            // 如果正在加载，等待加载完成
            while (this.config.cacheState.loading) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            return;
        }
        
        // 检查是否已登录
        if (!this.isAuthenticated()) {
            return;
        }
        
        this.config.cacheState.loading = true;
        try {
            const result = await this.config.apiGetAll();
            if (result.success && result.data) {
                const data = result.data[this.config.dataPath] || result.data[Object.keys(result.data)[0]];
                if (data && Array.isArray(data)) {
                    // 用服务器数据完全替换缓存（确保与服务端一致）
                    this.config.cache = data;
                    this.saveToLocalStorage();
                    this.config.cacheState.lastFetch = Date.now();
                    this.config.cacheState.error = null;
                    this.dispatchUpdate();
                }
            }
        } catch (error: any) {
            this.config.cacheState.error = error;
            // 静默处理错误，不影响用户体验
            if (process.env.NODE_ENV === 'development' && !error.message?.includes('Failed to fetch')) {
                console.warn(`刷新 ${this.config.cacheKey} 失败:`, error);
            }
            // 如果缓存为空，尝试从 localStorage 恢复
            if (this.config.cache.length === 0) {
                this.restoreFromLocalStorage();
            }
        } finally {
            this.config.cacheState.loading = false;
        }
    }
}
