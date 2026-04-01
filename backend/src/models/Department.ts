import { query } from '../config/database';

export class DepartmentModel {
  static async findAll(): Promise<string[]> {
    const result = await query('SELECT name FROM departments ORDER BY name');
    return result.rows.map(row => row.name);
  }

  static async create(name: string): Promise<string> {
    await query(
      'INSERT INTO departments (name) VALUES ($1) ON CONFLICT (name) DO NOTHING',
      [name]
    );
    return name;
  }

  static async countUsers(name: string): Promise<number> {
    const result = await query('SELECT COUNT(*)::int AS count FROM users WHERE department = $1', [name]);
    return result.rows[0]?.count || 0;
  }

  static async rename(oldName: string, newName: string): Promise<void> {
    await query('UPDATE departments SET name = $1 WHERE name = $2', [newName, oldName]);
    await query('UPDATE users SET department = $1 WHERE department = $2', [newName, oldName]);
  }

  static async delete(name: string): Promise<void> {
    await query('DELETE FROM departments WHERE name = $1', [name]);
  }
}
