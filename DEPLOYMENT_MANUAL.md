# OKR 系统部署与数据库迁移手册（完整版）

本手册覆盖以下场景：

- 镜像构建与推送（`192.168.210.90:6000`）
- 服务器 / 1Panel 编排部署
- 替换新数据库（PostgreSQL）并迁移老库数据
- 切换、验证、回滚与故障处理

---

## 1. 当前系统信息（基于代码）

- 前端镜像：`192.168.210.90:6000/okr-frontend:<tag>`
- 后端镜像：`192.168.210.90:6000/okr-backend:<tag>`
- 前端端口：`80`
- 后端端口：`3001`
- 后端健康检查：`GET /health`
- 当前编排文件：
  - 源码构建：`docker-compose.yml`
  - 仓库拉取：`docker-compose.registry.yml`

当前 `docker-compose.registry.yml` 使用的数据库环境变量（需改为新库）：

- `DB_HOST=192.168.210.90`
- `DB_PORT=5433`
- `DB_NAME=okr`
- `DB_USER=okr`
- `DB_PASSWORD=pbd76htiMAHymt3r`

---

## 2. 服务器配置要求（专业基线）

### 2.1 部署拓扑建议

- 单机标准版：1 台应用服务器（前后端容器同机）+ 1 台 PostgreSQL
- 生产推荐版：2 台应用服务器（可扩展）+ 1 主 1 备 PostgreSQL + 负载均衡
- 管理面：建议通过 1Panel 管理容器编排、日志与告警

### 2.2 硬件规格建议

#### 最小可运行（POC/测试）

- CPU：2 vCPU
- 内存：4 GB
- 系统盘：40 GB SSD
- 数据盘：100 GB SSD（数据库独立）
- 网络带宽：10 Mbps+

#### 生产推荐（中小规模）

- CPU：4-8 vCPU
- 内存：8-16 GB
- 系统盘：100 GB SSD
- 数据盘：200 GB+ SSD（数据库独立，建议云盘高性能）
- 网络带宽：50 Mbps+

#### 高可用推荐（核心业务）

- 应用节点：2 台（每台 4 vCPU / 8 GB）
- 数据库：主从或云 RDS 高可用实例
- 存储：按 6-12 个月数据增长量预估，预留 2-3 倍空间

### 2.3 操作系统与运行时基线

- OS：Ubuntu 20.04+/22.04+，或 CentOS 7+/RockyLinux 8+
- Docker Engine：24+（建议 26+）
- Docker Compose：v2
- 时区：`Asia/Shanghai`
- 时间同步：必须启用 NTP（chrony 或 systemd-timesyncd）

### 2.4 Linux 内核与系统参数建议

建议在生产机配置以下基线（根据安全规范评估后执行）：

- 文件句柄：`ulimit -n` 建议 >= `65535`
- `vm.max_map_count`：`262144`（兼容常见中间件）
- `net.core.somaxconn`：`1024` 或更高
- 开启 swap 策略审慎控制（数据库机器建议低 swappiness）

### 2.5 磁盘与文件系统规划

- 应用与数据库分盘（至少逻辑分离）
- Docker 数据目录建议独立挂载（`/var/lib/docker`）
- 数据库目录独立高性能盘，并启用定期快照
- 日志保留建议：
  - 容器日志：7-15 天
  - 审计/业务日志：90 天或按合规要求

### 2.6 网络与访问控制

需放通：

- 入站：`80`（前端）
- 入站：`3001`（可选，仅内网调试时开放）
- 出站：`192.168.210.90:6000`（镜像仓库）
- 出站：老库与新库 PostgreSQL 地址端口

建议限制：

- `3001` 不对公网开放（仅内网）
- 数据库仅允许应用服务器访问
- 1Panel 管理入口仅允许办公网/堡垒机访问

### 2.7 安全基线（必须）

- 禁止在仓库中存储明文密钥
- `JWT_SECRET` 使用强随机（>= 32 位）
- 数据库最小权限账号（避免超级管理员账号直连应用）
- 启用 SSH 密钥登录，禁用弱口令
- 启用主机防火墙与失败登录封禁（如 fail2ban）

### 2.8 监控与告警基线

至少监控以下指标：

- 主机：CPU、内存、磁盘、网络
- 容器：重启次数、健康检查状态、日志错误率
- 数据库：连接数、慢查询、磁盘增长、复制延迟（如主从）
- 业务：登录成功率、接口 5xx 比例、接口延迟 P95

告警建议：

- 后端容器非 healthy 持续 3 分钟
- 数据库连接失败连续 3 次
- 磁盘使用率 > 80%
- 关键接口 5xx 比率超过阈值

---

## 3. 环境与前置要求

### 3.1 软件要求

- Docker Engine 24+（建议 26+）
- Docker Compose v2
- 可访问私有仓库 `192.168.210.90:6000`
- 可访问新旧 PostgreSQL

### 3.2 数据库版本建议

- 新库 PostgreSQL 主版本建议与老库一致或更高（例如老库 13 -> 新库 13/14/15/16）
- 字符集建议 UTF-8
- 排序规则与编码建议与老库保持一致
- 时区建议统一（推荐 `Asia/Shanghai`）

---

## 4. 发布镜像（最新代码）

在发布机执行：

```bash
cd /path/to/OKR
chmod +x deploy.sh
./deploy.sh v2026.03.20
```

说明：

- `deploy.sh` 会构建前后端镜像并推送到 `192.168.210.90:6000`
- 建议使用固定 tag（不要长期用 `latest`）

### 4.1 部署到 X86 服务器（必须使用 amd64 镜像）

如果发布机是 ARM（如 M 系列 Mac），生产是 X86，必须发布 `linux/amd64` 镜像：

```bash
cd /path/to/OKR
./deploy_x86.sh v2026.03.31
```

默认只发布 `linux/amd64`。如需多架构（amd64 + arm64）：

```bash
PLATFORM=linux/amd64,linux/arm64 ./deploy_x86.sh v2026.03.31
```

验证：

```bash
docker pull 192.168.210.90:6000/okr-backend:v2026.03.20
docker pull 192.168.210.90:6000/okr-frontend:v2026.03.20
```

### 4.2 构建失败：Docker Hub 拉基础镜像 / 认证超时（长期方案）

现象多为：`auth.docker.io`、`registry-1.docker.io` 443 超时或 TLS 握手失败。  
本仓库已支持**不硬编码** `node:20-alpine` / `nginx:alpine`，构建时可通过参数改走**内网镜像代理**。

#### 方案 A：Docker 引擎配置镜像加速（推荐全员配置一次）

**Docker Desktop（Mac/Windows）**

1. 打开 Docker Desktop → Settings → Docker Engine  
2. 在 JSON 中增加 `registry-mirrors`（加速器地址请在「阿里云容器镜像服务 / DaoCloud 等」控制台获取个人专属地址，勿使用来历不明的公共列表）  
3. 确保已包含私仓（若 HTTP）：

```json
{
  "insecure-registries": ["192.168.210.90:6000"],
  "registry-mirrors": ["https://你的镜像加速器地址"]
}
```

4. Apply & Restart，再执行 `./deploy_x86.sh ...`

**Linux（daemon.json，路径因发行版而异，常见 `/etc/docker/daemon.json`）**

```json
{
  "insecure-registries": ["192.168.210.90:6000"],
  "registry-mirrors": ["https://你的镜像加速器地址"]
}
```

然后：`sudo systemctl restart docker`

#### 方案 B：在内网 Harbor 中准备「library 代理项目」（适合无外网或 Hub 极不稳）

1. 在 `192.168.210.90:6000` 上创建项目（示例名 `library`），配置 Docker Hub 代理或一次性同步镜像  
2. 保证存在：  
   - `192.168.210.90:6000/library/node:20-alpine`  
   - `192.168.210.90:6000/library/nginx:alpine`  
3. 发布时带上前缀（与本仓库 `Dockerfile` 的 `ARG` 一致）：

```bash
REGISTRY_PREFIX=192.168.210.90:6000/library ./deploy_x86.sh v2026.03.31
```

或分别指定完整镜像名：

```bash
NODE_IMAGE=192.168.210.90:6000/library/node:20-alpine \
NGINX_IMAGE=192.168.210.90:6000/library/nginx:alpine \
./deploy_x86.sh v2026.03.31
```

`deploy.sh` 同样支持 `REGISTRY_PREFIX` / `NODE_IMAGE` / `NGINX_IMAGE`。

#### 方案 C：检查本机代理

若 `docker info` 中出现 `HTTP Proxy`，但 Hub 仍超时，可能是代理未放行 `auth.docker.io` / `registry-1.docker.io`，需网络侧放行或换直连。

---

## 5. 新数据库替换与迁移总流程（推荐）

推荐采用“**先迁移，后切换**”的稳妥流程：

1. 创建新库并初始化权限
2. 从老库导出全量数据（`pg_dump`）
3. 导入到新库（`pg_restore` 或 `psql`）
4. 在新库执行应用迁移脚本（补齐结构差异）
5. 数据一致性校验（行数、关键业务数据）
6. 切换编排配置中的 DB 连接到新库
7. 重启服务并做业务回归
8. 观察稳定后下线老库（保留回滚窗口）

---

## 6. 数据库迁移操作步骤（可直接执行）

以下示例采用 PostgreSQL 客户端命令，建议在有网络直连数据库的运维机执行。

### 5.1 准备变量（示例）

```bash
# 老库
export OLD_DB_HOST=192.168.210.90
export OLD_DB_PORT=5433
export OLD_DB_NAME=okr
export OLD_DB_USER=okr
export OLD_DB_PASSWORD='old_password'

# 新库
export NEW_DB_HOST=10.0.0.20
export NEW_DB_PORT=5432
export NEW_DB_NAME=okr
export NEW_DB_USER=okr
export NEW_DB_PASSWORD='new_password'
```

### 5.2 导出老库（推荐自定义格式）

```bash
export PGPASSWORD="$OLD_DB_PASSWORD"
pg_dump -h "$OLD_DB_HOST" -p "$OLD_DB_PORT" -U "$OLD_DB_USER" -d "$OLD_DB_NAME" \
  -Fc -f okr_full_$(date +%F_%H%M).dump
```

### 5.3 新库建库与授权（如未创建）

```sql
CREATE DATABASE okr;
CREATE USER okr WITH ENCRYPTED PASSWORD 'new_password';
GRANT ALL PRIVILEGES ON DATABASE okr TO okr;
```

### 5.4 导入到新库

```bash
export PGPASSWORD="$NEW_DB_PASSWORD"
pg_restore -h "$NEW_DB_HOST" -p "$NEW_DB_PORT" -U "$NEW_DB_USER" -d "$NEW_DB_NAME" \
  --clean --if-exists --no-owner --no-privileges okr_full_YYYY-MM-DD_HHMM.dump
```

> 若数据量很大，建议在低峰期执行，并使用同机房网络链路。

### 5.5 执行应用迁移脚本（非常重要）

在项目目录执行（指向新库参数）：

```bash
cd /path/to/OKR/backend
# 确保环境变量指向新库，再执行迁移
npm run migrate
```

目的：保证新库结构与当前代码一致（例如新增字段、索引、触发器、configs 表结构等）。

### 5.6 基础校验（建议）

```bash
# 老库计数
export PGPASSWORD="$OLD_DB_PASSWORD"
psql -h "$OLD_DB_HOST" -p "$OLD_DB_PORT" -U "$OLD_DB_USER" -d "$OLD_DB_NAME" -c "SELECT COUNT(*) FROM users;"
psql -h "$OLD_DB_HOST" -p "$OLD_DB_PORT" -U "$OLD_DB_USER" -d "$OLD_DB_NAME" -c "SELECT COUNT(*) FROM okrs;"

# 新库计数
export PGPASSWORD="$NEW_DB_PASSWORD"
psql -h "$NEW_DB_HOST" -p "$NEW_DB_PORT" -U "$NEW_DB_USER" -d "$NEW_DB_NAME" -c "SELECT COUNT(*) FROM users;"
psql -h "$NEW_DB_HOST" -p "$NEW_DB_PORT" -U "$NEW_DB_USER" -d "$NEW_DB_NAME" -c "SELECT COUNT(*) FROM okrs;"
```

建议至少核对表：`users`, `okrs`, `workflows`, `grade_configs`, `operation_logs`, `configs`。

---

## 7. 切换到新数据库（编排改造）

修改 `docker-compose.registry.yml` 中 `backend.environment` 的 DB 参数：

- `DB_HOST` -> 新库地址
- `DB_PORT` -> 新库端口
- `DB_NAME` -> 新库库名
- `DB_USER` -> 新库用户
- `DB_PASSWORD` -> 新库密码

同时建议更新：

- `JWT_SECRET` 为新随机值（至少 32 位）

### 6.1 服务器命令行切换

```bash
cd /path/to/OKR
docker compose -f docker-compose.registry.yml down
docker compose -f docker-compose.registry.yml up -d
```

### 6.2 1Panel 切换

1. 打开编排项目（okr）
2. 编辑 compose 内容中的 DB 环境变量
3. 保存并重建/重启
4. 查看后端容器日志与健康状态

---

## 8. 1Panel 完整编排步骤（含新库）

1. 在 1Panel 添加镜像仓库 `192.168.210.90:6000`
2. 新建编排项目，粘贴 `docker-compose.registry.yml`
3. 将镜像 tag 改为固定版本（例如 `v2026.03.20`）
4. 修改后端 DB 参数为新数据库
5. 部署启动
6. 验证：
   - `http://<服务器IP>/`
   - `http://<服务器IP>/health`
   - 关键业务流程（登录、看板、我的OKR、审批）

---

## 9. 切换窗口与停机建议

若要求数据绝对一致，建议在切换窗口执行：

1. 通知维护窗口（短暂停写）
2. 暂停应用写入（停后端或设维护页）
3. 执行最后一次增量/全量导出导入
4. 切换 DB 配置并启动新服务
5. 验证后开放访问

---

## 10. 回滚方案（必须预案）

若切换后异常：

1. 将编排 DB 配置改回老库
2. 重新部署编排
3. 验证健康与核心功能
4. 保留新库现场用于问题排查

> 建议：至少保留老库只读/快照 7 天。

---

## 11. 常见问题

### 10.1 后端启动报数据库连接失败

检查：

- 新库防火墙/白名单
- 用户名密码
- 数据库是否已创建
- SSL 参数（如数据库要求 SSL）

### 10.2 启动报端口占用（3001）

```bash
lsof -iTCP:3001 -sTCP:LISTEN -n -P
kill <PID>
```

### 10.3 页面可打开但 API 报错

- 检查 `okr-backend` 日志
- 检查 Nginx `/api/` 反代是否可达后端
- 检查新库中 `configs` 是否完整（`wecom/sso/ai`）

---

## 12. 安全要求（生产必须）

- 禁止在文档/仓库中长期保留明文数据库密码
- 使用强随机 `JWT_SECRET`
- 修改默认管理员密码
- 1Panel、仓库、数据库均启用最小权限和访问控制
- 推荐开启 HTTPS 与日志审计

---

## 13. 上线验收清单

- [ ] 镜像已按固定 tag 推送成功
- [ ] 新库数据迁移完成并校验通过
- [ ] 后端迁移脚本在新库执行成功
- [ ] 编排 DB 参数已切换到新库
- [ ] 后端 `/health` 与前端访问正常
- [ ] 关键业务流程回归通过
- [ ] 回滚预案已验证（至少演练一次）

---

## 14. 建议的下一步（可选）

建议新增以下文件，进一步降低运维风险：

- `docker-compose.registry.prod.yml`（固定版本 tag + 环境变量拆分）
- `.env.prod.example`（统一管理 DB/JWT/端口）
- `MIGRATION_CHECKLIST.md`（迁移前后核对清单）

