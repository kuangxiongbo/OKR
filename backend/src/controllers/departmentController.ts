import { Request, Response } from 'express';
import { DepartmentModel } from '../models/Department';
import { AppError, ErrorCode, createSuccessResponse } from '../utils/errors';
import { OperationLogModel } from '../models/OperationLog';

export const getAllDepartments = async (req: Request, res: Response) => {
  try {
    const departments = await DepartmentModel.findAll();
    res.json(createSuccessResponse({ departments }));
  } catch (error) {
    console.error('Get departments error:', error);
    throw new AppError(ErrorCode.INTERNAL_ERROR, '服务器错误', 500);
  }
};

export const createDepartment = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const { name } = req.body;

    if (!name || !name.trim()) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, '部门名称不能为空', 400);
    }

    await DepartmentModel.create(name.trim());

    // 记录日志
    const user = await (await import('../models/User')).UserModel.findById(userId);
    await OperationLogModel.create({
      id: `log-${Date.now()}`,
      userId,
      userName: user?.name || 'Unknown',
      action: 'CREATE_DEPARTMENT',
      module: 'DEPARTMENT',
      details: `创建部门: ${name}`,
      ip: req.ip || '',
      timestamp: new Date().toISOString()
    });

    res.status(201).json(createSuccessResponse());
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    console.error('Create department error:', error);
    throw new AppError(ErrorCode.INTERNAL_ERROR, '服务器错误', 500);
  }
};

export const deleteDepartment = async (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    const userId = req.userId!;

    const userCount = await DepartmentModel.countUsers(name);
    if (userCount > 0) {
      throw new AppError(ErrorCode.BAD_REQUEST, `部门下仍有 ${userCount} 名用户，无法删除`, 400);
    }

    await DepartmentModel.delete(name);

    // 记录日志
    const user = await (await import('../models/User')).UserModel.findById(userId);
    await OperationLogModel.create({
      id: `log-${Date.now()}`,
      userId,
      userName: user?.name || 'Unknown',
      action: 'DELETE_DEPARTMENT',
      module: 'DEPARTMENT',
      details: `删除部门: ${name}`,
      ip: req.ip || '',
      timestamp: new Date().toISOString()
    });

    res.json(createSuccessResponse());
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    console.error('Delete department error:', error);
    throw new AppError(ErrorCode.INTERNAL_ERROR, '服务器错误', 500);
  }
};

export const updateDepartment = async (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    const { newName } = req.body;
    const userId = req.userId!;

    if (!newName || !newName.trim()) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, '新部门名称不能为空', 400);
    }

    const targetName = newName.trim();
    if (targetName === name) {
      return res.json(createSuccessResponse());
    }

    const departments = await DepartmentModel.findAll();
    if (!departments.includes(name)) {
      throw new AppError(ErrorCode.NOT_FOUND, '部门不存在', 404);
    }
    if (departments.includes(targetName)) {
      throw new AppError(ErrorCode.BAD_REQUEST, '部门名称已存在', 400);
    }

    await DepartmentModel.rename(name, targetName);

    const user = await (await import('../models/User')).UserModel.findById(userId);
    await OperationLogModel.create({
      id: `log-${Date.now()}`,
      userId,
      userName: user?.name || 'Unknown',
      action: 'UPDATE_DEPARTMENT',
      module: 'DEPARTMENT',
      details: `重命名部门: ${name} -> ${targetName}`,
      ip: req.ip || '',
      timestamp: new Date().toISOString()
    });

    res.json(createSuccessResponse());
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    console.error('Update department error:', error);
    throw new AppError(ErrorCode.INTERNAL_ERROR, '服务器错误', 500);
  }
};
