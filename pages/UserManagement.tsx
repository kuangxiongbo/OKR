

import React, { useState, useEffect, useMemo } from 'react';
import { getUsers, saveUser, deleteUser, getWeComConfig, saveWeComConfig, getSSOConfig, saveSSOConfig, getWorkflows, saveWorkflow, getDepartments, addDepartment, getRoles, addRole, getApproverRoles, deleteCustomRole, deleteWorkflow, updateCustomRole } from '../services/okrService';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { User, Role, ApprovalWorkflow, WeComConfig, SSOConfig, ROLE_NAMES, OKR, OKRLevel, OKRStatus } from '../types';
import { Plus, Trash2, Edit2, Shield, MessageSquare, Cloud, Check, Save, User as UserIcon, Building, Layers, Search, X, Lock, Key, ToggleLeft, ToggleRight, Settings, Send, Users, GitMerge, Crown, AlertTriangle } from 'lucide-react';

export const UserManagement: React.FC = () => {
    const currentUser = useCurrentUser();
    const [users, setUsers] = useState<User[]>([]);
    const [workflows, setWorkflows] = useState<ApprovalWorkflow[]>([]);
    const [departments, setDepartments] = useState<string[]>([]);
    const [roleOptions, setRoleOptions] = useState<{value: string, label: string}[]>([]);

    const [wecomConfig, setWecomConfig] = useState<WeComConfig>({ corpId: '', agentId: '', secret: '', enabled: false });
    const [ssoConfig, setSSOConfig] = useState<SSOConfig>({ metadataUrl: '', clientId: '', clientSecret: '', enabled: false });
    
    // UI State
    const [activeTab, setActiveTab] = useState<'users' | 'workflows' | 'integrations' | 'approvers'>('users');
    const [selectedDept, setSelectedDept] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    // Form state for User
    const [isEditing, setIsEditing] = useState(false);
    const [editUser, setEditUser] = useState<Partial<User>>({});
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPasswordReset, setShowPasswordReset] = useState(false);
    
    // Workflow edit state
    const [editingRole, setEditingRole] = useState<string | null>(null);
    const [tempWorkflow, setTempWorkflow] = useState<ApprovalWorkflow | null>(null);
    const [isAddingWorkflow, setIsAddingWorkflow] = useState(false); // New: Add Workflow State
    const [newWorkflowRole, setNewWorkflowRole] = useState('');

    // Manage Roles state
    const [editingCustomRoleKey, setEditingCustomRoleKey] = useState<string | null>(null);
    const [editingCustomRoleLabel, setEditingCustomRoleLabel] = useState('');

    // Integration & Add Item Modal State
    const [configModal, setConfigModal] = useState<'WECOM' | 'SSO' | 'ADD_DEPT' | 'MANAGE_ROLES' | null>(null);
    const [newItemName, setNewItemName] = useState(''); // For Dept or Role name
    const [newItemKey, setNewItemKey] = useState(''); // For Role key
    
    // Temp Config State for Modal
    const [tempWeCom, setTempWeCom] = useState<WeComConfig>(wecomConfig);
    const [tempSSO, setTempSSO] = useState<SSOConfig>(ssoConfig);

    useEffect(() => {
        refreshData();
    }, []);

    const refreshData = () => {
        // FILTER: Hide Admin from general user list
        setUsers(getUsers().filter(u => u.role !== Role.ADMIN));
        setWorkflows(getWorkflows());
        setDepartments(getDepartments());
        setRoleOptions(getRoles());
        setWecomConfig(getWeComConfig());
        setSSOConfig(getSSOConfig());
    }

    const getRoleName = (key: string) => {
        const r = roleOptions.find(opt => opt.value === key);
        return r ? r.label : key;
    }

    const isBuiltInRole = (role: string) => Object.values(Role).includes(role as Role);

    // --- Approval Map Logic (Existing Logic) ---
    const approvalMatrix = useMemo(() => {
        const fullUsers = getUsers(); 
        const getRank = (role: string): number => {
            if (role === Role.PRESIDENT) return 100;
            if (role === Role.VP_PRODUCT || role === Role.VP_TECH || role === Role.VP_MARKET) return 90;
            if (role === Role.PRODUCT_GM || role === Role.TECH_GM || role === Role.QUALITY_GM || role === Role.PROJECT_DEPT_GM) return 80;
            if (role === Role.GENERAL_OFFICE_DIRECTOR) return 80;
            if (role === Role.BUSINESS_HEAD || role === Role.TECH_HEAD || role === Role.QA_HEAD) return 70;
            if (role === Role.QA_MANAGER || role === Role.TECH_MANAGER) return 60;
            if (role === Role.PROJECT_MANAGER) return 50;
            return 0; // Employees
        };

        const matrix: { 
            dept: string, 
            teamResponsible: { names: string[], isError: boolean, isPrimary: boolean, roleName: string },
            roles: any[] 
        }[] = [];

        const depts = Array.from(new Set(fullUsers.map(u => u.department).filter(Boolean)));
        
        depts.forEach(dept => {
            const deptUsers = fullUsers.filter(u => u.department === dept);
            let maxRank = -1;
            deptUsers.forEach(u => {
                const r = getRank(u.role);
                if (r > maxRank) maxRank = r;
            });
            const highestUsers = maxRank > 0 ? deptUsers.filter(u => getRank(u.role) === maxRank) : [];
            let teamResponsibleDisplay = { names: [] as string[], isError: false, isPrimary: false, roleName: '-' };
            if (highestUsers.length > 0) {
                 const primary = highestUsers.find(u => u.isPrimaryApprover);
                 const roleLabel = getRoleName(highestUsers[0].role); 
                 if (primary) {
                     teamResponsibleDisplay = { names: [primary.name], isError: false, isPrimary: true, roleName: getRoleName(primary.role) };
                 } else {
                     teamResponsibleDisplay = { 
                         names: highestUsers.map(u => u.name), 
                         isError: highestUsers.length > 1, 
                         isPrimary: false, 
                         roleName: roleLabel 
                     };
                 }
            } else if (deptUsers.length > 0) {
                 teamResponsibleDisplay = { names: ['未配置负责人'], isError: true, isPrimary: false, roleName: '-' };
            }
            const uniqueRoles = Array.from(new Set(deptUsers.map(u => u.role)));
            const roleDetails = uniqueRoles.map(roleKey => {
                const sampleUser = deptUsers.find(u => u.role === roleKey);
                if (!sampleUser) return null;
                const level = [Role.VP_PRODUCT, Role.VP_TECH, Role.VP_MARKET, Role.PRESIDENT].includes(roleKey as Role) ? OKRLevel.COMPANY : OKRLevel.PERSONAL;
                const dummyOKR: OKR = {
                    id: 'sim', userId: sampleUser.id, userName: sampleUser.name, 
                    level: level, department: dept, title: 'Sim', period: '', 
                    status: OKRStatus.DRAFT, objectives: [], createdAt: ''
                };
                const { l1, l2, l3, cc } = getApproverRoles(dummyOKR);
                const resolveUser = (targetRole: string | Role | null) => {
                    if (!targetRole) return { name: '-', roleLabel: '-', isError: false, isPrimary: false };
                    const roleLabel = getRoleName(targetRole as string);
                    const localCandidates = fullUsers.filter(u => u.department === dept && u.role === targetRole);
                    if (localCandidates.length > 1) {
                        const primary = localCandidates.find(u => u.isPrimaryApprover);
                        if (primary) return { name: primary.name, roleLabel, isError: false, isPrimary: true };
                        return { name: `存在 ${localCandidates.length} 人 (需指定)`, roleLabel, isError: true, isPrimary: false };
                    }
                    if (localCandidates.length === 1) return { name: localCandidates[0].name, roleLabel, isError: false, isPrimary: !!localCandidates[0].isPrimaryApprover };
                    const globalCandidates = fullUsers.filter(u => u.role === targetRole);
                    if (globalCandidates.length > 1) {
                         const primary = globalCandidates.find(u => u.isPrimaryApprover);
                         if (primary) return { name: primary.name, roleLabel, isError: false, isPrimary: true };
                         return { name: `全局 ${globalCandidates.length} 人 (需指定)`, roleLabel, isError: true, isPrimary: false };
                    }
                    if (globalCandidates.length === 1) return { name: globalCandidates[0].name, roleLabel, isError: false, isPrimary: !!globalCandidates[0].isPrimaryApprover };
                    return { name: '未找到人员', roleLabel, isError: true, isPrimary: false };
                };
                const l1Info = resolveUser(l1);
                const l2Info = resolveUser(l2);
                const l3Info = resolveUser(l3);
                let ccNames: string[] = [];
                if (cc && cc.length > 0) {
                    cc.forEach(role => {
                        const targetRole = role as string;
                        const localCCs = deptUsers.filter(u => u.role === targetRole);
                        if (localCCs.length > 0) {
                            ccNames.push(...localCCs.map(u => u.name));
                        }
                    });
                }
                return {
                    roleKey: roleKey as string,
                    roleName: getRoleName(roleKey as string),
                    ccNames: ccNames,
                    l1Name: l1Info.name,
                    l1RoleName: l1Info.roleLabel,
                    l1Error: l1Info.isError,
                    l1IsPrimary: l1Info.isPrimary,
                    l2Name: l2Info.name,
                    l2RoleName: l2Info.roleLabel,
                    l2Error: l2Info.isError,
                    l2IsPrimary: l2Info.isPrimary,
                    l3Name: l3Info.name,
                    l3RoleName: l3Info.roleLabel,
                    l3Error: l3Info.isError,
                    l3IsPrimary: l3Info.isPrimary
                };
            }).filter(Boolean) as any[];
            if (roleDetails.length > 0) {
                matrix.push({ dept, teamResponsible: teamResponsibleDisplay, roles: roleDetails.sort((a,b) => a.roleKey.localeCompare(b.roleKey)) });
            }
        });
        return matrix.sort((a,b) => a.dept.localeCompare(b.dept));
    }, [users, workflows, roleOptions]); 

    // Security Check
    if (!currentUser || currentUser.role !== Role.ADMIN) {
        return <div className="text-center p-10 text-red-500">仅限管理员访问</div>;
    }

    const handleSaveUser = () => {
        const isDepartmentRequired = editUser.role !== Role.ADMIN;
        if (!editUser.name || !editUser.account || (isDepartmentRequired && !editUser.department)) {
            return alert("请填写完整信息 (姓名、账号、部门等)");
        }
        if (!editUser.id && !editUser.password) return alert("请设置初始密码");
        if (editUser.id && showPasswordReset && !editUser.password) return alert("请输入新密码");
        if ((!editUser.id || showPasswordReset) && editUser.password !== confirmPassword) return alert("两次输入的密码不一致，请重新输入");
        
        const newUser: User = {
            id: editUser.id || `u-${Date.now()}`,
            name: editUser.name,
            account: editUser.account,
            password: editUser.password || (editUser.id ? users.find(u => u.id === editUser.id)?.password : '123456'),
            role: editUser.role || Role.RD_EMPLOYEE,
            department: editUser.department || '', 
            avatar: editUser.avatar || `https://ui-avatars.com/api/?name=${editUser.name}&background=random`,
            source: editUser.source || 'LOCAL',
            ssoConnected: editUser.ssoConnected || false,
            isPrimaryApprover: editUser.isPrimaryApprover || false,
        };

        if (newUser.isPrimaryApprover && newUser.department) {
            const allUsers = getUsers();
            const conflictingUsers = allUsers.filter(u => u.department === newUser.department && u.isPrimaryApprover && u.id !== newUser.id);
            conflictingUsers.forEach(u => saveUser({ ...u, isPrimaryApprover: false }));
        }

        saveUser(newUser);
        refreshData();
        setIsEditing(false);
        setEditUser({});
        setConfirmPassword('');
        setShowPasswordReset(false);
    };

    const handleDelete = (id: string) => {
        if (confirm("确定删除该用户吗?")) {
            deleteUser(id);
            refreshData();
        }
    };

    // --- Workflow Handlers ---
    const handleEditWorkflow = (wf: ApprovalWorkflow) => {
        setEditingRole(wf.targetRole);
        setTempWorkflow({...wf, ccRoles: wf.ccRoles || []});
    };

    const handleSaveWorkflow = () => {
        if (tempWorkflow) {
            saveWorkflow(tempWorkflow);
            setWorkflows(getWorkflows());
            setEditingRole(null);
            setTempWorkflow(null);
            setIsAddingWorkflow(false);
            setNewWorkflowRole('');
        }
    };

    const handleDeleteWorkflow = (roleKey: string) => {
        if(confirm(`确认删除角色 "${getRoleName(roleKey)}" 的审批流配置吗？`)) {
            deleteWorkflow(roleKey);
            refreshData();
        }
    }

    const handleStartAddWorkflow = () => {
        setIsAddingWorkflow(true);
        // Find first available role that doesn't have a workflow
        const usedRoles = workflows.map(w => w.targetRole);
        const available = roleOptions.filter(r => !usedRoles.includes(r.value));
        const defaultRole = available.length > 0 ? available[0].value : '';
        
        setNewWorkflowRole(defaultRole);
        setTempWorkflow({
            targetRole: defaultRole,
            ccRoles: [],
            approverRoleL1: '',
            approverRoleL2: null
        });
    };

    const addCCRole = (newRole: string) => {
        if (!tempWorkflow) return;
        const currentCC = tempWorkflow.ccRoles || [];
        if (!currentCC.includes(newRole)) {
            setTempWorkflow({ ...tempWorkflow, ccRoles: [...currentCC, newRole] });
        }
    }

    const removeCCRole = (roleToRemove: string) => {
        if (!tempWorkflow) return;
        const currentCC = tempWorkflow.ccRoles || [];
        setTempWorkflow({ ...tempWorkflow, ccRoles: currentCC.filter(r => r !== roleToRemove) });
    }

    // --- Dynamic Add Handlers ---
    const handleAddDepartment = () => {
        if(!newItemName.trim()) return;
        addDepartment(newItemName);
        refreshData();
        setConfigModal(null);
        setNewItemName('');
    }

    // Custom Roles Management
    const handleAddRole = () => {
        if(!newItemName.trim() || !newItemKey.trim()) return;
        addRole(newItemKey, newItemName);
        refreshData();
        setNewItemName('');
        setNewItemKey('');
    }

    const handleUpdateCustomRole = (key: string) => {
        if (!editingCustomRoleLabel.trim()) return;
        updateCustomRole(key, editingCustomRoleLabel);
        refreshData();
        setEditingCustomRoleKey(null);
    }
    
    const handleDeleteCustomRole = (key: string) => {
        if(confirm(`确认彻底删除角色 "${getRoleName(key)}" 吗？\n警告：这将同时删除该角色的所有审批流配置。`)) {
            deleteCustomRole(key);
            refreshData();
        }
    }

    // --- Integration Handlers ---
    const openConfigModal = (type: 'WECOM' | 'SSO') => {
        if (type === 'WECOM') {
            setTempWeCom(getWeComConfig());
        } else {
            setTempSSO(getSSOConfig());
        }
        setConfigModal(type);
    }

    const handleSaveWeCom = () => {
        saveWeComConfig(tempWeCom);
        setWecomConfig(tempWeCom);
        setConfigModal(null);
        alert("企业微信配置已保存！");
    };

    const handleSaveSSO = () => {
        saveSSOConfig(tempSSO);
        setSSOConfig(tempSSO);
        setConfigModal(null);
        alert("SSO 配置已保存！");
    };
    
    // Filter Logic
    const filteredUsers = users.filter(u => {
        const matchesDept = selectedDept ? u.department === selectedDept : true;
        const matchesSearch = u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                              u.department?.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesDept && matchesSearch;
    });

    // Available roles for new workflow
    const availableRolesForWorkflow = roleOptions.filter(r => !workflows.find(w => w.targetRole === r.value));

    // Custom Roles Filter
    const customRolesList = roleOptions.filter(r => !isBuiltInRole(r.value));

    return (
        <div className="space-y-6 animate-in fade-in duration-300 h-[calc(100vh-100px)] flex flex-col">
            <h1 className="text-2xl font-bold text-slate-900 flex-shrink-0">用户与集成管理</h1>
            
            <div className="flex gap-4 border-b border-slate-200 overflow-x-auto flex-shrink-0">
                <button 
                    onClick={() => setActiveTab('users')}
                    className={`pb-3 px-2 font-medium text-sm transition-colors relative whitespace-nowrap ${activeTab === 'users' ? 'text-brand-600' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    用户管理
                    {activeTab === 'users' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-brand-600"></div>}
                </button>
                <button 
                    onClick={() => setActiveTab('workflows')}
                    className={`pb-3 px-2 font-medium text-sm transition-colors relative whitespace-nowrap ${activeTab === 'workflows' ? 'text-brand-600' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    审批流配置
                    {activeTab === 'workflows' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-brand-600"></div>}
                </button>
                <button 
                    onClick={() => setActiveTab('approvers')}
                    className={`pb-3 px-2 font-medium text-sm transition-colors relative whitespace-nowrap ${activeTab === 'approvers' ? 'text-brand-600' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    团队审批人查询
                    {activeTab === 'approvers' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-brand-600"></div>}
                </button>
                <button 
                     onClick={() => setActiveTab('integrations')}
                    className={`pb-3 px-2 font-medium text-sm transition-colors relative whitespace-nowrap ${activeTab === 'integrations' ? 'text-brand-600' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    第三方集成
                    {activeTab === 'integrations' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-brand-600"></div>}
                </button>
            </div>

            {/* ... (Users Tab - unchanged) ... */}
            {activeTab === 'users' && (
                <div className="flex gap-6 flex-1 min-h-0">
                    {/* Left Sidebar: Organization Tree */}
                    <div className="w-64 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden flex-shrink-0">
                        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                            <h3 className="font-bold text-slate-700 flex items-center gap-2 text-sm">
                                <Layers size={16} /> 组织架构
                            </h3>
                            <button 
                                onClick={() => setConfigModal('ADD_DEPT')}
                                className="text-brand-600 hover:bg-brand-50 p-1 rounded transition-colors"
                                title="新增部门"
                            >
                                <Plus size={16}/>
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
                            <button 
                                onClick={() => setSelectedDept(null)}
                                className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors ${
                                    selectedDept === null 
                                    ? 'bg-brand-50 text-brand-700 font-medium' 
                                    : 'text-slate-600 hover:bg-slate-50'
                                }`}
                            >
                                <Building size={16} className={selectedDept === null ? 'text-brand-500' : 'text-slate-400'} />
                                全部
                                <span className="ml-auto text-xs text-slate-400">{users.length}</span>
                            </button>
                            
                            <div className="my-2 border-t border-slate-100 mx-2"></div>
                            
                            {departments.map(dept => {
                                const count = users.filter(u => u.department === dept).length;
                                return (
                                    <button 
                                        key={dept}
                                        onClick={() => setSelectedDept(dept)}
                                        className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors ${
                                            selectedDept === dept 
                                            ? 'bg-brand-50 text-brand-700 font-medium' 
                                            : 'text-slate-600 hover:bg-slate-50'
                                        }`}
                                    >
                                        <div className={`w-1.5 h-1.5 rounded-full ${selectedDept === dept ? 'bg-brand-500' : 'bg-slate-300'}`}></div>
                                        <span className="truncate flex-1">{dept}</span>
                                        <span className="text-xs text-slate-400 bg-slate-100 px-1.5 rounded-full">{count}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Right Content: User Table */}
                    <div className="flex-1 flex flex-col min-h-0 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-white">
                            <div className="flex items-center gap-2">
                                <h2 className="font-bold text-slate-800">{selectedDept || '所有用户'}</h2>
                                <span className="text-sm text-slate-500 bg-slate-100 px-2 rounded-full">{filteredUsers.length} 人</span>
                            </div>
                            <div className="flex gap-3">
                                <div className="relative">
                                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input 
                                        className="pl-9 pr-4 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-100 focus:border-brand-300 w-48" 
                                        placeholder="搜索姓名..."
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                    />
                                </div>
                                <button 
                                    onClick={() => { 
                                        setIsEditing(true); 
                                        setShowPasswordReset(false);
                                        setConfirmPassword('');
                                        // Pre-select current department filter if active
                                        setEditUser({ 
                                            role: Role.RD_EMPLOYEE, 
                                            source: 'LOCAL', 
                                            department: selectedDept || departments[0] 
                                        }); 
                                    }}
                                    className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 hover:bg-brand-700 transition-colors shadow-sm"
                                >
                                    <Plus size={16} /> 新增成员
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200 sticky top-0 z-10">
                                    <tr>
                                        <th className="p-4">用户</th>
                                        <th className="p-4">账号 (登录名)</th>
                                        <th className="p-4">部门/业务线</th>
                                        <th className="p-4">角色</th>
                                        <th className="p-4 text-right">操作</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredUsers.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="p-10 text-center text-slate-400">
                                                暂无符合条件的用户
                                            </td>
                                        </tr>
                                    )}
                                    {filteredUsers.map(u => (
                                        <tr key={u.id} className="hover:bg-slate-50 transition-colors group">
                                            <td className="p-4 flex items-center gap-3">
                                                <img src={u.avatar} className="w-8 h-8 rounded-full bg-slate-200" alt="" />
                                                <div>
                                                    <div className="font-medium text-slate-800 flex items-center gap-1">
                                                        {u.name}
                                                        {u.isPrimaryApprover && (
                                                            <Crown size={12} className="text-amber-500 fill-amber-500" title="该团队第一责任人 (审批负责人)" />
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4 text-slate-600 font-mono text-xs">
                                                <div className="flex items-center gap-1">
                                                    <Lock size={12} className="text-slate-400"/> {u.account}
                                                </div>
                                            </td>
                                            <td className="p-4 text-slate-600">{u.department || '-'}</td>
                                            <td className="p-4">
                                                <span className={`px-2 py-1 rounded text-xs font-bold border ${
                                                    (u.role as string).includes('HEAD') || (u.role as string).includes('GM') || (u.role as string).includes('PRESIDENT') || (u.role as string).includes('VP')
                                                    ? 'bg-purple-50 text-purple-700 border-purple-100'
                                                    : 'bg-slate-50 text-slate-600 border-slate-100'
                                                }`}>
                                                    {getRoleName(u.role)}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button 
                                                    onClick={() => { setIsEditing(true); setEditUser(u); setShowPasswordReset(false); setConfirmPassword(''); }}
                                                    className="text-brand-600 hover:bg-brand-50 p-1.5 rounded transition-colors"
                                                    title="编辑"
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                <button 
                                                    onClick={() => handleDelete(u.id)}
                                                    className="text-red-500 hover:bg-red-50 p-1.5 rounded transition-colors"
                                                    title="删除"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* --- Workflows Tab --- */}
            {activeTab === 'workflows' && (
                <div>
                     <div className="flex flex-col gap-2 mb-4">
                         <div className="flex justify-between items-center">
                             <h2 className="text-lg font-bold text-slate-800">审批流配置</h2>
                             <div className="flex gap-2">
                                <button 
                                    onClick={() => setConfigModal('MANAGE_ROLES')}
                                    className="bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 px-3 py-1.5 rounded-lg text-sm flex items-center gap-2 shadow-sm"
                                >
                                    <Settings size={16}/> 管理自定义角色
                                </button>
                                <button 
                                    onClick={handleStartAddWorkflow}
                                    className="bg-brand-600 text-white hover:bg-brand-700 px-3 py-1.5 rounded-lg text-sm flex items-center gap-2 shadow-sm"
                                >
                                    <Plus size={16}/> 新增审批流
                                </button>
                             </div>
                         </div>
                        <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg text-sm text-blue-800">
                             <strong>注意：系统采用矩阵式审批逻辑 (业务线 vs 职能线)</strong><br/>
                             下表为角色默认审批流。若员工属于“业务线”，系统会自动将一级审批路由至该线的业务/研发负责人。<br/>
                             未配置审批流的角色将使用默认回退逻辑。
                        </div>
                    </div>
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                                <tr>
                                    <th className="p-4">申请人角色</th>
                                    <th className="p-4 w-64">邀请协作人员 (可多选)</th>
                                    <th className="p-4">一级审批 (初审)</th>
                                    <th className="p-4">二级审批</th>
                                    <th className="p-4">三级审批 (可选)</th>
                                    <th className="p-4 text-right">操作</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {/* Create New Row Inline */}
                                {isAddingWorkflow && (
                                     <tr className="bg-brand-50/30">
                                        <td className="p-4">
                                            <select 
                                                className="border rounded p-1.5 w-full outline-none focus:ring-1 focus:ring-brand-500"
                                                value={tempWorkflow?.targetRole}
                                                onChange={e => setTempWorkflow(prev => prev ? {...prev, targetRole: e.target.value as Role} : null)}
                                            >
                                                {availableRolesForWorkflow.map(role => (
                                                    <option key={role.value} value={role.value}>{role.label}</option>
                                                ))}
                                                {availableRolesForWorkflow.length === 0 && <option value="">无可用角色</option>}
                                            </select>
                                        </td>
                                        <td className="p-4">
                                             <div className="flex flex-col gap-2">
                                                <div className="flex flex-wrap gap-1 mb-1">
                                                    {tempWorkflow?.ccRoles?.map(role => (
                                                        <span key={role as string} className="flex items-center gap-1 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded text-xs text-blue-700">
                                                            {getRoleName(role as string)}
                                                            <button onClick={() => removeCCRole(role as string)}><X size={10} /></button>
                                                        </span>
                                                    ))}
                                                </div>
                                                <select 
                                                    className="border rounded p-1 text-xs w-full outline-none focus:ring-1 focus:ring-brand-500"
                                                    value=""
                                                    onChange={e => addCCRole(e.target.value)}
                                                >
                                                    <option value="">+ 添加协作角色</option>
                                                    {roleOptions.filter(r => !tempWorkflow?.ccRoles?.includes(r.value)).map(role => (
                                                        <option key={role.value} value={role.value}>{role.label}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                             <select 
                                                className="border rounded p-1.5 w-full outline-none focus:ring-1 focus:ring-brand-500"
                                                value={tempWorkflow?.approverRoleL1}
                                                onChange={e => setTempWorkflow(prev => prev ? {...prev, approverRoleL1: e.target.value as Role} : null)}
                                            >
                                                 <option value="">请选择...</option>
                                                 {roleOptions.map(role => (
                                                    <option key={role.value} value={role.value}>{role.label}</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className="p-4">
                                            <select 
                                                className="border rounded p-1.5 w-full outline-none focus:ring-1 focus:ring-brand-500"
                                                value={tempWorkflow?.approverRoleL2 || ''}
                                                onChange={e => setTempWorkflow(prev => prev ? {...prev, approverRoleL2: e.target.value === '' ? null : e.target.value as Role} : null)}
                                            >
                                                 <option value="">(无)</option>
                                                 {roleOptions.map(role => (
                                                    <option key={role.value} value={role.value}>{role.label}</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className="p-4">
                                             <select 
                                                className="border rounded p-1.5 w-full outline-none focus:ring-1 focus:ring-brand-500"
                                                value={tempWorkflow?.approverRoleL3 || ''}
                                                onChange={e => setTempWorkflow(prev => prev ? {...prev, approverRoleL3: e.target.value === '' ? null : e.target.value as Role} : null)}
                                            >
                                                 <option value="">(无)</option>
                                                 {roleOptions.map(role => (
                                                    <option key={role.value} value={role.value}>{role.label}</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className="p-4 text-right space-x-2">
                                            <button onClick={handleSaveWorkflow} className="text-green-600 hover:bg-green-50 p-1.5 rounded bg-green-50/50 border border-green-200">
                                                <Save size={16} />
                                            </button>
                                            <button onClick={() => { setIsAddingWorkflow(false); setTempWorkflow(null); }} className="text-slate-400 hover:bg-slate-100 p-1.5 rounded">
                                                <X size={16} />
                                            </button>
                                        </td>
                                     </tr>
                                )}

                                {workflows.map(wf => (
                                    <tr key={wf.targetRole} className="hover:bg-slate-50">
                                        <td className="p-4 font-medium text-slate-800 flex items-center gap-2">
                                            <div className="bg-slate-100 p-1.5 rounded text-slate-500">
                                                <UserIcon size={14}/>
                                            </div>
                                            {getRoleName(wf.targetRole)}
                                        </td>
                                        <td className="p-4 max-w-xs">
                                            {editingRole === wf.targetRole ? (
                                                <div className="flex flex-col gap-2">
                                                    <div className="flex flex-wrap gap-1 mb-1">
                                                        {tempWorkflow?.ccRoles?.map(role => (
                                                            <span key={role as string} className="flex items-center gap-1 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded text-xs text-blue-700">
                                                                {getRoleName(role as string)}
                                                                <button 
                                                                    onClick={() => removeCCRole(role as string)}
                                                                    className="hover:text-blue-900"
                                                                >
                                                                    <X size={10} />
                                                                </button>
                                                            </span>
                                                        ))}
                                                    </div>
                                                    <select 
                                                        className="border rounded p-1 text-xs w-full outline-none focus:ring-1 focus:ring-brand-500"
                                                        value=""
                                                        onChange={e => addCCRole(e.target.value)}
                                                    >
                                                        <option value="">+ 添加协作角色</option>
                                                        {roleOptions.filter(r => !tempWorkflow?.ccRoles?.includes(r.value)).map(role => (
                                                            <option key={role.value} value={role.value}>{role.label}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            ) : (
                                                wf.ccRoles && wf.ccRoles.length > 0 ? (
                                                    <div className="flex flex-wrap gap-1">
                                                        {wf.ccRoles.map((role, i) => (
                                                            <span key={i} className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded text-xs text-slate-600">
                                                                <Send size={10}/> {getRoleName(role as string)}
                                                            </span>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-400 text-xs italic">--</span>
                                                )
                                            )}
                                        </td>
                                        <td className="p-4">
                                            {editingRole === wf.targetRole ? (
                                                <select 
                                                    className="border rounded p-1 max-w-[150px] outline-none focus:ring-1 focus:ring-brand-500"
                                                    value={tempWorkflow?.approverRoleL1}
                                                    onChange={e => setTempWorkflow(prev => prev ? {...prev, approverRoleL1: e.target.value as Role} : null)}
                                                >
                                                     {roleOptions.map(role => (
                                                        <option key={role.value} value={role.value}>{role.label}</option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold">1</div>
                                                    <span className="text-slate-700">{getRoleName(wf.approverRoleL1)}</span>
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-4">
                                            {editingRole === wf.targetRole ? (
                                                <select 
                                                    className="border rounded p-1 max-w-[150px] outline-none focus:ring-1 focus:ring-brand-500"
                                                    value={tempWorkflow?.approverRoleL2 || ''}
                                                    onChange={e => setTempWorkflow(prev => prev ? {...prev, approverRoleL2: e.target.value === '' ? null : e.target.value as Role} : null)}
                                                >
                                                     <option value="">(无 - 无需二级审批)</option>
                                                     {roleOptions.map(role => (
                                                        <option key={role.value} value={role.value}>{role.label}</option>
                                                    ))}
                                                </select>
                                            ) : (
                                                wf.approverRoleL2 ? (
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-6 h-6 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-xs font-bold">2</div>
                                                        <span className="text-slate-700">{getRoleName(wf.approverRoleL2)}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-400 text-xs italic">--</span>
                                                )
                                            )}
                                        </td>
                                        <td className="p-4">
                                            {editingRole === wf.targetRole ? (
                                                <select 
                                                    className="border rounded p-1 max-w-[150px] outline-none focus:ring-1 focus:ring-brand-500"
                                                    value={tempWorkflow?.approverRoleL3 || ''}
                                                    onChange={e => setTempWorkflow(prev => prev ? {...prev, approverRoleL3: e.target.value === '' ? null : e.target.value as Role} : null)}
                                                >
                                                     <option value="">(无)</option>
                                                     {roleOptions.map(role => (
                                                        <option key={role.value} value={role.value}>{role.label}</option>
                                                    ))}
                                                </select>
                                            ) : (
                                                wf.approverRoleL3 ? (
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-6 h-6 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center text-xs font-bold">3</div>
                                                        <span className="text-slate-700">{getRoleName(wf.approverRoleL3)}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-400 text-xs italic">--</span>
                                                )
                                            )}
                                        </td>
                                        <td className="p-4 text-right space-x-2">
                                            {editingRole === wf.targetRole ? (
                                                <button onClick={handleSaveWorkflow} className="text-green-600 hover:bg-green-50 p-1.5 rounded bg-green-50/50 border border-green-200">
                                                    <Save size={16} />
                                                </button>
                                            ) : (
                                                <>
                                                    <button onClick={() => handleEditWorkflow(wf)} className="text-brand-600 hover:bg-brand-50 p-1.5 rounded">
                                                        <Edit2 size={16} />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDeleteWorkflow(wf.targetRole)} 
                                                        className="text-red-500 hover:bg-red-50 p-1.5 rounded"
                                                        title="删除此审批流配置"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'approvers' && (
                <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
                    <div className="bg-amber-50 border border-amber-100 p-4 rounded-lg text-sm text-amber-800 flex items-start gap-3">
                        <GitMerge size={20} className="mt-0.5 flex-shrink-0"/>
                        <div>
                            <strong>审批关系预览说明：</strong>
                            <p className="mt-1 opacity-90">
                                下表根据当前[用户列表]和[审批流配置]自动生成。系统会根据部门和角色，智能匹配该团队实际的一级和二级审批人。<br/>
                                “团队第一负责人”列会自动识别该团队/部门职级最高的人员（如经理、总监）。<br/>
                                <strong>如果一个部门内存在多名相同角色的管理者（如两名研发负责人），系统会提示您需指定其中一人为“第一责任人”。</strong>
                            </p>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col">
                        <div className="overflow-y-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                                    <tr>
                                        <th className="p-4">部门 / 团队</th>
                                        <th className="p-4 text-brand-700 bg-brand-50">团队第一负责人</th>
                                        <th className="p-4">人员角色</th>
                                        <th className="p-4 text-slate-700 bg-slate-100">邀请协作人员</th>
                                        <th className="p-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold">1</div>
                                                一级审批 (初审)
                                            </div>
                                        </th>
                                        <th className="p-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-5 h-5 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-xs font-bold">2</div>
                                                二级审批 (复审)
                                            </div>
                                        </th>
                                        <th className="p-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-5 h-5 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center text-xs font-bold">3</div>
                                                三级审批 (终审)
                                            </div>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {approvalMatrix.map((deptGroup, deptIdx) => (
                                        <React.Fragment key={deptGroup.dept}>
                                            {deptGroup.roles.map((roleRow, roleIdx) => (
                                                <tr key={`${deptGroup.dept}-${roleRow.roleKey}`} className="hover:bg-slate-50 transition-colors">
                                                    {/* Rowspan for Dept Name & Team Responsible (Since it's Dept level usually) */}
                                                    {roleIdx === 0 && (
                                                        <>
                                                            <td 
                                                                className="p-4 font-bold text-slate-800 align-top border-r border-slate-100 bg-slate-50/30" 
                                                                rowSpan={deptGroup.roles.length}
                                                            >
                                                                <div className="sticky top-16">
                                                                    <div className="font-bold text-slate-800">{deptGroup.dept}</div>
                                                                </div>
                                                            </td>
                                                            
                                                            <td 
                                                                className="p-4 bg-brand-50/30 align-top border-r border-slate-100" 
                                                                rowSpan={deptGroup.roles.length}
                                                            >
                                                                <div className="sticky top-16 flex flex-col gap-1">
                                                                    {deptGroup.teamResponsible.names.map((name, i) => (
                                                                        <span key={i} className={`font-bold flex items-center gap-1 ${deptGroup.teamResponsible.isError ? 'text-red-500' : 'text-slate-800'}`}>
                                                                            {deptGroup.teamResponsible.isPrimary && <Crown size={12} className="text-amber-500 fill-amber-500 flex-shrink-0" />}
                                                                            {name}
                                                                        </span>
                                                                    ))}
                                                                    {deptGroup.teamResponsible.isError && (
                                                                        <div className="flex items-center gap-1 text-xs text-red-500 bg-red-50 p-1 rounded border border-red-100">
                                                                            <AlertTriangle size={10} /> 需指定主责
                                                                        </div>
                                                                    )}
                                                                    <span className="text-xs text-slate-400 mt-1">
                                                                        {deptGroup.teamResponsible.roleName}
                                                                    </span>
                                                                </div>
                                                            </td>
                                                        </>
                                                    )}
                                                    
                                                    <td className="p-4">
                                                        <div className="inline-flex items-center px-2 py-1 bg-white border border-slate-200 rounded text-slate-600 text-xs font-medium">
                                                            {roleRow.roleName}
                                                        </div>
                                                    </td>

                                                    <td className="p-4 bg-slate-50/50">
                                                        {roleRow.ccNames.length > 0 ? (
                                                            <div className="flex flex-wrap gap-1">
                                                                {roleRow.ccNames.map((name, i) => (
                                                                    <div key={i} className="flex items-center gap-1 bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-600 font-medium text-xs">
                                                                        <Send size={10}/> {name}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : <span className="text-slate-300 text-xs">-</span>}
                                                    </td>
                                                    
                                                    <td className="p-4">
                                                        <div className="flex flex-col">
                                                            <span className={`font-bold flex items-center gap-1 ${roleRow.l1Name === '未找到人员' || roleRow.l1Error ? 'text-red-500' : 'text-slate-800'}`}>
                                                                {roleRow.l1Error && <AlertTriangle size={14} className="flex-shrink-0" />}
                                                                {roleRow.l1Name}
                                                                {roleRow.l1IsPrimary && <Crown size={12} className="text-amber-500 fill-amber-500" />}
                                                            </span>
                                                            <span className="text-xs text-slate-400 flex items-center gap-1">
                                                                {roleRow.l1RoleName}
                                                                {roleRow.l1IsPrimary && <span className="text-amber-600 bg-amber-50 px-1.5 rounded text-[10px] border border-amber-100">(团队第一负责人)</span>}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    
                                                    <td className="p-4">
                                                        <div className="flex flex-col">
                                                            <span className={`font-bold flex items-center gap-1 ${roleRow.l2Name === '未找到人员' && roleRow.l2RoleName !== '-' || roleRow.l2Error ? 'text-red-500' : 'text-slate-800'}`}>
                                                                {roleRow.l2Error && <AlertTriangle size={14} className="flex-shrink-0" />}
                                                                {roleRow.l2Name}
                                                                {roleRow.l2IsPrimary && <Crown size={12} className="text-amber-500 fill-amber-500" />}
                                                            </span>
                                                            <span className="text-xs text-slate-400 flex items-center gap-1">
                                                                {roleRow.l2RoleName}
                                                                {roleRow.l2IsPrimary && <span className="text-amber-600 bg-amber-50 px-1.5 rounded text-[10px] border border-amber-100">(团队第一负责人)</span>}
                                                            </span>
                                                        </div>
                                                    </td>

                                                    <td className="p-4">
                                                        <div className="flex flex-col">
                                                            <span className={`font-bold flex items-center gap-1 ${roleRow.l3Name === '未找到人员' && roleRow.l3RoleName !== '-' || roleRow.l3Error ? 'text-red-500' : 'text-slate-800'}`}>
                                                                {roleRow.l3Error && <AlertTriangle size={14} className="flex-shrink-0" />}
                                                                {roleRow.l3Name}
                                                                {roleRow.l3IsPrimary && <Crown size={12} className="text-amber-500 fill-amber-500" />}
                                                            </span>
                                                            <span className="text-xs text-slate-400 flex items-center gap-1">
                                                                {roleRow.l3RoleName}
                                                                {roleRow.l3IsPrimary && <span className="text-amber-600 bg-amber-50 px-1.5 rounded text-[10px] border border-amber-100">(团队第一负责人)</span>}
                                                            </span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                            {/* Divider between departments */}
                                            {deptIdx < approvalMatrix.length - 1 && (
                                                <tr><td colSpan={7} className="bg-slate-100 h-1 p-0"></td></tr>
                                            )}
                                        </React.Fragment>
                                    ))}
                                    {approvalMatrix.length === 0 && (
                                        <tr><td colSpan={7} className="p-10 text-center text-slate-400">暂无数据</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* ... Modal Code ... */}
            {isEditing && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    {/* ... (User Edit Modal Content Unchanged) ... */}
                    <div className="bg-white rounded-xl shadow-2xl w-[500px] overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="font-bold text-lg">{editUser.id ? '编辑用户' : '新增用户'}</h3>
                            <button onClick={() => { setIsEditing(false); setEditUser({}); setShowPasswordReset(false); setConfirmPassword(''); }} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">姓名 <span className="text-red-500">*</span></label>
                                <input 
                                    className="w-full p-2 border rounded focus:ring-2 focus:ring-brand-500 outline-none"
                                    value={editUser.name || ''}
                                    onChange={e => setEditUser({...editUser, name: e.target.value})}
                                />
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">登录账号 <span className="text-red-500">*</span></label>
                                <div className="relative">
                                    <UserIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input 
                                        className="w-full pl-9 p-2 border rounded focus:ring-2 focus:ring-brand-500 outline-none bg-white"
                                        value={editUser.account || ''}
                                        onChange={e => setEditUser({...editUser, account: e.target.value})}
                                        placeholder="例如：wangxiaogong"
                                    />
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">密码 <span className="text-red-500">*</span></label>
                                {!editUser.id || showPasswordReset ? (
                                    <div className="space-y-3">
                                        <div className="relative">
                                             <Key size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                             <input 
                                                type="password"
                                                className="w-full pl-9 p-2 border rounded focus:ring-2 focus:ring-brand-500 outline-none"
                                                value={editUser.password || ''}
                                                onChange={e => setEditUser({...editUser, password: e.target.value})}
                                                placeholder="设置登录密码"
                                            />
                                        </div>
                                        <div className="relative">
                                             <Key size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                             <input 
                                                type="password"
                                                className="w-full pl-9 p-2 border rounded focus:ring-2 focus:ring-brand-500 outline-none"
                                                value={confirmPassword}
                                                onChange={e => setConfirmPassword(e.target.value)}
                                                placeholder="确认密码"
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-between p-2 border rounded bg-slate-50">
                                        <span className="text-slate-500 flex items-center gap-2"><Lock size={14} /> 密码已设置</span>
                                        <button 
                                            onClick={() => setShowPasswordReset(true)}
                                            className="text-xs text-brand-600 hover:underline"
                                        >
                                            重置密码
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">角色 <span className="text-red-500">*</span></label>
                                <select 
                                    className="w-full p-2 border rounded focus:ring-2 focus:ring-brand-500 outline-none bg-white"
                                    value={editUser.role || Role.RD_EMPLOYEE}
                                    onChange={e => setEditUser({...editUser, role: e.target.value})}
                                >
                                    {roleOptions.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">部门/业务线 {editUser.role !== Role.ADMIN && <span className="text-red-500">*</span>}</label>
                                <select 
                                    className="w-full p-2 border rounded focus:ring-2 focus:ring-brand-500 outline-none bg-white"
                                    value={editUser.department || ''}
                                    onChange={e => setEditUser({...editUser, department: e.target.value})}
                                >
                                    <option value="">请选择...</option>
                                    {departments.map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                                <p className="text-xs text-slate-500 mt-1">支持将任何角色分配至任意业务线。</p>
                            </div>

                            {/* Primary Responsibility Flag */}
                            <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg border border-amber-100">
                                <input 
                                    type="checkbox" 
                                    id="isPrimary"
                                    className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500 border-gray-300 mt-0.5 cursor-pointer"
                                    checked={editUser.isPrimaryApprover || false}
                                    onChange={e => setEditUser({...editUser, isPrimaryApprover: e.target.checked})}
                                />
                                <label htmlFor="isPrimary" className="text-sm text-slate-700 cursor-pointer">
                                    <span className="flex items-center gap-1 font-medium text-amber-800 mb-0.5">
                                        <Crown size={14} className="text-amber-500 fill-amber-500"/>
                                        设为该角色/部门的第一责任人
                                    </span>
                                    <span className="text-xs text-slate-500 block">
                                        当部门内存在多名相同角色（如多位研发负责人）时，勾选此项的人员将被系统识别为主要的审批流负责人。
                                    </span>
                                </label>
                            </div>
                        </div>
                        <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                            <button onClick={() => { setIsEditing(false); setEditUser({}); setShowPasswordReset(false); setConfirmPassword(''); }} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded">取消</button>
                            <button onClick={handleSaveUser} className="px-6 py-2 bg-brand-600 text-white rounded hover:bg-brand-700">保存</button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Config & Add Modals */}
            {configModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl w-[500px] overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="font-bold text-lg">
                                {configModal === 'WECOM' && '配置企业微信'}
                                {configModal === 'SSO' && '配置 SSO 登录'}
                                {configModal === 'ADD_DEPT' && '新增部门'}
                                {configModal === 'MANAGE_ROLES' && '管理自定义角色'}
                            </h3>
                            <button onClick={() => { setConfigModal(null); setEditingCustomRoleKey(null); }} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
                        </div>
                        
                        <div className="p-6">
                            {configModal === 'WECOM' && (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Corp ID (企业ID)</label>
                                        <input 
                                            className="w-full p-2 border rounded focus:ring-2 focus:ring-green-500 outline-none" 
                                            value={tempWeCom.corpId}
                                            onChange={e => setTempWeCom({...tempWeCom, corpId: e.target.value})}
                                            placeholder="wwd08c8..." 
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Agent ID (应用ID)</label>
                                        <input 
                                            className="w-full p-2 border rounded focus:ring-2 focus:ring-green-500 outline-none" 
                                            value={tempWeCom.agentId}
                                            onChange={e => setTempWeCom({...tempWeCom, agentId: e.target.value})}
                                            placeholder="100001" 
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Agent Secret (应用密钥)</label>
                                        <input 
                                            type="password" 
                                            className="w-full p-2 border rounded focus:ring-2 focus:ring-green-500 outline-none" 
                                            value={tempWeCom.secret}
                                            onChange={e => setTempWeCom({...tempWeCom, secret: e.target.value})}
                                            placeholder="输入 Secret..." 
                                        />
                                    </div>
                                </div>
                            )}
                            
                            {configModal === 'SSO' && (
                                <div className="space-y-4">
                                    <div className="p-3 bg-blue-50 text-blue-800 rounded text-sm mb-4">
                                        配置 OIDC/SAML 服务提供商信息。
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Metadata / Issuer URL</label>
                                        <input 
                                            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none" 
                                            value={tempSSO.metadataUrl}
                                            onChange={e => setTempSSO({...tempSSO, metadataUrl: e.target.value})}
                                            placeholder="https://idp.example.com/..." 
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Client ID</label>
                                        <input 
                                            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none" 
                                            value={tempSSO.clientId}
                                            onChange={e => setTempSSO({...tempSSO, clientId: e.target.value})}
                                            placeholder="client-id-..." 
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Client Secret</label>
                                        <input 
                                            type="password"
                                            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none" 
                                            value={tempSSO.clientSecret}
                                            onChange={e => setTempSSO({...tempSSO, clientSecret: e.target.value})}
                                            placeholder="client-secret-..." 
                                        />
                                    </div>
                                </div>
                            )}

                            {configModal === 'ADD_DEPT' && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">部门名称</label>
                                    <input 
                                        className="w-full p-2 border rounded focus:ring-2 focus:ring-brand-500 outline-none" 
                                        placeholder="例如：市场部"
                                        value={newItemName}
                                        onChange={e => setNewItemName(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                            )}

                             {configModal === 'MANAGE_ROLES' && (
                                <div className="space-y-6">
                                    {/* Add New Role */}
                                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                                        <h4 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2"><Plus size={14}/> 新增角色</h4>
                                        <div className="space-y-3">
                                            <div>
                                                <input 
                                                    className="w-full p-2 text-sm border rounded outline-none focus:ring-1 focus:ring-brand-500" 
                                                    placeholder="角色名称 (如：高级架构师)"
                                                    value={newItemName}
                                                    onChange={e => setNewItemName(e.target.value)}
                                                />
                                            </div>
                                            <div>
                                                <input 
                                                    className="w-full p-2 text-sm border rounded outline-none focus:ring-1 focus:ring-brand-500 uppercase font-mono" 
                                                    placeholder="角色KEY (如：ARCHITECT)"
                                                    value={newItemKey}
                                                    onChange={e => setNewItemKey(e.target.value.toUpperCase())}
                                                />
                                            </div>
                                            <button 
                                                onClick={handleAddRole}
                                                disabled={!newItemName.trim() || !newItemKey.trim()}
                                                className="w-full bg-brand-600 text-white py-1.5 rounded text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
                                            >
                                                添加角色
                                            </button>
                                        </div>
                                    </div>

                                    {/* List Custom Roles */}
                                    <div>
                                        <h4 className="text-sm font-bold text-slate-700 mb-3">自定义角色列表</h4>
                                        <div className="max-h-60 overflow-y-auto space-y-2">
                                            {customRolesList.length === 0 && <div className="text-center text-xs text-slate-400 py-4">暂无自定义角色</div>}
                                            {customRolesList.map(r => (
                                                <div key={r.value} className="flex items-center justify-between p-2 border rounded text-sm group hover:bg-slate-50">
                                                    {editingCustomRoleKey === r.value ? (
                                                        <div className="flex-1 flex gap-2 mr-2">
                                                            <input 
                                                                className="flex-1 p-1 text-xs border rounded outline-none"
                                                                value={editingCustomRoleLabel}
                                                                onChange={e => setEditingCustomRoleLabel(e.target.value)}
                                                                autoFocus
                                                            />
                                                            <button onClick={() => handleUpdateCustomRole(r.value)} className="text-green-600 hover:bg-green-100 p-1 rounded"><Check size={14}/></button>
                                                            <button onClick={() => setEditingCustomRoleKey(null)} className="text-slate-400 hover:bg-slate-100 p-1 rounded"><X size={14}/></button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex-1">
                                                            <span className="font-medium text-slate-700">{r.label}</span>
                                                            <span className="text-xs text-slate-400 ml-2 font-mono">{r.value}</span>
                                                        </div>
                                                    )}
                                                    
                                                    {!editingCustomRoleKey && (
                                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button onClick={() => { setEditingCustomRoleKey(r.value); setEditingCustomRoleLabel(r.label); }} className="text-brand-600 hover:bg-brand-50 p-1 rounded"><Edit2 size={14}/></button>
                                                            <button onClick={() => handleDeleteCustomRole(r.value)} className="text-red-500 hover:bg-red-50 p-1 rounded"><Trash2 size={14}/></button>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                            <button onClick={() => { setConfigModal(null); setEditingCustomRoleKey(null); }} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded">取消</button>
                            
                            {configModal === 'WECOM' && (
                                <button onClick={handleSaveWeCom} className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700">
                                    保存配置
                                </button>
                            )}
                            {configModal === 'SSO' && (
                                <button onClick={handleSaveSSO} className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                                    保存配置
                                </button>
                            )}
                             {configModal === 'ADD_DEPT' && (
                                <button onClick={handleAddDepartment} className="px-6 py-2 bg-brand-600 text-white rounded hover:bg-brand-700">确认新增</button>
                            )}
                             {configModal === 'MANAGE_ROLES' && (
                                <button onClick={() => setConfigModal(null)} className="px-6 py-2 bg-slate-800 text-white rounded hover:bg-slate-900">完成</button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
