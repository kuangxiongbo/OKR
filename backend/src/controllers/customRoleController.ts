import { Request, Response } from 'express';
import { CustomRoleModel } from '../models/CustomRole';
import { AppError, ErrorCode, createSuccessResponse } from '../utils/errors';
import { OperationLogModel } from '../models/OperationLog';

export const getAllCustomRoles = async (req: Request, res: Response) => {
  try {
    const roles = await CustomRoleModel.findAll();
    res.json(createSuccessResponse({ roles }));
  } catch (error) {
    console.error('Get custom roles error:', error);
    throw new AppError(ErrorCode.INTERNAL_ERROR, '服务器错误', 500);
  }
};

export const createCustomRole = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const roleData = req.body;

    if (!roleData.value || !roleData.label) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, '角色值和标签不能为空', 400);
    }

    const role = await CustomRoleModel.create(roleData);

    // 记录日志
    const user = await (await import('../models/User')).UserModel.findById(userId);
    await OperationLogModel.create({
      id: `log-${Date.now()}`,
      userId,
      userName: user?.name || 'Unknown',
      action: 'CREATE_CUSTOM_ROLE',
      module: 'CUSTOM_ROLE',
      details: `创建自定义角色: ${roleData.label}`,
      ip: req.ip || '',
      timestamp: new Date().toISOString()
    });

    res.status(201).json(createSuccessResponse({ role }));
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    console.error('Create custom role error:', error);
    throw new AppError(ErrorCode.INTERNAL_ERROR, '服务器错误', 500);
  }
};

export const updateCustomRole = async (req: Request, res: Response) => {
  try {
    const { value } = req.params;
    const { label } = req.body;
    const userId = req.userId!;

    if (!label || !label.trim()) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, '角色标签不能为空', 400);
    }

    const role = await CustomRoleModel.update(value, label.trim());

    // 记录日志
    const user = await (await import('../models/User')).UserModel.findById(userId);
    await OperationLogModel.create({
      id: `log-${Date.now()}`,
      userId,
      userName: user?.name || 'Unknown',
      action: 'UPDATE_CUSTOM_ROLE',
      module: 'CUSTOM_ROLE',
      details: `更新自定义角色: ${value} -> ${label}`,
      ip: req.ip || '',
      timestamp: new Date().toISOString()
    });

    res.json(createSuccessResponse({ role }));
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    console.error('Update custom role error:', error);
    throw new AppError(ErrorCode.INTERNAL_ERROR, '服务器错误', 500);
  }
};

export const deleteCustomRole = async (req: Request, res: Response) => {
  try {
    const { value } = req.params;
    const userId = req.userId!;

    await CustomRoleModel.delete(value);

    // 记录日志
    const user = await (await import('../models/User')).UserModel.findById(userId);
    await OperationLogModel.create({
      id: `log-${Date.now()}`,
      userId,
      userName: user?.name || 'Unknown',
      action: 'DELETE_CUSTOM_ROLE',
      module: 'CUSTOM_ROLE',
      details: `删除自定义角色: ${value}`,
      ip: req.ip || '',
      timestamp: new Date().toISOString()
    });

    res.json(createSuccessResponse());
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    console.error('Delete custom role error:', error);
    throw new AppError(ErrorCode.INTERNAL_ERROR, '服务器错误', 500);
  }
};
