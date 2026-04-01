import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../services/okrService';
import { authAPI } from '../services/api';
import { Lock, User, ArrowRight, Info, CheckCircle2, MessageCircle, Key, Loader2 } from 'lucide-react';

export const Login: React.FC = () => {
    const navigate = useNavigate();
    const [account, setAccount] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [checkingConfig, setCheckingConfig] = useState(true);
    const [wechatEnabled, setWechatEnabled] = useState(false);
    const [ssoEnabled, setSsoEnabled] = useState(false);
    const [ssoProvider, setSsoProvider] = useState<string | null>(null);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const result = await login(account, password);
            setLoading(false);
            
            if (result.success) {
                navigate('/');
            } else {
                setError(result.message || '登录失败');
            }
        } catch (error: any) {
            setLoading(false);
            setError(error.message || '登录失败');
        }
    };

    const handleWeChatLogin = async () => {
        try {
            setError('');
            setLoading(true);
            const result = await authAPI.getWeChatAuthorizeUrl();
            if (result.success && result.data?.url) {
                // 跳转到企业微信授权页面
                window.location.href = result.data.url;
            } else {
                setLoading(false);
                setError('获取企业微信授权 URL 失败');
            }
        } catch (error: any) {
            setLoading(false);
            setError(error.message || '企业微信登录失败');
        }
    };

    const handleSSOLogin = async () => {
        try {
            setError('');
            setLoading(true);
            const result = await authAPI.getSSOAuthorizeUrl();
            if (result.success && result.data?.url) {
                // 跳转到 SSO 授权页面
                window.location.href = result.data.url;
            } else {
                setLoading(false);
                setError('获取 SSO 授权 URL 失败');
            }
        } catch (error: any) {
            setLoading(false);
            setError(error.message || 'SSO 登录失败');
        }
    };

    // 检查登录配置
    useEffect(() => {
        const checkConfig = async () => {
            try {
                const result = await authAPI.getLoginConfig();
                if (result.success && result.data) {
                    setWechatEnabled(result.data.wechat?.enabled || false);
                    setSsoEnabled(result.data.sso?.enabled || false);
                    setSsoProvider(result.data.sso?.provider || null);

                    // 如果配置了 SSO，自动跳转
                    if (result.data.sso?.enabled) {
                        try {
                            const ssoResult = await authAPI.getSSOAuthorizeUrl();
                            if (ssoResult.success && ssoResult.data?.url) {
                                window.location.href = ssoResult.data.url;
                                return;
                            }
                        } catch (e) {
                            console.error('SSO 跳转失败:', e);
                        }
                    }

                    // 如果配置了企业微信，自动获取授权 URL
                    if (result.data.wechat?.enabled) {
                        try {
                            const wechatResult = await authAPI.getWeChatAuthorizeUrl();
                            if (wechatResult.success && wechatResult.data?.url) {
                                // 跳转到企业微信授权页面
                                window.location.href = wechatResult.data.url;
                                return;
                            }
                        } catch (e) {
                            console.error('企业微信跳转失败:', e);
                        }
                    }
                }
            } catch (error: any) {
                console.error('检查登录配置失败:', error);
                // 配置检查失败时，显示传统登录表单
            } finally {
                setCheckingConfig(false);
            }
        };

        checkConfig();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 如果正在检查配置，显示加载状态
    if (checkingConfig) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 text-brand-600 animate-spin mx-auto mb-4" />
                    <p className="text-slate-600">正在检查登录配置...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 relative overflow-hidden">
            {/* Background Decoration */}
            <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-brand-600 to-slate-50 z-0"></div>
            <div className="absolute top-10 left-10 w-32 h-32 bg-white/10 rounded-full blur-3xl z-0"></div>
            <div className="absolute top-20 right-20 w-64 h-64 bg-brand-400/20 rounded-full blur-3xl z-0"></div>

            <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl overflow-hidden flex z-10 animate-in fade-in zoom-in-95 duration-500 min-h-[500px]">
                
                {/* Left Side: Brand Area */}
                <div className="w-2/5 bg-slate-900 hidden md:flex flex-col justify-between p-10 text-white relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-brand-700 to-slate-900 opacity-90 z-10"></div>
                    <img 
                        src="https://images.unsplash.com/photo-1557804506-669a67965ba0?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80" 
                        alt="Background" 
                        className="absolute top-0 left-0 w-full h-full object-cover opacity-40 z-0 grayscale"
                    />
                    
                    <div className="relative z-20">
                         <div className="flex items-center gap-3 mb-6">
                            <div className="bg-white/20 p-2 rounded-lg backdrop-blur-md">
                                <img src="https://cdn-icons-png.flaticon.com/128/3474/3474360.png" alt="Logo" className="w-8 h-8 object-contain brightness-0 invert" />
                            </div>
                            <span className="text-xl font-bold tracking-tight">OKR System</span>
                        </div>
                        <h2 className="text-3xl font-bold leading-tight mb-4">目标对齐<br/>驱动增长</h2>
                        <p className="text-brand-100 text-sm leading-relaxed opacity-90">
                            连接战略与执行，让每一个目标都清晰可见。
                        </p>
                    </div>

                    <div className="relative z-20 space-y-3">
                        <div className="flex items-center gap-3 text-sm text-brand-100">
                            <CheckCircle2 size={16} className="text-brand-400"/>
                            <span>多级审批工作流</span>
                        </div>
                         <div className="flex items-center gap-3 text-sm text-brand-100">
                            <CheckCircle2 size={16} className="text-brand-400"/>
                            <span>360° 绩效评估</span>
                        </div>
                         <div className="flex items-center gap-3 text-sm text-brand-100">
                            <CheckCircle2 size={16} className="text-brand-400"/>
                            <span>企业微信/SSO 集成</span>
                        </div>
                    </div>
                </div>

                {/* Right Side: Login Form */}
                <div className="flex-1 p-10 flex flex-col justify-center bg-white relative">
                     {/* Mobile Header Logo */}
                    <div className="md:hidden flex items-center gap-2 mb-8 justify-center text-brand-700 font-bold text-xl">
                        <img src="https://cdn-icons-png.flaticon.com/128/3474/3474360.png" alt="Logo" className="w-8 h-8 object-contain" />
                        <span>OKR 系统</span>
                    </div>

                    <div className="max-w-sm mx-auto w-full">
                        <h3 className="text-2xl font-bold text-slate-800 mb-2">欢迎回来</h3>
                        <p className="text-slate-500 text-sm mb-8">请输入您的账号密码以访问工作台</p>

                        <form onSubmit={handleLogin} className="space-y-5">
                            {error && (
                                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-center gap-2 border border-red-100 animate-in slide-in-from-top-2">
                                    <Info size={16} /> {error}
                                </div>
                            )}

                            <div className="space-y-1.5">
                                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide">账号</label>
                                <div className="relative group">
                                    <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-600 transition-colors" />
                                    <input 
                                        type="text" 
                                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all text-slate-800 text-sm"
                                        placeholder="请输入账号"
                                        value={account}
                                        onChange={e => setAccount(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide">密码</label>
                                <div className="relative group">
                                    <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-600 transition-colors" />
                                    <input 
                                        type="password" 
                                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all text-slate-800 text-sm"
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                    />
                                </div>
                            </div>

                            <button 
                                type="submit" 
                                disabled={loading}
                                className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-3 rounded-lg shadow-lg shadow-brand-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed mt-4"
                            >
                                {loading ? '验证中...' : '登录系统'}
                                {!loading && <ArrowRight size={18} />}
                            </button>
                        </form>

                        <div className="mt-8 pt-6 border-t border-slate-100 text-center">
                            <p className="text-xs text-slate-400">
                                如需账号信息，请向管理员获取。
                            </p>
                        </div>
                    </div>
                </div>
            </div>
            
            <div className="absolute bottom-4 text-center w-full text-xs text-slate-400">
                &copy; {new Date().getFullYear()} AlignFlow Enterprise. All rights reserved.
            </div>
        </div>
    );
};