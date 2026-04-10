

import React, { useEffect, useState } from 'react';
import { getOKRs, updateOKRStatus, getApproverRoles, getUsers, saveOKR } from '../services/okrService';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { OKR, OKRStatus, Role, ROLE_NAMES, User, FinalGrade, OKRLevel } from '../types';
import { getOKRScopeTypeLabel } from '../utils/okrScope';
import { Check, X, Workflow, ShieldAlert, Users, MessageSquare, FileText, ClipboardList, Send, Copy, MessageCircle, Clock, Calendar, Search } from 'lucide-react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { RejectReasonDialog } from '../components/RejectReasonDialog';

export const Approvals: React.FC = () => {
    const user = useCurrentUser();
    const [pending, setPending] = useState<OKR[]>([]);
    const [feedbackItems, setFeedbackItems] = useState<OKR[]>([]);
    const [activeTab, setActiveTab] = useState<'WORKFLOW' | 'FEEDBACK'>('WORKFLOW');
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedOKR, setSelectedOKR] = useState<OKR | null>(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [rejectTarget, setRejectTarget] = useState<OKR | null>(null);

    // Dialog State
    const [dialog, setDialog] = useState<{
        isOpen: boolean;
        title: string;
        message: React.ReactNode;
        type: 'info' | 'danger' | 'success' | 'warning';
        showCancel: boolean;
        onConfirm?: () => void;
    }>({ isOpen: false, title: '', message: '', type: 'info', showCancel: true });

    const openAlert = (title: string, message: React.ReactNode, type: 'info' | 'success' | 'warning' | 'danger' = 'info') => {
        setDialog({ isOpen: true, title, message, type, showCancel: false });
    };

    const refreshData = () => {
        const all = getOKRs();
        setAllUsers(getUsers());

        // 1. Workflow Approvals (Creation only)
        const workflowItems = all.filter(okr => {
            if (user.role === Role.ADMIN) {
                return okr.status === OKRStatus.PENDING_MANAGER ||
                    okr.status === OKRStatus.PENDING_GM;
            }

            if (!okr.department) return false;
            const { l1, l2 } = getApproverRoles(okr);
            const isDepartmentMatch = user.department === okr.department;
            const isGlobalRole = [
                Role.PRODUCT_GM, Role.TECH_GM, Role.VP_PRODUCT,
                Role.VP_TECH, Role.VP_MARKET, Role.PRESIDENT
            ].includes(user.role as Role);

            // Creation Approvals
            if (okr.status === OKRStatus.PENDING_MANAGER) {
                return user.role === l1 && (isDepartmentMatch || isGlobalRole);
            } else if (okr.status === OKRStatus.PENDING_GM) {
                return l2 && user.role === l2;
            }

            return false;
        });

        // 2. Feedback Items: Creation Phase Only
        // Only show items in DRAFT, PENDING_MANAGER, PENDING_GM
        const feedbackList = all.filter(okr => {
            // Filter out self
            if (okr.userId === user.id) return false;
            if (okr.isPerformanceArchived) return false;

            // STRICTLY Filter for Creation Phase statuses
            const isCreationPhase =
                okr.status === OKRStatus.DRAFT ||
                okr.status === OKRStatus.PENDING_MANAGER ||
                okr.status === OKRStatus.PENDING_GM;

            if (!isCreationPhase) return false;

            // A. Peer Review (Invitation)
            const isPeer = okr.peerReviewers?.includes(user.id);

            // B. CC (Copy)
            const { cc } = getApproverRoles(okr);
            const isCC = cc.includes(user.role);

            return isPeer || isCC;
        });

        setPending(workflowItems);
        setFeedbackItems(feedbackList);
    }

    const filteredPending = pending.filter(okr => {
        if (!searchTerm.trim()) return true;
        const lowTerm = searchTerm.toLowerCase();
        
        const nameMatches = okr.userName.toLowerCase().includes(lowTerm);
        const departmentMatches = okr.department?.toLowerCase().includes(lowTerm);
        const objectiveMatches = okr.objectives.some(obj => 
            obj.content.toLowerCase().includes(lowTerm) ||
            obj.keyResults.some(kr => kr.content.toLowerCase().includes(lowTerm))
        );
        
        return nameMatches || departmentMatches || objectiveMatches;
    });

    const filteredFeedbackItems = feedbackItems.filter(okr => {
        if (!searchTerm.trim()) return true;
        const lowTerm = searchTerm.toLowerCase();
        const nameMatches = okr.userName.toLowerCase().includes(lowTerm);
        const departmentMatches = okr.department?.toLowerCase().includes(lowTerm);
        const objectiveMatches = okr.objectives.some(obj => 
            obj.content.toLowerCase().includes(lowTerm) ||
            obj.keyResults.some(kr => kr.content.toLowerCase().includes(lowTerm))
        );
        return nameMatches || departmentMatches || objectiveMatches;
    });

    const openDetails = (okr: OKR) => {
        setSelectedOKR(okr);
        setIsDetailsOpen(true);
    };

    useEffect(() => {
        refreshData();
        window.addEventListener('alignflow_data_updated', refreshData);
        return () => window.removeEventListener('alignflow_data_updated', refreshData);
    }, [user]);

    // --- Actions ---

    const handleApproveCreation = async (okr: OKR) => {
        if (okr.status === OKRStatus.PENDING_MANAGER) {
            const { l2 } = getApproverRoles(okr);
            if (l2) {
                // 等待状态更新完成，确保数据已保存到服务器
                await updateOKRStatus(okr.id, OKRStatus.PENDING_GM);
            } else {
                await updateOKRStatus(okr.id, OKRStatus.PUBLISHED);
            }
        } else if (okr.status === OKRStatus.PENDING_GM) {
            await updateOKRStatus(okr.id, OKRStatus.PUBLISHED);
        }
        setPending(pending.filter(p => p.id !== okr.id));
    };

    const openRejectDialog = (okr: OKR) => {
        setRejectTarget(okr);
    };

    const confirmRejectCreation = async (reason: string) => {
        if (!rejectTarget) return;
        const okr = rejectTarget;
        await updateOKRStatus(okr.id, OKRStatus.DRAFT, { statusRejectReason: reason });
        setRejectTarget(null);
        setPending(pending.filter(p => p.id !== okr.id));
        setIsDetailsOpen(false);
        setSelectedOKR(null);
    };

    const handleSubmitFeedback = async (okr: OKR, comment: string, grade?: string) => {
        if (!comment.trim()) {
            openAlert("提示", "请输入建议内容。", "warning");
            return;
        }
        const newOKR = { ...okr };
        // Unify storage in ccFeedback for simplicity
        if (!newOKR.ccFeedback) newOKR.ccFeedback = [];

        const existingIdx = newOKR.ccFeedback.findIndex(f => f.userId === user.id);
        const feedbackPayload = {
            userId: user.id,
            userName: user.name,
            role: ROLE_NAMES[user.role as string] || user.role,
            comment: comment,
            recommendedGrade: grade === '' ? undefined : (grade as FinalGrade),
            createdAt: new Date().toISOString()
        };

        if (existingIdx > -1) {
            newOKR.ccFeedback[existingIdx] = feedbackPayload;
        } else {
            newOKR.ccFeedback.push(feedbackPayload);
        }

        // 等待保存完成，确保数据已保存到服务器
        try {
            await saveOKR(newOKR);
            // Note: saveOKR dispatches event which triggers refreshData via useEffect
            openAlert("成功", "建议已提交。", "success");
        } catch (error: any) {
            openAlert("失败", error?.message || "保存建议失败", "danger");
        }
    }

    return (
        <div className="animate-in fade-in duration-300">
            <ConfirmDialog
                isOpen={dialog.isOpen}
                onClose={() => setDialog({ ...dialog, isOpen: false })}
                onConfirm={dialog.onConfirm}
                title={dialog.title}
                message={dialog.message}
                type={dialog.type}
                showCancel={dialog.showCancel}
            />

            <RejectReasonDialog
                isOpen={!!rejectTarget}
                title="驳回 OKR 定稿"
                onClose={() => setRejectTarget(null)}
                onConfirm={confirmRejectCreation}
            />

            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
                    <Check /> 审批与建议中心
                </h1>
                
                <div className="relative w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                        type="text" 
                        placeholder="搜索姓名、部门、O/KR 内容..."
                        className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500/20 active:outline-none focus:outline-none transition-all"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-slate-200 mb-6 overflow-x-auto">
                <button
                    onClick={() => setActiveTab('WORKFLOW')}
                    className={`pb-3 px-6 font-medium text-sm transition-colors relative whitespace-nowrap flex items-center gap-2 ${activeTab === 'WORKFLOW' ? 'text-brand-600' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    待我审批 (定稿)
                    {pending.length > 0 && (
                        <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full min-w-[20px] text-center font-bold">
                            {pending.length}
                        </span>
                    )}
                    {activeTab === 'WORKFLOW' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-brand-600"></div>}
                </button>
                <button
                    onClick={() => setActiveTab('FEEDBACK')}
                    className={`pb-3 px-6 font-medium text-sm transition-colors relative whitespace-nowrap flex items-center gap-2 ${activeTab === 'FEEDBACK' ? 'text-brand-600' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    制定建议 (协作/CC)
                    {feedbackItems.length > 0 && (
                        <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full min-w-[20px] text-center font-bold">
                            {feedbackItems.length}
                        </span>
                    )}
                    {activeTab === 'FEEDBACK' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-brand-600"></div>}
                </button>
            </div>

            {activeTab === 'WORKFLOW' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-left-4">
                    {/* Section 1: OKR Creation Approvals */}
                    <section>
                        <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                            <FileText size={18} /> OKR 定稿审批
                        </h3>
                        {pending.length === 0 && <p className="text-slate-400 italic text-sm ml-6 mb-6">暂无定稿申请。</p>}
                        <div className="space-y-4">
                            {filteredPending.map(okr => (
                                <ApprovalCard
                                    key={okr.id}
                                    okr={okr}
                                    type="CREATION"
                                    allUsers={allUsers}
                                    onApprove={() => handleApproveCreation(okr)}
                                    onReject={() => openRejectDialog(okr)}
                                    onDetails={() => openDetails(okr)}
                                />
                            ))}
                        </div>
                    </section>
                </div>
            )}

            {activeTab === 'FEEDBACK' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-left-4">
                    <div className="flex items-center gap-2 text-sm text-slate-500 bg-indigo-50 p-3 rounded mb-4 border border-indigo-100">
                        <MessageSquare size={16} className="text-indigo-500" />
                        <span>以下为您受邀在「制定阶段」协作或「抄送」的 OKR。您可以提供建议以帮助负责人完善目标。</span>
                    </div>
                    {filteredFeedbackItems.length === 0 && <div className="text-center py-10 text-slate-400">暂无相关记录。</div>}
                    {filteredFeedbackItems.map(okr => (
                        <FeedbackCard
                            key={okr.id}
                            okr={okr}
                            currentUser={user}
                            onSubmitFeedback={(comment, grade) => handleSubmitFeedback(okr, comment, grade)}
                        />
                    ))}
                </div>
            )}

            {isDetailsOpen && selectedOKR && (
                <ApprovalDetailModal 
                    okr={selectedOKR} 
                    allUsers={allUsers}
                    onClose={() => setIsDetailsOpen(false)}
                    onApprove={() => {
                        handleApproveCreation(selectedOKR);
                        setIsDetailsOpen(false);
                    }}
                    onReject={() => {
                        openRejectDialog(selectedOKR);
                    }}
                />
            )}
        </div>
    );
};

// --- Helper Components ---

const ApprovalDetailModal = ({ okr, allUsers, onClose, onApprove, onReject }: any) => {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2 flex-wrap">
                            OKR 详情
                            <span className="text-xs font-normal bg-brand-50 text-brand-600 px-2 py-0.5 rounded border border-brand-100 uppercase">
                                {okr.level === OKRLevel.COMPANY ? '公司级' : okr.level === OKRLevel.DEPARTMENT ? '部门级' : '个人级'}
                            </span>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded border ${okr.level === OKRLevel.PERSONAL ? 'bg-violet-50 text-violet-700 border-violet-100' : 'bg-teal-50 text-teal-800 border-teal-100'}`}>
                                {getOKRScopeTypeLabel(okr)}
                            </span>
                        </h2>
                        <p className="text-slate-500 text-sm mt-0.5">{okr.userName} · {okr.department || '无部门'} · {okr.period}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400 hover:text-slate-600">
                        <X size={20} />
                    </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-8">
                    <div className="mb-8 p-4 bg-brand-50/30 rounded-xl border border-brand-100/50">
                        <h3 className="text-lg font-bold text-brand-900 mb-1">{okr.title}</h3>
                        <p className="text-sm text-slate-600 leading-relaxed">
                            这是 {okr.userName} 在 {okr.period} 的重点目标设定。请审核其合理性和对齐情况。
                        </p>
                    </div>

                    <div className="space-y-8">
                        {okr.objectives.map((o: any, i: number) => (
                            <div key={o.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                                <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 flex justify-between items-center">
                                    <h4 className="font-bold text-slate-800 flex items-center gap-2">
                                        <span className="w-6 h-6 bg-slate-800 text-white rounded-full flex items-center justify-center text-[10px]">O{i + 1}</span>
                                        {o.content}
                                    </h4>
                                    <span className="text-sm font-bold text-slate-500 bg-white px-2 py-1 rounded border border-slate-200">权重: {o.weight}%</span>
                                </div>
                                <div className="p-6">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="text-left text-slate-400 border-b border-slate-100">
                                                <th className="pb-3 font-medium">关键结果 (Key Results)</th>
                                                <th className="pb-3 font-medium w-24 text-right">权重</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {o.keyResults.map((kr: any, ki: number) => (
                                                <tr key={kr.id} className="group">
                                                    <td className="py-4 text-slate-600 group-hover:text-slate-900 transition-colors">
                                                        <div className="flex items-start gap-2">
                                                            <span className="text-slate-300 mt-0.5">KR{ki + 1}:</span>
                                                            {kr.content}
                                                        </div>
                                                    </td>
                                                    <td className="py-4 text-right font-medium text-slate-500">{kr.weight}%</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Collaboration / Feedback Section */}
                    {okr.ccFeedback && okr.ccFeedback.length > 0 && (
                        <div className="mt-12 bg-purple-50/50 rounded-2xl p-6 border border-purple-100">
                             <h4 className="text-sm font-bold text-purple-900 mb-4 flex items-center gap-2">
                                <Users size={18} /> 他人建议
                             </h4>
                             <div className="space-y-4">
                                {okr.ccFeedback.map((fb: any, idx: number) => (
                                    <div key={idx} className="bg-white p-4 rounded-xl shadow-sm border border-purple-100/50">
                                        <div className="flex justify-between items-center mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-slate-800 text-sm">{fb.userName}</span>
                                                <span className="text-[10px] text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-100">{fb.role}</span>
                                            </div>
                                            <span className="text-[10px] text-slate-400 italic">{new Date(fb.createdAt).toLocaleDateString()}</span>
                                        </div>
                                        <div className="text-sm text-slate-600 italic">“{fb.comment}”</div>
                                    </div>
                                ))}
                             </div>
                        </div>
                    )}
                </div>

                <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-between gap-4">
                    <button onClick={onClose} className="px-6 py-2.5 text-slate-600 hover:bg-slate-200 rounded-xl font-medium transition-colors">
                        稍后处理
                    </button>
                    <div className="flex gap-3">
                        <button onClick={onReject} className="px-6 py-2.5 bg-white border border-red-200 text-red-600 hover:bg-red-50 rounded-xl font-bold transition-colors flex items-center gap-2 border-dashed">
                            驳回
                        </button>
                        <button onClick={onApprove} className="px-10 py-2.5 bg-brand-600 text-white hover:bg-brand-700 rounded-xl font-bold transition-all shadow-lg shadow-brand-500/20 flex items-center gap-2">
                            <Check size={18} /> 确认通过
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const ApprovalCard = ({ okr, type, onApprove, onReject, onDetails, allUsers = [] }: any) => {
    // 1. Process Invited Reviewers (Merges invitations with feedback status)
    const invitedReviewers = Array.from(new Set(okr.peerReviewers || []));
    const feedbacks = okr.ccFeedback || [];

    const reviewerStatus = invitedReviewers.map((uid: string) => {
        const userObj = allUsers.find((u: User) => u.id === uid);
        const feedback = feedbacks.find((f: any) => f.userId === uid);
        return {
            userId: uid,
            name: userObj ? userObj.name : '未知用户',
            role: userObj ? (ROLE_NAMES[userObj.role] || userObj.role) : '-',
            feedback: feedback,
            isPending: !feedback
        };
    });

    // 2. Process Pure CC / Active Suggestions (Feedback from people NOT in peerReviewers list)
    const otherFeedbacks = feedbacks.filter((f: any) => !invitedReviewers.includes(f.userId));
    const hasContent = reviewerStatus.length > 0 || otherFeedbacks.length > 0;

    return (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-6 transition-all hover:shadow-md">
            <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                    <span className="font-bold text-lg text-slate-800">{okr.userName}</span>
                    <span className="text-sm bg-slate-100 px-2 py-0.5 rounded text-slate-600 border border-slate-200 flex items-center gap-1">
                        <Calendar size={12} /> {okr.period}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded border ${type === 'ASSESSMENT' ? 'bg-orange-50 text-orange-600 border-orange-100' : 'bg-indigo-50 text-indigo-600 border-indigo-100'}`}>
                        {type === 'ASSESSMENT' ? '自评审批' : 'OKR 定稿审批'}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded border font-bold ${okr.level === OKRLevel.PERSONAL ? 'bg-violet-50 text-violet-700 border-violet-100' : 'bg-teal-50 text-teal-800 border-teal-100'}`}>
                        {getOKRScopeTypeLabel(okr)}
                    </span>
                </div>
                <h3 className="text-md font-medium text-brand-700 mb-4">{okr.title}</h3>

                <div className="bg-slate-50 p-4 rounded-lg space-y-3 border border-slate-100">
                    {okr.objectives.map((o: any, i: number) => (
                        <div key={o.id}>
                            <p className="font-semibold text-sm text-slate-800">O{i + 1}: {o.content} ({o.weight}%)</p>
                            <ul className="pl-4 mt-1 list-disc text-xs text-slate-600">
                                {o.keyResults.map((kr: any) => <li key={kr.id}>{kr.content} ({kr.weight}%)</li>)}
                            </ul>
                        </div>
                    ))}
                </div>

                {/* Display Collaboration Status & Feedback for Approvers */}
                {hasContent && (
                    <div className="mt-4 bg-purple-50 rounded-lg p-3 border border-purple-100">
                        <h4 className="text-xs font-bold text-purple-800 mb-2 flex items-center gap-1">
                            <Users size={12} /> 协作成员建议 / 反馈情况
                        </h4>
                        <div className="space-y-2">
                            {/* Reviewers List */}
                            {reviewerStatus.map((r: any) => (
                                <div key={r.userId} className={`p-2 rounded border text-xs flex flex-col gap-1 ${r.isPending ? 'bg-slate-50 border-slate-200 border-dashed' : 'bg-white border-purple-100'}`}>
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-2">
                                            <span className={`font-bold ${r.isPending ? 'text-slate-500' : 'text-slate-700'}`}>{r.name}</span>
                                            <span className="text-[10px] text-slate-400 bg-slate-100 px-1 rounded">{r.role}</span>
                                        </div>
                                        {r.isPending ? (
                                            <span className="text-[10px] text-slate-400 italic flex items-center gap-1">
                                                <Clock size={10} /> 待协作评估
                                            </span>
                                        ) : (
                                            <span className="text-slate-400 scale-90">{new Date(r.feedback.createdAt).toLocaleDateString()}</span>
                                        )}
                                    </div>
                                    {r.feedback && <div className="text-slate-600 mt-1">{r.feedback.comment}</div>}
                                </div>
                            ))}

                            {/* Other CC Feedbacks */}
                            {otherFeedbacks.map((fb: any, i: number) => (
                                <div key={`cc-${i}`} className="bg-white p-2 rounded border border-purple-100 text-xs">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="font-bold text-slate-700">{fb.userName} <span className="font-normal text-slate-400 text-[10px]">(主动建议)</span></span>
                                        <span className="text-slate-400 scale-90">{new Date(fb.createdAt).toLocaleDateString()}</span>
                                    </div>
                                    <div className="text-slate-600">{fb.comment}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className="flex flex-col justify-center gap-3 min-w-[120px]">
                <button onClick={onDetails} className="bg-brand-50 border border-brand-100 text-brand-600 hover:bg-brand-100 py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors text-sm font-bold">
                    <ClipboardList size={16} /> 详情
                </button>
                <button onClick={onApprove} className="bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors shadow-sm text-sm">
                    <Check size={16} /> 通过
                </button>
                <div className="w-full h-px bg-slate-100"></div>
                <button onClick={onReject} className="bg-white border border-slate-200 text-slate-500 hover:text-red-600 hover:border-red-100 hover:bg-red-50 py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors text-sm">
                    <X size={16} /> 驳回
                </button>
            </div>
        </div>
    )
}

interface FeedbackCardProps {
    okr: OKR;
    currentUser: User;
    onSubmitFeedback: (c: string, g?: string) => void;
}

const FeedbackCard: React.FC<FeedbackCardProps> = ({ okr, currentUser, onSubmitFeedback }) => {
    const [expanded, setExpanded] = useState(false);

    // Using simple state initialization. 
    // NOTE: When 'okr' prop changes (after submit), we want to update the comment/grade state.
    // We can use a key on the parent or useEffect here.
    const existingFeedback = okr.ccFeedback?.find(f => f.userId === currentUser.id);
    const [comment, setComment] = useState(existingFeedback?.comment || '');
    const [grade, setGrade] = useState<string>(existingFeedback?.recommendedGrade || '');

    useEffect(() => {
        const ef = okr.ccFeedback?.find(f => f.userId === currentUser.id);
        setComment(ef?.comment || '');
        setGrade(ef?.recommendedGrade || '');
    }, [okr, currentUser.id]);

    // Determine context
    const isCreationPhase = okr.status === OKRStatus.PENDING_MANAGER || okr.status === OKRStatus.PENDING_GM;

    // Peer vs CC
    const isPeer = okr.peerReviewers?.includes(currentUser.id);
    const label = isPeer ? '邀请建议 (初稿)' : '抄送/建议';
    const badgeColor = isPeer ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600';

    return (
        <div className={`bg-white rounded-xl border border-slate-200 shadow-sm transition-all overflow-hidden ${expanded ? 'ring-2 ring-indigo-500/20' : ''}`}>
            <div className="p-6 cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => setExpanded(!expanded)}>
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <div className="bg-indigo-100 text-indigo-600 p-2 rounded-full font-bold w-10 h-10 flex items-center justify-center">
                            {okr.userName.substring(0, 1)}
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-500 bg-slate-100 px-2 rounded-full">{okr.department}</span>
                                <span className="text-xs text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full border border-brand-100 flex items-center gap-1">
                                    <Calendar size={10} /> {okr.period}
                                </span>
                                <span className={`text-xs px-2 py-0.5 rounded font-bold ${badgeColor}`}>{label}</span>
                                <span className={`text-xs px-2 py-0.5 rounded font-bold border ${okr.level === OKRLevel.PERSONAL ? 'bg-violet-50 text-violet-700 border-violet-100' : 'bg-teal-50 text-teal-800 border-teal-100'}`}>
                                    {getOKRScopeTypeLabel(okr)}
                                </span>
                            </div>
                            <p className="text-sm text-slate-600 font-medium">{okr.title}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {existingFeedback && <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded font-bold flex items-center gap-1"><Check size={12} /> 已反馈</span>}
                        <button className="text-sm text-slate-400 hover:text-indigo-600 underline">
                            {expanded ? '收起详情' : '查看 & 建议'}
                        </button>
                    </div>
                </div>
            </div>

            {expanded && (
                <div className="px-6 pb-6 pt-0 border-t border-slate-100 bg-slate-50/30">
                    <div className="mt-4 bg-white p-4 rounded-lg border border-slate-200 mb-6">
                        <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">OKR 内容预览</h4>
                        <div className="space-y-4">
                            {okr.objectives.map((o, i) => (
                                <div key={o.id}>
                                    <div className="flex justify-between text-sm font-bold text-slate-700 mb-1">
                                        <span>O{i + 1}: {o.content}</span>
                                        <span className="text-slate-400">{o.weight}%</span>
                                    </div>
                                    <ul className="space-y-1">
                                        {o.keyResults.map(kr => (
                                            <li key={kr.id} className="text-xs text-slate-600 pl-4 border-l-2 border-slate-200 ml-1">
                                                KR: {kr.content}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100">
                        <h4 className="text-sm font-bold text-indigo-900 mb-3 flex items-center gap-2">
                            <MessageSquare size={16} />
                            填写建议 (帮助完善目标)
                        </h4>
                        <textarea
                            className="w-full p-3 border border-indigo-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none min-h-[80px]"
                            placeholder="请对目标设定的合理性、挑战性提出建议..."
                            value={comment}
                            onChange={e => setComment(e.target.value)}
                        />
                        <div className="flex justify-between items-center mt-3">
                            <div className="flex items-center gap-2">
                                {/* Only show grading option if NOT in creation phase */}
                                {!isCreationPhase && (
                                    <>
                                        <span className="text-xs font-bold text-slate-600">建议评级 (可选):</span>
                                        <select
                                            className="text-sm border border-indigo-200 rounded p-1 outline-none focus:border-indigo-500 bg-white"
                                            value={grade}
                                            onChange={e => setGrade(e.target.value)}
                                            title="评估阶段可提供参考评级"
                                        >
                                            <option value="">--</option>
                                            <option value={FinalGrade.S}>S</option>
                                            <option value={FinalGrade.A}>A</option>
                                            <option value={FinalGrade.B}>B</option>
                                            <option value={FinalGrade.C}>C</option>
                                        </select>
                                    </>
                                )}
                            </div>
                            <button
                                onClick={() => onSubmitFeedback(comment, grade)}
                                className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 flex items-center gap-2 transition-colors shadow-sm"
                            >
                                <Send size={14} /> 提交反馈
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
