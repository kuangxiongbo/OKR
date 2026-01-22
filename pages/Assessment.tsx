
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { getOKRs, saveOKR, calculateOKRTotalScore, calculateObjScoreFromKRs, determineGrade, getGradeConfigs, getUsers, updateOKRStatus, getApproverRoles, getWorkflows, isCadre, getRoles } from '../services/okrService';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { OKR, OKRStatus, Role, FinalGrade, GradeConfiguration, User, ApprovalWorkflow, ROLE_NAMES, OKRLevel } from '../types';
import { Star, Send, User as UserIcon, Users, Edit, BarChart3, CheckCircle2, ShieldCheck, UserCheck, CheckSquare, AlertTriangle, Lock, UserCog, PieChart, GitMerge, Crown, ArrowRight, MessageCircle, LayoutGrid, Briefcase, Loader2, Building, ChevronRight, Cloud, CloudFog, Eye, ThumbsUp, ThumbsDown, ClipboardList } from 'lucide-react';
import { ConfirmDialog } from '../components/ConfirmDialog';

// Helper to get dynamic role name
const getRoleLabel = (roleKey: string | Role, options: {value: string, label: string}[]) => {
    const found = options.find(r => r.value === roleKey);
    return found ? found.label : (ROLE_NAMES[roleKey as string] || roleKey);
};

// ... (ListItem Component - No changes) ...
const ListItem: React.FC<{ 
    okr: OKR, 
    type: 'SELF' | 'PEER' | 'MANAGER' | 'APPROVER' | 'OBSERVER' | 'CC', 
    onSelect: (okr: OKR) => void,
    roleOptions: {value: string, label: string}[]
}> = ({ okr, type, onSelect, roleOptions }) => {
    let label = '查看详情';
    let statusColor = 'bg-slate-100 text-slate-600';
    let statusText = '未知状态';
    
    const { l1, l2, l3 } = getApproverRoles(okr);

    if (type === 'SELF') {
        if (okr.isPerformanceArchived || okr.status === OKRStatus.CLOSED) {
            label = '查看结果';
            statusColor = 'bg-slate-200 text-slate-800';
            statusText = '已归档';
        } else if (okr.status === OKRStatus.PUBLISHED) {
            label = '开始自评';
            statusColor = 'bg-gray-100 text-gray-700';
            statusText = '草稿';
        } else if (okr.status === OKRStatus.PENDING_ASSESSMENT_APPROVAL) {
            label = '查看';
            statusColor = 'bg-orange-100 text-orange-700';
            statusText = `等待 ${getRoleLabel(l1 as string, roleOptions) || '上级'} 评分`;
        } else if (okr.status === OKRStatus.PENDING_L2_APPROVAL) {
             label = '查看';
             statusColor = 'bg-blue-50 text-blue-600';
             statusText = `等待 ${getRoleLabel(l2 as string, roleOptions) || '二级'} 审批`;
        } else if (okr.status === OKRStatus.PENDING_L3_APPROVAL) {
             label = '查看';
             statusColor = 'bg-indigo-50 text-indigo-600';
             statusText = `等待 ${getRoleLabel(l3 as string, roleOptions) || '三级'} 审批`;
        } else if (okr.status === OKRStatus.PENDING_ARCHIVE) {
             label = '查看';
             statusColor = 'bg-cyan-50 text-cyan-600';
             statusText = '待归档';
        }
    } else if (type === 'PEER' || type === 'CC') {
            label = '协作评估';
            statusColor = 'bg-purple-100 text-purple-700';
            statusText = type === 'PEER' ? '受邀评估' : '协作/抄送';
    } else {
        label = '查看详情';
        statusText = '查看';
    }

    // STRICT VISIBILITY CHECK FOR SELF: Only show grade if Closed or Archived
    const canSeeResult = type !== 'SELF' || okr.status === OKRStatus.CLOSED || okr.isPerformanceArchived;

    return (
        <div className={`bg-white p-6 rounded-xl shadow-sm border border-slate-200 transition-colors hover:border-brand-300`}>
            <div className="flex justify-between items-start mb-4">
                <div>
                    <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                        {okr.userName}
                        {okr.level === OKRLevel.DEPARTMENT && <span className="bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0.5 rounded">团队/业务线</span>}
                        {okr.isPerformanceArchived && (
                            <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200 font-normal">绩效已定稿</span>
                        )}
                        {type === 'CC' && <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-normal">CC</span>}
                    </h3>
                    <p className="text-sm text-slate-500">{okr.title}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                     <span className={`${statusColor} text-xs px-2 py-1 rounded font-medium`}>
                        {statusText}
                    </span>
                    {okr.finalGrade && okr.finalGrade !== FinalGrade.PENDING && canSeeResult && (
                        <span className="text-xs font-bold bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            {okr.finalGrade}
                        </span>
                    )}
                </div>
            </div>
            
            <button 
                onClick={() => onSelect(okr)}
                className={`w-full py-2 font-medium rounded border flex items-center justify-center gap-2 bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200`}
            >
                {type === 'SELF' && okr.status === OKRStatus.PUBLISHED && !okr.isPerformanceArchived && <Edit size={14} />}
                {label}
            </button>
        </div>
    )
}

// User List Helper
const UserListPill: React.FC<{ users: User[], onClick?: (user: User) => void, emptyText?: string, actionLabel?: string }> = ({ users, onClick, emptyText, actionLabel }) => {
    if (!users || users.length === 0) return <div className="text-xs text-slate-400 italic">{emptyText || '无'}</div>;
    return (
        <div className="flex flex-wrap gap-2">
            {users.map(u => (
                <button 
                    key={u.id}
                    onClick={() => onClick && onClick(u)}
                    disabled={!onClick}
                    className={`flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-full text-xs border transition-all ${
                        onClick 
                        ? 'bg-white border-slate-200 hover:border-brand-300 hover:shadow-sm hover:text-brand-600 cursor-pointer group' 
                        : 'bg-slate-50 border-slate-100 text-slate-600 cursor-default'
                    }`}
                >
                    <img src={u.avatar} className="w-4 h-4 rounded-full" alt="" />
                    <span className="font-medium">{u.name}</span>
                    {actionLabel && onClick && <span className="text-[10px] text-brand-500 opacity-0 group-hover:opacity-100 transition-opacity ml-0.5">{actionLabel}</span>}
                </button>
            ))}
        </div>
    );
};

// ... (Assessment Modal Component - No changes) ...
interface AssessmentModalProps {
    okr: OKR;
    onChange: (okr: OKR) => void;
    onClose: () => void;
    currentUser: User;
    allUsers: User[];
    roleOptions: {value: string, label: string}[];
    workflows: ApprovalWorkflow[];
    onAlert: (title: string, msg: React.ReactNode, type?: 'info'|'success'|'warning'|'danger') => void;
    onConfirm: (title: string, msg: React.ReactNode, onConfirm: () => void, type?: 'info'|'danger'|'warning'|'success') => void;
    onRefresh: () => void;
}

const AssessmentModal: React.FC<AssessmentModalProps> = ({ okr: selectedOKR, onChange: setSelectedOKR, onClose, currentUser: user, allUsers, roleOptions, workflows, onAlert, onConfirm, onRefresh }) => {
    const isSelf = user.id === selectedOKR.userId;
    const isPeer = selectedOKR.peerReviewers?.includes(user.id) && !isSelf;
    const { l1, l2, l3, cc } = getApproverRoles(selectedOKR);
    
    // Role Checks
    const isL1Manager = user.role === l1;
    const isL2ApproverUser = user.role === l2;
    const isL3ApproverUser = user.role === l3;
    const isCCUser = cc.includes(user.role);
    
    // Executive/High Level Override: Anyone who acts as L2 or L3 in ANY workflow is considered "High Level" for Veto purposes
    const isHighLevelRole = workflows.some(w => w.approverRoleL2 === user.role || w.approverRoleL3 === user.role);
    
    const isTeamOKR = selectedOKR.level === OKRLevel.DEPARTMENT;
    
    // Team Primary override
    const isDeptMatch = selectedOKR.department === user.department;
    const isPrimaryOverride = user.isPrimaryApprover && isDeptMatch && 
                              (selectedOKR.status === OKRStatus.PENDING_ASSESSMENT_APPROVAL || 
                               selectedOKR.status === OKRStatus.PENDING_L2_APPROVAL || 
                               selectedOKR.status === OKRStatus.PENDING_L3_APPROVAL);

    // Permission Logic
    const canEditSelf = isSelf && (selectedOKR.status === OKRStatus.PUBLISHED) && !selectedOKR.isPerformanceArchived;
    
    const isAssessmentPhase = 
        selectedOKR.status === OKRStatus.PENDING_ASSESSMENT_APPROVAL || 
        selectedOKR.status === OKRStatus.GRADING || 
        selectedOKR.status === OKRStatus.PENDING_L2_APPROVAL || 
        selectedOKR.status === OKRStatus.PENDING_L3_APPROVAL;

    const canEditPeer = (isPeer || isCCUser) && isAssessmentPhase && !selectedOKR.isPerformanceArchived;
    
    const isL1Stage = (isL1Manager && selectedOKR.status === OKRStatus.PENDING_ASSESSMENT_APPROVAL) || isPrimaryOverride;
    
    // Cross Stage check: Strictly enforce workflow stage for L2/L3.
    // Executives should NOT edit unless it is explicitly their turn (L2/L3) or specific Veto stage.
    const isCrossStage = (isL2ApproverUser && selectedOKR.status === OKRStatus.PENDING_L2_APPROVAL) || 
                         (isL3ApproverUser && selectedOKR.status === OKRStatus.PENDING_L3_APPROVAL);

    const isVetoStage = isHighLevelRole && selectedOKR.status === OKRStatus.PENDING_ARCHIVE && !selectedOKR.isPerformanceArchived;

    // FIX: Strictly allow Detailed Grading ONLY in L1 Stage. 
    const canGradeDetails = (!user.role.includes(Role.ADMIN) && !selectedOKR.isPerformanceArchived && isL1Stage);
    
    const canAdjustGrade = (!user.role.includes(Role.ADMIN) && !selectedOKR.isPerformanceArchived && (isL1Stage || isCrossStage)) || isVetoStage;

    const isHRBP = user.role === Role.HRBP || user.role === Role.ADMIN;
    const canArchive = isHRBP && selectedOKR.status === OKRStatus.PENDING_ARCHIVE && !selectedOKR.isPerformanceArchived;
    
    const showManagerColumn = user.role === Role.ADMIN || (!isSelf && !isPeer && !isCCUser) || (isSelf && (selectedOKR.status === OKRStatus.CLOSED || selectedOKR.isPerformanceArchived));

    const hasCCFeedback = !!(selectedOKR.ccFeedback && selectedOKR.ccFeedback.length > 0);
    const targetUser = allUsers.find(u => u.id === selectedOKR.userId);
    const isTargetCadre = targetUser ? isCadre(targetUser.role) : false;

    // Determine Status Text in Modal
    let modalStatusText = '未知';
    let modalStatusColor = 'bg-slate-200 text-slate-700';
    if (selectedOKR.isPerformanceArchived) { modalStatusText = '绩效已归档'; modalStatusColor = 'bg-slate-800 text-white'; }
    else if (selectedOKR.status === OKRStatus.PUBLISHED) { modalStatusText = '草稿 (自评未提交)'; modalStatusColor = 'bg-gray-100 text-gray-700'; }
    else if (selectedOKR.status === OKRStatus.PENDING_ASSESSMENT_APPROVAL) { 
        if (selectedOKR.totalScore) {
            modalStatusText = '已评分，待提交';
            modalStatusColor = 'bg-indigo-100 text-indigo-700';
        } else {
            modalStatusText = `已提交，等待 ${getRoleLabel(l1 as string, roleOptions) || '上级'} 评分`; 
            modalStatusColor = 'bg-orange-100 text-orange-700'; 
        }
    }
    else if (selectedOKR.status === OKRStatus.PENDING_L2_APPROVAL) { modalStatusText = `等待 ${getRoleLabel(l2 as string, roleOptions) || '二级'} 审批`; modalStatusColor = 'bg-blue-100 text-blue-700'; }
    else if (selectedOKR.status === OKRStatus.PENDING_L3_APPROVAL) { modalStatusText = `等待 ${getRoleLabel(l3 as string, roleOptions) || '三级'} 审批`; modalStatusColor = 'bg-indigo-100 text-indigo-700'; }
    else if (selectedOKR.status === OKRStatus.PENDING_ARCHIVE) { modalStatusText = '已评估 (待归档)'; modalStatusColor = 'bg-cyan-100 text-cyan-700'; }
    else { modalStatusText = '已归档'; modalStatusColor = 'bg-slate-200 text-slate-700'; }

    const myPeerFeedback = selectedOKR.ccFeedback?.find(f => f.userId === user.id);
    const [peerComment, setPeerComment] = useState(myPeerFeedback?.comment || '');
    const [peerGrade, setPeerGrade] = useState<string>(myPeerFeedback?.recommendedGrade || '');
    const [isSaving, setIsSaving] = useState(false);
    const saveTimeoutRef = useRef<any>(null);

    const updateAndSave = (newOKR: OKR) => {
        setSelectedOKR(newOKR);
        setIsSaving(true);
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
            saveOKR(newOKR);
            setTimeout(() => { setIsSaving(false); }, 600);
        }, 1000);
    };

    // ... (Helper Calculation Functions from original file) ...
    const calculateSelfScore = (okr: OKR) => {
        let total = 0;
        okr.objectives.forEach(obj => {
            let objScore = 0;
            obj.keyResults.forEach(kr => {
                objScore += (kr.selfScore || 0) * (kr.weight / 100);
            });
            total += objScore * (obj.weight / 100);
        });
        return Math.round(total * 10) / 10;
    };
    const updateKRSelf = (objIndex: number, krIndex: number, field: 'selfScore' | 'selfComment', val: any) => {
        const newOKR = { ...selectedOKR };
        const kr = newOKR.objectives[objIndex].keyResults[krIndex];
        // @ts-ignore
        kr[field] = val;
        if (field === 'selfScore') {
             let objScore = 0;
             newOKR.objectives[objIndex].keyResults.forEach(k => {
                 objScore += (k.selfScore || 0) * (k.weight / 100);
             });
             newOKR.objectives[objIndex].selfScore = Math.round(objScore * 10) / 10;
             const newTotal = calculateSelfScore(newOKR);
             if (!newOKR.overallSelfAssessment) newOKR.overallSelfAssessment = { score: 0, comment: '' };
             newOKR.overallSelfAssessment.score = newTotal;
        }
        updateAndSave(newOKR);
    };
    const updateObjSelf = (objIndex: number, field: 'selfComment', val: any) => {
        const newOKR = { ...selectedOKR };
        const obj = newOKR.objectives[objIndex];
        // @ts-ignore
        obj[field] = val;
        updateAndSave(newOKR);
    };
    const updateOverallSelf = (field: 'score' | 'comment', val: any) => {
        const newOKR = { ...selectedOKR };
        const assessment = newOKR.overallSelfAssessment || { score: 0, comment: '' };
        // @ts-ignore
        assessment[field] = val;
        newOKR.overallSelfAssessment = assessment;
        updateAndSave(newOKR);
    };
    const updateManagerScore = (objIndex: number, krIndex: number | null, field: 'managerScore' | 'managerComment', val: any) => {
        const newOKR = { ...selectedOKR };
        if (krIndex !== null) {
            const kr = newOKR.objectives[objIndex].keyResults[krIndex];
            // @ts-ignore
            kr[field] = val;
            if (field === 'managerScore') {
                const calculatedObjScore = calculateObjScoreFromKRs(newOKR.objectives[objIndex]);
                newOKR.objectives[objIndex].managerScore = calculatedObjScore;
            }
        } else {
            const obj = newOKR.objectives[objIndex];
            // @ts-ignore
            obj[field] = val;
        }
        const newTotalScore = calculateOKRTotalScore(newOKR);
        newOKR.totalScore = newTotalScore;
        newOKR.finalGrade = determineGrade(newTotalScore);
        if (newOKR.overallManagerAssessment) {
            newOKR.overallManagerAssessment.score = newTotalScore;
        } else {
            newOKR.overallManagerAssessment = { score: newTotalScore, comment: '' };
        }
        updateAndSave(newOKR);
    };
    const updateFinalGrade = (grade: FinalGrade) => {
        const newOKR = { ...selectedOKR, finalGrade: grade };
        updateAndSave(newOKR);
    }
    const updateOverallManagerComment = (comment: string) => {
        const newOKR = { ...selectedOKR };
        const assessment = newOKR.overallManagerAssessment || { score: newOKR.totalScore || 0, comment: '' };
        assessment.comment = comment;
        assessment.score = newOKR.totalScore || 0;
        newOKR.overallManagerAssessment = assessment;
        updateAndSave(newOKR);
    }
    const updateAdjustmentReason = (val: string) => {
        const newOKR = { ...selectedOKR, adjustmentReason: val };
        updateAndSave(newOKR);
    }

    const handleManagerConfirm = () => {
        if (isCrossStage && !selectedOKR.adjustmentReason?.trim()) {
            onAlert("提示", "跨级调整/终审必须填写说明理由。", "warning");
            return;
        }
        saveOKR(selectedOKR); 
        onRefresh();
        onClose(); 
        onAlert("成功", isCrossStage ? "已暂存，请到列表页进行批量批准。" : "评估已暂存，请在列表页批量提交。", "success");
    };

    const handleSingleReject = () => {
        if (!selectedOKR.adjustmentReason?.trim()) {
            onAlert("提示", "驳回必须填写说明理由。", "warning");
            return;
        }
        onConfirm("确认驳回?", "将退回给一级主管重新评分。", () => {
            saveOKR(selectedOKR);
            updateOKRStatus(selectedOKR.id, OKRStatus.PENDING_ASSESSMENT_APPROVAL);
            onRefresh();
            onClose();
            onAlert("已驳回", "已退回至评分阶段。", "danger");
        }, "danger");
    };

    const handleExecutiveVeto = () => {
        if (!selectedOKR.adjustmentReason?.trim()) {
            onAlert("提示", "行使一票否决权必须填写【调整/驳回说明】理由。", "warning");
            return;
        }
        onConfirm("确认一票否决 (驳回)?", "该操作将强制把流程退回至【一级评分】阶段，要求重新评估。\n此操作具有最高优先级。", () => {
             const updated = { ...selectedOKR, status: OKRStatus.PENDING_ASSESSMENT_APPROVAL };
             saveOKR(updated);
             onRefresh();
             onClose();
             onAlert("已否决", "已强制退回至评分阶段。", "danger");
        }, "danger");
    };

    const handleSavePeerReview = (comment: string, grade?: string) => {
        if (!comment.trim()) {
            onAlert("提示", "请输入评估内容。", "warning");
            return;
        }
        const newOKR = { ...selectedOKR };
        if (!newOKR.ccFeedback) newOKR.ccFeedback = [];
        const existingIdx = newOKR.ccFeedback.findIndex(f => f.userId === user.id);
        const feedbackPayload = {
            userId: user.id,
            userName: user.name,
            role: getRoleLabel(user.role as string, roleOptions),
            comment: comment,
            recommendedGrade: grade === '' ? undefined : (grade as FinalGrade),
            createdAt: new Date().toISOString()
        };
        if (existingIdx > -1) {
            newOKR.ccFeedback[existingIdx] = feedbackPayload;
        } else {
            newOKR.ccFeedback.push(feedbackPayload);
        }
        saveOKR(newOKR);
        setSelectedOKR(newOKR); 
        onRefresh();
        onAlert("成功", "360 评估已提交。", "success");
    };

    const submitSelfAssessmentClick = () => {
        if (!selectedOKR.overallSelfAssessment?.comment?.trim()) return onAlert("提示", "请填写整体自评总结 (不能留空)。", "warning");
        onConfirm("确认提交自评?", "提交后将直接进入上级评分阶段，提交后无法修改。", () => {
            const updated = { ...selectedOKR, status: OKRStatus.PENDING_ASSESSMENT_APPROVAL };
            saveOKR(updated);
            onRefresh();
            onClose();
            setTimeout(() => {
                onAlert("提交成功", "自评已提交，请等待上级评估。", "success");
            }, 100);
        }, "info");
    };

    const handleArchivePerformance = (deptName: string, deptOkrs: OKR[]) => {
        onConfirm("确认绩效归档", `确认将 ${deptName} 的 ${deptOkrs.length} 个绩效进行归档发布？\n此操作将锁定评分结果，员工可查看最终定级。`, () => {
            deptOkrs.forEach(o => {
                const updated = { ...o, isPerformanceArchived: true, status: OKRStatus.PUBLISHED };
                saveOKR(updated);
            });
            onRefresh();
            onClose();
            onAlert("操作成功", `${deptName} 绩效已归档发布。`, "success");
        }, "success");
    }

    // ... (Render Modal Content - Identical to original) ...
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
             <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">
                <div className="p-6 border-b border-slate-100 flex justify-between items-start bg-slate-50 rounded-t-xl">
                        <div>
                        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                            绩效评估: {selectedOKR.title}
                            <span className="text-sm font-normal text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">{selectedOKR.userName}</span>
                        </h2>
                        <div className="flex items-center gap-4 mt-2">
                            <span className={`px-2 py-1 rounded text-xs font-bold ${modalStatusColor}`}>{modalStatusText}</span>
                            {selectedOKR.level === OKRLevel.DEPARTMENT && (
                                <span className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded border border-blue-200 font-bold">团队/业务线目标</span>
                            )}
                            {selectedOKR.totalScore !== undefined && showManagerColumn && (
                                <span className="text-sm font-bold text-indigo-600">最终评级: {selectedOKR.finalGrade || '待定'}</span>
                            )}
                            {isPrimaryOverride && (
                                <span className="text-xs bg-amber-50 text-amber-700 px-2 py-1 rounded border border-amber-200 flex items-center gap-1 font-bold">
                                    <Crown size={12}/> 团队第一负责人权限生效
                                </span>
                            )}
                        </div>
                        </div>
                        <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><div className="p-2 hover:bg-slate-200 rounded-full">✕</div></button>
                </div>
                
                {!showManagerColumn && isSelf && !selectedOKR.isPerformanceArchived && selectedOKR.status !== OKRStatus.PUBLISHED && (
                    <div className="bg-indigo-50 text-indigo-800 px-6 py-2 text-sm flex items-center gap-2 border-b border-indigo-100">
                        <Lock size={14} />
                        <span>评估流程进行中，最终结果将在流程结束并归档后可见。</span>
                    </div>
                )}
                {selectedOKR.isPerformanceArchived && (
                    <div className="bg-slate-800 text-white px-6 py-2 text-sm flex items-center gap-2">
                        <Lock size={14} />
                        <span>绩效结果已归档锁定。</span>
                    </div>
                )}
                
                <div className="flex-1 overflow-y-auto p-8 space-y-8 relative">
                    <div className="absolute top-2 right-4 z-10">
                        {isSaving ? (
                            <div className="flex items-center gap-2 text-xs text-brand-600 bg-brand-50 px-3 py-1.5 rounded-full animate-pulse border border-brand-100 shadow-sm">
                                <Loader2 size={12} className="animate-spin" /> 正在保存...
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 text-xs text-green-600 bg-green-50 px-3 py-1.5 rounded-full border border-green-100 transition-opacity duration-500 shadow-sm">
                                <Cloud size={12} /> 已自动保存
                            </div>
                        )}
                    </div>
                    
                    {/* Top Adjustment Explanation - REMOVED per requirement */}

                    {selectedOKR.level === OKRLevel.DEPARTMENT && !isSelf && (
                        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 flex items-center gap-3">
                            <Users className="text-indigo-600 h-6 w-6 flex-shrink-0" />
                            <div>
                                <h3 className="text-sm font-bold text-indigo-900">团队/业务线绩效评估</h3>
                                <p className="text-xs text-indigo-700">这是该团队的集体绩效目标。作为上级审批人，您的评分将直接作为该团队的最终绩效结果。</p>
                            </div>
                        </div>
                    )}

                    {selectedOKR.objectives.map((obj, i) => (
                        <div key={obj.id} className="border border-slate-200 rounded-lg overflow-hidden mb-6">
                            <div className="bg-slate-100 p-4 border-b border-slate-200 flex justify-between items-center">
                                <h3 className="font-bold text-slate-800">O{i+1}: {obj.content} <span className="text-xs font-normal text-slate-500 ml-2">权重 {obj.weight}%</span></h3>
                                {canEditSelf && <span className="text-xs text-blue-600 font-medium">当前自评: {obj.selfScore || 0}分</span>}
                            </div>
                            <div className="divide-y divide-slate-100 bg-white">
                                {obj.keyResults.map((kr, k) => (
                                    <div key={kr.id} className={`p-4 grid grid-cols-1 gap-6 ${showManagerColumn ? 'md:grid-cols-2' : ''}`}>
                                        <div className="bg-slate-50 p-3 rounded border border-slate-200">
                                            <div className="text-sm font-medium text-slate-700 mb-2">KR {k+1}: {kr.content}</div>
                                            <div className="flex gap-2">
                                                <input type="number" disabled={!canEditSelf} placeholder="0" className="w-16 p-1.5 border rounded text-sm text-center font-medium text-blue-700" value={kr.selfScore ?? ''} onChange={e => updateKRSelf(i, k, 'selfScore', e.target.value)} />
                                                <div className="flex-1 text-sm text-slate-600 bg-white p-1.5 rounded border border-slate-200 min-h-[50px] flex items-center">
                                                    {canEditSelf ? (
                                                        <textarea className="w-full h-full outline-none bg-transparent resize-none overflow-hidden py-1" rows={2} value={kr.selfComment || ''} onChange={e => updateKRSelf(i, k, 'selfComment', e.target.value)} placeholder="自评 (不能留空)..." />
                                                    ) : (
                                                        <div className="whitespace-pre-wrap">{kr.selfComment || '-'}</div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        {showManagerColumn && (
                                            <div className="bg-orange-50 p-3 rounded border border-orange-200">
                                                <div className="text-xs text-orange-400 mb-1">上级评分</div>
                                                <div className="flex gap-2">
                                                    <input type="number" disabled={!canGradeDetails && !canAdjustGrade} placeholder={isCrossStage ? "L1" : "0"} className={`w-14 p-1.5 border border-orange-300 rounded text-sm text-center focus:outline-none focus:border-orange-500 ${!canGradeDetails && !canAdjustGrade ? 'bg-slate-100 text-slate-500' : ''}`} value={kr.managerScore ?? ''} onChange={e => updateManagerScore(i, k, 'managerScore', Number(e.target.value))} />
                                                    <input disabled={!canGradeDetails && !canAdjustGrade} className={`flex-1 p-1.5 border border-orange-300 rounded text-sm focus:outline-none focus:border-orange-500 ${!canGradeDetails && !canAdjustGrade ? 'bg-slate-100 text-slate-500' : ''}`} placeholder="评价..." value={kr.managerComment || ''} onChange={e => updateManagerScore(i, k, 'managerComment', e.target.value)} />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                            <div className="bg-slate-50/80 p-4 border-t border-slate-200">
                                <div className={`grid grid-cols-1 gap-6 ${showManagerColumn ? 'md:grid-cols-2' : ''}`}>
                                        <div className="border border-blue-100 bg-blue-50/30 rounded p-3 h-full flex flex-col">
                                        <div className="flex justify-between items-center mb-2">
                                            <label className="text-xs font-bold text-blue-700">目标自评总结 (O{i+1})</label>
                                            <span className="text-sm font-bold text-blue-700">{obj.selfScore || 0} 分</span>
                                        </div>
                                        {canEditSelf ? (
                                            <textarea className="w-full p-2 text-sm border border-blue-200 rounded focus:ring-1 focus:ring-blue-500 outline-none flex-1 resize-y min-h-[3rem]" rows={3} placeholder="请对本目标的完成情况进行总结 (不能留空)..." value={obj.selfComment || ''} onChange={e => updateObjSelf(i, 'selfComment', e.target.value)} />
                                        ) : (
                                            <div className="text-sm text-slate-600 whitespace-pre-wrap bg-white p-2 rounded border border-blue-100/50 flex-1 min-h-[3rem]">{obj.selfComment || '未填写'}</div>
                                        )}
                                        </div>
                                        {showManagerColumn && (
                                            <div className="border border-orange-100 bg-orange-50/30 rounded p-3 h-full flex flex-col">
                                            <div className="flex justify-between items-center mb-2">
                                                <label className="text-xs font-bold text-orange-700">上级目标评价 (O{i+1})</label>
                                                <span className="text-sm font-bold text-orange-700">{obj.managerScore || 0} 分</span>
                                            </div>
                                            {canGradeDetails || canAdjustGrade ? (
                                                <textarea className="w-full p-2 text-sm border border-orange-200 rounded focus:ring-1 focus:ring-orange-500 outline-none flex-1 resize-y min-h-[3rem]" rows={3} placeholder="请对该目标的达成情况进行评价..." value={obj.managerComment || ''} onChange={e => updateManagerScore(i, null, 'managerComment', e.target.value)} />
                                            ) : (
                                                <div className="text-sm text-slate-600 whitespace-pre-wrap bg-white p-2 rounded border border-orange-100/50 flex-1 min-h-[3rem]">{obj.managerComment || '未填写'}</div>
                                            )}
                                            </div>
                                        )}
                                </div>
                            </div>
                        </div>
                    ))}

                    <div className="bg-blue-50 p-6 rounded-lg border border-blue-200 shadow-sm mt-4">
                        <h3 className="font-bold text-blue-900 mb-4 flex items-center gap-2"><UserCheck size={18}/> 员工整体自评</h3>
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="lg:col-span-1 space-y-4">
                                    <div className="bg-white p-4 rounded-lg border border-blue-100 shadow-sm text-center h-full flex flex-col justify-center">
                                    <div className="text-xs text-blue-500 uppercase font-bold mb-1">自评总分 (自动计算)</div>
                                    <div className="text-4xl font-extrabold text-blue-600">
                                        {selectedOKR.overallSelfAssessment?.score || 0}
                                    </div>
                                    </div>
                            </div>
                            <div className="lg:col-span-2">
                                <label className="block text-sm font-medium text-blue-800 mb-2">个人自评总结</label>
                                {canEditSelf ? (
                                    <textarea className="w-full p-3 border border-blue-200 rounded-lg min-h-[8rem] h-auto focus:ring-2 focus:ring-blue-500 outline-none" placeholder="请对本周期工作进行整体复盘和总结 (不能留空)..." value={selectedOKR.overallSelfAssessment?.comment || ''} onChange={e => updateOverallSelf('comment', e.target.value)} />
                                ) : (
                                    <div className="w-full p-4 border border-blue-200 rounded-lg min-h-[8rem] h-auto bg-white text-slate-700 whitespace-pre-wrap">{selectedOKR.overallSelfAssessment?.comment || '未填写评价'}</div>
                                )}
                            </div>
                        </div>
                    </div>

                    {showManagerColumn && (
                            <div className="bg-orange-50 p-6 rounded-lg border border-orange-200 shadow-sm mt-4">
                            <h3 className="font-bold text-orange-900 mb-4 flex items-center gap-2"><ShieldCheck size={18}/> 上级整体评价 & 定级</h3>
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                <div className="lg:col-span-1 space-y-4">
                                        <div className="bg-white p-4 rounded-lg border border-orange-100 shadow-sm text-center h-full flex flex-col justify-center">
                                        <div className="text-xs text-orange-500 uppercase font-bold mb-1">最终定级</div>
                                        {canAdjustGrade ? (
                                            <select className={`text-4xl font-extrabold text-center bg-transparent outline-none w-full ${selectedOKR.finalGrade === 'S' ? 'text-yellow-500' : selectedOKR.finalGrade === 'A' ? 'text-green-500' : 'text-blue-500'}`} value={selectedOKR.finalGrade || FinalGrade.PENDING} onChange={e => updateFinalGrade(e.target.value as FinalGrade)}>
                                                <option value={FinalGrade.PENDING}>待定</option>
                                                <option value={FinalGrade.S}>S</option>
                                                <option value={FinalGrade.A}>A</option>
                                                <option value={FinalGrade.B}>B</option>
                                                <option value={FinalGrade.C}>C</option>
                                            </select>
                                        ) : (
                                            <div className={`text-4xl font-extrabold flex items-center justify-center ${selectedOKR.finalGrade === 'S' ? 'text-yellow-500' : selectedOKR.finalGrade === 'A' ? 'text-green-500' : 'text-blue-500'}`}>{selectedOKR.finalGrade || FinalGrade.PENDING}</div>
                                        )}
                                        </div>
                                </div>
                                <div className="lg:col-span-2">
                                    <label className="block text-sm font-medium text-orange-800 mb-2">上级总结评价</label>
                                    {canGradeDetails || canAdjustGrade ? <textarea className="w-full p-3 border border-orange-200 rounded-lg min-h-[10rem] focus:ring-2 focus:ring-orange-500 outline-none" placeholder="请填写整体评价总结..." value={selectedOKR.overallManagerAssessment?.comment || ''} onChange={e => updateOverallManagerComment(e.target.value)}/> : <div className="w-full p-4 border border-orange-200 rounded-lg min-h-[10rem] h-auto bg-white text-slate-700 whitespace-pre-wrap">{selectedOKR.overallManagerAssessment?.comment || '未填写评价'}</div>}
                                </div>
                            </div>
                            
                            {(isCrossStage || isPrimaryOverride || selectedOKR.adjustmentReason || isVetoStage) && (
                                    <div className="bg-purple-50 p-4 rounded-lg border border-purple-200 mt-4">
                                    <h4 className="text-sm font-bold text-purple-900 mb-2 flex items-center gap-2">
                                        <GitMerge size={16}/> 
                                        {isVetoStage ? '一票否决/调整说明' : (isTargetCadre ? '干部跨级调整说明' : '跨级/负责调整说明')}
                                        {(isCrossStage || isVetoStage) && <span className="text-[10px] bg-red-100 text-red-600 px-2 rounded-full font-bold border border-red-200">* 必填</span>}
                                    </h4>
                                    <textarea className="w-full p-2 text-sm border border-purple-300 rounded focus:ring-1 focus:ring-purple-500 outline-none" rows={2} placeholder={isVetoStage ? "请填写一票否决的具体原因，以便下级修正..." : (isTargetCadre ? "作为上级主管，如需调整该干部的评分，请在此详细记录调整原因..." : "若对评分进行调整，请务必在此说明原因...")} value={selectedOKR.adjustmentReason || ''} onChange={e => updateAdjustmentReason(e.target.value)} disabled={!canAdjustGrade} />
                                </div>
                            )}
                        </div>
                    )}

                    {(hasCCFeedback || isCCUser || canEditPeer) && (
                        <div className="bg-slate-50 p-6 rounded-lg border border-slate-200 shadow-sm mt-4">
                            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <MessageCircle size={18} /> 360° 协作评估 / 建议 <span className="text-xs font-normal text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">Peer Review</span>
                            </h3>
                            {hasCCFeedback && (
                                <div className="space-y-3 mb-4">
                                    {selectedOKR.ccFeedback?.map((fb, idx) => (
                                        <div key={idx} className="bg-white p-3 rounded border border-slate-100 flex flex-col gap-2">
                                            <div className="flex justify-between items-start">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-sm text-slate-700">{fb.userName}</span>
                                                    <span className="text-xs text-slate-400 bg-slate-50 px-1.5 rounded border border-slate-100">{fb.role}</span>
                                                </div>
                                                <span className="text-xs text-slate-400">{new Date(fb.createdAt).toLocaleDateString()}</span>
                                            </div>
                                            <div className="text-sm text-slate-600">{fb.comment}</div>
                                            {fb.recommendedGrade && (
                                                <div className="text-xs font-bold text-slate-500">
                                                    推荐评级: <span className="text-brand-600">{fb.recommendedGrade}</span>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                            {canEditPeer && (
                                <div className="bg-purple-50 p-4 rounded border border-purple-100 shadow-sm mt-2">
                                    <h4 className="text-sm font-bold text-purple-900 mb-2 flex items-center gap-2"><Users size={16}/> 填写您的协作评估 (360 Peer Review / CC)</h4>
                                    <textarea className="w-full p-2 text-sm border border-purple-200 rounded focus:ring-1 focus:ring-purple-500 outline-none mb-3 min-h-[4rem]" placeholder="作为协作方，请对该成员的工作表现提供反馈..." value={peerComment} onChange={e => setPeerComment(e.target.value)} />
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-slate-600">建议评级:</span>
                                            <select className="text-sm border border-purple-200 rounded p-1 outline-none focus:border-purple-500" value={peerGrade} onChange={e => setPeerGrade(e.target.value as FinalGrade)}>
                                                <option value="">(不指定)</option>
                                                <option value={FinalGrade.S}>S</option>
                                                <option value={FinalGrade.A}>A</option>
                                                <option value={FinalGrade.B}>B</option>
                                                <option value={FinalGrade.C}>C</option>
                                            </select>
                                        </div>
                                        <button onClick={() => handleSavePeerReview(peerComment, peerGrade)} className="bg-purple-600 text-white px-4 py-1.5 rounded text-xs font-bold hover:bg-purple-700 flex items-center gap-1"><Send size={12}/> 提交评估</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
                <div className="p-6 border-t border-slate-100 bg-slate-50 rounded-b-xl flex justify-between items-center">
                    <div className="flex items-center gap-2">{isSaving && <span className="text-xs text-brand-600 flex items-center gap-1 animate-pulse"><CheckCircle2 size={12}/> 自动保存中...</span>}</div>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded">关闭</button>
                        {isSelf && canEditSelf && <button onClick={submitSelfAssessmentClick} className="px-6 py-2 bg-brand-600 text-white rounded hover:bg-brand-700 flex items-center gap-2"><Send size={16}/> 提交自评</button>}
                        {isCrossStage ? (
                            <>
                                <button onClick={handleManagerConfirm} className="px-4 py-2 bg-slate-200 text-slate-700 rounded hover:bg-slate-300 font-medium">保存 (去列表批量批准)</button>
                                <button onClick={handleSingleReject} className="px-4 py-2 bg-white border border-red-200 text-red-600 rounded hover:bg-red-50 flex items-center gap-2 font-bold"><ThumbsDown size={16}/> 驳回</button>
                            </>
                        ) : (
                            (canGradeDetails || canAdjustGrade) && !isVetoStage && <button onClick={handleManagerConfirm} className="px-6 py-2 bg-brand-600 text-white rounded hover:bg-brand-700 flex items-center gap-2">保存 & 完成</button>
                        )}
                        {isVetoStage && <button onClick={handleExecutiveVeto} className="px-4 py-2 bg-white border border-red-600 text-red-600 rounded hover:bg-red-50 flex items-center gap-2 font-bold shadow-sm"><ThumbsDown size={16}/> 一票否决 (退回重评)</button>}
                        {canArchive && <button onClick={() => { handleArchivePerformance(selectedOKR.department || '该部门', [selectedOKR]); }} className="px-6 py-2 bg-brand-600 text-white rounded hover:bg-brand-700 flex items-center gap-2 font-medium"><CheckSquare size={18} /> 绩效归档发布</button>}
                    </div>
                </div>
            </div>
        </div>
    );
};

export const Assessment: React.FC = () => {
    const user = useCurrentUser();
    const [okrs, setOkrs] = useState<OKR[]>([]);
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [gradeConfigs, setGradeConfigs] = useState<GradeConfiguration[]>([]);
    const [workflows, setWorkflows] = useState<ApprovalWorkflow[]>([]);
    const [roleOptions, setRoleOptions] = useState<{value: string, label: string}[]>([]);
    const [selectedOKR, setSelectedOKR] = useState<OKR | null>(null);
    const [teamViewFilterDept, setTeamViewFilterDept] = useState<string | null>(null);

    const [dialog, setDialog] = useState<{
        isOpen: boolean;
        title: string;
        message: React.ReactNode;
        type: 'info' | 'danger' | 'success' | 'warning';
        showCancel: boolean;
        onConfirm?: () => void;
    }>({ isOpen: false, title: '', message: '', type: 'info', showCancel: true });

    const openAlert = (title: string, message: React.ReactNode, type: 'info'|'success'|'warning'|'danger' = 'info') => {
        setDialog({ isOpen: true, title, message, type, showCancel: false });
    };

    const openConfirm = (title: string, message: React.ReactNode, onConfirm: () => void, type: 'info'|'danger'|'warning'|'success' = 'info') => {
        setDialog({ isOpen: true, title, message, type, showCancel: true, onConfirm });
    };
    
    // Refresh Data
    const refreshData = () => {
        setOkrs(getOKRs());
        setGradeConfigs(getGradeConfigs());
        setAllUsers(getUsers());
        setWorkflows(getWorkflows());
        setRoleOptions(getRoles());
    }

    useEffect(() => {
        refreshData();
        setSelectedOKR(null);
        window.addEventListener('alignflow_data_updated', refreshData);
        return () => window.removeEventListener('alignflow_data_updated', refreshData);
    }, [user]);

    // DYNAMIC PERMISSIONS: Driven by Workflow Configuration
    
    // 1. Is Manager/Approver: Is this user an L1, L2, or L3 approver in ANY active workflow?
    const isManagerOrApprover = useMemo(() => {
        if (user.role === Role.ADMIN) return true;
        // Check if user's role is L1, L2 or L3 in any workflow definition
        return workflows.some(w => 
            w.approverRoleL1 === user.role || 
            w.approverRoleL2 === user.role || 
            w.approverRoleL3 === user.role
        );
    }, [workflows, user.role]);

    const isHRBP = user.role === Role.HRBP || user.role === Role.ADMIN;
    const isAdmin = user.role === Role.ADMIN;

    // 2. Is Cross Level Approver: Is this user an L2 or L3 approver? (Typically Executives/VPs/GMs)
    const isCrossLevelApprover = useMemo(() => {
        if (user.role === Role.ADMIN) return true;
        return workflows.some(w => w.approverRoleL2 === user.role || w.approverRoleL3 === user.role);
    }, [workflows, user.role]);

    // 3. NEW: Can Assess Leaders? 
    // True if current user is an approver (L1/L2/L3) for ANY role that is *itself* a "Cadre" (Leader)
    const canAssessLeaders = useMemo(() => {
        if (isAdmin || user.role === Role.PRESIDENT) return true;
        
        // Find workflows where I am an approver
        const myApprovingWorkflows = workflows.filter(w => 
            w.approverRoleL1 === user.role || 
            w.approverRoleL2 === user.role || 
            w.approverRoleL3 === user.role
        );

        // Check if any of the target roles in these workflows are "Leaders"
        // (A Leader is defined as a role that is an approver in some other workflow)
        return myApprovingWorkflows.some(w => {
            // Is the target role (e.g. VP) a leader?
            // Reuse logic from 'isCadre': check if this target role appears as an approver in ANY workflow
            return workflows.some(checkWf => 
                checkWf.approverRoleL1 === w.targetRole || 
                checkWf.approverRoleL2 === w.targetRole
            );
        });
    }, [workflows, user.role, isAdmin]);

    const isDeptHead = [Role.BUSINESS_HEAD, Role.TECH_HEAD, Role.QA_HEAD].includes(user.role as Role); // Still useful for initial filters but could be dynamic too
    const isTeamPrimaryLead = user.isPrimaryApprover;

    // Tabs
    const [activeTab, setActiveTab] = useState<'MY_SELF' | 'COLLABORATION' | 'TEAM_MEMBERS' | 'TEAM_LEADERS' | 'TEAM_OVERVIEW' | 'ARCHIVE'>('MY_SELF');

    // ... (Logic for filtering OKRs - Copied from previous logic)
    const isCadreRole = (r: Role | string) => workflows.some(w => w.approverRoleL1 === r || w.approverRoleL2 === r);

    const myOKRs = okrs.filter(o => o.userId === user.id && (
        o.status === OKRStatus.PUBLISHED || 
        o.status === OKRStatus.PENDING_ASSESSMENT_APPROVAL ||
        o.status === OKRStatus.PENDING_L2_APPROVAL ||
        o.status === OKRStatus.PENDING_L3_APPROVAL ||
        o.status === OKRStatus.PENDING_ARCHIVE ||
        o.status === OKRStatus.CLOSED
    ));

    const peerOKRs = okrs.filter(o => {
        if (o.userId === user.id) return false;
        if (o.isPerformanceArchived) return false;
        const isAssessmentPhase = 
            o.status === OKRStatus.PENDING_ASSESSMENT_APPROVAL || 
            o.status === OKRStatus.GRADING || 
            o.status === OKRStatus.PENDING_L2_APPROVAL || 
            o.status === OKRStatus.PENDING_L3_APPROVAL;
        if (!isAssessmentPhase) return false;
        const isPeer = o.peerReviewers?.includes(user.id);
        const { cc } = getApproverRoles(o);
        const isCC = cc.includes(user.role);
        return isPeer || isCC;
    });

    const crossLevelManagedDepts = useMemo(() => {
        if (!isCrossLevelApprover && user.role !== Role.PRESIDENT) return new Set<string>();
        if (isAdmin || user.role === Role.PRESIDENT) { 
            return new Set(allUsers.map(u => u.department).filter(Boolean));
        }
        const depts = new Set<string>();
        allUsers.forEach(u => {
            if (u.id === user.id) return; 
            const dummyOKR: OKR = { id: 'temp', userId: u.id, userName: u.name, level: OKRLevel.PERSONAL, department: u.department, title: 'dummy', period: '', status: OKRStatus.DRAFT, objectives: [], createdAt: '' };
            const { l1, l2, l3 } = getApproverRoles(dummyOKR);
            if (l2 === user.role || l3 === user.role) {
                if (u.department) depts.add(u.department);
            }
            if (l1 === user.role) {
                if (u.department) depts.add(u.department);
            }
        });
        if (user.department) depts.add(user.department);
        return depts;
    }, [user, allUsers, isCrossLevelApprover, isAdmin]);

    const allAccessibleTeamOKRs = isManagerOrApprover
        ? okrs.filter(o => {
            if (o.userId === user.id) return false; 
            if (isAdmin || user.role === Role.PRESIDENT) return true;
            
            const isSubmitted = o.status !== OKRStatus.DRAFT && o.status !== OKRStatus.PENDING_MANAGER && o.status !== OKRStatus.PENDING_GM;
            if (!isSubmitted) return false;
            
            const { l1, l2, l3 } = getApproverRoles(o);
            let isL1Approver = user.role === l1;
            // Strict check: if I am L1, generally I only see my dept unless I am cross-dept manager
            if (isL1Approver && isDeptHead && o.department !== user.department) isL1Approver = false;
            
            const isCrossApprover = (user.role === l2 || user.role === l3);
            const isDeptView = isDeptHead && o.department === user.department;
            const isCrossDeptView = isCrossLevelApprover && crossLevelManagedDepts.has(o.department || '');
            const isPrimaryView = isTeamPrimaryLead && o.department === user.department;
            
            return isL1Approver || isCrossApprover || isDeptView || isCrossDeptView || isPrimaryView;
        })
        : [];

    const isLeaderUser = (u: User) => isCadreRole(u.role);

    const leaderOKRs = allAccessibleTeamOKRs.filter(o => {
        const targetUser = allUsers.find(u => u.id === o.userId);
        return targetUser && isLeaderUser(targetUser);
    });
    
    const memberOKRs = allAccessibleTeamOKRs.filter(o => {
        const targetUser = allUsers.find(u => u.id === o.userId);
        return targetUser && !isLeaderUser(targetUser);
    });

    const myActionCount = myOKRs.filter(o => o.status === OKRStatus.PUBLISHED).length;
    const collabCount = peerOKRs.length;

    const getActionCount = (list: OKR[]) => {
        if (isAdmin) return 0;
        const activeList = list.filter(o => !o.isPerformanceArchived);
        return activeList.filter(o => {
            const { l1, l2, l3 } = getApproverRoles(o);
            if (user.role === l1 && o.status === OKRStatus.PENDING_ASSESSMENT_APPROVAL) return true;
            if (user.role === l2 && o.status === OKRStatus.PENDING_L2_APPROVAL) return true;
            if (user.role === l3 && o.status === OKRStatus.PENDING_L3_APPROVAL) return true;
            if (user.role === Role.PRESIDENT && o.level === OKRLevel.DEPARTMENT && o.status === OKRStatus.PENDING_ASSESSMENT_APPROVAL) return true;
            return false;
        }).length;
    };
    const memberActionCount = getActionCount(memberOKRs);
    const leaderActionCount = getActionCount(leaderOKRs);

    const pendingArchiveOKRs = isHRBP ? okrs.filter(o => o.status === OKRStatus.PENDING_ARCHIVE && !o.isPerformanceArchived) : [];
    const pendingArchiveByDept = pendingArchiveOKRs.reduce((acc, okr) => {
        const dept = okr.department || '其他';
        if (!acc[dept]) acc[dept] = [];
        acc[dept].push(okr);
        return acc;
    }, {} as Record<string, OKR[]>);

    const displayedMemberOKRs = teamViewFilterDept ? memberOKRs.filter(o => o.department === teamViewFilterDept) : memberOKRs;
    const directReports = displayedMemberOKRs.filter(o => getApproverRoles(o).l1 === user.role);
    const crossLevelReports = displayedMemberOKRs.filter(o => {
        const { l2, l3 } = getApproverRoles(o);
        return l2 === user.role || l3 === user.role;
    });
    const otherTeamMembers = displayedMemberOKRs.filter(o => {
        if (isAdmin || user.role === Role.PRESIDENT) return true;
        const { l1, l2, l3 } = getApproverRoles(o);
        return l1 !== user.role && l2 !== user.role && l3 !== user.role;
    });

    const actionScopeOKRs = useMemo(() => {
        if (isAdmin) return [];
        const active = displayedMemberOKRs.filter(o => !o.isPerformanceArchived);
        if (isTeamPrimaryLead) {
            return active.filter(o => o.department === user.department);
        } else {
            return active.filter(o => {
                const { l1, l2, l3 } = getApproverRoles(o);
                if (user.role === Role.PRESIDENT && o.level === OKRLevel.DEPARTMENT) return true;
                return l1 === user.role || l2 === user.role || l3 === user.role;
            });
        }
    }, [displayedMemberOKRs, isTeamPrimaryLead, user, isAdmin]);

    const pendingSelfOKRs = actionScopeOKRs.filter(o => o.status === OKRStatus.PUBLISHED);
    const pendingGradingOKRs = actionScopeOKRs.filter(o => {
        if (o.status !== OKRStatus.PENDING_ASSESSMENT_APPROVAL) return false;
        if (o.totalScore) return false; 
        if (isTeamPrimaryLead) return true;
        const { l1 } = getApproverRoles(o);
        if (user.role === Role.PRESIDENT && o.level === OKRLevel.DEPARTMENT) return true;
        return user.role === l1;
    });
    const gradedPendingSubmitOKRs = actionScopeOKRs.filter(o => {
        if (o.status !== OKRStatus.PENDING_ASSESSMENT_APPROVAL) return false;
        if (!o.totalScore) return false; 
        if (isTeamPrimaryLead) return true;
        const { l1 } = getApproverRoles(o);
        return user.role === l1;
    });
    const unifiedActionableItems = actionScopeOKRs.filter(o => {
         const { l1, l2, l3 } = getApproverRoles(o);
         if (user.role === l1 && o.status === OKRStatus.PENDING_ASSESSMENT_APPROVAL && o.totalScore) return true;
         if (isTeamPrimaryLead && o.status === OKRStatus.PENDING_ASSESSMENT_APPROVAL && o.totalScore) return true;
         if (user.role === l2 && o.status === OKRStatus.PENDING_L2_APPROVAL) return true;
         if (user.role === l3 && o.status === OKRStatus.PENDING_L3_APPROVAL) return true;
         if (user.role === Role.PRESIDENT && o.level === OKRLevel.DEPARTMENT && o.status === OKRStatus.PENDING_ASSESSMENT_APPROVAL) return true;
         return false;
    });
    const isBatchActionAllowed = pendingGradingOKRs.length === 0 && unifiedActionableItems.length > 0;
    const blockingReason = pendingGradingOKRs.length > 0 ? `还有 ${pendingGradingOKRs.length} 位成员等待评分或提交自评。` : unifiedActionableItems.length === 0 ? "没有可批量批准的项目。" : "";
    
    const hasL1ActionScope = pendingSelfOKRs.length > 0 || pendingGradingOKRs.length > 0 || gradedPendingSubmitOKRs.length > 0;
    const hasCrossActionScope = unifiedActionableItems.some(o => 
        o.status === OKRStatus.PENDING_L2_APPROVAL || 
        o.status === OKRStatus.PENDING_L3_APPROVAL || 
        (user.role === Role.PRESIDENT && o.level === OKRLevel.DEPARTMENT && o.status === OKRStatus.PENDING_ASSESSMENT_APPROVAL)
    );

    const leaderActionScopeOKRs = useMemo(() => {
        if (isAdmin) return [];
        const active = leaderOKRs.filter(o => !o.isPerformanceArchived);
        return active.filter(o => {
            const { l1, l2, l3 } = getApproverRoles(o);
            if (user.role === Role.PRESIDENT && o.level === OKRLevel.DEPARTMENT) return true;
            return l1 === user.role || l2 === user.role || l3 === user.role;
        });
    }, [leaderOKRs, user, isAdmin]);

    const leaderPendingGradingOKRs = leaderActionScopeOKRs.filter(o => {
        if (o.status !== OKRStatus.PENDING_ASSESSMENT_APPROVAL) return false;
        const { l1 } = getApproverRoles(o);
        if (user.role === l1 && !o.totalScore) return true;
        return false; 
    });

    const leaderUnifiedActionableItems = leaderActionScopeOKRs.filter(o => {
         const { l1, l2, l3 } = getApproverRoles(o);
         if (user.role === l1 && o.status === OKRStatus.PENDING_ASSESSMENT_APPROVAL && o.totalScore) return true;
         if (user.role === l2 && o.status === OKRStatus.PENDING_L2_APPROVAL) return true;
         if (user.role === l3 && o.status === OKRStatus.PENDING_L3_APPROVAL) return true;
         if (user.role === Role.PRESIDENT && o.level === OKRLevel.DEPARTMENT && o.status === OKRStatus.PENDING_ASSESSMENT_APPROVAL) return true;
         return false;
    });

    const leaderBatchActionAllowed = leaderPendingGradingOKRs.length === 0 && leaderUnifiedActionableItems.length > 0;
    const leaderBlockingReason = leaderPendingGradingOKRs.length > 0 ? `还有 ${leaderPendingGradingOKRs.length} 位干部等待初评分。` : leaderUnifiedActionableItems.length === 0 ? "没有可批量批准的项目。" : "";

    const teamSubDepts = isCrossLevelApprover || user.role === Role.PRESIDENT ? Array.from(crossLevelManagedDepts) : Array.from(new Set(memberOKRs.map(o => o.department).filter(Boolean)));
    const totalPoolCount = isCrossLevelApprover && !teamViewFilterDept ? memberOKRs.length : displayedMemberOKRs.length; 
    const aggregateMemberStats = (okrList: OKR[]) => {
        return gradeConfigs.map(cfg => {
            const count = okrList.filter(o => o.finalGrade === cfg.grade).length;
            const targetCount = Math.round(okrList.length * (cfg.quota / 100));
            const percent = okrList.length > 0 ? Math.round((count / okrList.length) * 100) : 0;
            return { grade: cfg.grade, count, quota: cfg.quota, targetCount, percent, isOver: percent > cfg.quota };
        });
    };
    const currentDistStats = aggregateMemberStats(displayedMemberOKRs.filter(o => o.finalGrade && o.finalGrade !== FinalGrade.PENDING));

    // ... (Handlers) ...
    const handleUnifiedBatchApprove = (items: OKR[]) => {
        openConfirm("确认批量批准?", `即将批准 ${items.length} 位成员的绩效评估进入下一阶段。`, () => {
             items.forEach(okr => {
                const { l2, l3 } = getApproverRoles(okr);
                let nextStatus = OKRStatus.PENDING_ARCHIVE; 
                if (okr.status === OKRStatus.PENDING_ASSESSMENT_APPROVAL) { if (l2) nextStatus = OKRStatus.PENDING_L2_APPROVAL; } 
                else if (okr.status === OKRStatus.PENDING_L2_APPROVAL) { if (l3) nextStatus = OKRStatus.PENDING_L3_APPROVAL; }
                if (user.role === Role.PRESIDENT) nextStatus = OKRStatus.PENDING_ARCHIVE;
                if (okr.status === OKRStatus.PENDING_L2_APPROVAL && !l3) nextStatus = OKRStatus.PENDING_ARCHIVE;
                updateOKRStatus(okr.id, nextStatus);
            });
            refreshData();
            openAlert("批量操作成功", "已完成批准。", "success");
        }, "success");
    };
    const handleBatchRejectCrossLevel = (items: OKR[]) => {
        openConfirm("确认批量驳回?", `即将把 ${items.length} 个评估退回给上一级重新评分。`, () => {
             items.forEach(okr => { updateOKRStatus(okr.id, OKRStatus.PENDING_ASSESSMENT_APPROVAL); });
             refreshData();
             openAlert("批量操作成功", "已全部驳回至评分阶段。", "success");
        }, "danger");
    };
    const handleArchivePerformance = (deptName: string, deptOkrs: OKR[]) => {
        openConfirm("确认绩效归档", `确认将 ${deptName} 的 ${deptOkrs.length} 个绩效进行归档发布？`, () => {
            deptOkrs.forEach(o => {
                const updated = { ...o, isPerformanceArchived: true, status: OKRStatus.PUBLISHED };
                saveOKR(updated);
            });
            refreshData();
            openAlert("操作成功", `${deptName} 绩效已归档发布。`, "success");
        }, "success");
    };

    const renderTable = (list: OKR[], title: string, subtitle?: string) => {
        if (!list || list.length === 0) return null;
        return (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-6 animate-in fade-in slide-in-from-bottom-2">
                <div className="p-4 bg-slate-50 border-b border-slate-200">
                    <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                         <div className="w-1 h-4 bg-brand-500 rounded-full"></div> {title}
                         <span className="ml-auto text-xs bg-white border border-slate-200 px-2 py-0.5 rounded-full text-slate-500 font-normal">{list.length} 人</span>
                    </h3>
                    {subtitle && <p className="text-xs text-slate-500 mt-1 pl-3">{subtitle}</p>}
                </div>
                <div className="divide-y divide-slate-100">
                    {list.map(okr => {
                        // Check if it's the current user's turn to act
                        const { l1, l2, l3 } = getApproverRoles(okr);
                        let isMyTurn = false;
                        if (okr.status === OKRStatus.PENDING_ASSESSMENT_APPROVAL) {
                             if (user.role === l1) isMyTurn = true;
                             if (user.isPrimaryApprover && okr.department === user.department) isMyTurn = true;
                             if (user.role === Role.PRESIDENT && okr.level === OKRLevel.DEPARTMENT) isMyTurn = true;
                        } else if (okr.status === OKRStatus.PENDING_L2_APPROVAL) {
                             if (user.role === l2) isMyTurn = true;
                        } else if (okr.status === OKRStatus.PENDING_L3_APPROVAL) {
                             if (user.role === l3) isMyTurn = true;
                        }

                        const btnText = isMyTurn ? "评估" : "查看";
                        const btnClass = isMyTurn 
                            ? "bg-brand-600 text-white border-brand-600 hover:bg-brand-700 shadow-sm" 
                            : "bg-white border-slate-200 text-slate-600 hover:bg-brand-50 hover:text-brand-600 hover:border-brand-200";

                        return (
                        <div key={okr.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors group">
                            <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm shadow-sm ${okr.finalGrade === 'S' ? 'bg-yellow-100 text-yellow-700 border border-yellow-200' : okr.finalGrade === 'A' ? 'bg-green-100 text-green-700 border border-green-200' : okr.finalGrade === 'B' ? 'bg-blue-100 text-blue-700 border border-blue-200' : okr.finalGrade === 'C' ? 'bg-slate-100 text-slate-600 border border-slate-300' : 'bg-slate-50 text-slate-400 border border-slate-200' }`}>{okr.finalGrade || '-'}</div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-bold text-slate-800">{okr.userName}</span>
                                        <span className="text-[10px] text-slate-500 bg-white border border-slate-200 px-1.5 rounded">{okr.department}</span>
                                        {okr.isPerformanceArchived && <Lock size={10} className="text-slate-400"/>}
                                    </div>
                                    <div className="text-xs text-slate-500 truncate max-w-[200px] md:max-w-xs">{okr.title}</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="text-right hidden md:block">
                                    <div className="text-[10px] text-slate-400 uppercase">Status</div>
                                    <div className={`text-xs font-bold ${okr.status === OKRStatus.PUBLISHED ? 'text-slate-500' : okr.status === OKRStatus.PENDING_ARCHIVE ? 'text-cyan-600' : okr.isPerformanceArchived ? 'text-slate-800' : 'text-orange-600'}`}>
                                         {okr.status === OKRStatus.PENDING_ASSESSMENT_APPROVAL ? '待评分' : okr.status === OKRStatus.PENDING_L2_APPROVAL ? '待二级审批' : okr.status === OKRStatus.PENDING_L3_APPROVAL ? '待三级审批' : okr.status === OKRStatus.PENDING_ARCHIVE ? '待归档' : okr.isPerformanceArchived ? '已归档' : '草稿/自评中'}
                                    </div>
                                </div>
                                <button onClick={() => setSelectedOKR(okr)} className={`px-4 py-1.5 rounded text-xs font-bold transition-colors border ${btnClass}`}>
                                    {btnText}
                                </button>
                            </div>
                        </div>
                    )})}
                </div>
            </div>
        );
    }

    return (
        // ... (Return JSX - Identical to original file) ...
        <div className="space-y-8 animate-in fade-in duration-300">
            <ConfirmDialog isOpen={dialog.isOpen} onClose={() => setDialog({ ...dialog, isOpen: false })} onConfirm={dialog.onConfirm} title={dialog.title} message={dialog.message} type={dialog.type} showCancel={dialog.showCancel} />

            <div>
                 <h1 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                    <Star className="text-orange-500" /> 绩效评估中心
                 </h1>
                 <div className="flex border-b border-slate-200 gap-2 overflow-x-auto">
                     <button onClick={() => setActiveTab('MY_SELF')} className={`px-4 py-3 font-medium text-sm transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${activeTab === 'MY_SELF' ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                        我的绩效 {myActionCount > 0 && <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full min-w-[18px] text-center font-bold">{myActionCount}</span>}
                    </button>
                    <button onClick={() => setActiveTab('COLLABORATION')} className={`px-4 py-3 font-medium text-sm transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${activeTab === 'COLLABORATION' ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                        受邀协作评估 {collabCount > 0 && <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full min-w-[18px] text-center font-bold">{collabCount}</span>}
                    </button>
                    {isManagerOrApprover && (
                        <>
                            <button onClick={() => { setActiveTab('TEAM_MEMBERS'); setTeamViewFilterDept(null); }} className={`px-4 py-3 font-medium text-sm transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${activeTab === 'TEAM_MEMBERS' ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                                团队成员评估 {memberActionCount > 0 && <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full min-w-[18px] text-center font-bold">{memberActionCount}</span>}
                            </button>
                            <button onClick={() => { setActiveTab('TEAM_OVERVIEW'); setTeamViewFilterDept(null); }} className={`px-4 py-3 font-medium text-sm transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${activeTab === 'TEAM_OVERVIEW' ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                                直属&跨级团队评估
                            </button>
                        </>
                    )}
                    {canAssessLeaders && (
                        <button onClick={() => { setActiveTab('TEAM_LEADERS'); setTeamViewFilterDept(null); }} className={`px-4 py-3 font-medium text-sm transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${activeTab === 'TEAM_LEADERS' ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                            管理干部评估 {leaderActionCount > 0 && <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full min-w-[18px] text-center font-bold">{leaderActionCount}</span>}
                        </button>
                    )}
                    {isHRBP && (
                         <button onClick={() => setActiveTab('ARCHIVE')} className={`px-4 py-3 font-medium text-sm transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${activeTab === 'ARCHIVE' ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                            归档发布 <span className="bg-red-100 text-red-600 px-2 py-0.5 rounded-full text-xs">{pendingArchiveOKRs.length}</span>
                        </button>
                    )}
                 </div>
            </div>

            {/* TAB: MY SELF */}
            {activeTab === 'MY_SELF' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-left-4">
                    {myOKRs.length === 0 && <p className="text-slate-400 italic text-sm p-4 col-span-full">暂无个人评估任务。</p>}
                    {myOKRs.map(okr => <ListItem key={okr.id} okr={okr} type="SELF" onSelect={setSelectedOKR} roleOptions={roleOptions} />)}
                </div>
            )}

            {/* TAB: COLLABORATION */}
            {activeTab === 'COLLABORATION' && (
                 <div className="space-y-4 animate-in fade-in slide-in-from-left-4">
                     <div className="flex items-center gap-2 text-sm text-purple-600 bg-purple-50 p-3 rounded mb-4 border border-purple-100">
                         <MessageCircle size={16}/> <span>以下是您受邀参与协作评估 (Peer Review) 或抄送 (CC) 的目标。请提供您的反馈意见。</span>
                     </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {peerOKRs.length === 0 && <p className="text-slate-400 italic text-sm p-4 col-span-full">暂无受邀协作记录。</p>}
                        {peerOKRs.map(okr => <ListItem key={okr.id} okr={okr} type={getApproverRoles(okr).cc.includes(user.role) ? "CC" : "PEER"} onSelect={setSelectedOKR} roleOptions={roleOptions} />)}
                     </div>
                 </div>
            )}

            {/* TAB: TEAM MEMBERS (ICs) */}
            {activeTab === 'TEAM_MEMBERS' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-left-4">
                     {(isCrossLevelApprover || user.role === Role.PRESIDENT || teamSubDepts.length > 1) && (
                        <div className="flex gap-2 overflow-x-auto pb-2 border-b border-slate-100 mb-6 no-scrollbar">
                            <button onClick={() => setTeamViewFilterDept(null)} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap border ${!teamViewFilterDept ? 'bg-slate-800 text-white border-slate-800 shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                                <LayoutGrid size={12} className="inline mr-1 mb-0.5"/> 总览
                            </button>
                            {teamSubDepts.map(dept => (
                                <button key={dept} onClick={() => setTeamViewFilterDept(dept)} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap border ${teamViewFilterDept === dept ? 'bg-brand-600 text-white border-brand-600 shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                                    {dept}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Unified Action Panel for Members */}
                    {(hasL1ActionScope || hasCrossActionScope || (isTeamPrimaryLead && unifiedActionableItems.length > 0)) && (
                        <div className={`border rounded-xl shadow-sm mb-6 overflow-hidden bg-white ${isTeamPrimaryLead ? 'border-amber-200' : 'border-slate-200'}`}>
                            <div className="p-4 border-b border-slate-200 flex items-center justify-between gap-3 bg-white">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${isTeamPrimaryLead ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>
                                        {isTeamPrimaryLead ? <Crown size={20}/> : <Briefcase size={20}/>}
                                    </div>
                                    <div><h3 className="font-bold text-lg text-slate-800">{isTeamPrimaryLead ? '审批确认 (第一责任人)' : '审批确认 (直属团队)'}</h3></div>
                                </div>
                                {isTeamPrimaryLead && <div className="text-xs bg-amber-50 text-amber-700 px-3 py-1 rounded-full border border-amber-200 flex items-center gap-1"><ShieldCheck size={12}/> 全员审批权限已激活</div>}
                            </div>
                            <div className={`p-6 grid grid-cols-1 md:grid-cols-2 gap-8 divide-y md:divide-y-0 md:divide-x divide-slate-100`}>
                                <div className="space-y-6">
                                    <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-100"><UserCog size={16} className="text-slate-500"/><h4 className="font-bold text-slate-700 text-sm uppercase tracking-wide">团队成员进度</h4></div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center text-sm"><span className="text-slate-600 font-medium flex items-center gap-2"><div className={`w-1.5 h-1.5 rounded-full ${pendingSelfOKRs.length > 0 ? 'bg-red-500' : 'bg-slate-300'}`}></div> 待员工自评 ({pendingSelfOKRs.length})</span></div>
                                        <UserListPill users={pendingSelfOKRs.map(o => allUsers.find(u => u.id === o.userId)).filter(Boolean) as User[]} emptyText="无待办"/>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center text-sm"><span className="text-slate-600 font-medium flex items-center gap-2"><div className={`w-1.5 h-1.5 rounded-full ${pendingGradingOKRs.length > 0 ? 'bg-orange-500' : 'bg-slate-300'}`}></div> 待您评分 ({pendingGradingOKRs.length})</span></div>
                                        <UserListPill users={pendingGradingOKRs.map(o => allUsers.find(u => u.id === o.userId)).filter(Boolean) as User[]} onClick={(u) => { const targetOKR = pendingGradingOKRs.find(o => o.userId === u.id); if(targetOKR) setSelectedOKR(targetOKR); }} actionLabel="去评分" emptyText="无待办"/>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center text-sm"><span className="text-slate-600 font-medium flex items-center gap-2"><div className={`w-1.5 h-1.5 rounded-full ${gradedPendingSubmitOKRs.length > 0 ? 'bg-indigo-500' : 'bg-slate-300'}`}></div> 已评分，待提交 ({gradedPendingSubmitOKRs.length})</span></div>
                                        <UserListPill users={gradedPendingSubmitOKRs.map(o => allUsers.find(u => u.id === o.userId)).filter(Boolean) as User[]} onClick={(u) => { const targetOKR = gradedPendingSubmitOKRs.find(o => o.userId === u.id); if(targetOKR) setSelectedOKR(targetOKR); }} actionLabel="重新评估" emptyText="无待办"/>
                                    </div>
                                </div>
                                <div className="space-y-4 pt-4 md:pt-0 pl-0 md:pl-8 flex flex-col">
                                    <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-100"><ShieldCheck size={16} className="text-indigo-600"/><h4 className="font-bold text-slate-700 text-sm uppercase tracking-wide">审批提交</h4></div>
                                    <div className="flex-1 bg-indigo-50/40 rounded-xl border border-indigo-100 p-5 flex flex-col justify-between">
                                        <div>
                                            {!isBatchActionAllowed ? (
                                                <div className="flex flex-col gap-3"><div className="flex items-start gap-2 text-orange-600 bg-orange-50 p-3 rounded-lg border border-orange-100"><AlertTriangle size={18} className="mt-0.5 flex-shrink-0"/><span className="text-sm font-medium">{blockingReason}</span></div><p className="text-xs text-slate-500">请先处理左侧的待办事项，确保所有成员完成评估后方可批量批准。</p></div>
                                            ) : (
                                                <div className="space-y-4"><div className="flex items-center gap-2 text-indigo-700 font-bold"><CheckCircle2 size={20} className="text-indigo-600"/><span>可以提交/批准 ({unifiedActionableItems.length} 人)</span></div><div className="bg-white/60 rounded p-3 border border-indigo-50"><p className="text-xs text-slate-500 mb-2">以下成员已完成评估，确认无误后提交：</p><UserListPill users={unifiedActionableItems.map(o => allUsers.find(u => u.id === o.userId)).filter(Boolean) as User[]} /></div></div>
                                            )}
                                        </div>
                                        <div className="mt-6 pt-4 border-t border-indigo-100 flex gap-3">
                                            {(actionScopeOKRs.some(o => o.status === OKRStatus.PENDING_L2_APPROVAL || o.status === OKRStatus.PENDING_L3_APPROVAL) || pendingGradingOKRs.length > 0) && (
                                                <button onClick={() => handleBatchRejectCrossLevel(actionScopeOKRs.filter(o => o.status === OKRStatus.PENDING_L2_APPROVAL || o.status === OKRStatus.PENDING_L3_APPROVAL || o.status === OKRStatus.PENDING_ASSESSMENT_APPROVAL))} className="flex-1 bg-white text-red-600 border border-red-200 px-3 py-2.5 rounded-lg text-sm font-bold hover:bg-red-50 flex justify-center items-center gap-2 transition-colors">全部驳回</button>
                                            )}
                                            <button onClick={() => handleUnifiedBatchApprove(unifiedActionableItems)} disabled={!isBatchActionAllowed || unifiedActionableItems.length === 0} className={`flex-1 px-3 py-2.5 rounded-lg text-sm font-bold flex justify-center items-center gap-2 transition-colors shadow-sm ${!isBatchActionAllowed || unifiedActionableItems.length === 0 ? 'bg-slate-300 text-white cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-md'}`}>批量批准 <ChevronRight size={16} /></button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {directReports.length > 0 && renderTable(directReports, "直属成员列表 (一级管理)", "您是以下成员的直接主管，请完成初评分。")}
                    {crossLevelReports.length > 0 && renderTable(crossLevelReports, "跨级成员列表 (二级/三级终审)", "您是以下成员的二级或三级主管，请进行最终确认或调整。")}
                    {otherTeamMembers.length > 0 && renderTable(otherTeamMembers, "团队其他成员", "您拥有查看权限的团队成员。")}
                    {directReports.length === 0 && crossLevelReports.length === 0 && otherTeamMembers.length === 0 && <div className="p-10 text-center bg-white rounded-xl border border-dashed border-slate-300 text-slate-400 mt-6">暂无可见的团队成员数据。</div>}
                </div>
            )}

            {/* TAB: TEAM OVERVIEW (Charts & Dept Cards) */}
            {activeTab === 'TEAM_OVERVIEW' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-left-4">
                     <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl flex items-start gap-3">
                        <div className="bg-indigo-200 text-indigo-800 p-2 rounded-lg"><PieChart size={20}/></div>
                        <div>
                            <h3 className="font-bold text-indigo-900">直属 & 跨级团队概览</h3>
                            <p className="text-sm text-indigo-800 mt-1">查看团队整体绩效分布情况及各子部门的提交进度。此视图仅包含已提交审批的数据。</p>
                        </div>
                     </div>

                     {/* Stats Dashboard */}
                     {currentDistStats.length > 0 && (
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                            <div className="flex justify-between items-start mb-6">
                                <h3 className="font-bold text-slate-800 flex items-center gap-2"><BarChart3 size={18} /> {teamViewFilterDept ? `${teamViewFilterDept} 等级分布` : '团队整体等级分布'}</h3>
                                <span className="ml-auto text-xs bg-slate-100 text-slate-600 px-3 py-1 rounded-full font-bold">考核总人数: {totalPoolCount} 人</span>
                            </div>
                            <div className="grid grid-cols-4 gap-4">
                                {currentDistStats.map(stat => (
                                    <div key={stat.grade} className={`p-4 rounded-lg border ${stat.isOver ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
                                        <div className="flex justify-between items-center mb-2">
                                            <span className={`text-lg font-bold w-8 h-8 flex items-center justify-center rounded border bg-white ${stat.grade === 'S' ? 'text-yellow-600 border-yellow-200' : stat.grade === 'A' ? 'bg-green-100 text-green-700 border-green-200' : 'text-slate-600 border-slate-200'}`}>{stat.grade}</span>
                                            <div className="flex flex-col items-end"><span className="text-xs text-slate-500 font-mono">目标: {stat.targetCount}人</span><span className="text-[10px] text-slate-400">({stat.quota}%)</span></div>
                                        </div>
                                        <div className="text-2xl font-bold text-slate-800 mb-1">{stat.count} <span className="text-sm font-normal text-slate-400">/ {stat.targetCount}</span></div>
                                        <div className="w-full h-1.5 bg-white rounded-full mt-2 overflow-hidden border border-slate-100"><div className={`h-full ${stat.isOver ? 'bg-red-500' : 'bg-brand-500'}`} style={{width: `${Math.min(100, (stat.count / (totalPoolCount || 1)) * 100)}%`}}></div></div>
                                        {stat.isOver && <div className="text-[10px] text-red-500 mt-1 font-bold">超出配额</div>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Department Cards */}
                    {(isCrossLevelApprover || user.role === Role.PRESIDENT) && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {teamSubDepts.map(dept => {
                                const deptUsersCount = allUsers.filter(u => u.department === dept && !isCadre(u.role)).length;
                                const deptOKRs = memberOKRs.filter(o => o.department === dept);
                                const submittedCount = deptOKRs.filter(o => o.status === OKRStatus.PENDING_L2_APPROVAL || o.status === OKRStatus.PENDING_L3_APPROVAL || o.status === OKRStatus.PENDING_ARCHIVE || o.status === OKRStatus.CLOSED || o.isPerformanceArchived).length;
                                const isSubmitted = submittedCount > 0;
                                const stats = aggregateMemberStats(deptOKRs.filter(o => o.status === OKRStatus.PENDING_L2_APPROVAL || o.status === OKRStatus.PENDING_L3_APPROVAL || o.status === OKRStatus.PENDING_ARCHIVE || o.status === OKRStatus.CLOSED || o.isPerformanceArchived));
                                const overLimit = stats.find(s => s.isOver);

                                return (
                                    <div key={dept} onClick={() => { if(isSubmitted) { setTeamViewFilterDept(dept); setActiveTab('TEAM_MEMBERS'); } }} className={`relative overflow-hidden rounded-xl border p-5 transition-all ${isSubmitted ? 'bg-white border-slate-200 shadow-sm hover:shadow-md hover:border-brand-300 cursor-pointer group' : 'bg-slate-50 border-slate-200 opacity-70 cursor-not-allowed'}`}>
                                        <div className="flex justify-between items-start mb-4">
                                            <div><h4 className={`font-bold text-lg ${isSubmitted ? 'text-slate-800 group-hover:text-brand-600' : 'text-slate-500'}`}>{dept}</h4><p className="text-xs text-slate-500 mt-1">成员: {deptUsersCount} 人</p></div>
                                            <span className={`px-2 py-1 rounded text-xs font-bold border ${isSubmitted ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>{isSubmitted ? '已提交 (待终审)' : '未提交'}</span>
                                        </div>
                                        {isSubmitted ? (
                                            <>
                                                <div className="flex h-2 w-full rounded-full overflow-hidden mb-3 bg-slate-100">{stats.map(s => (s.count > 0 && <div key={s.grade} className={`${s.grade === 'S' ? 'bg-yellow-400' : s.grade === 'A' ? 'bg-green-400' : s.grade === 'B' ? 'bg-blue-400' : 'bg-slate-300'}`} style={{ width: `${s.percent}%` }}></div>))}</div>
                                                <div className="grid grid-cols-4 gap-1 text-center mb-4">{stats.map(s => (<div key={s.grade} className="bg-slate-50 rounded p-1"><div className="text-[10px] text-slate-400 font-bold">{s.grade}</div><div className={`text-sm font-bold ${s.isOver ? 'text-red-500' : 'text-slate-700'}`}>{s.count}</div></div>))}</div>
                                            </>
                                        ) : (
                                            <div className="h-16 flex items-center justify-center text-xs text-slate-400 border border-dashed border-slate-200 rounded mb-4 bg-slate-50/50"><div className="flex items-center gap-1"><Lock size={12}/> 等待一级主管提交</div></div>
                                        )}
                                        {overLimit && isSubmitted && <div className="flex items-center gap-1 text-xs text-red-600 bg-red-50 px-2 py-1.5 rounded mb-2"><AlertTriangle size={12} /><span>{overLimit.grade} 级比例超标</span></div>}
                                        {isSubmitted ? <div className="text-xs font-bold text-brand-600 flex items-center justify-end gap-1 mt-2">查看详情 <ArrowRight size={12}/></div> : <div className="text-xs text-slate-400 flex items-center justify-end gap-1 mt-2"><Lock size={12}/> 暂无权限查看</div>}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* TAB: TEAM LEADERS (Cadres) */}
            {activeTab === 'TEAM_LEADERS' && (
                 <div className="space-y-6 animate-in fade-in slide-in-from-left-4">
                    {(leaderActionScopeOKRs.length > 0 || leaderUnifiedActionableItems.length > 0) && (
                        <div className={`border rounded-xl shadow-sm mb-6 overflow-hidden bg-white border-purple-200`}>
                            <div className="p-4 border-b border-slate-200 flex items-center justify-between gap-3 bg-white">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-purple-100 text-purple-600">
                                        <Crown size={20}/>
                                    </div>
                                    <div><h3 className="font-bold text-lg text-slate-800">干部绩效审批 (批量处理)</h3></div>
                                </div>
                            </div>
                            <div className={`p-6 grid grid-cols-1 md:grid-cols-2 gap-8 divide-y md:divide-y-0 md:divide-x divide-slate-100`}>
                                <div className="space-y-6">
                                    <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-100"><UserCog size={16} className="text-slate-500"/><h4 className="font-bold text-slate-700 text-sm uppercase tracking-wide">待评估干部</h4></div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center text-sm"><span className="text-slate-600 font-medium flex items-center gap-2"><div className={`w-1.5 h-1.5 rounded-full ${leaderPendingGradingOKRs.length > 0 ? 'bg-orange-500' : 'bg-slate-300'}`}></div> 待评分/初审 ({leaderPendingGradingOKRs.length})</span></div>
                                        <UserListPill users={leaderPendingGradingOKRs.map(o => allUsers.find(u => u.id === o.userId)).filter(Boolean) as User[]} onClick={(u) => { const targetOKR = leaderPendingGradingOKRs.find(o => o.userId === u.id); if(targetOKR) setSelectedOKR(targetOKR); }} actionLabel="去评估" emptyText="无待办"/>
                                    </div>
                                </div>
                                <div className="space-y-4 pt-4 md:pt-0 pl-0 md:pl-8 flex flex-col">
                                    <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-100"><ShieldCheck size={16} className="text-indigo-600"/><h4 className="font-bold text-slate-700 text-sm uppercase tracking-wide">审批提交</h4></div>
                                    <div className="flex-1 bg-purple-50/40 rounded-xl border border-purple-100 p-5 flex flex-col justify-between">
                                        <div>
                                            {!leaderBatchActionAllowed ? (
                                                <div className="flex flex-col gap-3"><div className="flex items-start gap-2 text-orange-600 bg-orange-50 p-3 rounded-lg border border-orange-100"><AlertTriangle size={18} className="mt-0.5 flex-shrink-0"/><span className="text-sm font-medium">{leaderBlockingReason}</span></div><p className="text-xs text-slate-500">请先处理左侧的待办事项，完成所有初评后方可批量批准。</p></div>
                                            ) : (
                                                <div className="space-y-4"><div className="flex items-center gap-2 text-purple-700 font-bold"><CheckCircle2 size={20} className="text-purple-600"/><span>可以提交/批准 ({leaderUnifiedActionableItems.length} 人)</span></div><div className="bg-white/60 rounded p-3 border border-purple-50"><p className="text-xs text-slate-500 mb-2">以下干部已完成评估，确认无误后提交：</p><UserListPill users={leaderUnifiedActionableItems.map(o => allUsers.find(u => u.id === o.userId)).filter(Boolean) as User[]} /></div></div>
                                            )}
                                        </div>
                                        <div className="mt-6 pt-4 border-t border-purple-100 flex gap-3">
                                            {(leaderActionScopeOKRs.some(o => o.status === OKRStatus.PENDING_L2_APPROVAL || o.status === OKRStatus.PENDING_L3_APPROVAL) || leaderPendingGradingOKRs.length > 0) && (
                                                <button onClick={() => handleBatchRejectCrossLevel(leaderActionScopeOKRs.filter(o => o.status === OKRStatus.PENDING_L2_APPROVAL || o.status === OKRStatus.PENDING_L3_APPROVAL || o.status === OKRStatus.PENDING_ASSESSMENT_APPROVAL))} className="flex-1 bg-white text-red-600 border border-red-200 px-3 py-2.5 rounded-lg text-sm font-bold hover:bg-red-50 flex justify-center items-center gap-2 transition-colors">全部驳回</button>
                                            )}
                                            <button onClick={() => handleUnifiedBatchApprove(leaderUnifiedActionableItems)} disabled={!leaderBatchActionAllowed || leaderUnifiedActionableItems.length === 0} className={`flex-1 px-3 py-2.5 rounded-lg text-sm font-bold flex justify-center items-center gap-2 transition-colors shadow-sm ${!leaderBatchActionAllowed || leaderUnifiedActionableItems.length === 0 ? 'bg-slate-300 text-white cursor-not-allowed' : 'bg-purple-600 text-white hover:bg-purple-700 hover:shadow-md'}`}>批量批准 <ChevronRight size={16} /></button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="flex items-center gap-3 mb-4">
                        <div className="bg-purple-100 text-purple-600 p-2 rounded-lg"><UserCog size={20}/></div>
                        <div>
                            <h3 className="font-bold text-slate-800 text-lg">直属管理者 (干部) 列表</h3>
                            <p className="text-xs text-slate-500">以下为您管理的一级部门负责人。作为上级，您可对其进行评估或跨级调整。</p>
                        </div>
                    </div>
                    {leaderOKRs.length === 0 && <div className="p-10 text-center bg-white rounded-xl border border-dashed border-slate-300 text-slate-400 mt-6">暂无干部评估数据。</div>}
                    {renderTable(leaderOKRs, "管理者列表")}
                 </div>
            )}
            
            {/* TAB: ARCHIVE */}
            {activeTab === 'ARCHIVE' && isHRBP && (
                 <div className="space-y-6 animate-in fade-in slide-in-from-left-4">
                    <div className="flex justify-between items-center bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                         <div>
                             <h3 className="font-bold text-slate-800 text-lg mb-1">归档发布中心</h3>
                             <p className="text-slate-500 text-sm">将所有已完成上级评分 (待归档) 的 OKR 按部门统一发布，发布后员工可查看结果。</p>
                         </div>
                    </div>
                    {Object.keys(pendingArchiveByDept).length === 0 && <div className="p-10 text-center bg-white rounded-xl border border-dashed border-slate-300 text-slate-400">当前没有等待归档的记录。</div>}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {Object.entries(pendingArchiveByDept).map(([deptName, val]) => {
                            const deptOkrs = val as OKR[];
                            return (
                            <div key={deptName} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-2"><div className="bg-cyan-100 text-cyan-600 p-2 rounded-lg"><Building size={20} /></div><div><h4 className="font-bold text-slate-800">{deptName}</h4><p className="text-xs text-slate-500">待归档: {deptOkrs.length} 人</p></div></div>
                                </div>
                                <div className="space-y-2 mb-4">
                                    {deptOkrs.slice(0, 3).map(okr => <div key={okr.id} className="flex justify-between text-xs text-slate-600 bg-slate-50 p-2 rounded"><span>{okr.userName}</span><span className="font-bold text-indigo-600">{okr.finalGrade} ({okr.totalScore})</span></div>)}
                                    {deptOkrs.length > 3 && <div className="text-center text-xs text-slate-400">... 以及其他 {deptOkrs.length - 3} 人</div>}
                                </div>
                                <button onClick={() => handleArchivePerformance(deptName, deptOkrs)} className="w-full bg-cyan-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-cyan-700 flex items-center justify-center gap-2 transition-colors"><CheckSquare size={16} /> 绩效归档发布</button>
                            </div>
                        )})}
                    </div>
                 </div>
            )}

            {/* Render Assessment Modal if Selected */}
            {selectedOKR && (
                <AssessmentModal 
                    okr={selectedOKR} 
                    onChange={setSelectedOKR} 
                    onClose={() => setSelectedOKR(null)} 
                    currentUser={user} 
                    allUsers={allUsers}
                    roleOptions={roleOptions}
                    workflows={workflows}
                    onAlert={openAlert} 
                    onConfirm={openConfirm} 
                    onRefresh={refreshData} 
                />
            )}
        </div>
    );
};
