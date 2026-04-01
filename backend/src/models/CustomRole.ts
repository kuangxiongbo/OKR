import { query } from '../config/database';

export interface CustomRole {
  value: string;
  label: string;
}

export class CustomRoleModel {
  static async findAll(): Promise<CustomRole[]> {
    const result = await query('SELECT * FROM custom_roles ORDER BY value');
    return result.rows.map(this.mapRowToRole);
  }

  static async findByValue(value: string): Promise<CustomRole | null> {
    const result = await query('SELECT * FROM custom_roles WHERE value = $1', [value]);
    if (result.rows.length === 0) return null;
    return this.mapRowToRole(result.rows[0]);
  }

  static async create(role: CustomRole): Promise<CustomRole> {
    await query(
      `INSERT INTO custom_roles (value, label)
       VALUES ($1, $2)
       ON CONFLICT (value) DO UPDATE SET label = EXCLUDED.label`,
      [role.value, role.label]
    );
    return this.findByValue(role.value) as Promise<CustomRole>;
  }

  static async update(value: string, label: string): Promise<CustomRole> {
    await query(
      'UPDATE custom_roles SET label = $1 WHERE value = $2',
      [label, value]
    );
    return this.findByValue(value) as Promise<CustomRole>;
  }

  static async delete(value: string): Promise<void> {
    await query('DELETE FROM custom_roles WHERE value = $1', [value]);
  }

  private static mapRowToRole(row: any): CustomRole {
    return {
      value: row.value,
      label: row.label
    };
  }
}
