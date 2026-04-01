# ===================== Stage 1: Build =====================
# 可通过 --build-arg NODE_IMAGE= 指向内网镜像代理，避免构建时访问 Docker Hub
ARG NODE_IMAGE=192.168.210.90:6000/library/node:20-alpine
FROM ${NODE_IMAGE} AS builder

WORKDIR /app

# 安装依赖
COPY package.json package-lock.json ./
RUN npm ci

# 拷贝源码并编译
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# ===================== Stage 2: Production =====================
ARG NODE_IMAGE=192.168.210.90:6000/library/node:20-alpine
FROM ${NODE_IMAGE}

WORKDIR /app

# 仅安装生产依赖
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# 拷贝编译产物
COPY --from=builder /app/dist ./dist

# 设置默认环境变量（可在 docker-compose 或运行时覆盖）
ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

# 健康检查
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:3001/health || exit 1

CMD ["node", "dist/index.js"]
