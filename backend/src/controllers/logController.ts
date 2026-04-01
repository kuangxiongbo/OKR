import { Request, Response } from 'express';
import { OperationLogModel } from '../models/OperationLog';
import { AppError, ErrorCode, createSuccessResponse } from '../utils/errors';

export const getAllLogs = async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
    const logs = await OperationLogModel.findAll(limit);
    res.json(createSuccessResponse({ logs }));
  } catch (error) {
    console.error('Get logs error:', error);
    throw new AppError(ErrorCode.INTERNAL_ERROR, '服务器错误', 500);
  }
};
