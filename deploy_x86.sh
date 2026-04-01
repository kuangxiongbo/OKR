#!/bin/bash
# =====================================================
# OKR 系统 X86 镜像发布脚本
# 目标：构建 linux/amd64 并推送到私有仓库
# 用法：
#   ./deploy_x86.sh                # 默认 latest
#   ./deploy_x86.sh v2026.03.31
#   REGISTRY_PREFIX=192.168.210.90:6000/library ./deploy_x86.sh v2026.03.31
#   PLATFORM=linux/amd64,linux/arm64 ./deploy_x86.sh v2026.03.31
#
# 基础镜像（避免 Docker Hub 超时）任选其一：
#   A) 设置 REGISTRY_PREFIX，自动使用 ${PREFIX}/node:20-alpine 与 ${PREFIX}/nginx:alpine
#   B) 分别设置 NODE_IMAGE、NGINX_IMAGE 完整路径
#
# Builder：默认使用内置 default（不额外拉 moby/buildkit），内网不稳定时更稳。
#   BUILDX_BUILDER=mybuilder ./deploy_x86.sh ...
# =====================================================

set -euo pipefail

REGISTRY="192.168.210.90:6000"
BACKEND_IMAGE="okr-backend"
FRONTEND_IMAGE="okr-frontend"
TAG="${1:-latest}"
PLATFORM="${PLATFORM:-linux/amd64}"
BUILDX_BUILDER="${BUILDX_BUILDER:-default}"

if [[ -n "${REGISTRY_PREFIX:-}" ]]; then
  P="${REGISTRY_PREFIX%/}"
  NODE_IMG="${P}/node:20-alpine"
  NGINX_IMG="${P}/nginx:alpine"
else
  NODE_IMG="${NODE_IMAGE:-node:20-alpine}"
  NGINX_IMG="${NGINX_IMAGE:-nginx:alpine}"
fi

echo "============================================"
echo "  OKR 系统 X86/多架构镜像发布"
echo "  镜像仓库: ${REGISTRY}"
echo "  标签: ${TAG}"
echo "  平台: ${PLATFORM}"
echo "  buildx builder: ${BUILDX_BUILDER}"
echo "  NODE_IMAGE:     ${NODE_IMG}"
echo "  NGINX_IMAGE:    ${NGINX_IMG}"
echo "============================================"

echo ""
echo "🔧 [1/4] 选择 buildx builder（默认 default，避免拉取 Docker Hub 的 buildkit）..."
docker buildx use "${BUILDX_BUILDER}"
echo "✅ 当前 builder: ${BUILDX_BUILDER}"

echo ""
echo "📦 [2/4] 构建并推送后端镜像..."
docker buildx build \
  --builder "${BUILDX_BUILDER}" \
  --platform "${PLATFORM}" \
  --build-arg NODE_IMAGE="${NODE_IMG}" \
  -t "${REGISTRY}/${BACKEND_IMAGE}:${TAG}" \
  "./backend" \
  --push
echo "✅ 后端推送完成: ${REGISTRY}/${BACKEND_IMAGE}:${TAG}"

echo ""
echo "📦 [3/4] 构建并推送前端镜像..."
docker buildx build \
  --builder "${BUILDX_BUILDER}" \
  --platform "${PLATFORM}" \
  --build-arg NODE_IMAGE="${NODE_IMG}" \
  --build-arg NGINX_IMAGE="${NGINX_IMG}" \
  --build-arg VITE_API_BASE_URL=/api \
  -t "${REGISTRY}/${FRONTEND_IMAGE}:${TAG}" \
  "." \
  --push
echo "✅ 前端推送完成: ${REGISTRY}/${FRONTEND_IMAGE}:${TAG}"

echo ""
echo "🔍 [4/4] 校验远端 manifest（HTTP 私仓若失败可忽略）..."
docker buildx imagetools inspect "${REGISTRY}/${BACKEND_IMAGE}:${TAG}" || true
echo "--------------------------------------------"
docker buildx imagetools inspect "${REGISTRY}/${FRONTEND_IMAGE}:${TAG}" || true

echo ""
echo "============================================"
echo "  发布完成"
echo "  后端: ${REGISTRY}/${BACKEND_IMAGE}:${TAG}"
echo "  前端: ${REGISTRY}/${FRONTEND_IMAGE}:${TAG}"
echo "============================================"
