#!/bin/bash

echo "🧪 测试 OKR 系统环境"
echo "===================="

# 测试后端
echo ""
echo "1. 测试后端服务..."
BACKEND_STATUS=$(curl -s http://localhost:3001/health)
if [[ $BACKEND_STATUS == *"ok"* ]]; then
    echo "✅ 后端服务运行正常"
else
    echo "❌ 后端服务未运行，请运行: cd backend && npm run dev"
    exit 1
fi

# 测试数据库连接
echo ""
echo "2. 测试数据库连接..."
cd backend
DB_TEST=$(node -e "const { Pool } = require('pg'); const pool = new Pool({host: '192.168.210.90', port: 5433, database: 'okr', user: 'okr', password: 'pbd76htiMAHymt3r'}); pool.query('SELECT 1').then(() => {console.log('OK'); process.exit(0);}).catch(e => {console.log('FAIL'); process.exit(1);});" 2>&1)
if [[ $DB_TEST == *"OK"* ]]; then
    echo "✅ 数据库连接正常"
else
    echo "❌ 数据库连接失败"
    exit 1
fi
cd ..

# 测试登录API
echo ""
echo "3. 测试登录API..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"account":"admin","password":"Gw1admin."}')
if [[ $LOGIN_RESPONSE == *"success\":true"* ]]; then
    echo "✅ 登录API正常"
    TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)
    echo "   Token: ${TOKEN:0:50}..."
else
    echo "❌ 登录API失败"
    echo "   响应: $LOGIN_RESPONSE"
    exit 1
fi

# 测试获取用户API
echo ""
echo "4. 测试获取用户API..."
USERS_RESPONSE=$(curl -s -X GET http://localhost:3001/api/users \
  -H "Authorization: Bearer $TOKEN")
if [[ $USERS_RESPONSE == *"success\":true"* ]]; then
    echo "✅ 获取用户API正常"
    USER_COUNT=$(echo $USERS_RESPONSE | grep -o '"users":\[.*\]' | grep -o '{"id"' | wc -l)
    echo "   用户数量: $USER_COUNT"
else
    echo "❌ 获取用户API失败"
    echo "   响应: $USERS_RESPONSE"
    exit 1
fi

# 测试前端
echo ""
echo "5. 测试前端服务..."
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000)
if [[ $FRONTEND_STATUS == "200" ]]; then
    echo "✅ 前端服务运行正常"
else
    echo "⚠️  前端服务未运行 (HTTP $FRONTEND_STATUS)"
    echo "   请运行: npm run dev"
fi

echo ""
echo "===================="
echo "✅ 系统测试完成！"
echo ""
echo "访问地址："
echo "  前端: http://localhost:3000"
echo "  后端: http://localhost:3001"
echo ""
echo "测试账号："
echo "  账号: admin"
echo "  密码: Gw1admin."
