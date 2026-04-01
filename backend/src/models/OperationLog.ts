import { query } from '../config/database';
import { OperationLog } from '../types';

export class OperationLogModel {
  static async findAll(limit?: number): Promise<OperationLog[]> {
    let sql = 'SELECT * FROM operation_logs ORDER BY timestamp DESC';
    const params: any[] = [];
    
    if (limit) {
      sql += ' LIMIT $1';
      params.push(limit);
    }
    
    const result = await query(sql, params);
    return result.rows.map(this.mapRowToLog);
  }

  static async create(log: OperationLog): Promise<OperationLog> {
    await query(
      `INSERT INTO operation_logs (id, user_id, user_name, action, module, details, ip, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        log.id,
        log.userId,
        log.userName,
        log.action,
        log.module,
        log.details,
        log.ip || '',
        log.timestamp || new Date().toISOString()
      ]
    );
    return log;
  }

  private static mapRowToLog(row: any): OperationLog {
    return {
      id: row.id,
      userId: row.user_id,
      userName: row.user_name,
      action: row.action,
      module: row.module,
      details: row.details,
      timestamp: row.timestamp,
      ip: row.ip
    };
  }
}
