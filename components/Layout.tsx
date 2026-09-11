
import React, { useEffect, useState } from 'react';
import { changePassword, getUsers, logout, getImpersonator, switchPerspective, getBadgeCounts } from '../services/okrService';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { User, Role, ROLE_NAMES } from '../types';
import { LayoutDashboard, Target, CheckCircle2, FileText, UserCircle, LogOut, Settings, Award, Users, ShieldAlert, History, Eye, Key, X } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

const NavItem = ({ to, icon: Icon, label, active, count }: any) => (
  <Link
    to={to}
    className={`flex items-center justify-between px-4 py-3 rounded-lg transition-colors ${
      active ? 'bg-brand-50 text-brand-700 font-medium' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
    }`}
  >
    <div className="flex items-center gap-3">
        <Icon size={20} />
        <span>{label}</span>
    </div>
    {count > 0 && (
        <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm min-w-[20px] text-center">
            {count > 99 ? '99+' : count}
        </span>
    )}
  </Link>
);

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const user = useCurrentUser();
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [impersonator, setImpersonator] = useState<User | null>(null);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isPasswordChangeRequired, setIsPasswordChangeRequired] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  
  // Notification Counts
  const [counts, setCounts] = useState({ approvals: 0, assessments: 0 });

  const location = useLocation();
  const navigate = useNavigate();

  const refreshUsers = () => {
      setAllUsers(getUsers());
  };

  useEffect(() => {
    refreshUsers();
  }, []);

  // Update impersonator status whenever the current user changes (e.g., after a switch)
  useEffect(() => {
     setImpersonator(getImpersonator());
     const required = localStorage.getItem('alignflow_must_change_password') === 'true';
     setIsPasswordChangeRequired(required);
     if (required) setIsPasswordModalOpen(true);
  }, [user]);

  // Calculate Badges (Run on mount and data change event)
  useEffect(() => {
      const updateData = () => {
          if (!user) return;
          const newCounts = getBadgeCounts(user);
          setCounts(newCounts);
          refreshUsers(); // Also refresh users list to ensure impersonation list is up-to-date
      };

      updateData(); // Initial load
      window.addEventListener('alignflow_data_updated', updateData);
      
      return () => {
          window.removeEventListener('alignflow_data_updated', updateData);
      };
  }, [user]); 

  const handleUserSwitch = (e: React.ChangeEvent<HTMLSelectElement>) => {
    switchPerspective(e.target.value);
  };

  const handleLogout = () => {
      logout();
      navigate('/login');
  };

  const closePasswordModal = () => {
      if (isPasswordChangeRequired) return;
      setIsPasswordModalOpen(false);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordError('');
      setChangingPassword(false);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
      e.preventDefault();
      setPasswordError('');
      if (!oldPassword || !newPassword || !confirmPassword) {
          setPasswordError('请完整填写原密码、新密码和确认密码');
          return;
      }
      if (newPassword !== confirmPassword) {
          setPasswordError('两次输入的新密码不一致');
          return;
      }
      if (newPassword === 'Gw1admin.') {
          setPasswordError('新密码不能继续使用初始默认密码');
          return;
      }
      if (newPassword.length < 6) {
          setPasswordError('新密码长度不能少于 6 位');
          return;
      }
      setChangingPassword(true);
      try {
          await changePassword(oldPassword, newPassword);
          setIsPasswordChangeRequired(false);
          setIsPasswordModalOpen(false);
          setOldPassword('');
          setNewPassword('');
          setConfirmPassword('');
          setPasswordError('');
          setChangingPassword(false);
      } catch (error: any) {
          setChangingPassword(false);
          setPasswordError(error.message || '修改密码失败');
      }
  };

  if (!user) return null;
  
  // Show admin tools if user is strictly Admin OR if we are currently impersonating (which implies original user was Admin)
  const showAdminTools = user.role === Role.ADMIN || !!impersonator;
  // Show admin menu links ONLY if strictly Admin (to simulate true user view when impersonating)
  const showAdminLinks = user.role === Role.ADMIN;

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col shadow-sm z-10 transition-all duration-300">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-3 text-brand-600 font-bold text-xl">
             <img src="https://cdn-icons-png.flaticon.com/128/3474/3474360.png" alt="Logo" className="w-8 h-8 object-contain" />
             <span>OKR 系统</span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <NavItem 
            to="/" 
            icon={LayoutDashboard} 
            label="OKR 看板" 
            active={location.pathname === '/'} 
          />
          <NavItem 
            to="/my-okrs" 
            icon={FileText} 
            label="我的 OKR" 
            active={location.pathname === '/my-okrs'} 
          />
           <NavItem 
           to="/approvals" 
           icon={CheckCircle2} 
           label="审批与建议" 
           active={location.pathname === '/approvals'}
           count={counts.approvals}
         />
          <NavItem 
            to="/assessment" 
            icon={UserCircle} 
            label="绩效评估" 
            active={location.pathname === '/assessment'} 
            count={counts.assessments}
          />
          
          {showAdminLinks && (
            <div className="pt-4 mt-4 border-t border-slate-100 animate-in fade-in slide-in-from-left-2">
               <div className="px-4 text-xs font-semibold text-slate-400 uppercase mb-2">系统管理</div>
               <NavItem 
                to="/users" 
                icon={Settings} 
                label="用户与集成" 
                active={location.pathname === '/users'} 
              />
               <NavItem 
                to="/admin-account" 
                icon={ShieldAlert} 
                label="管理员账号" 
                active={location.pathname === '/admin-account'} 
              />
              <NavItem 
                to="/grading-settings" 
                icon={Award} 
                label="绩效设置" 
                active={location.pathname === '/grading-settings'} 
              />
               <NavItem 
                to="/operation-logs" 
                icon={History} 
                label="操作日志" 
                active={location.pathname === '/operation-logs'} 
              />
            </div>
          )}
        </nav>

        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3 mb-4">
            <img src={user.avatar} alt="avatar" className="w-10 h-10 rounded-full border border-slate-200 object-cover" />
            <div className="overflow-hidden flex-1">
              <p className="text-sm font-semibold text-slate-800 truncate">{user.name}</p>
              <p className="text-xs text-slate-500 truncate">{ROLE_NAMES[user.role] || user.role}</p>
            </div>
            <button onClick={() => setIsPasswordModalOpen(true)} className="text-slate-400 hover:text-brand-600 transition-colors" title="修改密码">
                <Key size={18} />
            </button>
            <button onClick={handleLogout} className="text-slate-400 hover:text-red-500 transition-colors" title="退出登录">
                <LogOut size={18} />
            </button>
          </div>
          
          {/* Admin Menu: Switch User Functionality - Persistent if Impersonating */}
          {showAdminTools && (
            <div className={`rounded-lg p-2 border ${impersonator ? 'bg-amber-50 border-amber-200' : 'bg-brand-50 border-brand-100'}`}>
                <label className={`text-xs font-bold uppercase tracking-wider mb-1 block flex items-center gap-1 ${impersonator ? 'text-amber-700' : 'text-brand-600'}`}>
                    {impersonator ? <Eye size={12}/> : <Users size={12}/>} 
                    {impersonator ? '预览模式' : '管理员: 切换视角'}
                </label>
                <select 
                    value={user.id} 
                    onChange={handleUserSwitch}
                    className="w-full text-xs p-1.5 border border-brand-200 rounded bg-white text-slate-700 outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer"
                >
                    {allUsers.map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({ROLE_NAMES[u.role] || u.role})</option>
                    ))}
                </select>
                {impersonator && (
                     <p className="text-[10px] text-amber-600 mt-1 leading-tight">
                        原身份: {impersonator.name}
                     </p>
                )}
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-50/50">
         {impersonator && (
             <div className="bg-amber-100 border-b border-amber-200 text-amber-900 px-6 py-2 text-sm flex justify-between items-center shadow-sm z-20">
                  <div className="flex items-center gap-2">
                      <Eye size={16} />
                      <span>
                          当前正在以 <strong>{user.name}</strong> 的身份预览系统。
                          <span className="opacity-75 text-xs ml-1">(部分管理菜单已隐藏以模拟真实视图)</span>
                      </span>
                  </div>
                  <button 
                     onClick={() => switchPerspective(impersonator.id)}
                     className="text-xs bg-white border border-amber-300 px-3 py-1 rounded hover:bg-amber-50 font-bold text-amber-800 transition-colors"
                  >
                      退出预览
                  </button>
             </div>
         )}
        <div className="flex-1 overflow-y-auto">
            <div className="max-w-7xl mx-auto p-8 min-h-full">
                {children}
            </div>
        </div>
      </main>

      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-6">
          <form onSubmit={handleChangePassword} className="w-full max-w-md bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
                  <Key size={18} />
                </div>
                <h3 className="font-bold text-slate-900">修改密码</h3>
              </div>
              {isPasswordChangeRequired ? (
                <button type="button" onClick={handleLogout} className="text-xs text-red-500 hover:bg-red-50 px-2 py-1 rounded">退出登录</button>
              ) : (
                <button type="button" onClick={closePasswordModal} className="text-slate-400 hover:text-slate-600">
                  <X size={18} />
                </button>
              )}
            </div>
            <div className="p-5 space-y-4">
              {isPasswordChangeRequired && <div className="bg-orange-50 text-orange-700 p-3 rounded-lg text-sm border border-orange-100">当前账号仍在使用初始默认密码，必须修改后才能继续使用系统。</div>}
              {passwordError && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-100">{passwordError}</div>}
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">原密码</label>
                <input type="password" className="w-full p-3 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-brand-500 outline-none text-sm" value={oldPassword} onChange={e => setOldPassword(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">新密码</label>
                <input type="password" className="w-full p-3 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-brand-500 outline-none text-sm" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">确认新密码</label>
                <input type="password" className="w-full p-3 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-brand-500 outline-none text-sm" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
              </div>
            </div>
            <div className="px-5 py-4 bg-slate-50 border-t border-slate-100">
              <button type="submit" disabled={changingPassword} className="w-full bg-brand-600 text-white font-bold py-2.5 rounded-lg hover:bg-brand-700 disabled:opacity-70 disabled:cursor-not-allowed">
                {changingPassword ? '保存中...' : '保存密码'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
