

import React, { useState, useEffect, useMemo } from 'react';
import { getOKRs, createOKR, saveOKR, deleteOKR, getUsers, getApproverRoles, getWorkflows, isCadre, importMyOKRByAI, moveOKRPriority, mergeMyOKRs } from '../services/okrService';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { OKR, OKRStatus, Objective, KeyResult, User, OKRLevel, Role, ROLE_NAMES } from '../types';
import { Plus, Trash2, Save, Send, ChevronDown, ChevronUp, ChevronRight, Sparkles, Users, Search, X, Building, User as UserIcon, Lock, Calendar, AlertCircle, Link as LinkIcon, Clock } from 'lucide-react';
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
    const [selectedOKRIds, setSelectedOKRIds] = useState<string[]>([]);
    const [mergeSelectMode, setMergeSelectMode] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [localOKR, setLocalOKR] = useState<OKR | null>(null);
    const [showCreateMenu, setShowCreateMenu] = useState(false);
    const [importModalOpen, setImportModalOpen] = useState(false);
    const [importing, setImporting] = useState(false);
    const [importText, setImportText] = useState('');
    const [importFileName, setImportFileName] = useState('');
    const [importImageBase64, setImportImageBase64] = useState<string | undefined>(undefined);
    const [importImages, setImportImages] = useState<Array<{ base64: string; mimeType?: string }>>([]);
    const [importFileBase64, setImportFileBase64] = useState<string | undefined>(undefined);
    const [importMimeType, setImportMimeType] = useState<string | undefined>(undefined);
    const [importLevel, setImportLevel] = useState<OKRLevel>(OKRLevel.PERSONAL);
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
        const my = all.filter(o => o.userId === user.id);
        setOkrs(my);
        setAllUsers(getUsers());

        // 合并选择只保留草稿状态 OKR，避免出现已提交但仍被选中的情况
        setSelectedOKRIds(prev => prev.filter(id => my.some(o => o.id === id && o.status === OKRStatus.DRAFT)));
    };

    const handleMovePriority = async (okrId: string, direction: 'up' | 'down') => {
        try {
            await moveOKRPriority(okrId, direction);
        } catch (e: any) {
            openAlert(e?.message || '调整优先级失败');
        }
    };

    const toggleSelectOKR = (okrId: string, disabled: boolean) => {
        if (disabled) return;
        setSelectedOKRIds(prev => {
            if (prev.includes(okrId)) return prev.filter(id => id !== okrId);
            return [...prev, okrId];
        });
    };

    const handleMergeSelected = async () => {
        if (selectedOKRIds.length < 2) {
            openAlert('请至少选择 2 个 OKR');
            return;
        }

        openConfirm(
            '确认合并',
            `将选中的 ${selectedOKRIds.length} 个 OKR 合并为 1 个。合并成功后，原内容将被删除。`,
            () => {
                (async () => {
                    try {
                        await mergeMyOKRs(selectedOKRIds);
                        setSelectedOKRIds([]);
                        setMergeSelectMode(false);
                        refreshData();
                        openAlert('合并成功：原 OKR 已删除，并生成新的 OKR 草稿。');
                    } catch (e: any) {
                        openAlert(e?.message || '合并失败');
                    }
                })();
            },
            'danger'
        );
    };

    const startMergeSelect = () => {
        setSelectedOKRIds([]);
        setMergeSelectMode(true);
        openAlert('已进入合并选择模式：请勾选要整合的草稿 OKR（至少2个），再点击“确认合并”。');
    };

    const cancelMergeSelect = () => {
        setSelectedOKRIds([]);
        setMergeSelectMode(false);
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

        // 仅进入编辑态，不立即加入列表；只有保存/提交成功后才出现在“我的 OKR”
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

    const handleSave = async () => {
        if (localOKR) {
            try {
                // 等待保存完成，确保数据已保存到服务器
                await saveOKR(localOKR);
                refreshData(); // Ensure fresh data reload
                setEditingId(null);
                setLocalOKR(null);
            } catch (error: any) {
                openAlert(`保存失败：${error?.message || '未知错误'}`);
            }
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

    const executeSubmit = async (okr: OKR) => {
        try {
            const executiveRoles = [
                Role.VP_PRODUCT, Role.VP_TECH, Role.VP_MARKET, Role.PRESIDENT
            ];
            const nextStatus = executiveRoles.includes(user.role as Role) 
                ? OKRStatus.PUBLISHED 
                : OKRStatus.PENDING_MANAGER;

            // 从缓存中获取最新的 OKR（包含更新后的版本号）
            const okrs = getOKRs();
            const latestOKR = okrs.find(o => o.id === okr.id);
            if (!latestOKR) {
                // 如果缓存中不存在，使用传入的 okr
                const updated = { ...okr, status: nextStatus };
                await saveOKR(updated);
            } else {
                // 使用最新的 OKR，但保留当前编辑的内容和状态，确保版本号不被覆盖
                const updated = { ...latestOKR, ...okr, status: nextStatus, version: latestOKR.version };
                await saveOKR(updated);
            }
            
            refreshData(); // Reload to show new status

            if (editingId === okr.id) {
                setEditingId(null);
                setLocalOKR(null);
            }
        } catch (error: any) {
            openAlert(`提交失败：${error?.message || '未知错误'}`);
        }
    };

    const confirmDelete = (okrId: string) => {
        openConfirm(
            "确认删除",
            "确认删除此 OKR? 操作无法撤销。",
            async () => {
                try {
                    // 等待删除完成，确保数据已从服务器删除
                    await deleteOKR(okrId);
                    setOkrs(prev => prev.filter(o => o.id !== okrId));
                    setAllOKRs(prev => prev.filter(o => o.id !== okrId));
                    if(editingId === okrId) {
                        setEditingId(null);
                        setLocalOKR(null);
                    }
                } catch (error: any) {
                    openAlert(`删除失败：${error?.message || '未知错误'}`);
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

    const handlePickImportFile = async (file: File) => {
        setImportFileName(file.name);
        setImportMimeType(file.type || undefined);
        if (file.type.startsWith('image/')) {
            const b64 = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => {
                    const dataUrl = String(reader.result || '');
                    resolve(dataUrl.split(',')[1] || '');
                };
                reader.onerror = () => reject(new Error('读取图片失败'));
                reader.readAsDataURL(file);
            });
            setImportImageBase64(b64);
            setImportImages(prev => [...prev, { base64: b64, mimeType: file.type }]);
            setImportFileBase64(undefined);
            setImportText('');
            return;
        }
        if (file.name.toLowerCase().endsWith('.pdf') || file.name.toLowerCase().endsWith('.ppt') || file.name.toLowerCase().endsWith('.pptx') || file.type.includes('pdf') || file.type.includes('presentation')) {
            const b64 = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => {
                    const dataUrl = String(reader.result || '');
                    resolve(dataUrl.split(',')[1] || '');
                };
                reader.onerror = () => reject(new Error('读取文件失败'));
                reader.readAsDataURL(file);
            });
            setImportFileBase64(b64);
            setImportImageBase64(undefined);
            setImportText('');
            return;
        }
        const text = await file.text();
        setImportText(text.slice(0, 20000));
        setImportImageBase64(undefined);
        setImportImages([]);
        setImportFileBase64(undefined);
    };

    const handleImportByAI = async () => {
        if (!importText.trim() && !importImageBase64 && importImages.length === 0 && !importFileBase64) {
            openAlert('请先上传截图或文本文件。');
            return;
        }
        try {
            setImporting(true);
            await importMyOKRByAI({
                textContent: importText || undefined,
                fileName: importFileName || undefined,
                mimeType: importMimeType,
                imageBase64: importImageBase64,
                imageList: importImages.length > 0 ? importImages : undefined,
                    fileBase64: importFileBase64,
                    importLevel
            });
            refreshData();
            setImportModalOpen(false);
            setImportText('');
            setImportFileName('');
            setImportImageBase64(undefined);
            setImportImages([]);
            setImportFileBase64(undefined);
            openAlert('AI 导入成功，已生成草稿 OKR。');
        } catch (error: any) {
            openAlert(`AI 导入失败：${error?.message || '未知错误'}`);
        } finally {
            setImporting(false);
        }
    };

    const handlePasteScreenshot: React.ClipboardEventHandler<HTMLDivElement> = async (e) => {
        const items = e.clipboardData?.items;
        if (!items) return;
        const imageItems = Array.from(items).filter((item: DataTransferItem) => item.type.startsWith('image/'));
        if (imageItems.length === 0) return;
        e.preventDefault();
        for (const imageItem of imageItems as DataTransferItem[]) {
            const file = imageItem.getAsFile();
            if (file) {
                await handlePickImportFile(file);
            }
        }
    };

    const handleRemoveImportImage = (idx: number) => {
        setImportImages(prev => prev.filter((_, i) => i !== idx));
        setImportImageBase64(undefined);
    };

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

    const handleChangeOKRLevel = (newLevel: OKRLevel) => {
        if (!localOKR) return;
        const year = new Date().getFullYear();
        const nextPeriod = newLevel === OKRLevel.COMPANY ? `${year} 全年` : `${year} 上半年`;

        setLocalOKR({
            ...localOKR,
            level: newLevel,
            period: nextPeriod,
            parentOKRId: newLevel === OKRLevel.COMPANY ? undefined : localOKR.parentOKRId,
            // Peer Review 仅个人 OKR 需要；切换类型时清空，避免提交时携带错误数据
            peerReviewers: newLevel === OKRLevel.PERSONAL ? (localOKR.peerReviewers || []) : []
        });
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

    const getDefaultImportLevel = (): OKRLevel => {
        // 与“创建新 OKR”菜单保持一致的优先级：公司 -> 部门 -> 个人
        if (canCreateCompanyOKR) return OKRLevel.COMPANY;
        if (canCreateDepartmentOKR) return OKRLevel.DEPARTMENT;
        return OKRLevel.PERSONAL;
    };

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
        const dept = allOKRs.filter(o => 
            activeStatuses.includes(o.status) &&
            o.level === OKRLevel.DEPARTMENT &&
            o.id !== localOKR.id
        );

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
                            <Sparkles size={14} /> OKR 类型
                        </label>
                        <div className="relative">
                            <select
                                className="w-full p-2 border rounded focus:ring-2 ring-brand-500 outline-none appearance-none bg-white pr-8"
                                value={localOKR.level}
                                onChange={e => handleChangeOKRLevel(e.target.value as OKRLevel)}
                            >
                                {canCreateCompanyOKR && <option value={OKRLevel.COMPANY}>公司 OKR</option>}
                                {canCreateDepartmentOKR && <option value={OKRLevel.DEPARTMENT}>{deptLevelLabel}</option>}
                                {canCreatePersonalOKR && <option value={OKRLevel.PERSONAL}>个人 OKR</option>}
                            </select>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                <ChevronDown size={16} />
                            </div>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">用于保证导入/创建时类型一致，支持后续调整。</p>
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
                <div className="relative flex items-center gap-2">
                    <button
                        onClick={() => {
                            setImportLevel(getDefaultImportLevel());
                            setImportModalOpen(true);
                        }}
                        className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 flex items-center gap-2 shadow-sm transition-all"
                    >
                        <Sparkles size={18} /> AI 导入
                    </button>
                    {!mergeSelectMode ? (
                        <button
                            type="button"
                            onClick={startMergeSelect}
                            className="px-4 py-2 rounded-lg border border-indigo-200 text-indigo-700 bg-white hover:bg-indigo-50 flex items-center gap-2 shadow-sm transition-all"
                            title="开始选择多个草稿 OKR 并整合"
                        >
                            合并
                        </button>
                    ) : (
                        <>
                            <button
                                type="button"
                                onClick={handleMergeSelected}
                                disabled={selectedOKRIds.length < 2}
                                className="px-4 py-2 rounded-lg border border-indigo-200 text-indigo-700 bg-white hover:bg-indigo-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm transition-all"
                                title="确认合并为一个 OKR（原内容将删除）"
                            >
                                确认合并
                                {selectedOKRIds.length >= 2 ? `(${selectedOKRIds.length})` : ''}
                            </button>
                            <button
                                type="button"
                                onClick={cancelMergeSelect}
                                className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 bg-white hover:bg-slate-50 flex items-center gap-2 shadow-sm transition-all"
                                title="取消合并选择"
                            >
                                取消
                            </button>
                        </>
                    )}
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
                
                {okrs.map((okr, idx) => {
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
                                <div className="flex flex-col items-end gap-2">
                                    {mergeSelectMode && okr.status === OKRStatus.DRAFT && (
                                        <label className="flex items-center gap-2 cursor-pointer select-none">
                                            <input
                                                type="checkbox"
                                                checked={selectedOKRIds.includes(okr.id)}
                                                onChange={() => toggleSelectOKR(okr.id, false)}
                                                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                                                title="选择用于合并"
                                            />
                                        </label>
                                    )}
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${statusColor}`}>{statusLabel}</span>
                                    {okrs.length > 1 && (
                                        <div className="flex items-center gap-1">
                                            <button
                                                type="button"
                                                disabled={idx === 0}
                                                onClick={() => handleMovePriority(okr.id, 'up')}
                                                className={`p-1.5 rounded border text-slate-600 transition-colors ${
                                                    idx === 0 ? 'opacity-40 cursor-not-allowed bg-white' : 'hover:bg-slate-50 bg-white'
                                                }`}
                                                title="上移"
                                            >
                                                <ChevronUp size={16} />
                                            </button>
                                            <button
                                                type="button"
                                                disabled={idx === okrs.length - 1}
                                                onClick={() => handleMovePriority(okr.id, 'down')}
                                                className={`p-1.5 rounded border text-slate-600 transition-colors ${
                                                    idx === okrs.length - 1 ? 'opacity-40 cursor-not-allowed bg-white' : 'hover:bg-slate-50 bg-white'
                                                }`}
                                                title="下移"
                                            >
                                                <ChevronDown size={16} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="space-y-2 mb-6 mt-2">
                                {(okr.objectives || []).map((o, idx) => (
                                    <div key={o.id} className="flex items-baseline gap-2 text-sm text-slate-700">
                                        <span className="font-semibold text-slate-400">O{idx+1}:</span><span>{o.content} ({o.weight}%)</span>
                                    </div>
                                ))}
                                {(!okr.objectives || okr.objectives.length === 0) && (
                                    <div className="text-xs text-slate-400 italic">暂无目标</div>
                                )}
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

            {importModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onPaste={handlePasteScreenshot}>
                    <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-[640px] max-w-[95vw] p-6 space-y-5 max-h-[85vh] overflow-y-auto">
                        <div className="flex items-start justify-between gap-4">
                            <div className="space-y-1">
                                <h3 className="text-lg font-bold text-slate-900">AI 智能导入 OKR</h3>
                                <div className="text-xs text-slate-500">支持截图/文本</div>
                            </div>
                            <button
                                onClick={() => setImportModalOpen(false)}
                                className="p-1.5 rounded-lg hover:bg-slate-50 text-slate-500 hover:text-slate-700 transition-colors"
                                aria-label="关闭"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="rounded-xl border border-slate-100 bg-white p-4">
                            <div className="grid md:grid-cols-1 gap-4 items-center">
                                <div>
                                    <label className="block text-sm font-medium text-slate-800 mb-2">OKR 类型</label>
                                    <div className="relative">
                                        <select
                                            className="w-full p-2.5 pr-9 border rounded-lg focus:ring-2 focus:ring-brand-500/30 outline-none appearance-none bg-white text-slate-900"
                                            value={importLevel}
                                            onChange={e => setImportLevel(e.target.value as OKRLevel)}
                                        >
                                            {canCreateCompanyOKR && <option value={OKRLevel.COMPANY}>公司 OKR</option>}
                                            {canCreateDepartmentOKR && <option value={OKRLevel.DEPARTMENT}>{deptLevelLabel}</option>}
                                            {canCreatePersonalOKR && <option value={OKRLevel.PERSONAL}>个人 OKR</option>}
                                        </select>
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                            <ChevronDown size={16} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4">
                            <label className="block">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div className="space-y-1">
                                        <div className="text-sm font-medium text-slate-800">选择文件</div>
                                        <div className="text-xs text-slate-500">截图/文本文件（可多选）</div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-slate-500 whitespace-nowrap">
                                            {importFileName ? `已选择：${importFileName}` : '未选择任何文件'}
                                        </span>
                                        <span className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer transition-colors">
                                            浏览
                                        </span>
                                    </div>
                                </div>
                                <input
                                    type="file"
                                    multiple
                                    className="hidden"
                                    accept="image/*,.txt,.md,.csv,.json,.pdf,.ppt,.pptx,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                                    onChange={async e => {
                                        const files = Array.from(e.target.files || []) as File[];
                                        for (const f of files) {
                                            await handlePickImportFile(f);
                                        }
                                    }}
                                />
                            </label>

                            {importImages.length > 0 && (
                                <div className="mt-3 space-y-2">
                                    <div className="text-xs text-slate-500">已添加截图：{importImages.length} 张</div>
                                    <div className="max-h-28 overflow-y-auto space-y-1">
                                        {importImages.map((img, idx) => (
                                            <div
                                                key={`${idx}-${img.base64.slice(0, 12)}`}
                                                className="flex items-center justify-between text-xs text-slate-600 bg-white border rounded-lg px-2 py-1"
                                            >
                                                <span>截图 {idx + 1}</span>
                                                <button
                                                    onClick={() => handleRemoveImportImage(idx)}
                                                    className="text-red-600 hover:text-red-700 hover:underline"
                                                >
                                                    删除
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <textarea
                            className="w-full h-44 border rounded-xl p-3 text-sm text-slate-900 bg-white focus:ring-2 focus:ring-brand-500/30 outline-none resize-none"
                            placeholder="可直接粘贴 OKR 文本内容（不上传文件也可以）"
                            value={importText}
                            onChange={e => setImportText(e.target.value)}
                        />

                        <div className="flex justify-end gap-2 pt-1">
                            <button
                                onClick={() => setImportModalOpen(false)}
                                className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
                            >
                                取消
                            </button>
                            <button
                                disabled={importing}
                                onClick={handleImportByAI}
                                className="px-4 py-2 rounded-lg bg-purple-600 text-white disabled:opacity-50 hover:bg-purple-700 transition-colors focus:ring-2 focus:ring-purple-400/40"
                            >
                                {importing ? '识别中...' : '识别并导入'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
