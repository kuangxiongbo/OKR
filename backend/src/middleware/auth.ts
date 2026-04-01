import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError, ErrorCode } from '../utils/errors';

const JWT_SECRET = process.env.JWT_SECRET || 'okr-system-secret-key-2024';

// 扩展 Request 类型
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userRole?: string;
    }
  }
}

// JWT 认证中间件
export function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError(ErrorCode.UNAUTHORIZED, '未提供认证令牌', 401);
    }
    
    const token = authHeader.substring(7);
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; role: string };
      req.userId = decoded.userId;
      req.userRole = decoded.role;
      next();
    } catch (error) {
      throw new AppError(ErrorCode.UNAUTHORIZED, '无效的认证令牌', 401);
    }
  } catch (error) {
    next(error);
  }
}

// 可选认证（如果有 token 则验证，没有也不报错）
export function optionalAuthenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; role: string };
      req.userId = decoded.userId;
      req.userRole = decoded.role;
    } catch (error) {
      // 忽略无效 token
    }
  }
  
  next();
}
