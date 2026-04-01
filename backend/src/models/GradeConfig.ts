import { query, withTransaction } from '../config/database';
import { GradeConfiguration } from '../types';

export class GradeConfigModel {
  static async findAll(): Promise<GradeConfiguration[]> {
    const result = await query('SELECT * FROM grade_configs ORDER BY grade');
    return result.rows.map(this.mapRowToConfig);
  }

  static async saveAll(configs: GradeConfiguration[]): Promise<GradeConfiguration[]> {
    return await withTransaction(async (client) => {
      // 删除所有现有配置
      await client.query('DELETE FROM grade_configs');
      
      // 插入新配置
      for (const config of configs) {
        await client.query(
          `INSERT INTO grade_configs (grade, min_score, max_score, quota, description)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            config.grade,
            config.minScore,
            config.maxScore,
            config.quota,
            config.description || ''
          ]
        );
      }
      
      // 重新查询返回
      const result = await client.query('SELECT * FROM grade_configs ORDER BY grade');
      return result.rows.map(this.mapRowToConfig);
    });
  }

  private static mapRowToConfig(row: any): GradeConfiguration {
    return {
      grade: row.grade,
      minScore: parseFloat(row.min_score),
      maxScore: parseFloat(row.max_score),
      quota: row.quota,
      description: row.description || ''
    };
  }
}
