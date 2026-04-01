import pool from './database';
import { UserModel } from '../models/User';
import { INITIAL_USERS, DEPARTMENTS, ApprovalWorkflow, GradeConfiguration } from '../types';
import bcrypt from 'bcryptjs';

export async function seed() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('开始数据初始化...');
    
    // 0. 清空除 admin、匡雄波 以外的用户（保留原账号）
    const keepAccounts = ['admin', 'kuangxb@myibc.net'];
    // 先清理引用 users 的表，避免外键约束
    await client.query(
      `DELETE FROM okr_history WHERE changed_by IN (SELECT id FROM users WHERE account != ALL($1::text[]))`,
      [keepAccounts]
    );
    await client.query(
      `DELETE FROM operation_logs WHERE user_id IN (SELECT id FROM users WHERE account != ALL($1::text[]))`,
      [keepAccounts]
    );
    const del = await client.query(
      `DELETE FROM users WHERE account != ALL($1::text[])`,
      [keepAccounts]
    );
    if (del.rowCount && del.rowCount > 0) {
      console.log(`已清理 ${del.rowCount} 个旧用户（已保留 admin、匡雄波）`);
    }

    // 1. 初始化用户
    console.log('初始化用户数据...');
    for (const userData of INITIAL_USERS) {
      const existing = await UserModel.findByAccount(userData.account || '');
      if (!existing) {
        const hashedPassword = await bcrypt.hash(userData.password || 'Gw1admin.', 10);
        await client.query(
          `INSERT INTO users (id, account, password, name, role, department, avatar, source, sso_connected, is_primary_approver)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (id) DO NOTHING`,
          [
            userData.id,
            userData.account || '',
            hashedPassword,
            userData.name,
            userData.role,
            userData.department || '',
            userData.avatar || '',
            userData.source || 'LOCAL',
            userData.ssoConnected || false,
            userData.isPrimaryApprover || false
          ]
        );
      }
    }
    console.log(`✅ 用户数据初始化完成 (${INITIAL_USERS.length} 个用户)`);
    
    // 2. 初始化部门
    console.log('初始化部门数据...');
    for (const deptName of DEPARTMENTS) {
      await client.query(
        `INSERT INTO departments (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`,
        [deptName]
      );
    }
    console.log(`✅ 部门数据初始化完成 (${DEPARTMENTS.length} 个部门)`);
    
    // 3. 初始化审批流程（从 types.ts 中的 DEFAULT_WORKFLOWS）
    console.log('初始化审批流程数据...');
    const DEFAULT_WORKFLOWS: ApprovalWorkflow[] = [
      { targetRole: 'PRODUCT_EMPLOYEE', approverRoleL1: 'BUSINESS_HEAD', approverRoleL2: 'PRODUCT_GM' },
      { targetRole: 'RD_EMPLOYEE', ccRoles: ['TECH_MANAGER'], approverRoleL1: 'TECH_HEAD', approverRoleL2: 'TECH_GM' },
      { targetRole: 'QA_EMPLOYEE', ccRoles: ['QA_MANAGER', 'QA_HEAD'], approverRoleL1: 'TECH_HEAD', approverRoleL2: 'TECH_GM' },
      { targetRole: 'PROJECT_MANAGER', approverRoleL1: 'TECH_HEAD', approverRoleL2: 'QUALITY_GM' },
      { targetRole: 'QA_HEAD', ccRoles: ['TECH_HEAD'], approverRoleL1: 'TECH_GM', approverRoleL2: null },
      { targetRole: 'VP_TECH', approverRoleL1: 'PRESIDENT', approverRoleL2: null },
      { targetRole: 'VP_PRODUCT', approverRoleL1: 'PRESIDENT', approverRoleL2: null },
      { targetRole: 'VP_MARKET', approverRoleL1: 'PRESIDENT', approverRoleL2: null },
      { targetRole: 'QUALITY_GM', approverRoleL1: 'VP_PRODUCT', approverRoleL2: null },
      { targetRole: 'PROJECT_DEPT_GM', approverRoleL1: 'VP_MARKET', approverRoleL2: null },
      { targetRole: 'PRODUCT_GM', approverRoleL1: 'VP_PRODUCT', approverRoleL2: null },
      { targetRole: 'TECH_GM', approverRoleL1: 'VP_TECH', approverRoleL2: null },
      { targetRole: 'HRBP', approverRoleL1: 'PRESIDENT', approverRoleL2: null },
      { targetRole: 'TECH_EXPERT', approverRoleL1: 'GENERAL_OFFICE_DIRECTOR', approverRoleL2: null },
      { targetRole: 'GENERAL_OFFICE_DIRECTOR', approverRoleL1: 'VP_TECH', approverRoleL2: null },
      { targetRole: 'EMPLOYEE', approverRoleL1: 'HRBP', approverRoleL2: null },
      { targetRole: 'TECH_MANAGER', ccRoles: [], approverRoleL1: 'TECH_HEAD', approverRoleL2: 'TECH_GM' },
      { targetRole: 'BUSINESS_HEAD', approverRoleL1: 'PRODUCT_GM', approverRoleL2: 'VP_PRODUCT' },
      { targetRole: 'TECH_HEAD', approverRoleL1: 'TECH_GM', approverRoleL2: 'VP_TECH' }
    ];
    
    for (const workflow of DEFAULT_WORKFLOWS) {
      await client.query(
        `INSERT INTO workflows (target_role, approver_role_l1, approver_role_l2, approver_role_l3, cc_roles)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (target_role) DO UPDATE SET
           approver_role_l1 = EXCLUDED.approver_role_l1,
           approver_role_l2 = EXCLUDED.approver_role_l2,
           approver_role_l3 = EXCLUDED.approver_role_l3,
           cc_roles = EXCLUDED.cc_roles`,
        [
          workflow.targetRole,
          workflow.approverRoleL1,
          workflow.approverRoleL2 || null,
          workflow.approverRoleL3 || null,
          workflow.ccRoles || []
        ]
      );
    }
    console.log(`✅ 审批流程数据初始化完成 (${DEFAULT_WORKFLOWS.length} 个流程)`);
    
    // 4. 初始化绩效等级配置
    console.log('初始化绩效等级配置数据...');
    const DEFAULT_GRADE_CONFIGS: GradeConfiguration[] = [
      { grade: 'S' as any, minScore: 90, maxScore: 120, quota: 10, description: '优秀' },
      { grade: 'A' as any, minScore: 80, maxScore: 89, quota: 20, description: '良好' },
      { grade: 'B' as any, minScore: 60, maxScore: 79, quota: 50, description: '合格' },
      { grade: 'C' as any, minScore: 0, maxScore: 59, quota: 20, description: '待改进' }
    ];
    
    for (const config of DEFAULT_GRADE_CONFIGS) {
      await client.query(
        `INSERT INTO grade_configs (grade, min_score, max_score, quota, description)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (grade) DO UPDATE SET
           min_score = EXCLUDED.min_score,
           max_score = EXCLUDED.max_score,
           quota = EXCLUDED.quota,
           description = EXCLUDED.description`,
        [
          config.grade,
          config.minScore,
          config.maxScore,
          config.quota,
          config.description || ''
        ]
      );
    }
    console.log(`✅ 绩效等级配置数据初始化完成 (${DEFAULT_GRADE_CONFIGS.length} 个等级)`);
    
    await client.query('COMMIT');
    console.log('✅ 数据初始化完成！');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ 数据初始化失败:', error);
    throw error;
  } finally {
    client.release();
  }
}

// 如果直接运行此文件
if (require.main === module) {
  seed()
    .then(() => {
      console.log('初始化脚本执行完成');
      process.exit(0);
    })
    .catch((error) => {
      console.error('初始化脚本执行失败:', error);
      process.exit(1);
    });
}
