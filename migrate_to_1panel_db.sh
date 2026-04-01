#!/usr/bin/env bash
set -euo pipefail

# ==============================
# 老环境 -> 1Panel PostgreSQL 迁移脚本
# 说明：
# 1) 通过 pg_dump 从老库导出
# 2) 通过 pg_restore 导入新库
# 3) 建议在低峰期执行，并在切换前做最后一次增量/全量
# ==============================

# -------- 老环境数据库（当前运行环境）--------
OLD_DB_HOST="${OLD_DB_HOST:-192.168.210.90}"
OLD_DB_PORT="${OLD_DB_PORT:-5433}"
OLD_DB_NAME="${OLD_DB_NAME:-okr}"
OLD_DB_USER="${OLD_DB_USER:-okr}"
OLD_DB_PASSWORD="${OLD_DB_PASSWORD:-}"

# -------- 新环境数据库（1Panel容器）--------
NEW_DB_HOST="${NEW_DB_HOST:-1Panel-postgresql-BmMt}"
NEW_DB_PORT="${NEW_DB_PORT:-5432}"
NEW_DB_NAME="${NEW_DB_NAME:-okr}"
NEW_DB_USER="${NEW_DB_USER:-user_mPkjFK}"
NEW_DB_PASSWORD="${NEW_DB_PASSWORD:-password_PsaHca}"

NOW="$(date +%F_%H%M%S)"
DUMP_FILE="okr_full_${NOW}.dump"

if [[ -z "${OLD_DB_PASSWORD}" ]]; then
  echo "ERROR: 请先提供 OLD_DB_PASSWORD，例如："
  echo "OLD_DB_PASSWORD='xxx' ./migrate_to_1panel_db.sh"
  exit 1
fi

echo "===> [1/5] 从老库导出: ${OLD_DB_HOST}:${OLD_DB_PORT}/${OLD_DB_NAME}"
export PGPASSWORD="${OLD_DB_PASSWORD}"
pg_dump -h "${OLD_DB_HOST}" -p "${OLD_DB_PORT}" -U "${OLD_DB_USER}" -d "${OLD_DB_NAME}" \
  -Fc -f "${DUMP_FILE}"

echo "===> [2/5] 检查新库连通: ${NEW_DB_HOST}:${NEW_DB_PORT}/${NEW_DB_NAME}"
export PGPASSWORD="${NEW_DB_PASSWORD}"
psql -h "${NEW_DB_HOST}" -p "${NEW_DB_PORT}" -U "${NEW_DB_USER}" -d "${NEW_DB_NAME}" -c "SELECT 1;" >/dev/null

echo "===> [3/5] 导入新库（会清理同名对象）"
pg_restore -h "${NEW_DB_HOST}" -p "${NEW_DB_PORT}" -U "${NEW_DB_USER}" -d "${NEW_DB_NAME}" \
  --clean --if-exists --no-owner --no-privileges "${DUMP_FILE}"

echo "===> [4/5] 基础行数校验"
echo "---- OLD users/okrs/workflows/configs ----"
export PGPASSWORD="${OLD_DB_PASSWORD}"
psql -h "${OLD_DB_HOST}" -p "${OLD_DB_PORT}" -U "${OLD_DB_USER}" -d "${OLD_DB_NAME}" -c \
  "SELECT 'users' t, COUNT(*) c FROM users UNION ALL SELECT 'okrs', COUNT(*) FROM okrs UNION ALL SELECT 'workflows', COUNT(*) FROM workflows UNION ALL SELECT 'configs', COUNT(*) FROM configs;"

echo "---- NEW users/okrs/workflows/configs ----"
export PGPASSWORD="${NEW_DB_PASSWORD}"
psql -h "${NEW_DB_HOST}" -p "${NEW_DB_PORT}" -U "${NEW_DB_USER}" -d "${NEW_DB_NAME}" -c \
  "SELECT 'users' t, COUNT(*) c FROM users UNION ALL SELECT 'okrs', COUNT(*) FROM okrs UNION ALL SELECT 'workflows', COUNT(*) FROM workflows UNION ALL SELECT 'configs', COUNT(*) FROM configs;"

echo "===> [5/5] 迁移完成: ${DUMP_FILE}"
echo "下一步：在 1Panel 使用 docker-compose.1panel.prod.yml 部署并验证 /health"

