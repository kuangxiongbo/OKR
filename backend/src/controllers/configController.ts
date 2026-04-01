import { Request, Response } from 'express';
import { query } from '../config/database';
import { AppError, ErrorCode, createSuccessResponse } from '../utils/errors';
import { OperationLogModel } from '../models/OperationLog';
import { WeComConfig, SSOConfig, AIConfig } from '../types';

export const getWeComConfig = async (req: Request, res: Response) => {
  try {
    const result = await query('SELECT value FROM configs WHERE key = $1', ['wecom']);
    if (result.rows.length === 0) {
      return res.json(createSuccessResponse({ config: null }));
    }
    const config = result.rows[0].value as WeComConfig;
    res.json(createSuccessResponse({ config }));
  } catch (error) {
    console.error('Get WeCom config error:', error);
    throw new AppError(ErrorCode.INTERNAL_ERROR, '服务器错误', 500);
  }
};

export const saveWeComConfig = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const config: WeComConfig = req.body;

    await query(
      `INSERT INTO configs (key, value, updated_by)
       VALUES ('wecom', $1, $2)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by`,
      [JSON.stringify(config), userId]
    );

    // 记录日志
    const user = await (await import('../models/User')).UserModel.findById(userId);
    await OperationLogModel.create({
      id: `log-${Date.now()}`,
      userId,
      userName: user?.name || 'Unknown',
      action: 'UPDATE_WECOM_CONFIG',
      module: 'CONFIG',
      details: '更新企业微信配置',
      ip: req.ip || '',
      timestamp: new Date().toISOString()
    });

    res.json(createSuccessResponse({ config }));
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    console.error('Save WeCom config error:', error);
    throw new AppError(ErrorCode.INTERNAL_ERROR, '服务器错误', 500);
  }
};

export const getSSOConfig = async (req: Request, res: Response) => {
  try {
    const result = await query('SELECT value FROM configs WHERE key = $1', ['sso']);
    if (result.rows.length === 0) {
      return res.json(createSuccessResponse({ config: null }));
    }
    const config = result.rows[0].value as SSOConfig;
    res.json(createSuccessResponse({ config }));
  } catch (error) {
    console.error('Get SSO config error:', error);
    throw new AppError(ErrorCode.INTERNAL_ERROR, '服务器错误', 500);
  }
};

export const saveSSOConfig = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const config: SSOConfig = req.body;

    await query(
      `INSERT INTO configs (key, value, updated_by)
       VALUES ('sso', $1, $2)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by`,
      [JSON.stringify(config), userId]
    );

    // 记录日志
    const user = await (await import('../models/User')).UserModel.findById(userId);
    await OperationLogModel.create({
      id: `log-${Date.now()}`,
      userId,
      userName: user?.name || 'Unknown',
      action: 'UPDATE_SSO_CONFIG',
      module: 'CONFIG',
      details: '更新 SSO 配置',
      ip: req.ip || '',
      timestamp: new Date().toISOString()
    });

    res.json(createSuccessResponse({ config }));
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    console.error('Save SSO config error:', error);
    throw new AppError(ErrorCode.INTERNAL_ERROR, '服务器错误', 500);
  }
};

export const getAIConfig = async (req: Request, res: Response) => {
  try {
    const result = await query('SELECT value FROM configs WHERE key = $1', ['ai']);
    if (result.rows.length === 0) {
      return res.json(createSuccessResponse({ config: null }));
    }
    const config = result.rows[0].value as AIConfig;
    res.json(createSuccessResponse({ config }));
  } catch (error) {
    console.error('Get AI config error:', error);
    throw new AppError(ErrorCode.INTERNAL_ERROR, '服务器错误', 500);
  }
};

export const saveAIConfig = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const config: AIConfig = req.body;

    await query(
      `INSERT INTO configs (key, value, updated_by)
       VALUES ('ai', $1, $2)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by`,
      [JSON.stringify(config), userId]
    );

    const user = await (await import('../models/User')).UserModel.findById(userId);
    await OperationLogModel.create({
      id: `log-${Date.now()}`,
      userId,
      userName: user?.name || 'Unknown',
      action: 'UPDATE_AI_CONFIG',
      module: 'CONFIG',
      details: `更新 AI 配置: ${config.provider}`,
      ip: req.ip || '',
      timestamp: new Date().toISOString()
    });

    res.json(createSuccessResponse({ config }));
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    console.error('Save AI config error:', error);
    throw new AppError(ErrorCode.INTERNAL_ERROR, '服务器错误', 500);
  }
};
