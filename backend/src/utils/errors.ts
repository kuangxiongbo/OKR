// 错误处理工具类
export enum ErrorCode {
  // 通用错误
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  BAD_REQUEST = 'BAD_REQUEST',
  
  // OKR 相关错误
  OKR_NOT_FOUND = 'OKR_NOT_FOUND',
  INVALID_STATUS_TRANSITION = 'INVALID_STATUS_TRANSITION',
  NO_APPROVAL_PERMISSION = 'NO_APPROVAL_PERMISSION',
  VERSION_CONFLICT = 'VERSION_CONFLICT',
  INVALID_WEIGHT_SUM = 'INVALID_WEIGHT_SUM',
  
  // 用户相关错误
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  DUPLICATE_ACCOUNT = 'DUPLICATE_ACCOUNT',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  
  // 数据库错误
  DATABASE_ERROR = 'DATABASE_ERROR',
  CONSTRAINT_VIOLATION = 'CONSTRAINT_VIOLATION'
}

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    public message: string,
    public statusCode: number = 400,
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
  }
}

// 错误响应格式
export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

export function createErrorResponse(error: AppError): ErrorResponse {
  return {
    success: false,
    error: {
      code: error.code,
      message: error.message,
      details: error.details
    }
  };
}

// 成功响应格式
export interface SuccessResponse<T = any> {
  success: true;
  data?: T;
  [key: string]: any; // 允许其他字段如 users, okrs 等
}

export function createSuccessResponse<T>(data?: T, extra?: Record<string, any>): SuccessResponse<T> {
  return {
    success: true,
    ...(data !== undefined ? { data } : {}),
    ...(extra || {})
  };
}
