import React, { useState } from 'react';
import { X } from 'lucide-react';

interface OKRAlignmentGuideModalProps {
  isOpen: boolean;
  onClose: (options: { neverShowAgain: boolean }) => void;
}

export const OKRAlignmentGuideModal: React.FC<OKRAlignmentGuideModalProps> = ({ isOpen, onClose }) => {
  const [neverShowAgain, setNeverShowAgain] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="okr-guide-title"
      >
        <div className="p-4 sm:p-5 border-b border-slate-100 flex justify-between items-center gap-3 bg-slate-50/80">
          <h2 id="okr-guide-title" className="text-lg sm:text-xl font-bold text-slate-900 pr-2">
            团队 OKR 自上而下对齐与个人 OKR 关联说明
          </h2>
          <button
            type="button"
            onClick={() => onClose({ neverShowAgain })}
            className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500 hover:text-slate-700 shrink-0"
            aria-label="关闭"
          >
            <X size={22} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/50">
          <p className="text-sm text-slate-600 mb-4">
            下图说明公司级、产研测与业务线目标的录入关系，以及个人目标应对齐的层级。制定与审批时请按角色选择正确的 OKR 类型（团队 / 个人）。
          </p>
          <div className="rounded-xl border border-slate-200 bg-white p-2 sm:p-3 shadow-sm overflow-auto max-h-[min(62vh,720px)]">
            <img
              src={`${import.meta.env.BASE_URL}OKR.png`}
              alt="团队 OKR 自上而下对齐与个人 OKR 关联结构示意图"
              className="w-full h-auto min-w-[280px] object-contain object-top mx-auto block"
            />
          </div>

          <label className="mt-5 flex items-start gap-3 cursor-pointer select-none text-sm text-slate-700">
            <input
              type="checkbox"
              className="mt-0.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              checked={neverShowAgain}
              onChange={(e) => setNeverShowAgain(e.target.checked)}
            />
            <span>下次不再提示（仍可在帮助文档或培训材料中查看相同说明）</span>
          </label>
        </div>

        <div className="p-4 border-t border-slate-100 bg-white flex justify-end gap-3">
          <button
            type="button"
            onClick={() => onClose({ neverShowAgain })}
            className="px-6 py-2.5 bg-brand-600 text-white hover:bg-brand-700 rounded-xl font-bold transition-colors shadow-md shadow-brand-500/15"
          >
            我知道了
          </button>
        </div>
      </div>
    </div>
  );
};
