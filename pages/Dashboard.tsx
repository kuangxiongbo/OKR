
import React, { useState, useMemo, useEffect } from 'react';
import { getOKRs, updateOKRStatus } from '../services/okrService';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { OKRStatus, OKRLevel, OKR, Role } from '../types';
import { OKRCard } from '../components/OKRCard';
import { Users, Building, ArrowLeft, Filter, LayoutGrid, RotateCcw, Eye } from 'lucide-react';

export const Dashboard: React.FC = () => {
    const user = useCurrentUser();
    const [selectedDept, setSelectedDept] = useState<string | null>(null);
    const [allOKRs, setAllOKRs] = useState<OKR[]>([]);
    
    const refreshData = () => {
        let okrs = getOKRs();
        
        // Rule: Only Admin sees ALL statuses (Draft, Pending Creation, etc.)
        // Regular users see Published/Grading/Closed/Assessment Pending
        if (user.role !== Role.ADMIN) {
            okrs = okrs.filter(o => 
                o.status === OKRStatus.PUBLISHED || 
                o.status === OKRStatus.GRADING || 
                o.status === OKRStatus.PENDING_ASSESSMENT_APPROVAL ||
                o.status === OKRStatus.PENDING_L2_APPROVAL ||
                o.status === OKRStatus.PENDING_L3_APPROVAL ||
                o.status === OKRStatus.PENDING_ARCHIVE ||
                o.status === OKRStatus.CLOSED
            );
        }
        
        setAllOKRs(okrs);
    };

    useEffect(() => {
        refreshData();
    }, [user]);

    const handleRevokeRequest = (okr: OKR, e: React.MouseEvent) => {
        // Prevent default button behavior
        e.preventDefault();
        // Stop bubbling to parent card click
        e.stopPropagation(); 
        
        if (confirm(`确认撤销 OKR 状态?\n\n目标: ${okr.title}\n\n警告：\n- 状态将强制变更为“草稿”\n- 现有审批流程将被终止\n- OKR 将退回给用户进行修改`)) {
            updateOKRStatus(okr.id, OKRStatus.DRAFT);
            // Force data reload immediately
            setTimeout(() => refreshData(), 50);
        }
    };

    const companyOKRs = allOKRs.filter(o => o.level === OKRLevel.COMPANY);
    const deptOKRs = allOKRs.filter(o => o.level === OKRLevel.DEPARTMENT);
    
    const personalOKRs = useMemo(() => {
        let base = allOKRs.filter(o => o.level === OKRLevel.PERSONAL);
        if (selectedDept) {
            base = base.filter(o => o.department === selectedDept);
        }
        return base;
    }, [allOKRs, selectedDept]);

    const renderRevokeButton = (okr: OKR) => {
        // Only Admin
        if (user.role !== Role.ADMIN) return null;
        // Don't show reset on Drafts (already initial state)
        if (okr.status === OKRStatus.DRAFT) return null;

        return (
            <div 
                className="absolute top-4 right-14 z-[100]" 
                onClick={(e) => e.stopPropagation()} 
                onMouseDown={(e) => e.stopPropagation()}
            >
                <button 
                    type="button"
                    onClick={(e) => handleRevokeRequest(okr, e)}
                    className="bg-white hover:bg-red-50 text-slate-400 hover:text-red-600 p-2 rounded-full border border-slate-200 hover:border-red-200 shadow-sm transition-all hover:scale-110 active:scale-95 cursor-pointer"
                    title="撤销/重置状态 (管理员权限)"
                >
                    <RotateCcw size={14} />
                </button>
            </div>
        );
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-10 relative">
            {/* Header */}
            <div className="flex justify-between items-end border-b border-slate-200 pb-6">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 mb-2 flex items-center gap-3">
                        OKR 公示看板
                        {user.role === Role.ADMIN && (
                            <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded-full border border-amber-200 flex items-center gap-1 font-normal">
                                <Eye size={12}/> 管理员全视图 (包含草稿/审批中)
                            </span>
                        )}
                    </h1>
                    <p className="text-slate-500">全员对齐，目标透明。{selectedDept ? '正在查看团队详情。' : '点击业务团队/部门卡片，可查看该团队成员的个人 OKR。'}</p>
                </div>
                {selectedDept && (
                    <button 
                        onClick={() => setSelectedDept(null)}
                        className="flex items-center gap-2 text-slate-600 hover:text-brand-600 px-4 py-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-sm font-medium"
                    >
                        <ArrowLeft size={18} />
                        返回全览
                    </button>
                )}
            </div>

            {/* Company Level */}
            {!selectedDept && (
                <section>
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-brand-100 text-brand-600 rounded-lg">
                            <Building size={24} />
                        </div>
                        <h2 className="text-xl font-bold text-slate-800">公司战略目标</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {companyOKRs.length === 0 && <p className="text-slate-400 italic col-span-full py-8 text-center bg-slate-50 rounded-lg border border-dashed border-slate-300">暂无相关 OKR。</p>}
                        {companyOKRs.map(okr => (
                            <div key={okr.id} className="transform hover:-translate-y-1 transition-transform relative group h-full">
                                {renderRevokeButton(okr)}
                                <div className="relative z-10 h-full">
                                    <OKRCard okr={okr} />
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Department/Business Line Level */}
            {!selectedDept && (
                <section>
                    <div className="flex items-center gap-3 mb-4 mt-10">
                        <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
                            <Users size={24} />
                        </div>
                        <h2 className="text-xl font-bold text-slate-800">业务线与部门目标</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {deptOKRs.length === 0 && <p className="text-slate-400 italic col-span-full py-8 text-center bg-slate-50 rounded-lg border border-dashed border-slate-300">暂无相关 OKR。</p>}
                        {deptOKRs.map(okr => (
                            <div key={okr.id} className="relative group cursor-pointer h-full" onClick={() => setSelectedDept(okr.department || '')}>
                                <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl opacity-0 group-hover:opacity-30 blur transition duration-200 z-0"></div>
                                <div className="relative z-10 h-full">
                                    {renderRevokeButton(okr)}
                                    <OKRCard okr={okr} />
                                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity bg-indigo-50 text-indigo-600 text-xs font-bold px-2 py-1 rounded-md border border-indigo-100">
                                        点击查看成员 OKR &rarr;
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Drill Down View / Personal OKRs */}
            <section className={selectedDept ? 'mt-0' : 'mt-10 pt-10 border-t border-slate-200'}>
                <div className="flex items-center gap-3 mb-6">
                     {selectedDept ? (
                        <>
                            <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
                                <LayoutGrid size={24} />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-slate-800">{selectedDept} - 成员目标详情</h2>
                                <p className="text-sm text-slate-500">以下是该团队所有成员的个人 OKR。</p>
                            </div>
                        </>
                     ) : (
                        <>
                            <div className="p-2 bg-slate-100 text-slate-600 rounded-lg">
                                <Filter size={24} />
                            </div>
                            <h2 className="text-xl font-bold text-slate-800">全员个人目标概览</h2>
                        </>
                     )}
                </div>

                {/* Context Header for Selected Dept */}
                {selectedDept && (
                    <div className="mb-8 p-6 bg-indigo-50 rounded-xl border border-indigo-100 shadow-sm">
                        <h3 className="text-sm font-bold text-indigo-800 uppercase mb-4 flex items-center gap-2">
                            <Users size={16}/> 
                            当前团队目标 (上下文)
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                             {deptOKRs.filter(d => d.department === selectedDept).map(d => (
                                 <div key={d.id} className="relative">
                                     {renderRevokeButton(d)}
                                     <OKRCard okr={d} />
                                 </div>
                             ))}
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {personalOKRs.length === 0 && (
                        <p className="text-slate-400 italic col-span-full py-12 text-center bg-slate-50 rounded-lg border border-dashed border-slate-300">
                            {selectedDept ? `"${selectedDept}" 暂无相关个人 OKR。` : '暂无个人 OKR。'}
                        </p>
                    )}
                    {personalOKRs.map(okr => (
                        <div key={okr.id} className="relative">
                            {renderRevokeButton(okr)}
                            <OKRCard okr={okr} />
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
};
