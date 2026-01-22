import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { MyOKRs } from './pages/MyOKRs';
import { Approvals } from './pages/Approvals';
import { Assessment } from './pages/Assessment';
import { UserManagement } from './pages/UserManagement';
import { GradingSettings } from './pages/GradingSettings';
import { Login } from './pages/Login';
import { AdminAccount } from './pages/AdminAccount';
import { OperationLogs } from './pages/OperationLogs';
import { useCurrentUser } from './hooks/useCurrentUser';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const user = useCurrentUser();
    
    // Check local storage directly for immediate redirect on initial load
    // to prevent flash of content if the hook takes a tick to update
    const hasToken = localStorage.getItem('alignflow_current_user_id');

    if (!hasToken) {
        return <Navigate to="/login" replace />;
    }

    // Wait for user to be loaded by hook if needed (though local storage check above handles most cases)
    if (!user) return null; 

    return <Layout>{children}</Layout>;
};

const App: React.FC = () => {
  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        
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