import pool from './database';
import bcrypt from 'bcryptjs';

export async function migrate() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('开始数据库迁移...');
    
    // 1. 创建用户表
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(50) PRIMARY KEY,
        account VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255),
        name VARCHAR(100) NOT NULL,
        role VARCHAR(50) NOT NULL,
        department VARCHAR(100),
        avatar TEXT,
        source VARCHAR(20) DEFAULT 'LOCAL',
        sso_connected BOOLEAN DEFAULT FALSE,
        is_primary_approver BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // 添加第三方集成字段（如果不存在）
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS wechat_userid VARCHAR(255);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS wechat_openid VARCHAR(255);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS sso_provider VARCHAR(50);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS sso_id VARCHAR(255);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS sso_attributes JSONB;
    `);
    
    // 添加第三方账号索引
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_wechat_userid ON users(wechat_userid) WHERE wechat_userid IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_users_sso_id ON users(sso_id) WHERE sso_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_users_sso_provider ON users(sso_provider) WHERE sso_provider IS NOT NULL;
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
      CREATE INDEX IF NOT EXISTS idx_users_department ON users(department);
    `);
    console.log('✅ 用户表创建完成');
    // 为已存在且 password 为空的用户设置默认密码，确保所有用户均可通过账户/密码登录
    try {
      const defaultPasswordHash = await bcrypt.hash('Password123!', 10);
      await client.query('UPDATE users SET password = $1 WHERE password IS NULL', [defaultPasswordHash]);
      console.log('✅ 为 NULL 密码的用户设置默认登录密码');
    } catch (e) {
      console.warn('设置默认登录密码失败:', (e as any).message);
    }
    
    // 2. 创建 OKR 表
    await client.query(`
      CREATE TABLE IF NOT EXISTS okrs (
        id VARCHAR(50) PRIMARY KEY,
        user_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        level VARCHAR(20) NOT NULL CHECK (level IN ('COMPANY', 'DEPARTMENT', 'PERSONAL')),
        title VARCHAR(500) NOT NULL,
        period VARCHAR(50),
        status VARCHAR(50) NOT NULL CHECK (status IN (
          'DRAFT', 'PENDING_MANAGER', 'PENDING_GM', 'PUBLISHED',
          'PENDING_ASSESSMENT_APPROVAL', 'GRADING', 'PENDING_L2_APPROVAL',
          'PENDING_L3_APPROVAL', 'PENDING_ARCHIVE', 'CLOSED'
        )),
        parent_okr_id VARCHAR(50) REFERENCES okrs(id) ON DELETE SET NULL,
        approver_l1_role VARCHAR(50),
        approver_l2_role VARCHAR(50),
        approver_l3_role VARCHAR(50),
        cc_roles TEXT[],
        peer_reviewers TEXT[],
        -- display_order：我的 OKR 卡片优先级（从上到下，数字越小越靠前）
        display_order INTEGER NOT NULL DEFAULT 0,
        total_score DECIMAL(5,2) CHECK (total_score >= 0 AND total_score <= 120),
        final_grade VARCHAR(10) CHECK (final_grade IN ('S', 'A', 'B', 'C', '待定')),
        adjustment_reason TEXT,
        is_performance_archived BOOLEAN DEFAULT FALSE,
        objectives JSONB NOT NULL,
        overall_self_assessment JSONB,
        overall_manager_assessment JSONB,
        cc_feedback JSONB,
        version INTEGER DEFAULT 1 NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_by VARCHAR(50) REFERENCES users(id),
        updated_by VARCHAR(50) REFERENCES users(id)
      );
    `);
    
    // 先创建基础索引
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_okrs_user_id ON okrs(user_id);
      CREATE INDEX IF NOT EXISTS idx_okrs_status ON okrs(status);
      CREATE INDEX IF NOT EXISTS idx_okrs_level ON okrs(level);
      CREATE INDEX IF NOT EXISTS idx_okrs_parent_id ON okrs(parent_okr_id);
      CREATE INDEX IF NOT EXISTS idx_okrs_created_at ON okrs(created_at DESC);
    `);

    // 兼容旧库：如果之前没有 display_order 列，则初始化它为“按创建时间倒序”的队列顺序
    // 初始化只在列缺失时执行，避免覆盖用户手动调整后的结果。
    const colCheck = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'okrs' AND column_name = 'display_order'
    `);
    if (colCheck.rows.length > 0) {
      // 列已存在：仅确保字段存在（ALTER IF NOT EXISTS 已做）
    } else {
      // 理论上不会走到这里（因为 CREATE TABLE 已包含字段），但保留防御式逻辑
      await client.query(`ALTER TABLE okrs ADD COLUMN display_order INTEGER NOT NULL DEFAULT 0;`);
    }

    // 如果是旧库且 display_order 列刚加入，则它的值应该都是默认 0，我们用一遍初始化即可
    // （注意：如果列已存在且非 0，则跳过初始化）
    const zeroCountRes = await client.query(`SELECT COUNT(*)::int AS cnt FROM okrs WHERE display_order = 0`);
    if (zeroCountRes.rows[0]?.cnt > 0) {
      // 将 display_order 初始化为每个 user_id 下的 created_at 倒序序号
      await client.query(`
        UPDATE okrs SET display_order = sub.rn
        FROM (
          SELECT id,
                 ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC, id DESC) AS rn
          FROM okrs
          WHERE display_order = 0
        ) sub
        WHERE okrs.id = sub.id;
      `);
    }

    // display_order 索引（要求列存在，且此时列已在上面 ALTER/创建逻辑中完成）
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_okrs_user_display_order ON okrs(user_id, display_order);
    `);
    
    // GIN 索引需要单独创建（如果不存在且列存在）
    try {
      // 先检查列是否存在
      const colCheck = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'okrs' AND column_name = 'objectives'
      `);
      if (colCheck.rows.length > 0) {
        await client.query(`
          CREATE INDEX IF NOT EXISTS idx_okrs_objectives ON okrs USING GIN (objectives);
        `);
      }
    } catch (e: any) {
      if (e.code !== '42P07') { // 忽略索引已存在的错误
        console.warn('创建 objectives GIN 索引失败:', e.message);
      }
    }
    
    try {
      const colCheck = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'okrs' AND column_name = 'peer_reviewers'
      `);
      if (colCheck.rows.length > 0) {
        await client.query(`
          CREATE INDEX IF NOT EXISTS idx_okrs_peer_reviewers ON okrs USING GIN (peer_reviewers);
        `);
      }
    } catch (e: any) {
      if (e.code !== '42P07') {
        console.warn('创建 peer_reviewers GIN 索引失败:', e.message);
      }
    }
    console.log('✅ OKR 表创建完成');
    
    // 3. 创建 OKR 变更历史表
    await client.query(`
      CREATE TABLE IF NOT EXISTS okr_history (
        id SERIAL PRIMARY KEY,
        okr_id VARCHAR(50) NOT NULL REFERENCES okrs(id) ON DELETE CASCADE,
        changed_by VARCHAR(50) NOT NULL REFERENCES users(id),
        changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        action VARCHAR(50) NOT NULL,
        field_name VARCHAR(50),
        old_value TEXT,
        new_value TEXT,
        change_reason TEXT,
        ip VARCHAR(50)
      );
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_okr_history_okr_id ON okr_history(okr_id);
      CREATE INDEX IF NOT EXISTS idx_okr_history_changed_at ON okr_history(changed_at DESC);
      CREATE INDEX IF NOT EXISTS idx_okr_history_action ON okr_history(action);
    `);
    console.log('✅ OKR 变更历史表创建完成');
    
    // 4. 创建审批流程表
    await client.query(`
      CREATE TABLE IF NOT EXISTS workflows (
        id SERIAL PRIMARY KEY,
        target_role VARCHAR(50) UNIQUE NOT NULL,
        approver_role_l1 VARCHAR(50),
        approver_role_l2 VARCHAR(50),
        approver_role_l3 VARCHAR(50),
        cc_roles TEXT[],
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_workflows_target_role ON workflows(target_role);
    `);
    console.log('✅ 审批流程表创建完成');
    
    // 5. 创建绩效等级配置表
    await client.query(`
      CREATE TABLE IF NOT EXISTS grade_configs (
        id SERIAL PRIMARY KEY,
        grade VARCHAR(10) UNIQUE NOT NULL CHECK (grade IN ('S', 'A', 'B', 'C')),
        min_score DECIMAL(5,2) NOT NULL CHECK (min_score >= 0),
        max_score DECIMAL(5,2) NOT NULL CHECK (max_score >= min_score),
        quota INTEGER NOT NULL CHECK (quota >= 0 AND quota <= 100),
        description VARCHAR(200),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ 绩效等级配置表创建完成');
    
    // 6. 创建部门表
    await client.query(`
      CREATE TABLE IF NOT EXISTS departments (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_departments_name ON departments(name);
    `);
    console.log('✅ 部门表创建完成');
    
    // 7. 创建自定义角色表
    await client.query(`
      CREATE TABLE IF NOT EXISTS custom_roles (
        value VARCHAR(50) PRIMARY KEY,
        label VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ 自定义角色表创建完成');
    
    // 8. 创建操作日志表
    await client.query(`
      CREATE TABLE IF NOT EXISTS operation_logs (
        id VARCHAR(50) PRIMARY KEY,
        user_id VARCHAR(50) NOT NULL REFERENCES users(id),
        user_name VARCHAR(100) NOT NULL,
        action VARCHAR(50) NOT NULL,
        module VARCHAR(50) NOT NULL,
        details TEXT,
        ip VARCHAR(50),
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_operation_logs_user_id ON operation_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_operation_logs_timestamp ON operation_logs(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_operation_logs_module ON operation_logs(module);
    `);
    console.log('✅ 操作日志表创建完成');
    
    // 9. 创建系统配置表
    await client.query(`
      CREATE TABLE IF NOT EXISTS configs (
        key VARCHAR(50) PRIMARY KEY,
        value JSONB NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_by VARCHAR(50) REFERENCES users(id)
      );
    `);
    console.log('✅ 系统配置表创建完成');
    
    // 10. 创建触发器函数
    await client.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);
    
    // 11. 创建触发器
    await client.query(`
      DROP TRIGGER IF EXISTS update_users_updated_at ON users;
      CREATE TRIGGER update_users_updated_at 
        BEFORE UPDATE ON users
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);
    
    await client.query(`
      DROP TRIGGER IF EXISTS update_okrs_updated_at ON okrs;
      CREATE TRIGGER update_okrs_updated_at 
        BEFORE UPDATE ON okrs
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);
    
    await client.query(`
      DROP TRIGGER IF EXISTS update_workflows_updated_at ON workflows;
      CREATE TRIGGER update_workflows_updated_at 
        BEFORE UPDATE ON workflows
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);
    
    await client.query(`
      DROP TRIGGER IF EXISTS update_grade_configs_updated_at ON grade_configs;
      CREATE TRIGGER update_grade_configs_updated_at 
        BEFORE UPDATE ON grade_configs
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);
    
    await client.query(`
      DROP TRIGGER IF EXISTS update_custom_roles_updated_at ON custom_roles;
      CREATE TRIGGER update_custom_roles_updated_at 
        BEFORE UPDATE ON custom_roles
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);
    console.log('✅ 触发器创建完成');
    
    // 12. 创建 OKR 变更历史触发器
    await client.query(`
      CREATE OR REPLACE FUNCTION log_okr_changes()
      RETURNS TRIGGER AS $$
      BEGIN
        IF TG_OP = 'INSERT' THEN
          INSERT INTO okr_history (okr_id, changed_by, action, new_value)
          VALUES (NEW.id, COALESCE(NEW.created_by, 'system'), 'CREATE', row_to_json(NEW)::text);
          RETURN NEW;
        ELSIF TG_OP = 'UPDATE' THEN
          IF OLD.status != NEW.status THEN
            INSERT INTO okr_history (okr_id, changed_by, action, field_name, old_value, new_value)
            VALUES (NEW.id, COALESCE(NEW.updated_by, 'system'), 'STATUS_CHANGE', 'status', OLD.status, NEW.status);
          END IF;
          IF OLD.total_score IS DISTINCT FROM NEW.total_score THEN
            INSERT INTO okr_history (okr_id, changed_by, action, field_name, old_value, new_value)
            VALUES (NEW.id, COALESCE(NEW.updated_by, 'system'), 'SCORE_UPDATE', 'total_score', 
                    COALESCE(OLD.total_score::text, ''), COALESCE(NEW.total_score::text, ''));
          END IF;
          RETURN NEW;
        END IF;
        RETURN NULL;
      END;
      $$ language 'plpgsql';
    `);
    
    await client.query(`
      DROP TRIGGER IF EXISTS okr_history_trigger ON okrs;
      CREATE TRIGGER okr_history_trigger
        AFTER INSERT OR UPDATE ON okrs
        FOR EACH ROW EXECUTE FUNCTION log_okr_changes();
    `);
    console.log('✅ OKR 变更历史触发器创建完成');
    
    await client.query('COMMIT');
    console.log('✅ 数据库迁移完成！');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ 数据库迁移失败:', error);
    throw error;
  } finally {
    client.release();
  }
}

// 如果直接运行此文件
if (require.main === module) {
  migrate()
    .then(() => {
      console.log('迁移脚本执行完成');
      process.exit(0);
    })
    .catch((error) => {
      console.error('迁移脚本执行失败:', error);
      process.exit(1);
    });
}
