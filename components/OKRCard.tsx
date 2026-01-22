

import React, { useMemo } from 'react';
import { OKR, OKRStatus, FinalGrade, OKRLevel } from '../types';
import { Users, Building, User, Link as LinkIcon, CheckCircle } from 'lucide-react';
import { getOKRs } from '../services/okrService';

const statusColors: Record<string, string> = {
  [OKRStatus.DRAFT]: 'bg-gray-100 text-gray-700',
  [OKRStatus.PENDING_MANAGER]: 'bg-orange-100 text-orange-700',
  [OKRStatus.PENDING_GM]: 'bg-purple-100 text-purple-700',
  [OKRStatus.PUBLISHED]: 'bg-green-100 text-green-700',
  [OKRStatus.CLOSED]: 'bg-slate-200 text-slate-800',
};

// Simplified Status Labels for Dashboard
const statusLabels: Record<string, string> = {
    [OKRStatus.DRAFT]: '草稿',
    [OKRStatus.PENDING_MANAGER]: '已提交',
    [OKRStatus.PENDING_GM]: '已提交',
    [OKRStatus.PUBLISHED]: '已发布',
    [OKRStatus.CLOSED]: '已归档',
};

export const OKRCard: React.FC<{ okr: OKR, onClick?: () => void }> = ({ okr, onClick }) => {
  
  // Logic to unify display status for dashboard
  // "Dashboard Statuses: Only Published and Archived"
  const displayStatus = useMemo(() => {
      // If it's closed or archived, show as Archived (CLOSED)
      if (okr.status === OKRStatus.CLOSED || okr.status === OKRStatus.PENDING_ARCHIVE || okr.isPerformanceArchived) {
          return OKRStatus.CLOSED;
      }
      // If it's a draft, show Draft (usually hidden from dashboard unless Admin)
      if (okr.status === OKRStatus.DRAFT) {
          return OKRStatus.DRAFT;
      }
      // If it's pending approval (creation), show Pending (usually hidden from dashboard unless Admin)
      if (okr.status === OKRStatus.PENDING_MANAGER || okr.status === OKRStatus.PENDING_GM) {
          return OKRStatus.PENDING_MANAGER; // Maps to "已提交"
      }
      
      // All other active states (Published, Grading, Assessment Pending, Approvals) -> Published
      return OKRStatus.PUBLISHED;
  }, [okr.status, okr.isPerformanceArchived]);

  // Determine display level label
  let levelLabel = '个人 OKR';
  let levelColor = 'bg-slate-100 text-slate-600';
  let levelIcon = <User size={14} />;

  if (okr.level === OKRLevel.COMPANY) {
      levelLabel = '公司 OKR';
      levelColor = 'bg-red-100 text-red-700';
      levelIcon = <Building size={14} />;
  } else if (okr.level === OKRLevel.DEPARTMENT) {
      // Logic: If department name contains "业务线", assume it's a Business Line OKR
      if ((okr.department || '').includes('业务线')) {
          levelLabel = '业务线 OKR';
          levelColor = 'bg-blue-100 text-blue-700';
      } else {
          levelLabel = '部门 OKR';
          levelColor = 'bg-indigo-100 text-indigo-700';
      }
      levelIcon = <Users size={14} />;
  }

  // Find Parent OKR Name if linked
  const parentName = useMemo(() => {
      if (!okr.parentOKRId) return null;
      const all = getOKRs();
      const parent = all.find(o => o.id === okr.parentOKRId);
      return parent ? parent.title : null;
  }, [okr.parentOKRId]);

  return (
    <div 
      onClick={onClick}
      className={`bg-white rounded-xl shadow-sm border border-slate-200 p-5 hover:shadow-md transition-all cursor-pointer group flex flex-col h-full`}
    >
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1 mr-2">
          <h3 className="text-lg font-bold text-slate-800 group-hover:text-brand-600 transition-colors leading-tight line-clamp-2">
            {okr.title}
          </h3>
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500 mt-2">
             <span className={`px-2 py-0.5 rounded text-xs flex items-center gap-1 whitespace-nowrap ${levelColor}`}>
                {levelIcon} {levelLabel}
             </span>
             <span className="text-xs whitespace-nowrap bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">{okr.userName}</span>
             <span className="text-xs">{okr.period}</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${statusColors[displayStatus] || statusColors[OKRStatus.PUBLISHED]}`}>
            {statusLabels[displayStatus] || '已发布'}
            </span>
            {okr.isPerformanceArchived && (
                 <span className={`px-2 py-0.5 rounded text-[10px] font-bold border border-slate-300 text-slate-600 bg-slate-50 flex items-center gap-1`}>
                    <CheckCircle size={10}/> 绩效完成
                 </span>
            )}
        </div>
      </div>

      {parentName && (
          <div className="mb-4 bg-brand-50/50 p-2 rounded-lg border border-brand-100 flex items-start gap-2">
              <LinkIcon size={14} className="text-brand-400 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-brand-800 truncate">
                  <span className="opacity-70 mr-1">对齐:</span>
                  <span className="font-medium">{parentName}</span>
              </div>
          </div>
      )}

      <div className="space-y-3 flex-1">
        {okr.objectives.slice(0, 2).map((obj, i) => (
          <div key={obj.id} className="text-sm">
            <div className="flex justify-between mb-1">
              <span className="font-medium text-slate-700 truncate w-3/4">O{i + 1}: {obj.content}</span>
              <span className="text-slate-400 text-xs">{obj.weight}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                {/* Visual mock of progress - could be calculated from KRs */}
               <div className="bg-brand-500 h-full rounded-full" style={{ width: `${Math.random() * 60 + 20}%`}}></div>
            </div>
          </div>
        ))}
        {okr.objectives.length > 2 && (
            <div className="text-xs text-center text-slate-400 mt-2">
                +{okr.objectives.length - 2} 个更多目标
            </div>
        )}
      </div>
    </div>
  );
};