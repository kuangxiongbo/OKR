/**
 * 企业微信 OAuth2.0 认证服务
 */
import axios from 'axios';
import crypto from 'crypto';

export interface WeChatConfig {
  corpId: string;
  corpSecret: string;
  agentId: string;
  redirectUri: string;
}

export interface WeChatUserInfo {
  userid: string;
  name: string;
  mobile?: string;
  email?: string;
  avatar?: string;
  department?: number[];
}

export class WeChatAuthService {
  private config: WeChatConfig;
  private accessTokenCache: { token: string; expiresAt: number } | null = null;

  constructor(config: WeChatConfig) {
    this.config = config;
  }

  /**
   * 生成企业微信授权 URL
   */
  getAuthorizeUrl(state?: string): string {
    const baseUrl = 'https://open.weixin.qq.com/connect/oauth2/authorize';
    const params = new URLSearchParams({
      appid: this.config.corpId,
      redirect_uri: encodeURIComponent(this.config.redirectUri),
      response_type: 'code',
      scope: 'snsapi_base',
      agentid: this.config.agentId,
      state: state || this.generateState(),
    });
    return `${baseUrl}?${params.toString()}#wechat_redirect`;
  }

  /**
   * 生成随机 state 参数（用于防止 CSRF 攻击）
   */
  private generateState(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * 获取 Access Token（带缓存）
   */
  async getAccessToken(): Promise<string> {
    // 检查缓存
    if (this.accessTokenCache && this.accessTokenCache.expiresAt > Date.now()) {
      return this.accessTokenCache.token;
    }

    try {
      const url = 'https://qyapi.weixin.qq.com/cgi-bin/gettoken';
      const response = await axios.get(url, {
        params: {
          corpid: this.config.corpId,
          corpsecret: this.config.corpSecret,
        },
      });

      if (response.data.errcode !== 0) {
        throw new Error(`获取 Access Token 失败: ${response.data.errmsg}`);
      }

      const accessToken = response.data.access_token;
      const expiresIn = response.data.expires_in || 7200; // 默认 2 小时

      // 缓存 token（提前 5 分钟过期）
      this.accessTokenCache = {
        token: accessToken,
        expiresAt: Date.now() + (expiresIn - 300) * 1000,
      };

      return accessToken;
    } catch (error: any) {
      console.error('获取企业微信 Access Token 失败:', error);
      throw new Error(`获取 Access Token 失败: ${error.message}`);
    }
  }

  /**
   * 通过 code 获取用户信息
   */
  async getUserInfoByCode(code: string): Promise<WeChatUserInfo> {
    try {
      // 1. 通过 code 获取 userid
      const accessToken = await this.getAccessToken();
      const getUserUrl = 'https://qyapi.weixin.qq.com/cgi-bin/user/getuserinfo';
      const userResponse = await axios.get(getUserUrl, {
        params: {
          access_token: accessToken,
          code: code,
        },
      });

      if (userResponse.data.errcode !== 0) {
        throw new Error(`获取用户信息失败: ${userResponse.data.errmsg}`);
      }

      const userid = userResponse.data.UserId;
      if (!userid) {
        throw new Error('无法获取用户 ID');
      }

      // 2. 通过 userid 获取用户详细信息
      const detailUrl = 'https://qyapi.weixin.qq.com/cgi-bin/user/get';
      const detailResponse = await axios.get(detailUrl, {
        params: {
          access_token: accessToken,
          userid: userid,
        },
      });

      if (detailResponse.data.errcode !== 0) {
        throw new Error(`获取用户详细信息失败: ${detailResponse.data.errmsg}`);
      }

      return {
        userid: detailResponse.data.userid,
        name: detailResponse.data.name,
        mobile: detailResponse.data.mobile,
        email: detailResponse.data.email,
        avatar: detailResponse.data.avatar,
        department: detailResponse.data.department,
      };
    } catch (error: any) {
      console.error('获取企业微信用户信息失败:', error);
      throw new Error(`获取用户信息失败: ${error.message}`);
    }
  }
}
