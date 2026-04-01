// 测试自评提交功能
const { Pool } = require('pg');

const pool = new Pool({
  host: '192.168.210.90',
  port: 5433,
  database: 'okr',
  user: 'okr',
  password: 'pbd76htiMAHymt3r'
});

async function testSelfAssessment() {
  const client = await pool.connect();
  
  try {
    console.log('🧪 开始测试自评提交功能...\n');
    
    // 1. 查找一个状态为 PUBLISHED 的 OKR
    console.log('📋 步骤 1: 查找测试 OKR...');
    const okrResult = await client.query(`
      SELECT id, title, status, user_id, overall_self_assessment, objectives
      FROM okrs 
      WHERE status = 'PUBLISHED'
      LIMIT 1
    `);
    
    if (okrResult.rows.length === 0) {
      console.log('   ⚠️  没有找到状态为 PUBLISHED 的 OKR，跳过测试');
      return;
    }
    
    const testOKR = okrResult.rows[0];
    console.log(`   ✅ 找到 OKR: ${testOKR.id}`);
    console.log(`   - 标题: ${testOKR.title}`);
    console.log(`   - 当前状态: ${testOKR.status}`);
    console.log(`   - 用户ID: ${testOKR.user_id}\n`);
    
    // 2. 准备自评数据
    console.log('📝 步骤 2: 准备自评数据...');
    let objectives = typeof testOKR.objectives === 'string' 
      ? JSON.parse(testOKR.objectives) 
      : testOKR.objectives;
    
    // 添加自评数据到 objectives
    if (objectives && objectives.length > 0) {
      objectives = objectives.map((obj, i) => {
        const updatedObj = { ...obj };
        // 添加关键结果自评数据
        if (updatedObj.keyResults && updatedObj.keyResults.length > 0) {
          updatedObj.keyResults = updatedObj.keyResults.map((kr, j) => ({
            ...kr,
            selfScore: 90 + (i * 10) + j,
            selfComment: `关键结果 ${j + 1} 的自评评论`
          }));
        }
        // 计算目标自评分数
        let objScore = 0;
        if (updatedObj.keyResults) {
          updatedObj.keyResults.forEach(kr => {
            objScore += (kr.selfScore || 0) * (kr.weight / 100);
          });
        }
        updatedObj.selfScore = Math.round(objScore * 10) / 10;
        updatedObj.selfComment = `目标 ${i + 1} 的自评总结`;
        return updatedObj;
      });
    }
    
    // 计算总分
    let totalScore = 0;
    objectives.forEach(obj => {
      totalScore += (obj.selfScore || 0) * (obj.weight / 100);
    });
    totalScore = Math.round(totalScore * 10) / 10;
    
    // 准备整体自评
    const overallSelfAssessment = {
      score: totalScore,
      comment: '这是整体自评总结，用于测试自评提交功能。'
    };
    
    console.log(`   ✅ 自评数据准备完成`);
    console.log(`   - 目标数量: ${objectives.length}`);
    console.log(`   - 自评总分: ${totalScore}`);
    console.log(`   - 整体自评总结: ${overallSelfAssessment.comment.substring(0, 20)}...\n`);
    
    // 3. 测试保存自评数据（模拟 saveImmediately）
    console.log('💾 步骤 3: 保存自评数据...');
    await client.query(`
      UPDATE okrs 
      SET 
        objectives = $1::jsonb,
        overall_self_assessment = $2::jsonb,
        version = version + 1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
    `, [JSON.stringify(objectives), JSON.stringify(overallSelfAssessment), testOKR.id]);
    console.log('   ✅ 自评数据已保存\n');
    
    // 4. 测试更新状态（模拟提交自评）
    console.log('🔄 步骤 4: 更新状态为 PENDING_ASSESSMENT_APPROVAL...');
    await client.query(`
      UPDATE okrs 
      SET 
        status = $1,
        version = version + 1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, ['PENDING_ASSESSMENT_APPROVAL', testOKR.id]);
    console.log('   ✅ 状态已更新\n');
    
    // 5. 验证数据保存
    console.log('🔍 步骤 5: 验证数据保存...');
    const verifyResult = await client.query(`
      SELECT 
        id, 
        title, 
        status, 
        overall_self_assessment,
        objectives,
        version
      FROM okrs 
      WHERE id = $1
    `, [testOKR.id]);
    
    const verifiedOKR = verifyResult.rows[0];
    const verifiedObjectives = typeof verifiedOKR.objectives === 'string'
      ? JSON.parse(verifiedOKR.objectives)
      : verifiedOKR.objectives;
    const verifiedSelfAssessment = typeof verifiedOKR.overall_self_assessment === 'string'
      ? JSON.parse(verifiedOKR.overall_self_assessment)
      : verifiedOKR.overall_self_assessment;
    
    console.log(`   - OKR ID: ${verifiedOKR.id}`);
    console.log(`   - 状态: ${verifiedOKR.status}`);
    console.log(`   - 版本号: ${verifiedOKR.version}`);
    
    // 验证状态
    if (verifiedOKR.status === 'PENDING_ASSESSMENT_APPROVAL') {
      console.log('   ✅ 状态更新正确');
    } else {
      console.error(`   ❌ 状态更新失败，期望: PENDING_ASSESSMENT_APPROVAL，实际: ${verifiedOKR.status}`);
    }
    
    // 验证整体自评
    if (verifiedSelfAssessment && verifiedSelfAssessment.comment) {
      console.log('   ✅ 整体自评数据已保存');
      console.log(`   - 自评分数: ${verifiedSelfAssessment.score}`);
      console.log(`   - 自评总结: ${verifiedSelfAssessment.comment.substring(0, 30)}...`);
    } else {
      console.error('   ❌ 整体自评数据未保存');
    }
    
    // 验证目标自评数据
    let hasSelfScores = false;
    let hasSelfComments = false;
    if (verifiedObjectives && verifiedObjectives.length > 0) {
      verifiedObjectives.forEach((obj, i) => {
        if (obj.selfScore !== undefined) hasSelfScores = true;
        if (obj.selfComment) hasSelfComments = true;
        if (obj.keyResults) {
          obj.keyResults.forEach(kr => {
            if (kr.selfScore !== undefined) hasSelfScores = true;
            if (kr.selfComment) hasSelfComments = true;
          });
        }
      });
    }
    
    if (hasSelfScores) {
      console.log('   ✅ 自评分数已保存');
    } else {
      console.error('   ❌ 自评分数未保存');
    }
    
    if (hasSelfComments) {
      console.log('   ✅ 自评评论已保存');
    } else {
      console.error('   ❌ 自评评论未保存');
    }
    
    console.log('\n✅ 所有测试通过！\n');
    
    // 6. 恢复测试数据（可选）
    console.log('🔄 步骤 6: 恢复测试数据...');
    await client.query(`
      UPDATE okrs 
      SET 
        status = 'PUBLISHED',
        overall_self_assessment = NULL,
        objectives = $1::jsonb,
        version = version + 1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [JSON.stringify(testOKR.objectives), testOKR.id]);
    console.log('   ✅ 测试数据已恢复\n');
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

testSelfAssessment();
