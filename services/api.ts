// 本地开发默认后端端口为 3001
const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:3001/api';

// Get token from localStorage
const getToken = (): string | null => {
  return localStorage.getItem('okr_token');
};

// Set token to localStorage
export const setToken = (token: string): void => {
  localStorage.setItem('okr_token', token);
};

// Remove token from localStorage
export const removeToken = (): void => {
  localStorage.removeItem('okr_token');
};

// API request helper
const request = async <T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> => {
  const token = getToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  console.log('[API] 发起请求:', options.method || 'GET', endpoint);
  
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    console.log('[API] 响应状态:', response.status, response.statusText, endpoint);

    if (!response.ok) {
      let errorMessage = '请求失败';
      try {
        const error = await response.json();
        errorMessage = error.error?.message || error.message || `HTTP ${response.status}: ${response.statusText}`;
        console.error('[API] 请求失败:', response.status, errorMessage);
      } catch (e) {
        errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        console.error('[API] 请求失败，无法解析错误:', response.status, errorMessage);
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    console.log('[API] 请求成功:', endpoint, data.success ? 'success' : 'failed');
    return data;
  } catch (error) {
    console.error('[API] 请求异常:', endpoint, error);
    throw error;
  }
};

// Auth API
export const authAPI = {
  getLoginConfig: async () => {
    const data = await request<{ success: boolean; data?: { wechat?: { enabled: boolean }; sso?: { enabled: boolean; provider?: string | null } } }>('/v1/auth/config');
    return data;
  },

  login: async (account: string, password: string) => {
    const data = await request<{ success: boolean; data?: { token?: string; user?: any }; error?: { message?: string } }>(
      '/v1/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ account, password }),
      }
    );
    if (data.success && data.data?.token) {
      setToken(data.data.token);
      localStorage.setItem('alignflow_current_user_id', data.data.user?.id || '');
    }
    return data;
  },
  
  getCurrentUser: async () => {
    const data = await request<{ success: boolean; data?: { user?: any } }>('/v1/auth/me');
    if (data.success && data.data?.user) {
      localStorage.setItem('alignflow_current_user_id', data.data.user.id);
    }
    return data;
  },

  getWeChatAuthorizeUrl: async (state?: string) => {
    const query = state ? `?state=${encodeURIComponent(state)}` : '';
    const data = await request<{ success: boolean; data?: { url?: string } }>(`/v1/auth/wechat/authorize${query}`);
    return data;
  },

  getSSOAuthorizeUrl: async (state?: string) => {
    const query = state ? `?state=${encodeURIComponent(state)}` : '';
    const data = await request<{ success: boolean; data?: { url?: string; method?: string } }>(`/v1/auth/sso/authorize${query}`);
    return data;
  },
};

// Users API
export const usersAPI = {
  getAll: () => request<{ success: boolean; data?: { users: any[] } }>('/v1/users'),
  getById: (id: string) => request<{ success: boolean; data?: { user: any } }>(`/v1/users/${id}`),
  create: (user: any) => request<{ success: boolean; data?: { user: any } }>('/v1/users', {
    method: 'POST',
    body: JSON.stringify(user),
  }),
  update: (id: string, user: any) => request<{ success: boolean; data?: { user: any } }>(`/v1/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(user),
  }),
  delete: (id: string) => request<{ success: boolean }>(`/v1/users/${id}`, {
    method: 'DELETE',
  }),
};

// OKRs API
export const okrsAPI = {
  getAll: (userId?: string) => {
    const query = userId ? `?userId=${userId}` : '';
    return request<{ success: boolean; data?: { okrs: any[] } }>(`/v1/okrs${query}`);
  },
  getById: (id: string) => request<{ success: boolean; data?: { okr: any } }>(`/v1/okrs/${id}`),
  create: (okr: any) => request<{ success: boolean; data?: { okr: any } }>('/v1/okrs', {
    method: 'POST',
    body: JSON.stringify(okr),
  }),
  update: (id: string, okr: any) => request<{ success: boolean; data?: { okr: any } }>(`/v1/okrs/${id}`, {
    method: 'PUT',
    body: JSON.stringify(okr),
  }),
  updateStatus: (id: string, status: string, version?: number) => request<{ success: boolean; data?: { okr: any } }>(`/v1/okrs/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, version }),
  }),
  delete: (id: string) => request<{ success: boolean }>(`/v1/okrs/${id}`, {
    method: 'DELETE',
  }),
  importByAI: (payload: {
    textContent?: string;
    fileName?: string;
    mimeType?: string;
    imageBase64?: string;
    imageList?: Array<{ base64: string; mimeType?: string }>;
    fileBase64?: string;
    // 管理员预览模式下：指定导入 OKR 的归属用户
    importUserId?: string;
    // 生成的 OKR 类型：COMPANY / DEPARTMENT / PERSONAL
    importLevel?: 'COMPANY' | 'DEPARTMENT' | 'PERSONAL';
  }) =>
    request<{ success: boolean; data?: { okr?: any; parsed?: any } }>('/v1/okrs/import/ai', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  movePriority: (id: string, payload: { direction: 'up' | 'down'; targetUserId?: string }) =>
    request<{ success: boolean; data?: { okrId?: string; updated?: any } }>(`/v1/okrs/${id}/move`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  mergeOKRs: (payload: { okrIds: string[]; targetUserId?: string }) =>
    request<{ success: boolean; data?: { okr?: any } }>(`/v1/okrs/merge`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

// Workflows API
export const workflowsAPI = {
  getAll: () => request<{ success: boolean; data?: { workflows: any[] } }>('/v1/workflows'),
  create: (workflow: any) => request<{ success: boolean; data?: { workflow: any } }>('/v1/workflows', {
    method: 'POST',
    body: JSON.stringify(workflow),
  }),
  delete: (targetRole: string) => request<{ success: boolean }>(`/v1/workflows/${targetRole}`, {
    method: 'DELETE',
  }),
};

// Grade Configs API
export const gradeConfigsAPI = {
  getAll: () => request<{ success: boolean; data?: { configs: any[] } }>('/v1/grade-configs'),
  saveAll: (configs: any[]) => request<{ success: boolean; data?: { configs: any[] } }>('/v1/grade-configs', {
    method: 'POST',
    body: JSON.stringify(configs),
  }),
};

// Departments API
export const departmentsAPI = {
  getAll: () => request<{ success: boolean; data?: { departments: string[] } }>('/v1/departments'),
  create: (name: string) => request<{ success: boolean }>('/v1/departments', {
    method: 'POST',
    body: JSON.stringify({ name }),
  }),
  update: (name: string, newName: string) => request<{ success: boolean }>(`/v1/departments/${encodeURIComponent(name)}`, {
    method: 'PUT',
    body: JSON.stringify({ newName }),
  }),
  delete: (name: string) => request<{ success: boolean }>(`/v1/departments/${encodeURIComponent(name)}`, {
    method: 'DELETE',
  }),
};

// Custom Roles API
export const customRolesAPI = {
  getAll: () => request<{ success: boolean; data?: { roles: any[] } }>('/v1/custom-roles'),
  create: (role: any) => request<{ success: boolean; data?: { role: any } }>('/v1/custom-roles', {
    method: 'POST',
    body: JSON.stringify(role),
  }),
  update: (value: string, label: string) => request<{ success: boolean; data?: { role: any } }>(`/v1/custom-roles/${value}`, {
    method: 'PUT',
    body: JSON.stringify({ label }),
  }),
  delete: (value: string) => request<{ success: boolean }>(`/v1/custom-roles/${value}`, {
    method: 'DELETE',
  }),
};

// Logs API
export const logsAPI = {
  getAll: (limit?: number) => {
    const query = limit ? `?limit=${limit}` : '';
    return request<{ success: boolean; data?: { logs: any[] } }>(`/v1/logs${query}`);
  },
};

// Configs API
export const configsAPI = {
  getWeCom: () => request<{ success: boolean; data?: { config?: any } }>('/v1/configs/wecom'),
  saveWeCom: (config: any) => request<{ success: boolean; data?: { config?: any } }>('/v1/configs/wecom', {
    method: 'POST',
    body: JSON.stringify(config),
  }),
  getSSO: () => request<{ success: boolean; data?: { config?: any } }>('/v1/configs/sso'),
  saveSSO: (config: any) => request<{ success: boolean; data?: { config?: any } }>('/v1/configs/sso', {
    method: 'POST',
    body: JSON.stringify(config),
  }),
  getAI: () => request<{ success: boolean; data?: { config?: any } }>('/v1/configs/ai'),
  saveAI: (config: any) => request<{ success: boolean; data?: { config?: any } }>('/v1/configs/ai', {
    method: 'POST',
    body: JSON.stringify(config),
  }),
};
