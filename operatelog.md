# 操作日志

## 2026-04-10

- **私有仓库镜像**：已执行 `docker context use default` 后运行 `REGISTRY_PREFIX=192.168.210.90:6000/library ./deploy_x86.sh v2026.04.10.1`，推送 `192.168.210.90:6000/okr-backend` 与 `okr-frontend` 的标签 `v2026.04.10.1` 及 `latest`（脚本末尾 `imagetools inspect` 对 HTTP 私仓报 HTTPS 客户端错误可忽略）。
- **审批驳回理由（端到端）**：定稿审批（`pages/Approvals.tsx`）、绩效单条驳回（`AssessmentModal` 内 `RejectReasonDialog`）与绩效**批量驳回**（`pages/Assessment.tsx` 主页面 `RejectReasonDialog`）均需填写驳回理由；通过 `updateOKRStatus(..., { statusRejectReason })` 提交；后端 `updateOKRStatus` 对定稿驳回与考核相关驳回校验必填理由，并在通过/进入下一阶段时按规则清空 `status_reject_reason`。
- **数据与模型**：`types.ts` / `backend/src/types.ts` 增加 `statusRejectReason`；迁移 `status_reject_reason` 列；`OKR` 模型读写该字段。
- **「我的 OKR」展示**：`pages/MyOKRs.tsx` 在状态徽章下方展示「驳回说明」与 `okr.statusRejectReason`（有内容时）。
- **`pages/Assessment.tsx`**：`AssessmentModal` 根节点改为 Fragment 并挂载绩效单条驳回弹窗；批量驳回由确认框改为 `RejectReasonDialog`，对多项使用**统一理由**逐条调用 `updateOKRStatus`。

## 2026-04-07

- **私有仓库镜像（二次发布）**：执行 `REGISTRY_PREFIX=192.168.210.90:6000/library ./deploy_x86.sh v2026.04.07.2`，推送 `192.168.210.90:6000/okr-backend` 与 `okr-frontend` 的标签 `v2026.04.07.2` 及 `latest`（含 AI 导入 Nginx 请求体上限与前端去重 `imageBase64` 等改动）。
- **`nginx.conf`**：增加 `client_max_body_size 35m`，避免 AI 导入多图（base64 JSON）超过 Nginx 默认 **1MB** 请求体上限时出现 **413 / “too large”**；与后端 `express.json({ limit: '30mb' })` 对齐留余量。
- **`pages/MyOKRs.tsx`（AI 导入）**：多图时仅提交 `imageList`，不再同时提交重复的 `imageBase64`（原逻辑每张图都会 `setImportImageBase64`，最后一张与列表重复），减小请求体积。
- **`Dockerfile`（前端构建）**：增加 `COPY utils/ ./utils/`，修复容器内 `vite build` 无法解析 `pages/Approvals.tsx` 等对 `../utils/okrScope` 的引用导致镜像构建失败的问题。
- **私有仓库镜像**：执行 `REGISTRY_PREFIX=192.168.210.90:6000/library ./deploy_x86.sh v2026.04.07`，将 `192.168.210.90:6000/okr-backend` 与 `okr-frontend` 以标签 `v2026.04.07` 及 `latest` 推送（若本机 Docker 曾未在 default context，需先 `docker context use default`）。
- **`public/OKR.png`**：自用户提供的参考图复制入库，用于首页对齐规则说明弹窗。
- **`components/OKRAlignmentGuideModal.tsx`**：新增首页引导弹窗，展示对齐示意图；支持「下次不再提示」（按用户 ID 写入 `localStorage`）；未勾选时在同一会话内用 `sessionStorage` 关闭后不再反复弹出，下次打开浏览器可再次提示。
- **`pages/Dashboard.tsx`**：登录后进入 OKR 看板时按上述规则弹出引导（每用户独立、可永久关闭）。
- **`utils/okrScope.ts`**：根据 `OKR.level` 区分 **团队 OKR**（公司/部门级）与 **个人 OKR**。
- **`pages/Approvals.tsx`**：定稿审批卡片、详情弹窗与制定建议卡片中展示 **OKR 类型**（团队/个人）。
- **`pages/Assessment.tsx`**：绩效列表项、评估弹窗与团队审批表格行中展示 **OKR 类型**（团队/个人）。

## 2026-03-31

- **`components/OKRCard.tsx`（公司级看板也可展开）**：放宽“查看全部内容”按钮条件为“只要存在目标就显示”，确保公司级 OKR 卡片（即使只有 1-2 个 Objective、标题较短）也能展开查看全部内容与 KR 详情。
- **生产库人员录入（基础设施线）**：按“姓全拼 + 名首字母 + `@myibc.net`”规则补录 11 人：`孙莉芸(sunly)`、`庄坤标(zhuangkb)`、`杨海峰(yanghf)`、`刘赵新(liuzx)`、`李党(lid)`、`段玉威(duanyw)`、`魏志威(weizw)`、`杨积香(yangjx)`、`蒋正(jiangz)`、`刘佳奇(liujq)`、`凌艳姣(lingyj)`；并复核基础设施线目标名单 18 人在生产库完整存在。
- **生产库人员录入（密码服务线）**：按“姓全拼 + 名首字母 + `@myibc.net`”规则，向新库 `192.168.136.239:5432/okr` 补录 8 人：`姚茂洋(yaomy)`、`何曾洁(hezj)`、`陈刚平(chengp)`、`陈岳民(chenym)`、`李燕南(liyn)`、`苏礼洁(sulj)`、`李丹柳(lidl)`、`甘玉华(ganyh)`；并复核目标名单 11 人在库完整存在。
- **dev 登录排障**：定位到前端 `Failed to fetch` 原因是本地后端未在 `3001` 提供 API；已启动本地后端并验证 `http://127.0.0.1:3001/health` 返回 `ok`。后端数据库连接使用测试库默认配置（`DB_HOST=192.168.210.90`、`DB_PORT=5433`）。
- **新增项目 Skill：`okr-release-flow`**：在 `.cursor/skills/okr-release-flow/SKILL.md` 固化三阶段发布流程（1. 本机开发验证+测试库；2. 推送镜像并本机 Docker 验证+测试库；3. 生产更新编排与验收），并包含失败回滚与统一输出模板，供后续重复执行。
- **`components/OKRCard.tsx`（看板内容可完整查看）**：新增卡片“查看全部内容/收起内容”交互；展开后不再截断标题与 Objective 文本，并显示每个 Objective 下的 KR 明细，解决公示看板无法看全 OKR 内容的问题。
- **数据库迁移执行（老库 -> 新库）**：已从 `192.168.210.90:5433/okr` 使用 `postgres:17` 客户端导出 `okr_full_2026-03-31_132304_pg17.dump`，并恢复到新库 `192.168.136.239:5432/okr`（用户 `user_mPkjFK`）。因新库已有旧结构，先执行 `DROP SCHEMA public CASCADE; CREATE SCHEMA public;` 后再 `pg_restore`，最终核心表行数校验一致：`users=42`、`okrs=11`、`workflows=19`、`configs=2`。
- **`docker-compose.1panel.prod.yml`（前端端口）**：`frontend` 映射由 `80:80` 改为 `8080:80`，避免宿主机 `0.0.0.0:80` 已被占用导致 `failed to bind host port`；移除顶层 `version`（Compose v2 已忽略该字段，消除告警）。
- **`docker-compose.1panel.prod.yml`（后端启动健康）**：将数据库连接从容器名改为 `DB_HOST=host.docker.internal`（并增加 `extra_hosts: host-gateway`）以适配 1Panel 跨应用网络；同时把后端健康检查窗口放宽（`start_period: 90s`、`interval: 15s`、`retries: 8`），避免首次迁移/冷启动被过早判定 `unhealthy`。
- **`Dockerfile`（前端多阶段）**：将 `ARG NGINX_IMAGE` 与 `NODE_IMAGE` 一并放在**首个 `FROM` 之前**，修复 BuildKit 报错「`FROM ${NGINX_IMAGE}` 不应为空 / 未声明」导致 `deploy_x86.sh` 前端阶段构建失败的问题；修复后 `./deploy_x86.sh latest` 已顺利将 `okr-backend` / `okr-frontend` 推至 `192.168.210.90:6000`（脚本末尾 `docker manifest inspect` 对 HTTP 私仓报错可忽略）。
- **Docker 构建拉取 Docker Hub 超时**：前后端 `Dockerfile` 增加 `ARG NODE_IMAGE` / `ARG NGINX_IMAGE`，支持从内网仓库或镜像加速拉取基础镜像。
- **`deploy_x86.sh`**：默认使用 `buildx` 的 `default` builder（减少额外拉取 `moby/buildkit`）；支持 `REGISTRY_PREFIX`、`NODE_IMAGE`、`NGINX_IMAGE` 环境变量。
- **`deploy.sh`**：构建时传入与上述一致的 `build-arg`。
- **`DEPLOYMENT_MANUAL.md`**：新增「4.2 Docker Hub 超时」章：镜像加速、私有 Harbor 前缀、代理排查。
