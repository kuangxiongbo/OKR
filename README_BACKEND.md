# OKR 系统 - 后端集成说明

## 项目结构

```
OKR/
├── backend/          # 后端API服务
│   ├── src/
│   │   ├── config/   # 数据库配置和迁移
│   │   ├── models/   # 数据模型
│   │   ├── controllers/ # 控制器
│   │   ├── routes/   # 路由
│   │   └── index.ts  # 入口文件
│   └── package.json
├── services/         # 前端API服务
│   ├── api.ts        # API客户端
│   └── okrService.ts # 业务逻辑（已更新为使用API）
└── ...
```

## 快速开始

### 1. 启动后端服务

```bash
cd backend
npm install
npm run migrate  # 创建数据库表
npm run seed     # 导入初始数据
npm run dev      # 启动开发服务器（端口3001）
```

### 2. 配置前端API地址

前端默认连接到 `http://localhost:3001/api`

如需修改，可在前端项目根目录创建 `.env.local`：

```
VITE_API_BASE_URL=http://your-backend-url/api
```

### 3. 启动前端服务

```bash
npm run dev  # 启动前端开发服务器（端口3000）
```

## 数据库配置

数据库信息：
- 主机：192.168.210.90
- 端口：5433
- 数据库名：okr
- 用户名：okr
- 密码：pbd76htiMAHymt3r

配置在 `backend/.env` 文件中。

## 主要变更

### 前端代码更新

1. **新增 `services/api.ts`** - API客户端封装
2. **更新 `services/okrService.ts`** - 所有数据操作改为API调用
   - 保留了同步版本函数（带`Sync`后缀）用于向后兼容
   - 异步版本函数用于实际API调用
3. **更新 `hooks/useCurrentUser.ts`** - 使用异步API获取用户

### 后端API

- RESTful API设计
- JWT认证
- PostgreSQL数据库
- 完整的CRUD操作

## 测试

1. 访问前端：http://localhost:3000
2. 使用默认账号登录：
   - 账号：`admin`
   - 密码：`Gw1admin.`

## 注意事项

- 前端代码中部分地方仍使用同步函数（`getUsersSync`, `getOKRsSync`等），这些函数从缓存读取数据
- 首次加载需要调用异步函数从API获取数据
- 数据更新后会触发 `alignflow_data_updated` 事件，前端会自动刷新
