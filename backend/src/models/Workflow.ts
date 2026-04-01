import { query } from '../config/database';
import { ApprovalWorkflow } from '../types';

export class WorkflowModel {
  static async findAll(): Promise<ApprovalWorkflow[]> {
    const result = await query('SELECT * FROM workflows ORDER BY target_role');
    return result.rows.map(this.mapRowToWorkflow);
  }

  static async findByTargetRole(targetRole: string): Promise<ApprovalWorkflow | null> {
    const result = await query('SELECT * FROM workflows WHERE target_role = $1', [targetRole]);
    if (result.rows.length === 0) return null;
    return this.mapRowToWorkflow(result.rows[0]);
  }

  static async create(workflow: ApprovalWorkflow): Promise<ApprovalWorkflow> {
    await query(
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
    return this.findByTargetRole(workflow.targetRole) as Promise<ApprovalWorkflow>;
  }

  static async delete(targetRole: string): Promise<void> {
    await query('DELETE FROM workflows WHERE target_role = $1', [targetRole]);
  }

  private static mapRowToWorkflow(row: any): ApprovalWorkflow {
    return {
      targetRole: row.target_role,
      approverRoleL1: row.approver_role_l1,
      approverRoleL2: row.approver_role_l2,
      approverRoleL3: row.approver_role_l3,
      ccRoles: row.cc_roles || []
    };
  }
}
