import { Request, Response } from 'express';
import { UserModel } from '../models/User';
import { AppError, ErrorCode, createSuccessResponse } from '../utils/errors';
import { OperationLogModel } from '../models/OperationLog';

export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const users = await UserModel.findAll();
    // 移除密码字段
    const usersWithoutPassword = users.map(({ password, ...user }) => user);
    res.json(createSuccessResponse({ users: usersWithoutPassword }));
  } catch (error) {
    console.error('Get users error:', error);
    throw new AppError(ErrorCode.INTERNAL_ERROR, '服务器错误', 500);
  }
};

export const getUserById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = await UserModel.findById(id);
    if (!user) {
      throw new AppError(ErrorCode.USER_NOT_FOUND, '用户不存在', 404);
    }
    const { password, ...userWithoutPassword } = user;
    res.json(createSuccessResponse({ user: userWithoutPassword }));
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    console.error('Get user error:', error);
    throw new AppError(ErrorCode.INTERNAL_ERROR, '服务器错误', 500);
  }
};

export const createUser = async (req: Request, res: Response) => {
  try {
    const userData = req.body;
    // 如果未提供密码，给一个默认密码，确保所有新建用户都能通过账户/密码登录
    if (userData && (userData.password === undefined || userData.password === null)) {
      userData.password = 'Password123!';
    }
    const userId = req.userId || 'system';

    // 校验必填字段，避免创建时缺少关键字段导致数据不保存
    if (!userData || !userData.account || !userData.name) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, '缺少必要字段: account 与 name', 400);
    }

    // 检查账号是否已存在
    if (userData.account) {
      const existing = await UserModel.findByAccount(userData.account);
      if (existing) {
        throw new AppError(ErrorCode.DUPLICATE_ACCOUNT, '账号已存在', 400);
      }
    }

    const user = await UserModel.create(userData);

    // 记录日志
    await OperationLogModel.create({
      id: `log-${Date.now()}`,
      userId,
      userName: req.body.userName || 'System',
      action: 'CREATE_USER',
      module: 'USER_MGMT',
      details: `创建用户: ${user.name}`,
      ip: req.ip || '',
      timestamp: new Date().toISOString()
    });

    const { password, ...userWithoutPassword } = user;
    res.status(201).json(createSuccessResponse({ user: userWithoutPassword }));
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    console.error('Create user error:', error);
    throw new AppError(ErrorCode.INTERNAL_ERROR, '服务器错误', 500);
  }
};

export const updateUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userData = req.body;
    const userId = req.userId || 'system';

    // 检查用户是否存在
    const existing = await UserModel.findById(id);
    if (!existing) {
      throw new AppError(ErrorCode.USER_NOT_FOUND, '用户不存在', 404);
    }

    // 如果更新账号，检查是否重复
    if (userData.account && userData.account !== existing.account) {
      const duplicate = await UserModel.findByAccount(userData.account);
      if (duplicate && duplicate.id !== id) {
        throw new AppError(ErrorCode.DUPLICATE_ACCOUNT, '账号已存在', 400);
      }
    }

    const user = await UserModel.update(id, userData);

    // 记录日志
    await OperationLogModel.create({
      id: `log-${Date.now()}`,
      userId,
      userName: req.body.userName || 'System',
      action: 'UPDATE_USER',
      module: 'USER_MGMT',
      details: `更新用户: ${user.name}`,
      ip: req.ip || '',
      timestamp: new Date().toISOString()
    });

    const { password, ...userWithoutPassword } = user;
    res.json(createSuccessResponse({ user: userWithoutPassword }));
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    console.error('Update user error:', error);
    throw new AppError(ErrorCode.INTERNAL_ERROR, '服务器错误', 500);
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.userId || 'system';

    const user = await UserModel.findById(id);
    if (!user) {
      throw new AppError(ErrorCode.USER_NOT_FOUND, '用户不存在', 404);
    }

    await UserModel.delete(id);

    // 记录日志
    await OperationLogModel.create({
      id: `log-${Date.now()}`,
      userId,
      userName: req.body.userName || 'System',
      action: 'DELETE_USER',
      module: 'USER_MGMT',
      details: `删除用户: ${user.name}`,
      ip: req.ip || '',
      timestamp: new Date().toISOString()
    });

    res.json(createSuccessResponse());
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    console.error('Delete user error:', error);
    throw new AppError(ErrorCode.INTERNAL_ERROR, '服务器错误', 500);
  }
};
