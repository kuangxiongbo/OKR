import { query } from '../config/database';
import { User, Role } from '../types';
import bcrypt from 'bcryptjs';

export class UserModel {
  static async findAll(): Promise<User[]> {
    const result = await query('SELECT * FROM users ORDER BY created_at DESC');
    return result.rows.map(row => this.mapRowToUser(row));
  }

  static async findById(id: string): Promise<User | null> {
    const result = await query('SELECT * FROM users WHERE id = $1', [id]);
    if (result.rows.length === 0) return null;
    return this.mapRowToUser(result.rows[0]);
  }

  static async findByAccount(account: string): Promise<(User & { password?: string }) | null> {
    const result = await query('SELECT * FROM users WHERE account = $1', [account]);
    if (result.rows.length === 0) return null;
    return this.mapRowToUserWithPassword(result.rows[0]);
  }

  static async findByWeChatUserId(wechatUserId: string): Promise<User | null> {
    const result = await query('SELECT * FROM users WHERE wechat_userid = $1', [wechatUserId]);
    if (result.rows.length === 0) return null;
    return this.mapRowToUser(result.rows[0]);
  }

  static async findBySSOId(provider: string, ssoId: string): Promise<User | null> {
    const result = await query('SELECT * FROM users WHERE sso_provider = $1 AND sso_id = $2', [provider, ssoId]);
    if (result.rows.length === 0) return null;
    return this.mapRowToUser(result.rows[0]);
  }

  static async findByIdWithPassword(id: string): Promise<(User & { password?: string }) | null> {
    const result = await query('SELECT * FROM users WHERE id = $1', [id]);
    if (result.rows.length === 0) return null;
    return this.mapRowToUserWithPassword(result.rows[0]);
  }

  static async create(user: Omit<User, 'id'> & { id?: string; password?: string | null; wechatUserId?: string | null; wechatOpenId?: string | null; ssoProvider?: string | null; ssoId?: string | null; ssoAttributes?: any }): Promise<User> {
    const id = user.id || `u-${Date.now()}`;
    // 处理密码哈希：若为字符串则哈希，否则保存为 NULL
    const hashedPassword = typeof user.password === 'string' ? await bcrypt.hash(user.password, 10) : null;
    
    await query(
      `INSERT INTO users (id, account, password, name, role, department, avatar, source, sso_connected, is_primary_approver, wechat_userid, wechat_openid, sso_provider, sso_id, sso_attributes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [
        id,
        user.account || '',
        hashedPassword,
        user.name,
        user.role,
        user.department || '',
        user.avatar || '',
        user.source || 'LOCAL',
        user.ssoConnected || false,
        user.isPrimaryApprover || false,
        user.wechatUserId || null,
        user.wechatOpenId || null,
        user.ssoProvider || null,
        user.ssoId || null,
        user.ssoAttributes ? JSON.stringify(user.ssoAttributes) : null
      ]
    );
    
    return this.findById(id) as Promise<User>;
  }

  static async update(id: string, user: Partial<User>): Promise<User> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (user.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(user.name);
    }
    if (user.account !== undefined) {
      updates.push(`account = $${paramIndex++}`);
      values.push(user.account);
    }
    if (user.password !== undefined) {
      updates.push(`password = $${paramIndex++}`);
      if (user.password && typeof user.password === 'string') {
        values.push(await bcrypt.hash(user.password, 10));
      } else {
        values.push(null);
      }
    }
    if (user.role !== undefined) {
      updates.push(`role = $${paramIndex++}`);
      values.push(user.role);
    }
    if (user.department !== undefined) {
      updates.push(`department = $${paramIndex++}`);
      values.push(user.department);
    }
    if (user.avatar !== undefined) {
      updates.push(`avatar = $${paramIndex++}`);
      values.push(user.avatar);
    }
    if (user.source !== undefined) {
      updates.push(`source = $${paramIndex++}`);
      values.push(user.source);
    }
    if (user.ssoConnected !== undefined) {
      updates.push(`sso_connected = $${paramIndex++}`);
      values.push(user.ssoConnected);
    }
    if (user.isPrimaryApprover !== undefined) {
      updates.push(`is_primary_approver = $${paramIndex++}`);
      values.push(user.isPrimaryApprover);
    }
    if ((user as any).wechatUserId !== undefined) {
      updates.push(`wechat_userid = $${paramIndex++}`);
      values.push((user as any).wechatUserId);
    }
    if ((user as any).wechatOpenId !== undefined) {
      updates.push(`wechat_openid = $${paramIndex++}`);
      values.push((user as any).wechatOpenId);
    }
    if ((user as any).ssoProvider !== undefined) {
      updates.push(`sso_provider = $${paramIndex++}`);
      values.push((user as any).ssoProvider);
    }
    if ((user as any).ssoId !== undefined) {
      updates.push(`sso_id = $${paramIndex++}`);
      values.push((user as any).ssoId);
    }
    if ((user as any).ssoAttributes !== undefined) {
      updates.push(`sso_attributes = $${paramIndex++}`);
      values.push((user as any).ssoAttributes ? JSON.stringify((user as any).ssoAttributes) : null);
    }

    if (updates.length === 0) {
      return this.findById(id) as Promise<User>;
    }

    values.push(id);
    await query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
      values
    );

    return this.findById(id) as Promise<User>;
  }

  static async delete(id: string): Promise<void> {
    await query('DELETE FROM users WHERE id = $1', [id]);
  }

  static async verifyPassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  private static mapRowToUser(row: any): User {
    return {
      id: row.id,
      account: row.account,
      name: row.name,
      role: row.role as Role,
      department: row.department || '',
      avatar: row.avatar || '',
      source: row.source || 'LOCAL',
      ssoConnected: row.sso_connected || false,
      isPrimaryApprover: row.is_primary_approver || false
    };
  }

  private static mapRowToUserWithPassword(row: any): User & { password?: string } {
    return {
      id: row.id,
      account: row.account,
      name: row.name,
      password: row.password,
      role: row.role as Role,
      department: row.department || '',
      avatar: row.avatar || '',
      source: row.source || 'LOCAL',
      ssoConnected: row.sso_connected || false,
      isPrimaryApprover: row.is_primary_approver || false
    };
  }
}
