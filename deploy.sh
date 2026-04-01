#!/bin/bash
# =====================================================
# OKR 系统 Docker 部署脚本
# 本地构建 + 推送到镜像仓库 192.168.210.90:6000
# =====================================================

set -e

# ---- 配置 ----
REGISTRY="192.168.210.90:6000"
BACKEND_IMAGE="okr-backend"
FRONTEND_IMAGE="okr-frontend"
TAG="${1:-latest}"

echo "============================================"
echo "  OKR 系统 Docker 部署"
echo "  镜像仓库: ${REGISTRY}"
echo "  标签: ${TAG}"
echo "============================================"

# 基础镜像（与 deploy_x86.sh 一致，避免 Docker Hub 不可达）
if [[ -n "${REGISTRY_PREFIX:-}" ]]; then
  P="${REGISTRY_PREFIX%/}"
  NODE_IMG="${P}/node:20-alpine"
  NGINX_IMG="${P}/nginx:alpine"
else
  NODE_IMG="${NODE_IMAGE:-node:20-alpine}"
  NGINX_IMG="${NGINX_IMAGE:-nginx:alpine}"
fi

# ---- Step 1: 构建后端镜像 ----
echo ""
echo "🔨 [1/6] 构建后端镜像... (NODE_IMAGE=${NODE_IMG})"
docker build \
  --build-arg NODE_IMAGE="${NODE_IMG}" \
  -t ${BACKEND_IMAGE}:${TAG} ./backend
echo "✅ 后端镜像构建完成"

# ---- Step 2: 构建前端镜像 ----
echo ""
echo "🔨 [2/6] 构建前端镜像... (NODE_IMAGE=${NODE_IMG}, NGINX_IMAGE=${NGINX_IMG})"
docker build \
  --build-arg NODE_IMAGE="${NODE_IMG}" \
  --build-arg NGINX_IMAGE="${NGINX_IMG}" \
  -t ${FRONTEND_IMAGE}:${TAG} --build-arg VITE_API_BASE_URL=/api .
echo "✅ 前端镜像构建完成"

# ---- Step 3: 标记镜像 ----
echo ""
echo "🏷️  [3/6] 标记镜像..."
docker tag ${BACKEND_IMAGE}:${TAG} ${REGISTRY}/${BACKEND_IMAGE}:${TAG}
docker tag ${FRONTEND_IMAGE}:${TAG} ${REGISTRY}/${FRONTEND_IMAGE}:${TAG}
echo "✅ 镜像标记完成"

# ---- Step 4: 推送到镜像仓库 ----
echo ""
echo "📤 [4/6] 推送镜像到仓库 ${REGISTRY} ..."
docker push ${REGISTRY}/${BACKEND_IMAGE}:${TAG}
docker push ${REGISTRY}/${FRONTEND_IMAGE}:${TAG}
echo "✅ 镜像推送完成"

# ---- Step 5: 本地启动 ----
echo ""
echo "🚀 [5/6] 本地启动服务 (docker compose) ..."
docker compose down 2>/dev/null || true
docker compose up -d --build
echo "✅ 本地服务启动完成"

# ---- Step 6: 健康检查 ----
echo ""
echo "🔍 [6/6] 等待服务就绪..."
sleep 5
BACKEND_HEALTH=$(curl -sf http://localhost:3001/health 2>/dev/null || echo "FAIL")
FRONTEND_HEALTH=$(curl -sf http://localhost:80/ 2>/dev/null || echo "FAIL")

if [ "$BACKEND_HEALTH" != "FAIL" ]; then
  echo "✅ 后端服务健康: $BACKEND_HEALTH"
else
  echo "⚠️  后端服务暂未就绪，请稍后检查 docker logs okr-backend"
fi

if [ "$FRONTEND_HEALTH" != "FAIL" ]; then
  echo "✅ 前端服务正常 (http://localhost:80)"
else
  echo "⚠️  前端服务暂未就绪，请稍后检查 docker logs okr-frontend"
fi

echo ""
echo "============================================"
echo "  部署完成！"
echo "  前端地址: http://localhost:80"
echo "  后端地址: http://localhost:3001"
echo "  镜像仓库:"
echo "    ${REGISTRY}/${BACKEND_IMAGE}:${TAG}"
echo "    ${REGISTRY}/${FRONTEND_IMAGE}:${TAG}"
echo "============================================"
