

import React, { useState, useEffect, useMemo } from 'react';
import { getOKRs, createOKR, saveOKR, deleteOKR, getUsers, getApproverRoles, getWorkflows, isCadre } from '../services/okrService';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { OKR, OKRStatus, Objective, KeyResult, User, OKRLevel, Role, ROLE_NAMES } from '../types';
import { Plus, Trash2, Save, Send, ChevronDown, ChevronRight, Sparkles, Users, Search, X, Building, User as UserIcon, Lock, Calendar, AlertCircle, Link as LinkIcon, Clock } from 'lucide-react';
import { AICoach } from '../components/AICoach';
import { ConfirmDialog } from '../components/ConfirmDialog';

// Visual Mapping per request: 
// Draft -> Draft
// Pending Manager/GM -> Submitted
// Published / Assessment Phases -> Published
// Closed / Archive Pending -> Archived
const statusLabels: Record<OKRStatus, string> = {
    [OKRStatus.DRAFT]: '草稿',
    [OKRStatus.PENDING_MANAGER]: '已提交',
    [OKRStatus.PENDING_GM]: '已提交',
    [OKRStatus.PUBLISHED]: '已发布',
    [OKRStatus.GRADING]: '已发布',
    [OKRStatus.CLOSED]: '已归档',
    [OKRStatus.PENDING_ASSESSMENT_APPROVAL]: '已发布',
    [OKRStatus.PENDING_L2_APPROVAL]: '已发布',
    [OKRStatus.PENDING_L3_APPROVAL]: '已发布',
    [OKRStatus.PENDING_ARCHIVE]: '已归档',
};

const distributeWeights = <T extends { weight: number }>(items: T[]): T[] => {
    const count = items.length;
    if (count === 0) return items;
    const avg = Math.floor(100 / count);
    const remainder = 100 % count;
    return items.map((item, index) => ({
        ...item,
        weight: index < remainder ? avg + 1 : avg
    }));
};

export const MyOKRs: React.FC = () => {
    const user = useCurrentUser();
    const [okrs, setOkrs] = useState<OKR[]>([]);
    const [allOKRs, setAllOKRs] = useState<OKR[]>([]);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [localOKR, setLocalOKR] = useState<OKR | null>(null);
    const [showCreateMenu, setShowCreateMenu] = useState(false);
    const [aiModalOpen, setAiModalOpen] = useState(false);
    const [activeObjContext, setActiveObjContext] = useState<string>('');
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [userSearch, setUserSearch] = useState('');
    const [showUserSearch, setShowUserSearch] = useState(false);

    // Dialog State
    const [dialog, setDialog] = useState<{
        isOpen: boolean;
        title: string;
        message: React.ReactNode;
        type: 'info' | 'danger' | 'success' | 'warning';
        showCancel: boolean;
        onConfirm?: () => void;
    }>({ isOpen: false, title: '', message: '', type: 'info', showCancel: true });

    const openAlert = (message: string) => {
        setDialog({ isOpen: true, title: '提示', message, type: 'info', showCancel: false });
    };

    const openConfirm = (title: string, message: string, onConfirm: () => void, type: 'info'|'danger' = 'info') => {
        setDialog({ isOpen: true, title, message, type, showCancel: true, onConfirm });
    };

    const refreshData = () => {
        const all = getOKRs();
        setAllOKRs(all);
        setOkrs(all.filter(o => o.userId === user.id));
        setAllUsers(getUsers());
    };

    useEffect(() => {
        refreshData();
        setEditingId(null);
        setLocalOKR(null);
        
        // Listen for updates from other components
        window.addEventListener('alignflow_data_updated', refreshData);
        return () => window.removeEventListener('alignflow_data_updated', refreshData);
    }, [user.id]);

    const handleCreate = (level: OKRLevel) => {
        const newOKR = createOKR(user, level);
        
        // Auto-fill Peer Reviewers based on Workflow Configuration
        if (level === OKRLevel.PERSONAL) {
            const workflows = getWorkflows();
            const wf = workflows.find(w => w.targetRole === user.role);
            const defaultPeers: string[] = [];
            
            if (wf && wf.ccRoles && wf.ccRoles.length > 0) {
                const currentUsers = getUsers(); // Need fresh users
                
                wf.ccRoles.forEach(role => {
                    const targetRole = role as string;
                    // 1. Find in the SAME department ONLY
                    const deptCandidates = currentUsers.filter(u => u.role === targetRole && u.department === user.department);
                    
                    if (deptCandidates.length > 0) {
                        deptCandidates.forEach(u => {
                            if (!defaultPeers.includes(u.id)) defaultPeers.push(u.id);
                        });
                    }
                    // Removed global fallback to prevent cross-dept mismatches
                });
            }
            newOKR.peerReviewers = defaultPeers;
        }

        setOkrs([...okrs, newOKR]);
        handleEdit(newOKR);
        setShowCreateMenu(false);
    };

    const handleEdit = (okr: OKR) => {
        if (okr.isPerformanceArchived) {
            openAlert("该 OKR 绩效评估已归档，内容已锁定，无法编辑。");
            return;
        }
        let okrToEdit = JSON.parse(JSON.stringify(okr));
        setEditingId(okr.id);
        setLocalOKR(okrToEdit);
    };

    const handleSave = () => {
        if (localOKR) {
            saveOKR(localOKR);
            refreshData(); // Ensure fresh data reload
            setEditingId(null);
            setLocalOKR(null);
        }
    };

    const handleSubmit = (okr: OKR) => {
        try {
            if(!okr.objectives || okr.objectives.length === 0) {
                openAlert("请至少添加一个目标。");
                return;
            }
            const objTotal = okr.objectives.reduce((sum, o) => sum + (o.weight || 0), 0);
            if (objTotal !== 100) {
                openAlert(`目标总权重为 ${objTotal}%，必须等于 100%。`);
                return;
            }
            for (let i = 0; i < okr.objectives.length; i++) {
                const obj = okr.objectives[i];
                if (!obj.keyResults || obj.keyResults.length === 0) {
                     openAlert(`目标 "O${i+1}" 缺少关键结果。请添加至少一个关键结果。`);
                     return;
                }
                const krTotal = obj.keyResults.reduce((sum, k) => sum + (k.weight || 0), 0);
                if (krTotal !== 100) {
                     openAlert(`目标 "O${i+1}" 的关键结果总权重为 ${krTotal}%，必须等于 100%。`);
                     return;
                }
            }

            openConfirm(
                "确认提交审批?",
                "提交后，OKR 将进入正式审批流程。审批期间将无法再次修改内容。",
                () => executeSubmit(okr),
                "info"
            );
        } catch (e) {
            console.error(e);
            openAlert("提交时发生未知错误。");
        }
    };

    const executeSubmit = (okr: OKR) => {
        const executiveRoles = [
            Role.VP_PRODUCT, Role.VP_TECH, Role.VP_MARKET, Role.PRESIDENT
        ];
        const nextStatus = executiveRoles.includes(user.role as Role) 
            ? OKRStatus.PUBLISHED 
            : OKRStatus.PENDING_MANAGER;

        const updated = { ...okr, status: nextStatus };
        saveOKR(updated);
        refreshData(); // Reload to show new status

        if (editingId === okr.id) {
            setEditingId(null);
            setLocalOKR(null);
        }
    };

    const confirmDelete = (okrId: string) => {
        openConfirm(
            "确认删除",
            "确认删除此 OKR? 操作无法撤销。",
            () => {
                deleteOKR(okrId);
                setOkrs(prev => prev.filter(o => o.id !== okrId));
                setAllOKRs(prev => prev.filter(o => o.id !== okrId));
                if(editingId === okrId) {
                    setEditingId(null);
                    setLocalOKR(null);
                }
            },
            "danger"
        );
    };

    // ... (Peer, Form, AI handlers) ...
    const addPeerReviewer = (peerId: string) => {
        if (!localOKR) return;
        const currentPeers = localOKR.peerReviewers || [];
        if (!currentPeers.includes(peerId)) {
            setLocalOKR({ ...localOKR, peerReviewers: [...currentPeers, peerId] });
        }
        setShowUserSearch(false);
        setUserSearch('');
    };

    const removePeerReviewer = (peerId: string) => {
        if (!localOKR) return;
        setLocalOKR({ 
            ...localOKR, 
            peerReviewers: (localOKR.peerReviewers || []).filter(id => id !== peerId) 
        });
    };

    const filteredUsers = allUsers.filter(u => 
        u.id !== user.id && 
        u.name.toLowerCase().includes(userSearch.toLowerCase()) &&
        !localOKR?.peerReviewers?.includes(u.id)
    );

    const updateObj = (idx: number, field: keyof Objective, val: any) => {
        if (!localOKR) return;
        const newObjs = [...localOKR.objectives];
        newObjs[idx] = { ...newObjs[idx], [field]: val };
        setLocalOKR({ ...localOKR, objectives: newObjs });
    };

    const addObj = () => {
        if (!localOKR) return;
        const newObj: Objective = { id: `obj-${Date.now()}`, content: '', weight: 0, keyResults: [] };
        const newObjectives = distributeWeights([...localOKR.objectives, newObj]);
        setLocalOKR({ ...localOKR, objectives: newObjectives });
    };

    const removeObj = (idx: number) => {
        if (!localOKR) return;
        const filtered = localOKR.objectives.filter((_, i) => i !== idx);
        const newObjectives = distributeWeights(filtered);
        setLocalOKR({ ...localOKR, objectives: newObjectives });
    };

    const addKR = (objIdx: number) => {
        if (!localOKR) return;
        const newObjs = [...localOKR.objectives];
        const newKR: KeyResult = { id: `kr-${Date.now()}`, content: '', weight: 0 };
        newObjs[objIdx].keyResults = distributeWeights([...newObjs[objIdx].keyResults, newKR]);
        setLocalOKR({ ...localOKR, objectives: newObjs });
    };
    
    const updateKR = (objIdx: number, krIdx: number, field: keyof KeyResult, val: any) => {
         if (!localOKR) return;
        const newObjs = [...localOKR.objectives];
        newObjs[objIdx].keyResults[krIdx] = { ...newObjs[objIdx].keyResults[krIdx], [field]: val };
        setLocalOKR({ ...localOKR, objectives: newObjs });
    };

    const removeKR = (objIdx: number, krIdx: number) => {
        if (!localOKR) return;
        const newObjs = [...localOKR.objectives];
        const filteredKRs = newObjs[objIdx].keyResults.filter((_, i) => i !== krIdx);
        newObjs[objIdx].keyResults = distributeWeights(filteredKRs);
        setLocalOKR({ ...localOKR, objectives: newObjs });
    };

    const openAI = (text: string) => {
        setActiveObjContext(text);
        setAiModalOpen(true);
    };

    // --- Permissions Logic ---
    const executiveRoles = [Role.VP_PRODUCT, Role.VP_TECH, Role.VP_MARKET, Role.PRESIDENT];

    // Dynamic Permission: Use isCadre to determine if user is a manager (L1 or L2 in any workflow)
    const isManager = isCadre(user.role);
    const isExecutive = executiveRoles.includes(user.role as Role);
    const isBusinessLineHead = user.role === Role.BUSINESS_HEAD;

    // Create Logic
    const canCreateCompanyOKR = [Role.PRODUCT_GM, Role.TECH_GM, ...executiveRoles].includes(user.role as Role);
    
    // Dynamic: If they are a Cadre (Manager) or Executive, they can create Team OKRs
    const canCreateDepartmentOKR = isManager || isExecutive;
    
    // Personal: Most roles can, except maybe specific top execs if business rule requires, but keeping broad for now
    const canCreatePersonalOKR = true; 

    const deptLevelLabel = isBusinessLineHead ? '业务线 OKR' : '部门/团队 OKR';

    // --- Parent OKR Candidates with Grouping ---
    const parentOKRGroups = useMemo(() => {
        if (!localOKR) return { company: [], dept: [] };
        
        const activeStatuses = [
            OKRStatus.PUBLISHED, 
            OKRStatus.PENDING_ASSESSMENT_APPROVAL, 
            OKRStatus.PENDING_L2_APPROVAL, 
            OKRStatus.PENDING_L3_APPROVAL, 
            OKRStatus.PENDING_ARCHIVE
        ];

        const company = allOKRs.filter(o => activeStatuses.includes(o.status) && o.level === OKRLevel.COMPANY);
        let dept = [];

        if (localOKR.level === OKRLevel.PERSONAL) {
             dept = allOKRs.filter(o => 
                activeStatuses.includes(o.status) &&
                o.level === OKRLevel.DEPARTMENT && 
                o.department === user.department
            );
        }

        return { company, dept };
    }, [allOKRs, localOKR, user.department]);

    // --- Dynamic Period Options ---
    const periodOptions = useMemo(() => {
        if (!localOKR) return [];
        const currentYear = new Date().getFullYear();
        const years = [currentYear, currentYear + 1];
        const options: string[] = [];

        years.forEach(year => {
            if (localOKR.level === OKRLevel.COMPANY) {
                options.push(`${year} 全年`);
            } else {
                options.push(`${year} 上半年`);
                options.push(`${year} 下半年`);
            }
        });
        return options;
    }, [localOKR?.level]);

    // Helper for Status Text
    const getDetailedStatusText = (okr: OKR) => {
        if (okr.isPerformanceArchived) return '绩效评估已完成并归档。';
        
        const { l1, l2, l3 } = getApproverRoles(okr);
        
        switch (okr.status) {
            case OKRStatus.DRAFT:
                return '草稿状态，请完善后提交审批。';
            case OKRStatus.PENDING_MANAGER:
                return `已提交，等待一级审批 (${ROLE_NAMES[l1 as string] || l1 || '主管'})。`;
            case OKRStatus.PENDING_GM:
                return `一级已通过，等待二级审批 (${ROLE_NAMES[l2 as string] || l2 || '总经理'})。`;
            case OKRStatus.PUBLISHED:
                return '已发布成功，等待后续绩效评估。';
            case OKRStatus.PENDING_ASSESSMENT_APPROVAL:
                return `自评已提交，等待一级主管 (${ROLE_NAMES[l1 as string] || l1}) 评分。`;
            case OKRStatus.PENDING_L2_APPROVAL:
                return `一级评分完成，等待二级主管 (${ROLE_NAMES[l2 as string] || l2}) 审批。`;
            case OKRStatus.PENDING_L3_APPROVAL:
                return `二级审批完成，等待三级主管 (${ROLE_NAMES[l3 as string] || l3}) 终审。`;
            case OKRStatus.PENDING_ARCHIVE:
                return '绩效审批完成，等待归档发布。';
            case OKRStatus.CLOSED:
                return '本周期已结束。';
            default:
                return '状态更新中...';
        }
    };

    if (editingId && localOKR) {
        const totalObjWeight = localOKR.objectives.reduce((sum, o) => sum + (o.weight || 0), 0);
        const isObjWeightValid = totalObjWeight === 100;

        return (
            <div className="bg-white rounded-xl shadow p-8 max-w-4xl mx-auto animate-in zoom-in-95 duration-200 relative">
                <ConfirmDialog 
                    isOpen={dialog.isOpen}
                    onClose={() => setDialog({ ...dialog, isOpen: false })}
                    onConfirm={dialog.onConfirm}
                    title={dialog.title}
                    message={dialog.message}
                    type={dialog.type}
                    showCancel={dialog.showCancel}
                />
                
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        {localOKR.level === OKRLevel.COMPANY ? <Building className="text-red-500"/> : 
                         localOKR.level === OKRLevel.DEPARTMENT ? <Users className="text-brand-500"/> : <UserIcon className="text-slate-500"/>}
                        {localOKR.id ? '编辑 OKR' : '创建 OKR'}
                    </h2>
                </div>
                
                <div className="grid md:grid-cols-2 gap-6 mb-8">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">标题</label>
                        <input className="w-full p-2 border rounded focus:ring-2 ring-brand-500 outline-none" value={localOKR.title} onChange={e => setLocalOKR({...localOKR, title: e.target.value})} />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                            <Calendar size={14} /> 周期
                        </label>
                        <div className="relative">
                            <select
                                className="w-full p-2 border rounded focus:ring-2 ring-brand-500 outline-none appearance-none bg-white pr-8"
                                value={localOKR.period}
                                onChange={e => setLocalOKR({...localOKR, period: e.target.value})}
                            >
                                {periodOptions.map(p => (
                                    <option key={p} value={p}>{p}</option>
                                ))}
                            </select>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                <ChevronDown size={16} />
                            </div>
                        </div>
                    </div>
                    
                    {/* Parent OKR Selection */}
                    {localOKR.level !== OKRLevel.COMPANY && (
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                                <LinkIcon size={14} /> 关联上级目标 (对齐)
                            </label>
                            <div className="relative">
                                <select 
                                    className="w-full p-2 border rounded focus:ring-2 ring-brand-500 outline-none appearance-none bg-white pr-8"
                                    value={localOKR.parentOKRId || ''}
                                    onChange={e => setLocalOKR({...localOKR, parentOKRId: e.target.value || undefined})}
                                >
                                    <option value="">(无关联)</option>
                                    {parentOKRGroups.dept.length > 0 && (
                                        <optgroup label="部门/业务线目标">
                                            {parentOKRGroups.dept.map(p => (
                                                <option key={p.id} value={p.id}>{p.title}</option>
                                            ))}
                                        </optgroup>
                                    )}
                                    {parentOKRGroups.company.length > 0 && (
                                        <optgroup label="公司战略目标">
                                            {parentOKRGroups.company.map(p => (
                                                <option key={p.id} value={p.id}>{p.title}</option>
                                            ))}
                                        </optgroup>
                                    )}
                                </select>
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                    <ChevronDown size={16} />
                                </div>
                            </div>
                            <p className="text-xs text-slate-400 mt-1">选择已发布的上级 OKR 以确保目标对齐。</p>
                        </div>
                    )}

                    {localOKR.level === OKRLevel.PERSONAL && (
                        <div className="relative md:col-span-2">
                             <label className="block text-sm font-medium text-slate-700 mb-1">邀请协作评价 (Peer Review) - 已根据您的角色自动填充，可手动修改</label>
                             <div className="flex flex-wrap gap-2 p-2 border rounded min-h-[42px] bg-white">
                                 {(localOKR.peerReviewers || []).map(pid => {
                                     const pUser = allUsers.find(u => u.id === pid);
                                     return (
                                         <span key={pid} className={`text-xs px-2 py-1 rounded-full flex items-center gap-1 border bg-purple-50 text-purple-700 border-purple-100`}>
                                             {pUser?.name}
                                             <button onClick={() => removePeerReviewer(pid)} className="hover:text-purple-900"><X size={12}/></button>
                                         </span>
                                     )
                                 })}
                                 <button onClick={() => setShowUserSearch(!showUserSearch)} className="text-slate-400 hover:text-brand-500 flex items-center gap-1 text-xs px-2 py-1"><Plus size={14} /> 添加人员</button>
                             </div>
                             {showUserSearch && (
                                 <div className="absolute top-full left-0 w-full bg-white shadow-xl border border-slate-200 rounded-lg mt-1 z-20 p-2">
                                     <div className="flex items-center gap-2 border-b border-slate-100 pb-2 mb-2 px-2">
                                         <Search size={14} className="text-slate-400"/>
                                         <input autoFocus className="w-full text-sm outline-none" placeholder="搜索员工..." value={userSearch} onChange={e => setUserSearch(e.target.value)} />
                                     </div>
                                     <div className="max-h-48 overflow-y-auto space-y-1">
                                         {filteredUsers.map(u => (
                                             <button key={u.id} onClick={() => addPeerReviewer(u.id)} className="w-full text-left flex items-center gap-2 p-2 hover:bg-slate-50 rounded text-sm">
                                                 <img src={u.avatar} className="w-5 h-5 rounded-full" alt=""/>
                                                 <span>{u.name}</span>
                                             </button>
                                         ))}
                                     </div>
                                 </div>
                             )}
                        </div>
                    )}
                </div>

                <div className="space-y-6">
                    {localOKR.objectives.map((obj, i) => {
                         const totalKRWeight = obj.keyResults.reduce((sum, k) => sum + (k.weight || 0), 0);
                         const isKRWeightValid = totalKRWeight === 100 && obj.keyResults.length > 0;
                         return (
                            <div key={obj.id} className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                                <div className="flex gap-4 mb-3">
                                    <div className="flex-1">
                                        <label className="text-xs font-bold text-slate-500 uppercase flex justify-between">
                                            目标 (Objective) {i + 1}
                                            <button onClick={() => openAI(obj.content)} className="text-purple-600 flex items-center gap-1 hover:text-purple-800"><Sparkles size={12} /> AI 助手</button>
                                        </label>
                                        <input className="w-full p-2 border rounded mt-1 focus:border-brand-500 outline-none" placeholder="例如：提高系统稳定性" value={obj.content} onChange={e => updateObj(i, 'content', e.target.value)} />
                                    </div>
                                    <div className="w-24">
                                        <label className="text-xs font-bold text-slate-500 uppercase">权重 %</label>
                                        <input type="number" min="0" max="100" className={`w-full p-2 border rounded mt-1 outline-none ${!isObjWeightValid ? 'border-red-300 bg-red-50 text-red-700' : 'focus:border-brand-500'}`} value={obj.weight} onChange={e => updateObj(i, 'weight', Number(e.target.value))} />
                                    </div>
                                </div>
                                <div className="pl-6 space-y-3 border-l-2 border-slate-200 ml-2">
                                    {obj.keyResults.map((kr, k) => (
                                        <div key={kr.id} className="flex gap-4 items-center group">
                                            <span className="text-xs font-bold text-slate-400">KR {k+1}</span>
                                            <input className="flex-1 p-2 border rounded text-sm focus:border-brand-500 outline-none" placeholder="关键结果描述" value={kr.content} onChange={e => updateKR(i, k, 'content', e.target.value)} />
                                            <input type="number" min="0" max="100" className={`w-20 p-2 border rounded text-sm outline-none ${totalKRWeight !== 100 ? 'border-red-300 bg-red-50' : 'focus:border-brand-500'}`} placeholder="%" value={kr.weight} onChange={e => updateKR(i, k, 'weight', Number(e.target.value))} />
                                            <button onClick={() => removeKR(i, k)} className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100"><Trash2 size={16} /></button>
                                        </div>
                                    ))}
                                    <div className="flex justify-between items-center mt-2">
                                        <button onClick={() => addKR(i)} className="text-sm text-brand-600 font-medium hover:underline flex items-center gap-1"><Plus size={14} /> 添加关键结果</button>
                                        {!isKRWeightValid && <span className="text-xs text-red-600 flex items-center gap-1 font-medium bg-red-50 px-2 py-1 rounded"><AlertCircle size={12}/> 当前 KR 总权重: {totalKRWeight}% (需等于 100%)</span>}
                                    </div>
                                </div>
                                <div className="mt-4 flex justify-end">
                                    <button onClick={() => removeObj(i)} className="text-red-500 text-sm hover:underline">移除目标</button>
                                </div>
                            </div>
                        );
                    })}
                    <button onClick={addObj} className="w-full py-3 border-2 border-dashed border-slate-300 rounded-lg text-slate-500 hover:border-brand-500 flex justify-center items-center gap-2"><Plus size={20} /> 添加新目标</button>
                </div>

                <div className="flex flex-col items-end gap-2 mt-8 pt-6 border-t border-slate-100">
                     {!isObjWeightValid && <div className="text-sm text-red-600 flex items-center gap-2 font-bold bg-red-50 px-3 py-2 rounded-lg border border-red-100 mb-2"><AlertCircle size={16}/> 错误: 目标总权重当前为 {totalObjWeight}%，必须等于 100%。</div>}
                    <div className="flex gap-3">
                        <button onClick={() => { setEditingId(null); setLocalOKR(null); }} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded">取消</button>
                        <button onClick={handleSave} className="px-6 py-2 bg-slate-800 text-white rounded hover:bg-slate-900 flex items-center gap-2"><Save size={18} /> 保存草稿</button>
                        <button onClick={() => handleSubmit(localOKR)} className="px-6 py-2 bg-brand-600 text-white rounded hover:bg-brand-700 flex items-center gap-2"><Send size={18} /> 提交{isExecutive ? '并发布' : '审批'}</button>
                    </div>
                </div>
                <AICoach isOpen={aiModalOpen} onClose={() => setAiModalOpen(false)} currentObjective={activeObjContext} onApplySuggestion={() => {}} />
            </div>
        );
    }

    return (
        <div>
            <ConfirmDialog 
                isOpen={dialog.isOpen}
                onClose={() => setDialog({ ...dialog, isOpen: false })}
                onConfirm={dialog.onConfirm}
                title={dialog.title}
                message={dialog.message}
                type={dialog.type}
                showCancel={dialog.showCancel}
            />
            {/* ... (Main View Code) ... */}
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-2xl font-bold text-slate-900">我的 OKR</h1>
                <div className="relative">
                    <button onClick={() => setShowCreateMenu(!showCreateMenu)} className="bg-brand-600 text-white px-4 py-2 rounded-lg hover:bg-brand-700 flex items-center gap-2 shadow-sm transition-all"><Plus size={20} /> 创建新 OKR <ChevronDown size={16} /></button>
                    {showCreateMenu && (
                        <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-slate-200 z-20 py-1 animate-in fade-in slide-in-from-top-2">
                            {canCreateCompanyOKR && <button onClick={() => handleCreate(OKRLevel.COMPANY)} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 font-medium"><Building size={16} /> 公司 OKR</button>}
                            
                            {canCreateDepartmentOKR && <button onClick={() => handleCreate(OKRLevel.DEPARTMENT)} className="w-full text-left px-4 py-2 text-sm text-indigo-600 hover:bg-indigo-50 flex items-center gap-2 font-medium"><Users size={16} /> 创建{deptLevelLabel}</button>}
                            
                            {canCreatePersonalOKR ? (
                                <button onClick={() => handleCreate(OKRLevel.PERSONAL)} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"><UserIcon size={16} /> 个人 OKR</button>
                            ) : (
                                <div className="px-4 py-2 text-xs text-slate-400 italic bg-slate-50">
                                    团队负责人(一级审批者)仅需创建团队 OKR
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="grid gap-4">
                {okrs.length === 0 && <div className="text-center py-20 bg-white rounded-xl border border-dashed border-slate-300 text-slate-500">您还没有任何 OKR。</div>}
                
                {okrs.map(okr => {
                    let badgeLabel = '个人 OKR';
                    let badgeColor = 'bg-slate-100 text-slate-600';
                    if (okr.level === OKRLevel.COMPANY) { badgeLabel = '公司 OKR'; badgeColor = 'bg-red-100 text-red-700'; }
                    else if (okr.level === OKRLevel.DEPARTMENT) {
                        const isBusinessLine = (okr.department || '').includes('业务线');
                        if (isBusinessLine && user.role === Role.BUSINESS_HEAD) { badgeLabel = '业务线 OKR'; badgeColor = 'bg-blue-100 text-blue-700'; } 
                        else { badgeLabel = '部门 OKR'; badgeColor = 'bg-indigo-100 text-indigo-700'; }
                    }

                    // Display Logic for "My OKRs" page: Should show detailed status unlike Dashboard
                    // Using Simplified Statuses
                    const statusLabel = statusLabels[okr.status] || '已发布';
                    const statusColor = 
                        okr.status === OKRStatus.DRAFT ? 'bg-slate-100 text-slate-600' :
                        okr.status === OKRStatus.PENDING_MANAGER || okr.status === OKRStatus.PENDING_GM ? 'bg-orange-100 text-orange-700' :
                        okr.status === OKRStatus.CLOSED || okr.isPerformanceArchived ? 'bg-slate-200 text-slate-800' :
                        'bg-green-100 text-green-700'; // Published & Assessment Phases

                    return (
                        <div key={okr.id} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 relative overflow-hidden transition-all hover:shadow-md">
                            <div className={`absolute top-0 left-0 px-3 py-1 rounded-br-lg text-xs font-bold ${badgeColor}`}>{badgeLabel}</div>
                            {okr.isPerformanceArchived && <div className="absolute top-0 right-0 px-3 py-1 bg-slate-800 text-white text-xs font-bold rounded-bl-lg z-10 flex items-center gap-1"><Lock size={10}/> 绩效已归档</div>}
                            
                            <div className="flex justify-between items-start mt-4">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-800">{okr.title}</h3>
                                    <div className="flex flex-col gap-1">
                                        <p className="text-sm text-slate-500">周期: {okr.period} • 创建时间: {new Date(okr.createdAt).toLocaleDateString()}</p>
                                        {okr.parentOKRId && (
                                            <div className="flex items-center gap-1 text-xs text-brand-600 bg-brand-50 w-fit px-2 py-0.5 rounded border border-brand-100 mt-1">
                                                <LinkIcon size={10} />
                                                关联上级目标
                                            </div>
                                        )}
                                    </div>
                                    
                                    {okr.peerReviewers && okr.peerReviewers.length > 0 && (
                                        <div className="flex items-center gap-2 text-xs text-slate-500 mb-4 mt-2">
                                            <Users size={12} /><span>受邀评价: </span>
                                            {okr.peerReviewers.map(pid => {
                                                const p = allUsers.find(u => u.id === pid);
                                                return p ? <span key={pid} className="bg-slate-100 px-2 py-0.5 rounded">{p.name}</span> : null;
                                            })}
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${statusColor}`}>{statusLabel}</span>
                                </div>
                            </div>
                            <div className="space-y-2 mb-6 mt-2">
                                {okr.objectives.map((o, idx) => (
                                    <div key={o.id} className="flex items-baseline gap-2 text-sm text-slate-700">
                                        <span className="font-semibold text-slate-400">O{idx+1}:</span><span>{o.content} ({o.weight}%)</span>
                                    </div>
                                ))}
                            </div>
                            <div className="flex gap-3 pt-4 border-t border-slate-100">
                                {okr.status === OKRStatus.DRAFT ? (
                                    <>
                                        <button onClick={() => handleEdit(okr)} className="px-4 py-2 bg-white border border-slate-300 rounded hover:bg-slate-50 text-sm font-medium">编辑</button>
                                        <button onClick={() => confirmDelete(okr.id)} className="px-4 py-2 text-red-600 hover:bg-red-50 rounded text-sm font-medium">删除</button>
                                        <div className="flex-1"></div>
                                        <button onClick={() => handleSubmit(okr)} className="px-4 py-2 bg-brand-600 text-white rounded hover:bg-brand-700 text-sm font-medium flex items-center gap-2"><Send size={16} /> {isExecutive ? '发布' : '提交审批'}</button>
                                    </>
                                ) : (
                                    <div className="flex justify-between w-full items-center">
                                        <div className="flex items-center gap-2 text-sm text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 w-full">
                                            {okr.isPerformanceArchived ? (
                                                <div className="flex items-center gap-2">
                                                    <span className="w-2 h-2 rounded-full bg-slate-800"></span> 
                                                    <span className="font-medium text-slate-700">绩效评估已完成并归档。</span>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2">
                                                    <span className={`w-2 h-2 rounded-full ${okr.status.includes('PENDING') ? 'bg-orange-500 animate-pulse' : 'bg-green-500'}`}></span>
                                                    <span>{getDetailedStatusText(okr)}</span>
                                                </div>
                                            )}
                                        </div>
                                        
                                        {okr.isPerformanceArchived && (
                                            <button 
                                                onClick={() => handleEdit(okr)} 
                                                className="ml-4 px-4 py-1.5 border border-slate-200 text-slate-500 text-xs rounded hover:bg-slate-50 whitespace-nowrap"
                                            >
                                                查看内容
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
