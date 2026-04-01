/**
 * 清空“已归档绩效”的 OKR 数据
 * - 目标：okrs.is_performance_archived = true
 * - okr_history 会因外键级联自动删除
 */
import pool from '../config/database';

async function clearArchivedOKRs() {
  const result = await pool.query(
    'DELETE FROM okrs WHERE is_performance_archived = true',
  );
  console.log(`✅ 已清空归档 OKR：删除 ${result.rowCount} 条`);
  await pool.end();
}

clearArchivedOKRs().catch((err) => {
  console.error('❌ 清除失败:', err);
  process.exit(1);
});

