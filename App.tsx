import React, { useEffect, useRef } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { MyOKRs } from './pages/MyOKRs';
import { Approvals } from './pages/Approvals';
import { Assessment } from './pages/Assessment';
import { UserManagement } from './pages/UserManagement';
import { GradingSettings } from './pages/GradingSettings';
import { Login } from './pages/Login';
import { WeChatCallback } from './pages/WeChatCallback';
import { SSOCallback } from './pages/SSOCallback';
import { AdminAccount } from './pages/AdminAccount';
import { OperationLogs } from './pages/OperationLogs';
import { useCurrentUser } from './hooks/useCurrentUser';
import { clearInvalidAuthSession } from './services/okrService';

const AUTH_RESOLVE_TIMEOUT_MS = 25000;

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const user = useCurrentUser();
    const stuckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    
    // Check local storage directly for immediate redirect on initial load
    // to prevent flash of content if the hook takes a tick to update
    const hasToken = localStorage.getItem('alignflow_current_user_id');
    const okrToken = localStorage.getItem('okr_token');

    // 有 token 但长时间解析不出用户（例如后端未启动、网络失败且未返回 401）时清会话，避免无限「加载中」
    useEffect(() => {
        if (!hasToken || !okrToken || user) {
            if (stuckTimerRef.current) {
                clearTimeout(stuckTimerRef.current);
                stuckTimerRef.current = null;
            }
            return;
        }
        stuckTimerRef.current = setTimeout(() => {
            stuckTimerRef.current = null;
            clearInvalidAuthSession();
        }, AUTH_RESOLVE_TIMEOUT_MS);
        return () => {
            if (stuckTimerRef.current) {
                clearTimeout(stuckTimerRef.current);
                stuckTimerRef.current = null;
            }
        };
    }, [hasToken, okrToken, user]);

    // 防止出现：有 userId 但没有 okr_token，导致永远加载中
    if (!hasToken || !okrToken) {
        if (!okrToken) {
            localStorage.removeItem('alignflow_current_user_id');
        }
        return <Navigate to="/login" replace />;
    }

    // Wait for user to be loaded by hook if needed
    // Show loading state instead of null to prevent blank page
    if (!user) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600 mb-4"></div>
                    <p className="text-slate-600">加载中...</p>
                </div>
            </div>
        );
    }

    return <Layout>{children}</Layout>;
};

const App: React.FC = () => {
  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/auth/wechat/callback" element={<WeChatCallback />} />
        <Route path="/auth/sso/callback" element={<SSOCallback />} />
        
        <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/my-okrs" element={<ProtectedRoute><MyOKRs /></ProtectedRoute>} />
        <Route path="/approvals" element={<ProtectedRoute><Approvals /></ProtectedRoute>} />
        <Route path="/assessment" element={<ProtectedRoute><Assessment /></ProtectedRoute>} />
        <Route path="/users" element={<ProtectedRoute><UserManagement /></ProtectedRoute>} />
        <Route path="/grading-settings" element={<ProtectedRoute><GradingSettings /></ProtectedRoute>} />
        <Route path="/admin-account" element={<ProtectedRoute><AdminAccount /></ProtectedRoute>} />
        <Route path="/operation-logs" element={<ProtectedRoute><OperationLogs /></ProtectedRoute>} />
        
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
};

export default App;