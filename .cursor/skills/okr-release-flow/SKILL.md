---
name: okr-release-flow
description: 执行 OKR 系统三阶段发布流程：本机开发验证（测试库）-> 推送镜像并本机 Docker 验证（测试库）-> 生产环境更新编排。用于用户提到发布、上线、镜像推送、1Panel 部署、回滚或发布检查清单时。
---

# OKR 三阶段发布流程

按以下固定顺序执行，默认不跳步。

## 适用触发词

- 发布流程
- 上线流程
- 推送镜像
- 生产更新编排
- 1Panel 部署
- 回滚

## 全局约束

1. 数据库连接显式区分测试/生产，禁止混用。
2. 每阶段完成后再进入下一阶段。
3. 任一步失败，先定位修复，不直接推进。
4. 所有改动写入 `operatelog.md`。

## 阶段 1：本机开发环境验证（测试数据库）

目标：确认代码功能正确，且连接的是测试库。

检查项：

- 后端环境变量指向测试库（`DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD`）。
- 前端 API 指向本机后端或测试后端。
- 关键页面与流程可用（登录、看板、我的 OKR、审批/考核）。

建议命令：

```bash
# 前端
npm run dev

# 后端（如需单独验证）
cd backend && npm run dev
```

通过标准：

- 无阻断报错（启动/接口 5xx/核心页面空白）。
- 关键链路完成至少 1 次完整操作。

## 阶段 2：推送镜像并本机 Docker 验证（测试数据库）

目标：确认“构建产物镜像”在容器形态下可运行，并连接测试库。

1) 构建并推送：

```bash
./deploy_x86.sh <tag>
```

2) 本机容器验证（测试库）：

- 使用本机 compose 或临时 compose 运行镜像版本。
- 环境变量必须继续指向测试数据库。

示例（按项目现状调整）：

```bash
docker compose -f docker-compose.1panel.prod.yml up -d
docker compose -f docker-compose.1panel.prod.yml ps
```

3) 健康与接口检查：

```bash
curl -fsS http://localhost:3001/health
curl -I http://localhost:8080
```

通过标准：

- `backend` healthy。
- 前端可访问，核心接口返回正常。

## 阶段 3：生产环境更新镜像并启动编排

目标：以新 tag 替换生产服务并完成验收。

1) 生产编排文件使用镜像 tag（不要使用本地 build）。
2) 执行更新：

```bash
docker compose -f docker-compose.1panel.prod.yml pull
docker compose -f docker-compose.1panel.prod.yml up -d
```

3) 生产验收：

- 后端健康检查通过（`/health`）。
- 前端可访问。
- 抽查关键业务路径。

## 失败处理与回滚

若生产异常：

1. 将镜像 tag 回退到上一稳定版本。
2. 重新执行 `pull` + `up -d`。
3. 复核健康检查与关键页面。

## 输出格式（每次执行后）

按以下结构反馈：

```markdown
## 发布执行结果
- 阶段1：通过/失败（原因）
- 阶段2：通过/失败（镜像 tag、验证结果）
- 阶段3：通过/失败（生产状态）

## 风险与回滚点
- 风险1
- 回滚命令/方案

## 记录
- 已更新 operatelog.md
```

## 相关文件

- `deploy_x86.sh`
- `docker-compose.1panel.prod.yml`
- `docker-compose.yml`
- `operatelog.md`
---
name: okr-release-flow
description: 执行 OKR 系统三阶段发布流程：本机开发验证（测试库）-> 推送镜像并本机 Docker 验证（测试库）-> 生产环境更新编排。用于用户提到发布、上线、镜像推送、1Panel 部署、回滚或发布检查清单时。
---

# OKR 三阶段发布流程

按以下固定顺序执行，默认不跳步。

## 适用触发词

- 发布流程
- 上线流程
- 推送镜像
- 生产更新编排
- 1Panel 部署
- 回滚

## 全局约束

1. 数据库连接显式区分测试/生产，禁止混用。
2. 每阶段完成后再进入下一阶段。
3. 任一步失败，先定位修复，不直接推进。
4. 所有改动写入 `operatelog.md`。

## 阶段 1：本机开发环境验证（测试数据库）

目标：确认代码功能正确，且连接的是测试库。

检查项：

- 后端环境变量指向测试库（`DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD`）。
- 前端 API 指向本机后端或测试后端。
- 关键页面与流程可用（登录、看板、我的 OKR、审批/考核）。

建议命令：

```bash
# 前端
npm run dev

# 后端（如需单独验证）
cd backend && npm run dev
```

通过标准：

- 无阻断报错（启动/接口 5xx/核心页面空白）。
- 关键链路完成至少 1 次完整操作。

## 阶段 2：推送镜像并本机 Docker 验证（测试数据库）

目标：确认“构建产物镜像”在容器形态下可运行，并连接测试库。

1) 构建并推送：

```bash
./deploy_x86.sh <tag>
```

2) 本机容器验证（测试库）：

- 使用本机 compose 或临时 compose 运行镜像版本。
- 环境变量必须继续指向测试数据库。

示例（按项目现状调整）：

```bash
docker compose -f docker-compose.1panel.prod.yml up -d
docker compose -f docker-compose.1panel.prod.yml ps
```

3) 健康与接口检查：

```bash
curl -fsS http://localhost:3001/health
curl -I http://localhost:8080
```

通过标准：

- `backend` healthy。
- 前端可访问，核心接口返回正常。

## 阶段 3：生产环境更新镜像并启动编排

目标：以新 tag 替换生产服务并完成验收。

1) 生产编排文件使用镜像 tag（不要使用本地 build）。
2) 执行更新：

```bash
docker compose -f docker-compose.1panel.prod.yml pull
docker compose -f docker-compose.1panel.prod.yml up -d
```

3) 生产验收：

- 后端健康检查通过（`/health`）。
- 前端可访问。
- 抽查关键业务路径。

## 失败处理与回滚

若生产异常：

1. 将镜像 tag 回退到上一稳定版本。
2. 重新执行 `pull` + `up -d`。
3. 复核健康检查与关键页面。

## 输出格式（每次执行后）

按以下结构反馈：

```markdown
## 发布执行结果
- 阶段1：通过/失败（原因）
- 阶段2：通过/失败（镜像 tag、验证结果）
- 阶段3：通过/失败（生产状态）

## 风险与回滚点
- 风险1
- 回滚命令/方案

## 记录
- 已更新 operatelog.md
```

## 相关文件

- `deploy_x86.sh`
- `docker-compose.1panel.prod.yml`
- `docker-compose.yml`
- `operatelog.md`
