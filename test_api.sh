#!/bin/bash

# 后端 API 同步测试脚本

BASE_URL="http://localhost:3001/api/v1"
TOKEN=""

echo "=========================================="
echo "后端 API 同步测试"
echo "=========================================="
echo ""

# 1. 登录测试
echo "【测试 1】登录 API"
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"account":"admin","password":"Gw1admin."}')

if echo "$LOGIN_RESPONSE" | grep -q '"success":true'; then
  echo "✅ POST /v1/auth/login - 成功"
  TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
  echo "   Token: ${TOKEN:0:50}..."
else
  echo "❌ POST /v1/auth/login - 失败"
  echo "   响应: $(echo "$LOGIN_RESPONSE" | head -c 200)"
  exit 1
fi
echo ""

# 2. 用户列表测试
echo "【测试 2】获取用户列表"
USER_RESPONSE=$(curl -s "$BASE_URL/users" -H "Authorization: Bearer $TOKEN")
if echo "$USER_RESPONSE" | grep -q '"success":true'; then
  echo "✅ GET /v1/users - 成功"
  USER_COUNT=$(echo "$USER_RESPONSE" | grep -o '"users":\[.*\]' | grep -o '"id"' | wc -l | tr -d ' ')
  echo "   用户数量: $USER_COUNT"
else
  echo "❌ GET /v1/users - 失败"
  echo "   响应: $(echo "$USER_RESPONSE" | head -c 200)"
fi
echo ""

# 3. OKR 列表测试
echo "【测试 3】获取 OKR 列表"
OKR_RESPONSE=$(curl -s "$BASE_URL/okrs" -H "Authorization: Bearer $TOKEN")
if echo "$OKR_RESPONSE" | grep -q '"success":true'; then
  echo "✅ GET /v1/okrs - 成功"
  OKR_COUNT=$(echo "$OKR_RESPONSE" | grep -o '"okrs":\[.*\]' | grep -o '"id"' | wc -l | tr -d ' ')
  echo "   OKR 数量: $OKR_COUNT"
else
  echo "❌ GET /v1/okrs - 失败"
  echo "   响应: $(echo "$OKR_RESPONSE" | head -c 300)"
fi
echo ""

# 4. 创建 OKR 测试
echo "【测试 4】创建 OKR"
CREATE_OKR_RESPONSE=$(curl -s -X POST "$BASE_URL/okrs" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "API测试OKR",
    "level": "PERSONAL",
    "period": "2024-Q1",
    "status": "DRAFT",
    "objectives": [{"id":"obj1","content":"测试目标","weight":100,"keyResults":[]}],
    "userId": "u8"
  }')

if echo "$CREATE_OKR_RESPONSE" | grep -q '"success":true'; then
  echo "✅ POST /v1/okrs - 成功"
  OKR_ID=$(echo "$CREATE_OKR_RESPONSE" | grep -o '"id":"[^"]*' | cut -d'"' -f4 | head -1)
  echo "   OKR ID: $OKR_ID"
else
  echo "❌ POST /v1/okrs - 失败"
  echo "   响应: $(echo "$CREATE_OKR_RESPONSE" | head -c 300)"
  OKR_ID=""
fi
echo ""

# 5. 更新 OKR 测试
if [ -n "$OKR_ID" ]; then
  echo "【测试 5】更新 OKR"
  UPDATE_OKR_RESPONSE=$(curl -s -X PUT "$BASE_URL/okrs/$OKR_ID" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"title\": \"更新后的API测试OKR\",
      \"level\": \"PERSONAL\",
      \"period\": \"2024-Q1\",
      \"status\": \"DRAFT\",
      \"objectives\": [],
      \"userId\": \"u8\",
      \"version\": 1
    }")
  
  if echo "$UPDATE_OKR_RESPONSE" | grep -q '"success":true'; then
    echo "✅ PUT /v1/okrs/$OKR_ID - 成功"
  else
    echo "❌ PUT /v1/okrs/$OKR_ID - 失败"
    echo "   响应: $(echo "$UPDATE_OKR_RESPONSE" | head -c 300)"
  fi
  echo ""
fi

# 6. 更新 OKR 状态测试
if [ -n "$OKR_ID" ]; then
  echo "【测试 6】更新 OKR 状态"
  STATUS_RESPONSE=$(curl -s -X PATCH "$BASE_URL/okrs/$OKR_ID/status" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"status":"PENDING_MANAGER"}')
  
  if echo "$STATUS_RESPONSE" | grep -q '"success":true'; then
    echo "✅ PATCH /v1/okrs/$OKR_ID/status - 成功"
  else
    echo "❌ PATCH /v1/okrs/$OKR_ID/status - 失败"
    echo "   响应: $(echo "$STATUS_RESPONSE" | head -c 300)"
  fi
  echo ""
fi

# 7. 审批流程测试
echo "【测试 7】获取审批流程"
WORKFLOW_RESPONSE=$(curl -s "$BASE_URL/workflows" -H "Authorization: Bearer $TOKEN")
if echo "$WORKFLOW_RESPONSE" | grep -q '"success":true'; then
  echo "✅ GET /v1/workflows - 成功"
else
  echo "❌ GET /v1/workflows - 失败"
  echo "   响应: $(echo "$WORKFLOW_RESPONSE" | head -c 200)"
fi
echo ""

# 8. 绩效等级配置测试
echo "【测试 8】获取绩效等级配置"
GRADE_RESPONSE=$(curl -s "$BASE_URL/grade-configs" -H "Authorization: Bearer $TOKEN")
if echo "$GRADE_RESPONSE" | grep -q '"success":true'; then
  echo "✅ GET /v1/grade-configs - 成功"
else
  echo "❌ GET /v1/grade-configs - 失败"
  echo "   响应: $(echo "$GRADE_RESPONSE" | head -c 200)"
fi
echo ""

# 9. 部门列表测试
echo "【测试 9】获取部门列表"
DEPT_RESPONSE=$(curl -s "$BASE_URL/departments" -H "Authorization: Bearer $TOKEN")
if echo "$DEPT_RESPONSE" | grep -q '"success":true'; then
  echo "✅ GET /v1/departments - 成功"
else
  echo "❌ GET /v1/departments - 失败"
  echo "   响应: $(echo "$DEPT_RESPONSE" | head -c 200)"
fi
echo ""

# 10. 自定义角色测试
echo "【测试 10】获取自定义角色"
ROLE_RESPONSE=$(curl -s "$BASE_URL/custom-roles" -H "Authorization: Bearer $TOKEN")
if echo "$ROLE_RESPONSE" | grep -q '"success":true'; then
  echo "✅ GET /v1/custom-roles - 成功"
else
  echo "❌ GET /v1/custom-roles - 失败"
  echo "   响应: $(echo "$ROLE_RESPONSE" | head -c 200)"
fi
echo ""

# 11. 操作日志测试
echo "【测试 11】获取操作日志"
LOG_RESPONSE=$(curl -s "$BASE_URL/logs?limit=10" -H "Authorization: Bearer $TOKEN")
if echo "$LOG_RESPONSE" | grep -q '"success":true'; then
  echo "✅ GET /v1/logs - 成功"
else
  echo "❌ GET /v1/logs - 失败"
  echo "   响应: $(echo "$LOG_RESPONSE" | head -c 200)"
fi
echo ""

echo "=========================================="
echo "测试完成"
echo "=========================================="
