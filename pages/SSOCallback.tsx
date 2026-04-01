import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { setToken } from '../services/api';
import { getUsers } from '../services/okrService';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';

export const SSOCallback: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [message, setMessage] = useState('正在处理登录...');

    useEffect(() => {
        const handleCallback = async () => {
            try {
                const token = searchParams.get('token');
                const error = searchParams.get('error');
                const userParam = searchParams.get('user');

                if (error) {
                    setStatus('error');
                    setMessage(decodeURIComponent(error));
                    setTimeout(() => {
                        navigate('/login');
                    }, 3000);
                    return;
                }

                if (!token) {
                    setStatus('error');
                    setMessage('缺少认证令牌');
                    setTimeout(() => {
                        navigate('/login');
                    }, 3000);
                    return;
                }

                // 保存 token
                setToken(token);

                // 解析用户信息
                if (userParam) {
                    try {
                        const user = JSON.parse(decodeURIComponent(userParam));
                        localStorage.setItem('alignflow_current_user_id', user.id);
                        
                        // 更新用户缓存
                        const users = getUsers();
                        const idx = users.findIndex(u => u.id === user.id);
                        if (idx >= 0) {
                            users[idx] = user;
                        } else {
                            users.push(user);
                        }
                        
                        // 通知订阅者更新（触发 useCurrentUser hook 更新）
                        window.dispatchEvent(new CustomEvent('alignflow_data_updated'));
                    } catch (e) {
                        console.error('解析用户信息失败:', e);
                    }
                }

                setStatus('success');
                setMessage('登录成功，正在跳转...');
                
                setTimeout(() => {
                    navigate('/');
                }, 1000);
            } catch (error: any) {
                console.error('SSO 回调处理失败:', error);
                setStatus('error');
                setMessage(error.message || '登录失败');
                setTimeout(() => {
                    navigate('/login');
                }, 3000);
            }
        };

        handleCallback();
    }, [searchParams, navigate]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
            <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
                {status === 'loading' && (
                    <>
                        <Loader2 className="w-12 h-12 text-brand-600 animate-spin mx-auto mb-4" />
                        <h2 className="text-xl font-bold text-slate-800 mb-2">处理中</h2>
                        <p className="text-slate-600">{message}</p>
                    </>
                )}
                {status === 'success' && (
                    <>
                        <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-4" />
                        <h2 className="text-xl font-bold text-slate-800 mb-2">登录成功</h2>
                        <p className="text-slate-600">{message}</p>
                    </>
                )}
                {status === 'error' && (
                    <>
                        <XCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
                        <h2 className="text-xl font-bold text-slate-800 mb-2">登录失败</h2>
                        <p className="text-slate-600 mb-4">{message}</p>
                        <button
                            onClick={() => navigate('/login')}
                            className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors"
                        >
                            返回登录
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};
