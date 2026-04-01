/**
 * 清除系统管理员（admin, id=u8）的 OKR 内容
 * okr_history 有 ON DELETE CASCADE，会随 okrs 一并删除
 */
import pool from '../config/database';

async function clearAdminOKRs() {
  const adminUserId = 'u8';
  const result = await pool.query('DELETE FROM okrs WHERE user_id = $1', [adminUserId]);
  console.log(`✅ 已清除系统管理员的 OKR：删除 ${result.rowCount} 条`);
  await pool.end();
}

clearAdminOKRs().catch((err) => {
  console.error('❌ 清除失败:', err);
  process.exit(1);
});
