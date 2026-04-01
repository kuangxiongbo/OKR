# 系统化数据同步机制

## 问题背景

当前系统中，每个数据实体（Users, OKRs, Workflows, GradeConfigs, Departments, CustomRoles）都有类似的保存和缓存同步逻辑，但都是分散实现的。这导致：

1. **代码重复**：每个实体都有相似的乐观更新、异步保存、缓存同步逻辑
2. **维护困难**：修改同步逻辑需要在多个地方修改
3. **不一致问题**：不同实体的实现可能有细微差异，导致行为不一致
4. **难以统一处理**：错误处理、重试机制、数据一致性保证难以统一

## 解决方案

设计了系统化的数据同步机制 `DataSyncManager`，统一处理所有数据实体的：

- ✅ 乐观更新（立即更新本地缓存）
- ✅ 异步保存到服务器
- ✅ 保存成功后用服务器数据更新缓存（确保一致性）
- ✅ 错误处理和重试
- ✅ 缓存与服务端数据同步

## 核心设计

### DataSyncManager 类

```typescript
class DataSyncManager<T extends SyncableEntity> {
    // 统一的数据同步逻辑
    getAll(): T[]                    // 获取所有数据（从缓存）
    getById(id: EntityId): T         // 根据 ID 获取数据
    save(entity: T): Promise<void>    // 保存数据（乐观更新 + 异步同步）
    delete(id: EntityId): Promise<void> // 删除数据
    refreshInBackground(): Promise<void> // 后台刷新（从服务器同步）
}
```

### 配置化设计

通过 `DataSyncConfig` 配置不同的数据实体：

```typescript
interface DataSyncConfig<T> {
    cacheKey: string;              // localStorage key
    cache: T[];                    // 内存缓存
    cacheState: CacheState;        // 缓存状态
    apiGetAll: () => Promise<...>; // API 调用函数
    apiCreate: (entity: T) => Promise<...>;
    apiUpdate: (id, entity) => Promise<...>;
    apiDelete: (id) => Promise<...>;
    dataPath: string;              // 数据路径（从 API 响应中提取）
    initialData: T[];              // 初始数据
    beforeSave?: (entity) => T;    // 保存前的数据转换
    afterSave?: (local, server) => void; // 保存后的处理
    isExisting?: (cache, entity) => boolean; // 判断是否已存在
    mergeStrategy?: 'replace' | 'merge'; // 合并策略
}
```

## 工作流程

### 保存数据流程

```
1. 乐观更新
   └─> 立即更新本地缓存（内存 + localStorage）
   └─> 触发 UI 更新

2. 异步保存
   └─> 检查是否已登录
   └─> 判断是创建还是更新
   └─> 调用 API 保存到服务器

3. 数据同步
   └─> 保存成功后用服务器数据更新缓存
   └─> 确保缓存与服务端一致
   └─> 触发 UI 更新
```

### 刷新数据流程

```
1. 检查缓存状态
   └─> 如果缓存为空或过期，触发后台刷新

2. 后台刷新
   └─> 从服务器获取最新数据
   └─> 用服务器数据完全替换缓存
   └─> 确保数据一致，避免遗漏
```

## 使用示例

### 1. 创建配置

```typescript
const usersSyncConfig: DataSyncConfig<User> = {
    cacheKey: 'alignflow_users',
    cache: usersCache,
    cacheState: usersCacheState,
    apiGetAll: usersAPI.getAll,
    apiCreate: usersAPI.create,
    apiUpdate: usersAPI.update,
    apiDelete: usersAPI.delete,
    dataPath: 'users',
    initialData: INITIAL_USERS
};

const usersSyncManager = new DataSyncManager<User>(usersSyncConfig);
```

### 2. 使用管理器

```typescript
// 获取所有数据
const users = usersSyncManager.getAll();

// 保存数据
await usersSyncManager.save(user);

// 删除数据
await usersSyncManager.delete(userId);
```

## 迁移指南

### 步骤 1: 识别数据实体

找出所有需要同步的数据类型：
- Users
- OKRs
- Workflows
- GradeConfigs
- Departments
- CustomRoles

### 步骤 2: 创建配置

为每个实体创建 `DataSyncConfig` 配置。

### 步骤 3: 创建管理器实例

使用配置创建 `DataSyncManager` 实例。

### 步骤 4: 替换现有函数

将现有的 `getXxx()`, `saveXxx()`, `deleteXxx()` 函数替换为管理器的方法。

### 步骤 5: 测试验证

确保数据保存和同步正常工作。

### 步骤 6: 清理旧代码

删除重复的缓存管理代码和同步逻辑。

## 优势

1. **代码复用**：统一的数据同步逻辑，避免重复代码
2. **易于维护**：修改同步逻辑只需在一个地方修改
3. **一致性保证**：所有实体使用相同的同步机制，行为一致
4. **可扩展性**：通过配置支持不同实体的特殊需求
5. **错误处理**：统一的错误处理机制
6. **数据一致性**：确保缓存与服务端数据一致，避免遗漏

## 文件结构

```
services/
├── dataSync.ts              # 核心同步机制
├── dataSync.example.ts      # 使用示例和迁移指南
└── DATA_SYNC_README.md      # 本文档
```

## 下一步

1. 选择一个简单的实体（如 Departments）先迁移
2. 验证迁移后的功能正常
3. 逐步迁移其他实体
4. 最终统一所有数据实体的同步机制
