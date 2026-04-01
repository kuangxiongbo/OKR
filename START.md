# OKR 系统启动指南

## ✅ 系统状态

- ✅ 后端服务：运行在 http://localhost:3001
- ✅ 数据库连接：正常
- ✅ API接口：测试通过
- ⚠️  前端服务：需要手动启动

## 🚀 启动步骤

### 1. 启动后端（如果未运行）

```bash
cd backend
npm run dev
```

后端将在 http://localhost:3001 启动

### 2. 启动前端

```bash
npm run dev
```

前端将在 http://localhost:3000 启动

### 3. 访问系统

打开浏览器访问：http://localhost:3000

### 4. 登录

使用以下账号登录：
- **账号**: `admin`
- **密码**: `Gw1admin.`

## 🧪 运行测试

运行测试脚本验证系统：

```bash
./test-system.sh
```

## 📝 注意事项

1. **后端必须先启动**：前端依赖后端API
2. **数据库连接**：确保数据库服务器可访问（192.168.210.90:5433）
3. **端口占用**：如果3000或3001端口被占用，需要修改配置

## 🔧 故障排查

### 前端无法启动
- 检查是否有编译错误：查看终端输出
- 检查端口3000是否被占用：`lsof -i :3000`
- 清除缓存重新安装：`rm -rf node_modules && npm install`

### 后端无法启动
- 检查数据库连接：运行 `cd backend && npm run migrate`
- 检查端口3001是否被占用：`lsof -i :3001`
- 查看后端日志：检查终端错误信息

### 登录失败
- 确认后端服务正在运行
- 检查网络连接
- 查看浏览器控制台错误信息

## 📚 API文档

后端API文档：
- 健康检查：GET http://localhost:3001/health
- 登录：POST http://localhost:3001/api/auth/login
- 用户列表：GET http://localhost:3001/api/users (需要token)

更多API请查看 `backend/README.md`
