import { Request, Response, NextFunction } from 'express';
import { AppError, createErrorResponse, ErrorCode } from '../utils/errors';

// 错误处理中间件
export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) {
  console.error('Error:', err);
  
  if (err instanceof AppError) {
    return res.status(err.statusCode).json(createErrorResponse(err));
  }
  
  // 处理数据库错误
  if (err.name === 'PostgresError') {
    const pgError = err as any;
    if (pgError.code === '23505') { // 唯一约束违反
      return res.status(400).json(createErrorResponse(
        new AppError(ErrorCode.CONSTRAINT_VIOLATION, '数据已存在', 400)
      ));
    }
    if (pgError.code === '23503') { // 外键约束违反
      return res.status(400).json(createErrorResponse(
        new AppError(ErrorCode.CONSTRAINT_VIOLATION, '关联数据不存在', 400)
      ));
    }
  }
  
  // 默认错误
  return res.status(500).json(createErrorResponse(
    new AppError(ErrorCode.INTERNAL_ERROR, '服务器内部错误', 500)
  ));
}

// 404 处理
export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json(createErrorResponse(
    new AppError(ErrorCode.NOT_FOUND, `路由 ${req.path} 不存在`, 404)
  ));
}
