import { Request, Response } from 'express';
import { GradeConfigModel } from '../models/GradeConfig';
import { AppError, ErrorCode, createSuccessResponse } from '../utils/errors';
import { OperationLogModel } from '../models/OperationLog';
import { GradeConfiguration } from '../types';

export const getAllGradeConfigs = async (req: Request, res: Response) => {
  try {
    const configs = await GradeConfigModel.findAll();
    res.json(createSuccessResponse({ configs }));
  } catch (error) {
    console.error('Get grade configs error:', error);
    throw new AppError(ErrorCode.INTERNAL_ERROR, '服务器错误', 500);
  }
};

export const saveAllGradeConfigs = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const configs: GradeConfiguration[] = req.body;

    // 验证配置
    if (!Array.isArray(configs)) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, '配置必须是数组', 400);
    }

    // 验证配额总和
    const totalQuota = configs.reduce((sum, config) => sum + config.quota, 0);
    if (totalQuota !== 100) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, `配额总和必须等于 100，当前为 ${totalQuota}`, 400);
    }

    const savedConfigs = await GradeConfigModel.saveAll(configs);

    // 记录日志
    const user = await (await import('../models/User')).UserModel.findById(userId);
    await OperationLogModel.create({
      id: `log-${Date.now()}`,
      userId,
      userName: user?.name || 'Unknown',
      action: 'UPDATE_GRADE_CONFIGS',
      module: 'GRADE_CONFIG',
      details: `更新绩效等级配置`,
      ip: req.ip || '',
      timestamp: new Date().toISOString()
    });

    res.json(createSuccessResponse({ configs: savedConfigs }));
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    console.error('Save grade configs error:', error);
    throw new AppError(ErrorCode.INTERNAL_ERROR, '服务器错误', 500);
  }
};
