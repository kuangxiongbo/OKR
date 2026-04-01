import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { UserModel } from '../models/User';
import { AppError, ErrorCode, createSuccessResponse } from '../utils/errors';
import { OperationLogModel } from '../models/OperationLog';
import { WeChatAuthService } from '../services/wechatAuth';
import { SSOAuthService, SSOProvider } from '../services/ssoAuth';
import { query } from '../config/database';
import { WeComConfig, SSOConfig } from '../types';

const JWT_SECRET: string = process.env.JWT_SECRET || 'okr-system-secret-key-2024';
const JWT_EXPIRES_IN: string = process.env.JWT_EXPIRES_IN || '7d';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

/**
 * 从数据库动态获取企业微信配置并创建服务实例
 */
async function getWeChatService(): Promise<WeChatAuthService | null> {
  try {
    const result = await query('SELECT value FROM configs WHERE key = $1', ['wecom']);
    if (result.rows.length === 0) {
      return null;
    }
    const config: WeComConfig = result.rows[0].value;
    
    // 检查是否启用且配置完整
    if (!config.enabled || !config.corpId || !config.agentId || !config.secret) {
      return null;
    }

    return new WeChatAuthService({
      corpId: config.corpId,
      corpSecret: config.secret,
      agentId: config.agentId,
      redirectUri: `${FRONTEND_URL}/auth/wechat/callback`,
    });
  } catch (error) {
    console.error('获取企业微信配置失败:', error);
    return null;
  }
}

/**
 * 从数据库动态获取 SSO 配置并创建服务实例
 */
async function getSSOService(): Promise<SSOAuthService | null> {
  try {
    const result = await query('SELECT value FROM configs WHERE key = $1', ['sso']);
    if (result.rows.length === 0) {
      return null;
    }
    const config: SSOConfig = result.rows[0].value;
    
    // 检查是否启用且配置完整
    if (!config.enabled || !config.metadataUrl || !config.clientId || !config.clientSecret) {
      return null;
    }

    // 根据配置确定 provider（如果没有指定，默认使用 OAuth2）
    let provider = SSOProvider.OAUTH2;
    if (config.metadataUrl.includes('cas') || config.metadataUrl.includes('CAS')) {
      provider = SSOProvider.CAS;
    } else if (config.metadataUrl.includes('saml') || config.metadataUrl.includes('SAML')) {
      provider = SSOProvider.SAML;
    }

    // 构建回调 URL
    const callbackUrl = process.env.SSO_CALLBACK_URL || `${FRONTEND_URL.replace(':3000', ':3001')}/api/v1/auth/sso/callback`;
    
    return new SSOAuthService({
      provider: provider,
      enabled: config.enabled,
      issuer: config.metadataUrl,
      entryPoint: config.metadataUrl,
      callbackUrl: callbackUrl,
      oauth2ClientId: config.clientId,
      oauth2ClientSecret: config.clientSecret,
      oauth2AuthUrl: config.metadataUrl,
      oauth2TokenUrl: config.metadataUrl.replace('/authorize', '/token').replace('/login', '/token'),
      oauth2UserInfoUrl: config.metadataUrl.replace('/authorize', '/userinfo').replace('/login', '/userinfo'),
      casServerUrl: provider === SSOProvider.CAS ? config.metadataUrl : undefined,
    });
  } catch (error) {
    console.error('获取 SSO 配置失败:', error);
    return null;
  }
}

export const login = async (req: Request, res: Response) => {
  try {
    const { account, password } = req.body;

    if (!account || !password) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, '账号和密码不能为空', 400);
    }

    const user = await UserModel.findByAccount(account);
    if (!user) {
      throw new AppError(ErrorCode.INVALID_CREDENTIALS, '账号或密码错误', 401);
    }

    // 验证密码
    if (!user.password) {
      throw new AppError(ErrorCode.INVALID_CREDENTIALS, '账号或密码错误', 401);
    }
    
    const isValid = await UserModel.verifyPassword(password, user.password);
    if (!isValid) {
      throw new AppError(ErrorCode.INVALID_CREDENTIALS, '账号或密码错误', 401);
    }

    // 创建 JWT token
    const payload: { userId: string; role: string } = { userId: user.id, role: user.role };
    const token: string = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);

    // 记录登录日志
    await OperationLogModel.create({
      id: `log-${Date.now()}`,
      userId: user.id,
      userName: user.name,
      action: 'LOGIN',
      module: 'AUTH',
      details: `用户登录: ${user.name}`,
      ip: req.ip || req.socket.remoteAddress || '',
      timestamp: new Date().toISOString()
    });

    // 移除密码字段
    const { password: _, ...userWithoutPassword } = user;

    res.json(createSuccessResponse({
      token,
      user: userWithoutPassword
    }));
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    console.error('Login error:', error);
    throw new AppError(ErrorCode.INTERNAL_ERROR, '服务器错误', 500);
  }
};

export const getCurrentUser = async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      throw new AppError(ErrorCode.UNAUTHORIZED, '未认证', 401);
    }

    const user = await UserModel.findById(userId);
    if (!user) {
      throw new AppError(ErrorCode.USER_NOT_FOUND, '用户不存在', 404);
    }

    // 移除密码字段
    const { password: _, ...userWithoutPassword } = user;

    res.json(createSuccessResponse({ user: userWithoutPassword }));
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    console.error('Get current user error:', error);
    throw new AppError(ErrorCode.INTERNAL_ERROR, '服务器错误', 500);
  }
};

/**
 * 获取登录配置（检查企业微信和SSO是否已配置）
 */
export const getLoginConfig = async (req: Request, res: Response) => {
  try {
    // 从数据库读取配置
    let wechatConfig: any = null;
    let ssoConfig: any = null;
    
    try {
      const wechatResult = await query('SELECT value FROM configs WHERE key = $1', ['wecom']);
      if (wechatResult.rows.length > 0) {
        wechatConfig = wechatResult.rows[0].value;
      }
    } catch (e) {
      console.warn('读取企业微信配置失败:', e);
    }
    
    try {
      const ssoResult = await query('SELECT value FROM configs WHERE key = $1', ['sso']);
      if (ssoResult.rows.length > 0) {
        ssoConfig = ssoResult.rows[0].value;
      }
    } catch (e) {
      console.warn('读取 SSO 配置失败:', e);
    }

    // 检查企业微信是否已配置且启用
    const wechatEnabled = !!(
      wechatConfig?.enabled &&
      wechatConfig?.corpId &&
      wechatConfig?.agentId &&
      wechatConfig?.secret
    );

    // 检查 SSO 是否已配置且启用
    const ssoEnabled = !!(
      ssoConfig?.enabled &&
      ssoConfig?.metadataUrl &&
      ssoConfig?.clientId &&
      ssoConfig?.clientSecret
    );

    res.json(createSuccessResponse({
      wechat: {
        enabled: wechatEnabled,
      },
      sso: {
        enabled: ssoEnabled,
        provider: ssoConfig?.provider || null,
      },
    }));
  } catch (error) {
    console.error('Get login config error:', error);
    throw new AppError(ErrorCode.INTERNAL_ERROR, '服务器错误', 500);
  }
};

/**
 * 企业微信登录 - 获取授权 URL
 */
export const wechatAuthorize = async (req: Request, res: Response) => {
  try {
    const wechatService = await getWeChatService();
    if (!wechatService) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, '企业微信未配置或未启用', 400);
    }
    
    const state = req.query.state as string;
    const authorizeUrl = wechatService.getAuthorizeUrl(state);
    res.json(createSuccessResponse({ url: authorizeUrl }));
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error;
    }
    console.error('企业微信授权失败:', error);
    throw new AppError(ErrorCode.INTERNAL_ERROR, `获取授权 URL 失败: ${error.message}`, 500);
  }
};

/**
 * 企业微信登录 - 回调处理
 */
export const wechatCallback = async (req: Request, res: Response) => {
  try {
    const wechatService = await getWeChatService();
    if (!wechatService) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, '企业微信未配置或未启用', 400);
    }

    const { code, state } = req.query;

    if (!code) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, '缺少授权码', 400);
    }

    // 获取用户信息
    const wechatUser = await wechatService.getUserInfoByCode(code as string);

    // 查找或创建用户
    let user = await UserModel.findByWeChatUserId(wechatUser.userid);

    if (!user) {
      // 创建新用户（需要分配默认角色）
      const newUser = {
        id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        account: `wechat_${wechatUser.userid}`,
        password: null as string | null, // 第三方登录不需要密码
        name: wechatUser.name,
        role: 'EMPLOYEE', // 默认角色，管理员可以在后台修改
        department: '',
        avatar: wechatUser.avatar || '',
        source: 'WECHAT' as const,
        ssoConnected: false,
        wechatUserId: wechatUser.userid,
        wechatOpenId: null,
        ssoProvider: null,
        ssoId: null,
        ssoAttributes: undefined,
      };

      user = await UserModel.create(newUser);
    } else {
      // 更新用户信息
      if (wechatUser.name !== user.name || wechatUser.avatar !== user.avatar) {
        await UserModel.update(user.id, {
          name: wechatUser.name,
          avatar: wechatUser.avatar || user.avatar,
        });
        user = await UserModel.findById(user.id);
      }
    }

    if (!user) {
      throw new AppError(ErrorCode.INTERNAL_ERROR, '用户创建失败', 500);
    }

    // 创建 JWT token
    const payload: { userId: string; role: string } = { userId: user.id, role: user.role };
    const token: string = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);

    // 记录登录日志
    await OperationLogModel.create({
      id: `log-${Date.now()}`,
      userId: user.id,
      userName: user.name,
      action: 'LOGIN',
      module: 'AUTH',
      details: `企业微信登录: ${user.name}`,
      ip: req.ip || req.socket.remoteAddress || '',
      timestamp: new Date().toISOString()
    });

    // 移除密码字段
    const { password: _, ...userWithoutPassword } = user;

    // 重定向到前端，携带 token
    const redirectUrl = `${FRONTEND_URL}/auth/wechat/callback?token=${token}&user=${encodeURIComponent(JSON.stringify(userWithoutPassword))}`;
    res.redirect(redirectUrl);
  } catch (error) {
    if (error instanceof AppError) {
      const errorUrl = `${FRONTEND_URL}/auth/wechat/callback?error=${encodeURIComponent(error.message)}`;
      return res.redirect(errorUrl);
    }
    console.error('企业微信回调处理失败:', error);
    const errorUrl = `${FRONTEND_URL}/auth/wechat/callback?error=${encodeURIComponent('登录失败')}`;
    res.redirect(errorUrl);
  }
};

/**
 * SSO 登录 - 获取授权 URL
 */
export const ssoAuthorize = async (req: Request, res: Response) => {
  try {
    const ssoService = await getSSOService();
    if (!ssoService) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'SSO 未配置或未启用', 400);
    }

    const state = req.query.state as string;
    const authorizeUrl = ssoService.getAuthorizeUrl(state);
    
    // 如果是 SAML，返回登录表单 URL
    const config = (ssoService as any).config;
    if (config.provider === SSOProvider.SAML) {
      res.json(createSuccessResponse({ url: authorizeUrl, method: 'POST' }));
    } else {
      // OAuth2 或 CAS，直接重定向
      res.redirect(authorizeUrl);
    }
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error;
    }
    console.error('SSO 授权失败:', error);
    throw new AppError(ErrorCode.INTERNAL_ERROR, `获取授权 URL 失败: ${error.message}`, 500);
  }
};

/**
 * SSO 登录 - 回调处理
 */
export const ssoCallback = async (req: Request, res: Response) => {
  try {
    const ssoService = await getSSOService();
    if (!ssoService) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'SSO 未配置或未启用', 400);
    }

    let ssoUser;
    const config = (ssoService as any).config;

    switch (config.provider) {
      case SSOProvider.OAUTH2:
        const code = req.query.code as string;
        if (!code) {
          throw new AppError(ErrorCode.VALIDATION_ERROR, '缺少授权码', 400);
        }
        ssoUser = await ssoService.getOAuth2UserInfo(code);
        break;

      case SSOProvider.CAS:
        const ticket = req.query.ticket as string;
        if (!ticket) {
          throw new AppError(ErrorCode.VALIDATION_ERROR, '缺少 ticket', 400);
        }
        ssoUser = await ssoService.validateCASTicket(ticket);
        break;

      case SSOProvider.SAML:
        // SAML 需要专门的库支持，这里只是示例
        throw new AppError(ErrorCode.INTERNAL_ERROR, 'SAML 需要专门的库支持', 501);
        break;

      default:
        throw new AppError(ErrorCode.VALIDATION_ERROR, '不支持的 SSO 提供商', 400);
    }

    // 查找或创建用户
    let user = await UserModel.findBySSOId(config.provider, ssoUser.id);

    if (!user) {
      // 创建新用户
      const newUser = {
        id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        account: `sso_${config.provider.toLowerCase()}_${ssoUser.id}`,
        password: null as string | null,
        name: ssoUser.name,
        role: 'EMPLOYEE',
        department: '',
        avatar: '',
        source: 'SSO' as const,
        ssoConnected: true,
        wechatUserId: null,
        wechatOpenId: null,
        ssoProvider: config.provider,
        ssoId: ssoUser.id,
        ssoAttributes: ssoUser.attributes || {},
      };

      user = await UserModel.create(newUser);
    } else {
      // 更新用户信息
      const currentSsoAttrs = (user as any).ssoAttributes || {};
      if (ssoUser.name !== user.name || JSON.stringify(ssoUser.attributes) !== JSON.stringify(currentSsoAttrs)) {
        await UserModel.update(user.id, {
          name: ssoUser.name,
          ssoAttributes: ssoUser.attributes || {},
        } as any);
        user = await UserModel.findById(user.id);
      }
    }

    if (!user) {
      throw new AppError(ErrorCode.INTERNAL_ERROR, '用户创建失败', 500);
    }

    // 创建 JWT token
    const payload: { userId: string; role: string } = { userId: user.id, role: user.role };
    const token: string = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);

    // 记录登录日志
    await OperationLogModel.create({
      id: `log-${Date.now()}`,
      userId: user.id,
      userName: user.name,
      action: 'LOGIN',
      module: 'AUTH',
      details: `SSO 登录: ${user.name} (${config.provider})`,
      ip: req.ip || req.socket.remoteAddress || '',
      timestamp: new Date().toISOString()
    });

    // 移除密码字段
    const { password: _, ...userWithoutPassword } = user;

    // 重定向到前端
    const redirectUrl = `${FRONTEND_URL}/auth/sso/callback?token=${token}&user=${encodeURIComponent(JSON.stringify(userWithoutPassword))}`;
    res.redirect(redirectUrl);
  } catch (error) {
    if (error instanceof AppError) {
      const errorUrl = `${FRONTEND_URL}/auth/sso/callback?error=${encodeURIComponent(error.message)}`;
      return res.redirect(errorUrl);
    }
    console.error('SSO 回调处理失败:', error);
    const errorUrl = `${FRONTEND_URL}/auth/sso/callback?error=${encodeURIComponent('登录失败')}`;
    res.redirect(errorUrl);
  }
};
