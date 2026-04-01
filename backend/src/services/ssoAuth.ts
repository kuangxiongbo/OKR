/**
 * SSO 单点登录服务
 * 支持 SAML 2.0、OAuth2.0、CAS 协议
 */
import axios from 'axios';
import crypto from 'crypto';

export enum SSOProvider {
  SAML = 'SAML',
  OAUTH2 = 'OAUTH2',
  CAS = 'CAS',
}

export interface SSOConfig {
  provider: SSOProvider;
  enabled: boolean;
  issuer?: string; // SAML Issuer
  entryPoint?: string; // SAML SSO Entry Point
  certPath?: string; // SAML Certificate Path
  callbackUrl: string;
  // OAuth2 配置
  oauth2ClientId?: string;
  oauth2ClientSecret?: string;
  oauth2AuthUrl?: string;
  oauth2TokenUrl?: string;
  oauth2UserInfoUrl?: string;
  // CAS 配置
  casServerUrl?: string;
}

export interface SSOUserInfo {
  id: string;
  name: string;
  email?: string;
  attributes?: Record<string, any>;
}

export class SSOAuthService {
  private config: SSOConfig;

  constructor(config: SSOConfig) {
    this.config = config;
  }

  /**
   * 生成 SSO 授权 URL
   */
  getAuthorizeUrl(state?: string): string {
    if (!this.config.enabled) {
      throw new Error('SSO 未启用');
    }

    switch (this.config.provider) {
      case SSOProvider.OAUTH2:
        return this.getOAuth2AuthorizeUrl(state);
      case SSOProvider.CAS:
        return this.getCASAuthorizeUrl();
      case SSOProvider.SAML:
        // SAML 通常通过 POST 请求，返回登录表单 URL
        return this.config.entryPoint || '';
      default:
        throw new Error(`不支持的 SSO 提供商: ${this.config.provider}`);
    }
  }

  /**
   * OAuth2.0 授权 URL
   */
  private getOAuth2AuthorizeUrl(state?: string): string {
    if (!this.config.oauth2AuthUrl || !this.config.oauth2ClientId) {
      throw new Error('OAuth2 配置不完整');
    }

    const params = new URLSearchParams({
      client_id: this.config.oauth2ClientId,
      redirect_uri: encodeURIComponent(this.config.callbackUrl),
      response_type: 'code',
      scope: 'openid profile email',
      state: state || this.generateState(),
    });

    return `${this.config.oauth2AuthUrl}?${params.toString()}`;
  }

  /**
   * CAS 授权 URL
   */
  private getCASAuthorizeUrl(): string {
    if (!this.config.casServerUrl) {
      throw new Error('CAS 配置不完整');
    }

    const service = encodeURIComponent(this.config.callbackUrl);
    return `${this.config.casServerUrl}/login?service=${service}`;
  }

  /**
   * 生成随机 state 参数
   */
  private generateState(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * OAuth2.0: 通过 code 获取用户信息
   */
  async getOAuth2UserInfo(code: string): Promise<SSOUserInfo> {
    if (!this.config.oauth2TokenUrl || !this.config.oauth2UserInfoUrl) {
      throw new Error('OAuth2 配置不完整');
    }

    try {
      // 1. 通过 code 获取 access_token
      const tokenResponse = await axios.post(
        this.config.oauth2TokenUrl,
        new URLSearchParams({
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: this.config.callbackUrl,
          client_id: this.config.oauth2ClientId!,
          client_secret: this.config.oauth2ClientSecret!,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      const accessToken = tokenResponse.data.access_token;
      if (!accessToken) {
        throw new Error('无法获取 access_token');
      }

      // 2. 通过 access_token 获取用户信息
      const userResponse = await axios.get(this.config.oauth2UserInfoUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      return {
        id: userResponse.data.sub || userResponse.data.id || userResponse.data.user_id,
        name: userResponse.data.name || userResponse.data.display_name || userResponse.data.username,
        email: userResponse.data.email,
        attributes: userResponse.data,
      };
    } catch (error: any) {
      console.error('OAuth2 获取用户信息失败:', error);
      throw new Error(`获取用户信息失败: ${error.message}`);
    }
  }

  /**
   * CAS: 验证 ticket 并获取用户信息
   */
  async validateCASTicket(ticket: string): Promise<SSOUserInfo> {
    if (!this.config.casServerUrl) {
      throw new Error('CAS 配置不完整');
    }

    try {
      const validateUrl = `${this.config.casServerUrl}/serviceValidate`;
      const response = await axios.get(validateUrl, {
        params: {
          ticket: ticket,
          service: this.config.callbackUrl,
          format: 'JSON',
        },
      });

      // CAS 返回格式: <cas:serviceResponse>...</cas:serviceResponse>
      // 或 JSON 格式（如果指定 format=JSON）
      if (response.data.serviceResponse?.authenticationSuccess) {
        const user = response.data.serviceResponse.authenticationSuccess.user;
        const attributes = response.data.serviceResponse.authenticationSuccess.attributes || {};

        return {
          id: user,
          name: attributes.displayName || attributes.name || user,
          email: attributes.email,
          attributes: attributes,
        };
      } else {
        throw new Error('CAS ticket 验证失败');
      }
    } catch (error: any) {
      console.error('CAS ticket 验证失败:', error);
      throw new Error(`验证失败: ${error.message}`);
    }
  }

  /**
   * SAML: 验证 SAML Assertion（简化版，实际需要 XML 解析）
   * 注意：完整的 SAML 实现需要使用专门的库（如 saml2-js）
   */
  async validateSAMLAssertion(assertion: string): Promise<SSOUserInfo> {
    // 这里只是示例，实际实现需要使用 SAML 库来解析和验证
    // 建议使用 saml2-js 或 passport-saml
    throw new Error('SAML 验证需要专门的库支持，请使用 saml2-js');
  }
}
