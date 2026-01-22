import React, { useState, useEffect } from 'react';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { Role, User } from '../types';
import { getUsers, saveUser, deleteUser, addLog } from '../services/okrService';
import { ShieldAlert, Plus, Edit2, Trash2, X, Lock, User as UserIcon, ShieldCheck, Key } from 'lucide-react';

export const AdminAccount: React.FC = () => {
    const currentUser = useCurrentUser();
    const [admins, setAdmins] = useState<User[]>([]);
    
    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingAdmin, setEditingAdmin] = useState<Partial<User>>({});
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    useEffect(() => {
        refreshAdmins();
    }, []);

    const refreshAdmins = () => {
        const allUsers = getUsers();
        // Filter only admins
        setAdmins(allUsers.filter(u => u.role === Role.ADMIN));
    };

    if (currentUser?.role !== Role.ADMIN) {
        return <div className="text-center p-10 text-red-500">仅限管理员访问</div>;
    }

    const handleEditClick = (admin: User) => {
        setEditingAdmin(admin);
        setPassword('');
        setConfirmPassword('');
        setIsModalOpen(true);
    };

    const handleCreateClick = () => {
        setEditingAdmin({ role: Role.ADMIN, department: '系统管理组', source: 'LOCAL' });
        setPassword('');
        setConfirmPassword('');
        setIsModalOpen(true);
    };

    const handleDeleteClick = (admin: User) => {
        if (admin.account === 'admin') {
            alert("内置系统管理员账号不可删除。");
            return;
        }
        if (admin.id === currentUser.id) {
            alert("无法删除当前正在登录的账号。");
            return;
        }
        if (confirm(`确定要删除管理员 "${admin.name}" 吗？此操作无法撤销。`)) {
            deleteUser(admin.id);
            addLog('DELETE_ADMIN', 'SYSTEM', `删除了管理员账号: ${admin.name}`);
            refreshAdmins();
        }
    };

    const handleSave = () => {
        if (!editingAdmin.name || !editingAdmin.account) {
            alert("请填写姓名和账号。");
            return;
        }

        // New Admin: Password is required
        if (!editingAdmin.id && !password) {
            alert("新建管理员必须设置密码。");
            return;
        }

        // Password confirmation
        if (password && password !== confirmPassword) {
            alert("两次输入的密码不一致。");
            return;
        }

        // Check for duplicate account name (if changing account or creating new)
        const allUsers = getUsers();
        const existing = allUsers.find(u => u.account === editingAdmin.account && u.id !== editingAdmin.id);
        if (existing) {
            alert("该账号已存在，请使用其他登录账号。");
            return;
        }

        const isNew = !editingAdmin.id;
        
        const finalUser: User = {
            id: editingAdmin.id || `admin-${Date.now()}`,
            name: editingAdmin.name,
            account: editingAdmin.account,
            // Keep old password if not changing, otherwise use new one
            password: password || (editingAdmin.id ? admins.find(a => a.id === editingAdmin.id)?.password : '') || '123456',
            role: Role.ADMIN,
            department: '系统管理组',
            avatar: editingAdmin.avatar || `https://ui-avatars.com/api/?name=${editingAdmin.name}&background=0f172a&color=fff`,
            source: 'LOCAL'
        };

        saveUser(finalUser);
        addLog(isNew ? 'CREATE_ADMIN' : 'UPDATE_ADMIN', 'SYSTEM', `${isNew ? '创建' : '更新'}了管理员账号: ${finalUser.name}`);
        
        setIsModalOpen(false);
        refreshAdmins();
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
             <div className="flex items-center justify-between mb-6">
                 <div className="flex items-center gap-3">
                    <div className="bg-slate-800 text-white p-2 rounded-lg">
                        <ShieldAlert size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">管理员账号</h1>
                        <p className="text-slate-500 text-sm">管理拥有系统最高权限的账号。</p>
                    </div>
                 </div>
                 <button 
                    onClick={handleCreateClick}
                    className="bg-brand-600 text-white px-4 py-2 rounded-lg hover:bg-brand-700 flex items-center gap-2 shadow-sm transition-colors"
                >
                    <Plus size={18} /> 新增管理员
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                        <tr>
                            <th className="p-4">管理员信息</th>
                            <th className="p-4">登录账号</th>
                            <th className="p-4">状态/权限</th>
                            <th className="p-4 text-right">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {admins.map(admin => (
                            <tr key={admin.id} className="hover:bg-slate-50 transition-colors">
                                <td className="p-4">
                                    <div className="flex items-center gap-3">
                                        <img src={admin.avatar} alt="" className="w-9 h-9 rounded-full border border-slate-200" />
                                        <div className="font-medium text-slate-900">{admin.name}</div>
                                    </div>
                                </td>
                                <td className="p-4 font-mono text-slate-600">
                                    {admin.account}
                                </td>
                                <td className="p-4">
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                        <ShieldCheck size={12} /> 超级管理员
                                    </span>
                                    {admin.account === 'admin' && (
                                        <span className="ml-2 text-xs text-slate-400 italic">(内置)</span>
                                    )}
                                </td>
                                <td className="p-4 text-right space-x-2">
                                    <button 
                                        onClick={() => handleEditClick(admin)}
                                        className="text-brand-600 hover:bg-brand-50 p-1.5 rounded transition-colors"
                                        title="编辑/修改密码"
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                    <button 
                                        onClick={() => handleDeleteClick(admin)}
                                        className={`p-1.5 rounded transition-colors ${
                                            admin.account === 'admin' || admin.id === currentUser.id 
                                            ? 'text-slate-300 cursor-not-allowed' 
                                            : 'text-red-500 hover:bg-red-50'
                                        }`}
                                        disabled={admin.account === 'admin' || admin.id === currentUser.id}
                                        title={admin.account === 'admin' ? "内置账号不可删除" : "删除"}
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Edit/Create Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl w-[450px] overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="font-bold text-lg text-slate-800">
                                {editingAdmin.id ? '编辑管理员' : '新增管理员'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={20}/>
                            </button>
                        </div>
                        
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">姓名</label>
                                <div className="relative">
                                    <UserIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input 
                                        className="w-full pl-9 p-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                                        value={editingAdmin.name || ''}
                                        onChange={e => setEditingAdmin({...editingAdmin, name: e.target.value})}
                                        placeholder="管理员姓名"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">登录账号</label>
                                <div className="relative">
                                    <ShieldCheck size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input 
                                        className={`w-full pl-9 p-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none transition-all ${editingAdmin.account === 'admin' ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : ''}`}
                                        value={editingAdmin.account || ''}
                                        onChange={e => setEditingAdmin({...editingAdmin, account: e.target.value})}
                                        placeholder="仅限英文、数字"
                                        disabled={editingAdmin.account === 'admin'}
                                    />
                                </div>
                                {editingAdmin.account === 'admin' && <p className="text-xs text-orange-500 mt-1">内置账号不可修改登录名。</p>}
                            </div>

                            <div className="pt-2 border-t border-slate-100">
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    {editingAdmin.id ? '重置密码 (留空则不修改)' : '设置密码'}
                                </label>
                                <div className="space-y-3">
                                    <div className="relative">
                                        <Key size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input 
                                            type="password"
                                            className="w-full pl-9 p-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                                            placeholder="输入密码"
                                            value={password}
                                            onChange={e => setPassword(e.target.value)}
                                        />
                                    </div>
                                    <div className="relative">
                                        <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input 
                                            type="password"
                                            className="w-full pl-9 p-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                                            placeholder="确认密码"
                                            value={confirmPassword}
                                            onChange={e => setConfirmPassword(e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-5 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
                            <button 
                                onClick={() => setIsModalOpen(false)} 
                                className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg text-sm font-medium transition-colors"
                            >
                                取消
                            </button>
                            <button 
                                onClick={handleSave} 
                                className="px-6 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 text-sm font-medium shadow-sm transition-all"
                            >
                                保存
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};