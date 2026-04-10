import { query } from '../config/database';
import { OKR, OKRStatus, OKRLevel, FinalGrade } from '../types';

export interface OKRRow {
  id: string;
  user_id: string;
  level: string;
  title: string;
  period: string;
  status: string;
  parent_okr_id?: string;
  approver_l1_role?: string;
  approver_l2_role?: string;
  approver_l3_role?: string;
  cc_roles?: string[];
  peer_reviewers?: string[];
  display_order: number;
  total_score?: number;
  final_grade?: string;
  adjustment_reason?: string;
  status_reject_reason?: string | null;
  is_performance_archived: boolean;
  objectives: any;
  overall_self_assessment?: any;
  overall_manager_assessment?: any;
  cc_feedback?: any[];
  version: number;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
}

export class OKRModel {
  static async findAll(userId?: string): Promise<OKR[]> {
    let sql = `
      SELECT o.*, u.name as user_name, u.department as user_department
      FROM okrs o
      LEFT JOIN users u ON o.user_id = u.id
    `;
    const params: any[] = [];
    
    if (userId) {
      sql += ' WHERE o.user_id = $1';
      params.push(userId);
    }
    
    // display_order 越小越靠前；并在同一优先级下用 created_at 再排序
    sql += ' ORDER BY o.display_order ASC, o.created_at DESC';
    
    const result = await query(sql, params);
    return result.rows.map(this.mapRowToOKR);
  }

  static async findById(id: string): Promise<OKR | null> {
    const result = await query(
      `SELECT o.*, u.name as user_name, u.department as user_department
       FROM okrs o
       LEFT JOIN users u ON o.user_id = u.id
       WHERE o.id = $1`,
      [id]
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToOKR(result.rows[0]);
  }

  static async create(okr: Partial<OKR> & { userId: string; title: string; level: OKRLevel; objectives: any[] }, userId: string): Promise<OKR> {
    const id = okr.id || `okr-${Date.now()}`;

    // 新建 OKR：排到当前用户队列的最后一位（display_order 最大值 + 1）
    const orderResult = await query(
      'SELECT COALESCE(MAX(display_order), 0) + 1 AS next_order FROM okrs WHERE user_id = $1',
      [okr.userId]
    );
    const nextOrder = Number(orderResult.rows[0]?.next_order ?? 1);
    
    await query(
      `INSERT INTO okrs (
        id, user_id, level, title, period, status, parent_okr_id,
        approver_l1_role, approver_l2_role, approver_l3_role, cc_roles,
        peer_reviewers, total_score, final_grade, adjustment_reason,
        display_order,
        is_performance_archived, objectives, overall_self_assessment,
        overall_manager_assessment, cc_feedback, version, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)`,
      [
        id,
        okr.userId,
        okr.level,
        okr.title,
        okr.period || '',
        okr.status,
        okr.parentOKRId || null,
        okr.approver_l1_role || null,
        okr.approver_l2_role || null,
        okr.approver_l3_role || null,
        okr.cc_roles || [],
        okr.peerReviewers || [],
        okr.totalScore || null,
        okr.finalGrade || null,
        okr.adjustmentReason || null,
        nextOrder,
        okr.isPerformanceArchived || false,
        JSON.stringify(okr.objectives),
        okr.overallSelfAssessment ? JSON.stringify(okr.overallSelfAssessment) : null,
        okr.overallManagerAssessment ? JSON.stringify(okr.overallManagerAssessment) : null,
        okr.ccFeedback ? JSON.stringify(okr.ccFeedback) : null,
        1,
        userId
      ]
    );
    
    return this.findById(id) as Promise<OKR>;
  }

  static async update(id: string, okr: Partial<OKR>, userId: string, currentVersion?: number): Promise<OKR> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (okr.title !== undefined) {
      updates.push(`title = $${paramIndex++}`);
      values.push(okr.title);
    }
    if (okr.period !== undefined) {
      updates.push(`period = $${paramIndex++}`);
      values.push(okr.period);
    }
    if (okr.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(okr.status);
    }
    if (okr.level !== undefined) {
      updates.push(`level = $${paramIndex++}`);
      values.push(okr.level);
    }
    if (okr.parentOKRId !== undefined) {
      updates.push(`parent_okr_id = $${paramIndex++}`);
      values.push(okr.parentOKRId || null);
    }
    if (okr.peerReviewers !== undefined) {
      updates.push(`peer_reviewers = $${paramIndex++}`);
      values.push(okr.peerReviewers);
    }
    if (okr.totalScore !== undefined) {
      updates.push(`total_score = $${paramIndex++}`);
      values.push(okr.totalScore);
    }
    if (okr.finalGrade !== undefined) {
      updates.push(`final_grade = $${paramIndex++}`);
      values.push(okr.finalGrade);
    }
    if (okr.adjustmentReason !== undefined) {
      updates.push(`adjustment_reason = $${paramIndex++}`);
      values.push(okr.adjustmentReason || null);
    }
    if ((okr as any).statusRejectReason !== undefined) {
      updates.push(`status_reject_reason = $${paramIndex++}`);
      values.push((okr as any).statusRejectReason ?? null);
    }
    if (okr.isPerformanceArchived !== undefined) {
      updates.push(`is_performance_archived = $${paramIndex++}`);
      values.push(okr.isPerformanceArchived);
    }
    if ((okr as any).displayOrder !== undefined) {
      updates.push(`display_order = $${paramIndex++}`);
      values.push((okr as any).displayOrder);
    }
    if (okr.objectives !== undefined) {
      updates.push(`objectives = $${paramIndex++}`);
      values.push(JSON.stringify(okr.objectives));
    }
    if (okr.overallSelfAssessment !== undefined) {
      updates.push(`overall_self_assessment = $${paramIndex++}`);
      values.push(okr.overallSelfAssessment ? JSON.stringify(okr.overallSelfAssessment) : null);
    }
    if (okr.overallManagerAssessment !== undefined) {
      updates.push(`overall_manager_assessment = $${paramIndex++}`);
      values.push(okr.overallManagerAssessment ? JSON.stringify(okr.overallManagerAssessment) : null);
    }
    if (okr.ccFeedback !== undefined) {
      updates.push(`cc_feedback = $${paramIndex++}`);
      values.push(okr.ccFeedback ? JSON.stringify(okr.ccFeedback) : null);
    }

    // 版本号递增
    updates.push(`version = version + 1`);
    updates.push(`updated_by = $${paramIndex++}`);
    values.push(userId);

    if (updates.length === 0) {
      return this.findById(id) as Promise<OKR>;
    }

    // 如果有版本号，检查版本冲突
    if (currentVersion !== undefined) {
      values.push(id, currentVersion);
      const result = await query(
        `UPDATE okrs SET ${updates.join(', ')} WHERE id = $${paramIndex} AND version = $${paramIndex + 1}`,
        values
      );
      
      if (result.rowCount === 0) {
        throw new Error('版本冲突，请刷新后重试');
      }
    } else {
      values.push(id);
      await query(
        `UPDATE okrs SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
        values
      );
    }

    return this.findById(id) as Promise<OKR>;
  }

  static async delete(id: string): Promise<void> {
    await query('DELETE FROM okrs WHERE id = $1', [id]);
  }

  static async updateStatus(id: string, status: OKRStatus, userId: string): Promise<OKR> {
    await query(
      'UPDATE okrs SET status = $1, updated_by = $2, version = version + 1 WHERE id = $3',
      [status, userId, id]
    );
    return this.findById(id) as Promise<OKR>;
  }

  private static mapRowToOKR(row: any): OKR {
    return {
      id: row.id,
      userId: row.user_id,
      userName: row.user_name || '',
      level: row.level as OKRLevel,
      department: row.user_department || row.department || '',
      title: row.title,
      period: row.period || '',
      status: row.status as OKRStatus,
      parentOKRId: row.parent_okr_id,
      approver_l1_role: row.approver_l1_role,
      approver_l2_role: row.approver_l2_role,
      approver_l3_role: row.approver_l3_role,
      cc_roles: row.cc_roles || [],
      peerReviewers: row.peer_reviewers || [],
      displayOrder: Number(row.display_order ?? 0),
      totalScore: row.total_score ? parseFloat(row.total_score) : undefined,
      finalGrade: row.final_grade as FinalGrade,
      adjustmentReason: row.adjustment_reason,
      statusRejectReason: row.status_reject_reason ?? undefined,
      isPerformanceArchived: row.is_performance_archived || false,
      objectives: typeof row.objectives === 'string' ? JSON.parse(row.objectives) : row.objectives,
      overallSelfAssessment: row.overall_self_assessment 
        ? (typeof row.overall_self_assessment === 'string' 
          ? JSON.parse(row.overall_self_assessment) 
          : row.overall_self_assessment)
        : undefined,
      overallManagerAssessment: row.overall_manager_assessment
        ? (typeof row.overall_manager_assessment === 'string'
          ? JSON.parse(row.overall_manager_assessment)
          : row.overall_manager_assessment)
        : undefined,
      ccFeedback: row.cc_feedback
        ? (typeof row.cc_feedback === 'string'
          ? JSON.parse(row.cc_feedback)
          : row.cc_feedback)
        : undefined,
      createdAt: row.created_at,
      version: row.version
    } as OKR;
  }
}
