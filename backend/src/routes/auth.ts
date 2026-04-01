import { Router } from 'express';
import { login, getCurrentUser, wechatAuthorize, wechatCallback, ssoAuthorize, ssoCallback, getLoginConfig } from '../controllers/authController';
import { authenticate } from '../middleware/auth';

const router = Router();

// 获取登录配置（无需认证）
router.get('/config', getLoginConfig);

// 传统账号密码登录
router.post('/login', login);
router.get('/me', authenticate, getCurrentUser);

// 企业微信登录
router.get('/wechat/authorize', wechatAuthorize);
router.get('/wechat/callback', wechatCallback);

// SSO 单点登录
router.get('/sso/authorize', ssoAuthorize);
router.get('/sso/callback', ssoCallback);
router.post('/sso/callback', ssoCallback); // SAML 使用 POST

export default router;
