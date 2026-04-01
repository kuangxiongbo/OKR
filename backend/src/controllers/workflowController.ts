import { Request, Response } from 'express';
import { WorkflowModel } from '../models/Workflow';
import { AppError, ErrorCode, createSuccessResponse } from '../utils/errors';
import { OperationLogModel } from '../models/OperationLog';
import { ApprovalWorkflow } from '../types';

export const getAllWorkflows = async (req: Request, res: Response) => {
  try {
    const workflows = await WorkflowModel.findAll();
    res.json(createSuccessResponse({ workflows }));
  } catch (error) {
    console.error('Get workflows error:', error);
    throw new AppError(ErrorCode.INTERNAL_ERROR, '服务器错误', 500);
  }
};

export const createWorkflow = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const workflowData: ApprovalWorkflow = req.body;

    const workflow = await WorkflowModel.create(workflowData);

    // 记录日志
    const user = await (await import('../models/User')).UserModel.findById(userId);
    await OperationLogModel.create({
      id: `log-${Date.now()}`,
      userId,
      userName: user?.name || 'Unknown',
      action: 'CREATE_WORKFLOW',
      module: 'WORKFLOW',
      details: `创建审批流程: ${workflowData.targetRole}`,
      ip: req.ip || '',
      timestamp: new Date().toISOString()
    });

    res.status(201).json(createSuccessResponse({ workflow }));
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    console.error('Create workflow error:', error);
    throw new AppError(ErrorCode.INTERNAL_ERROR, '服务器错误', 500);
  }
};

export const deleteWorkflow = async (req: Request, res: Response) => {
  try {
    const { targetRole } = req.params;
    const userId = req.userId!;

    await WorkflowModel.delete(targetRole);

    // 记录日志
    const user = await (await import('../models/User')).UserModel.findById(userId);
    await OperationLogModel.create({
      id: `log-${Date.now()}`,
      userId,
      userName: user?.name || 'Unknown',
      action: 'DELETE_WORKFLOW',
      module: 'WORKFLOW',
      details: `删除审批流程: ${targetRole}`,
      ip: req.ip || '',
      timestamp: new Date().toISOString()
    });

    res.json(createSuccessResponse());
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    console.error('Delete workflow error:', error);
    throw new AppError(ErrorCode.INTERNAL_ERROR, '服务器错误', 500);
  }
};
