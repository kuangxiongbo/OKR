import React, { useState, useEffect } from 'react';
import { X, MessageSquare } from 'lucide-react';

interface RejectReasonDialogProps {
  isOpen: boolean;
  title?: string;
  description?: string;
  onClose: () => void;
  onConfirm: (reason: string) => void | Promise<void>;
  confirmText?: string;
}

export const RejectReasonDialog: React.FC<RejectReasonDialogProps> = ({
  isOpen,
  title = '填写驳回理由',
  description = '请说明驳回原因，提交人将可在「我的 OKR」中查看。',
  onClose,
  onConfirm,
  confirmText = '确认驳回',
}) => {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) setReason('');
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    const t = reason.trim();
    if (!t) return;
    setSubmitting(true);
    try {
      await onConfirm(t);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-red-50/50">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <MessageSquare size={20} className="text-red-600" />
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-slate-200 rounded-full text-slate-500"
            disabled={submitting}
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-sm text-slate-600">{description}</p>
          <textarea
            className="w-full min-h-[120px] p-3 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-400 outline-none"
            placeholder="请输入驳回理由（必填）"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={submitting}
            autoFocus
          />
        </div>
        <div className="bg-slate-50 p-4 flex justify-end gap-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg text-sm font-medium"
          >
            取消
          </button>
          <button
            type="button"
            disabled={!reason.trim() || submitting}
            onClick={handleConfirm}
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? '提交中…' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
