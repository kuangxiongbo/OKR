/**
 * 清除匡雄波（account: kuangxb@myibc.net, id=u-kuangxb）的 OKR 内容
 * okr_history 有 ON DELETE CASCADE，会随 okrs 一并删除
 */
import pool from '../config/database';

async function clearKuangxbOKRs() {
  // 后端用户表中匡雄波的固定 user_id
  const kuangxbUserId = 'u-kuangxb';

  const result = await pool.query('DELETE FROM okrs WHERE user_id = $1', [kuangxbUserId]);
  console.log(`✅ 已清除匡雄波的 OKR：删除 ${result.rowCount} 条`);

  await pool.end();
}

clearKuangxbOKRs().catch((err) => {
  console.error('❌ 清除失败:', err);
  process.exit(1);
});

