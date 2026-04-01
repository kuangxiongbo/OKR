// 测试协作建议保存和读取逻辑
const { Pool } = require('pg');

const pool = new Pool({
  host: '192.168.210.90',
  port: 5433,
  database: 'okr',
  user: 'okr',
  password: 'pbd76htiMAHymt3r'
});

async function testCCFeedback() {
  const client = await pool.connect();
  
  try {
    console.log('🧪 开始测试协作建议保存和读取...\n');
    
    // 1. 测试数据
    const testCCFeedback = [
      {
        userId: 'test-user-1',
        userName: '测试用户1',
        role: '产品经理',
        comment: '这是一个测试建议',
        recommendedGrade: 'A',
        createdAt: new Date().toISOString()
      },
      {
        userId: 'test-user-2',
        userName: '测试用户2',
        role: '技术负责人',
        comment: '这是另一个测试建议',
        createdAt: new Date().toISOString()
      }
    ];
    
    // 2. 检查字段类型
    console.log('📋 检查数据库字段类型...');
    const typeCheck = await client.query(`
      SELECT column_name, data_type, udt_name 
      FROM information_schema.columns 
      WHERE table_name = 'okrs' AND column_name = 'cc_feedback'
    `);
    console.log('   字段类型:', typeCheck.rows[0]);
    if (typeCheck.rows[0].data_type !== 'jsonb' && typeCheck.rows[0].udt_name !== 'jsonb') {
      console.error('❌ 字段类型错误！应该是 jsonb');
      return;
    }
    console.log('   ✅ 字段类型正确\n');
    
    // 3. 查找一个测试 OKR（或创建一个）
    console.log('📝 查找测试 OKR...');
    const okrResult = await client.query(`
      SELECT id, title, cc_feedback 
      FROM okrs 
      LIMIT 1
    `);
    
    if (okrResult.rows.length === 0) {
      console.log('   ⚠️  没有找到 OKR，跳过更新测试');
      return;
    }
    
    const testOKRId = okrResult.rows[0].id;
    const oldCCFeedback = okrResult.rows[0].cc_feedback;
    console.log(`   找到 OKR: ${testOKRId}`);
    console.log(`   当前 cc_feedback: ${JSON.stringify(oldCCFeedback)}\n`);
    
    // 4. 测试保存（模拟代码逻辑）
    console.log('💾 测试保存协作建议...');
    const jsonString = JSON.stringify(testCCFeedback);
    console.log(`   JSON 字符串: ${jsonString.substring(0, 100)}...`);
    
    await client.query(`
      UPDATE okrs 
      SET cc_feedback = $1::jsonb
      WHERE id = $2
    `, [jsonString, testOKRId]);
    console.log('   ✅ 保存成功\n');
    
    // 5. 测试读取（模拟代码逻辑）
    console.log('📖 测试读取协作建议...');
    const readResult = await client.query(`
      SELECT cc_feedback 
      FROM okrs 
      WHERE id = $1
    `, [testOKRId]);
    
    const readCCFeedback = readResult.rows[0].cc_feedback;
    console.log(`   读取的原始数据: ${JSON.stringify(readCCFeedback)}`);
    
    // 模拟代码中的解析逻辑
    let parsed;
    if (typeof readCCFeedback === 'string') {
      parsed = JSON.parse(readCCFeedback);
    } else {
      parsed = readCCFeedback;
    }
    
    console.log(`   解析后的数据: ${JSON.stringify(parsed, null, 2)}`);
    
    // 6. 验证数据完整性
    console.log('\n🔍 验证数据完整性...');
    if (Array.isArray(parsed) && parsed.length === 2) {
      console.log('   ✅ 数据是数组，长度正确');
      if (parsed[0].userId === 'test-user-1' && parsed[1].userId === 'test-user-2') {
        console.log('   ✅ 数据内容正确');
        console.log('   ✅ 所有测试通过！\n');
      } else {
        console.error('   ❌ 数据内容不正确');
      }
    } else {
      console.error('   ❌ 数据格式不正确');
    }
    
    // 7. 恢复原始数据
    console.log('🔄 恢复原始数据...');
    await client.query(`
      UPDATE okrs 
      SET cc_feedback = $1
      WHERE id = $2
    `, [oldCCFeedback, testOKRId]);
    console.log('   ✅ 恢复完成\n');
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

testCCFeedback();
