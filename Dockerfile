# ===================== Stage 1: Build =====================
# 二者须写在首个 FROM 之前，后续阶段的 FROM 才能展开变量（BuildKit 校验）
ARG NODE_IMAGE=192.168.210.90:6000/library/node:20-alpine
ARG NGINX_IMAGE=192.168.210.90:6000/library/nginx:alpine
FROM ${NODE_IMAGE} AS builder

WORKDIR /app

# 安装依赖
COPY package.json package-lock.json ./
RUN npm ci

# 拷贝源码
COPY index.html tsconfig.json vite.config.ts ./
COPY App.tsx index.tsx types.ts ./
COPY components/ ./components/
COPY hooks/ ./hooks/
COPY pages/ ./pages/
COPY services/ ./services/
COPY public/ ./public/

# 构建时注入后端 API 地址（通过 Nginx 反代，前端用相对路径）
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

RUN npm run build

# ===================== Stage 2: Nginx =====================
# 基础镜像由文件顶部 ARG NGINX_IMAGE 提供，构建时 --build-arg NGINX_IMAGE=... 可覆盖
FROM ${NGINX_IMAGE}

# 拷贝构建产物
COPY --from=builder /app/dist /usr/share/nginx/html

# 拷贝 Nginx 配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget -qO- http://localhost:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
