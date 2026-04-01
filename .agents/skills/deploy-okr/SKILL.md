---
name: deploy-okr
description: "OKR 系统多架构、多标签发布标准作业程序 (SOP)"
---

# OKR 系统部署手册 (Skill)

本 Skill 提供了一套标准化的工作流，用于在本地验证代码后，构建并推送支持 amd64 和 arm64 的 Docker 镜像到私有镜像仓库。

## 核心流程

### 1. 本地开发验证 (Local Dev)
在构建镜像前，务必确保本地代码逻辑正确。
- **启动服务**:
    - 后端: `cd backend && npm run dev` (3001)
    - 前端: `npm run dev` (3000)
- **自动化测试**:
    - 运行 `./test-system.sh`。确保所有 API 返回 `✅ 正常`。

### 2. 双架构构建与双标签推送 (Build & Push)
使用 `deploy_x86.sh` 脚本进行多架构构建。
- **环境变量**:
    - `PLATFORM=linux/amd64,linux/arm64` (必选，用于多架构)
- **执行指令**:
    ```bash
    PLATFORM=linux/amd64,linux/arm64 ./deploy_x86.sh <VERSION_TAG>
    ```
- **输出结果**: 脚本将同时向 `192.168.210.90:6000` 推送两个标签：`<VERSION_TAG>` 和 `latest`。

### 3. 本地镜像运行验证 (Local Docker)
确认推送到仓库的镜像在容器环境下可正常启动（模拟生产环境）。
- **清理本地**: `docker compose -f docker-compose.registry.yml down`
- **拉取并启动**:
    ```bash
    TAG=<VERSION_TAG> docker compose -f docker-compose.registry.yml up -d
    ```
- **集成测试**:
    - 再次运行 `./test-system.sh`。注意检查访问地址（前端容器通常运行在 80 端口）。

### 4. 远程环境更新 (Environment Sync)
- **测试环境**: 登录测试机 1Panel，修改编排文件中的 `image` tag 为新版本或 `latest`，点击“重建”。
- **生产环境**: 测试环境验证无误后，同步在此环境执行“重建”操作。

## 故障排除 (Troubleshooting)
- **拉取基础镜像超时**: 检查 `deploy_x86.sh` 中的 `REGISTRY_PREFIX` 是否配置正确。
- **数据库连接失败**: 确保 `docker-compose.registry.yml` 中的 `DB_HOST` 和 `DB_PASSWORD` 指向正确的迁移后数据库。
- **架构不匹配**: 检查 `PLATFORM` 变量是否包含目标服务器架构。
