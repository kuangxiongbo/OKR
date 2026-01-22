
import React from 'react';
import { AlertTriangle, Info, CheckCircle2, X } from 'lucide-react';

interface ConfirmDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm?: () => void;
    title: string;
    message: React.ReactNode;
    type?: 'info' | 'danger' | 'success' | 'warning';
    confirmText?: string;
    cancelText?: string;
    showCancel?: boolean; // If false, acts like an Alert
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    type = 'info',
    confirmText = '确认',
    cancelText = '取消',
    showCancel = true
}) => {
    if (!isOpen) return null;

    let Icon = Info;
    let iconColor = 'text-brand-600';
    let iconBg = 'bg-brand-100';
    let buttonColor = 'bg-brand-600 hover:bg-brand-700';

    if (type === 'danger') {
        Icon = AlertTriangle;
        iconColor = 'text-red-600';
        iconBg = 'bg-red-100';
        buttonColor = 'bg-red-600 hover:bg-red-700';
    } else if (type === 'success') {
        Icon = CheckCircle2;
        iconColor = 'text-green-600';
        iconBg = 'bg-green-100';
        buttonColor = 'bg-green-600 hover:bg-green-700';
    } else if (type === 'warning') {
        Icon = AlertTriangle;
        iconColor = 'text-orange-600';
        iconBg = 'bg-orange-100';
        buttonColor = 'bg-orange-600 hover:bg-orange-700';
    }

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-6">
                    <div className="flex items-start gap-4">
                        <div className={`p-3 rounded-full flex-shrink-0 ${iconBg}`}>
                            <Icon size={24} className={iconColor} />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-lg font-bold text-slate-800 mb-2">{title}</h3>
                            <div className="text-sm text-slate-600 leading-relaxed">
                                {message}
                            </div>
                        </div>
                    </div>
                </div>
                <div className="bg-slate-50 p-4 flex justify-end gap-3 border-t border-slate-100">
                    {showCancel && (
                        <button 
                            onClick={onClose}
                            className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg text-sm font-medium transition-colors"
                        >
                            {cancelText}
                        </button>
                    )}
                    <button 
                        onClick={() => {
                            if (onConfirm) onConfirm();
                            onClose();
                        }}
                        className={`px-6 py-2 text-white rounded-lg text-sm font-bold shadow-sm transition-colors flex items-center gap-2 ${buttonColor}`}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};
