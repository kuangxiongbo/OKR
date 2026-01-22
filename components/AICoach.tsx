import React, { useState } from 'react';
import { generateOKRAdvice } from '../services/geminiService';
import { Sparkles, X, Loader2 } from 'lucide-react';

interface AICoachProps {
    isOpen: boolean;
    onClose: () => void;
    currentObjective: string;
    onApplySuggestion: (text: string) => void;
}

export const AICoach: React.FC<AICoachProps> = ({ isOpen, onClose, currentObjective, onApplySuggestion }) => {
    const [advice, setAdvice] = useState<string>('');
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleGetAdvice = async () => {
        setLoading(true);
        const result = await generateOKRAdvice(
            "Company goal: Market Leadership. Dept goal: High Performance.", 
            currentObjective
        );
        setAdvice(result);
        setLoading(false);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-[500px] overflow-hidden">
                <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-4 flex justify-between items-center text-white">
                    <div className="flex items-center gap-2">
                        <Sparkles size={20} />
                        <h3 className="font-bold text-lg">Gemini OKR 教练</h3>
                    </div>
                    <button onClick={onClose} className="hover:bg-white/20 rounded-full p-1"><X size={18} /></button>
                </div>
                
                <div className="p-6">
                    <div className="mb-4">
                        <label className="text-xs font-bold text-slate-400 uppercase">正在分析</label>
                        <p className="text-slate-800 bg-slate-50 p-3 rounded-md border border-slate-200 mt-1 italic">
                            "{currentObjective || "空目标..."}"
                        </p>
                    </div>

                    {!advice ? (
                        <div className="text-center py-6">
                            <p className="text-slate-500 mb-4 text-sm">我可以评估您的目标，提出改进建议，并确保其符合 SMART 原则。</p>
                            <button 
                                onClick={handleGetAdvice}
                                disabled={!currentObjective || loading}
                                className="bg-purple-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2 mx-auto"
                            >
                                {loading ? <Loader2 className="animate-spin" /> : <Sparkles size={16} />}
                                优化我的 OKR
                            </button>
                        </div>
                    ) : (
                        <div className="animate-in fade-in slide-in-from-bottom-4">
                            <div className="prose prose-sm text-slate-600 max-h-60 overflow-y-auto mb-4 bg-purple-50 p-4 rounded-lg border border-purple-100">
                                <pre className="whitespace-pre-wrap font-sans text-sm">{advice}</pre>
                            </div>
                            <div className="flex justify-end gap-2">
                                <button onClick={() => setAdvice('')} className="text-slate-500 text-sm hover:underline px-3">重试</button>
                                <button 
                                    onClick={onClose}
                                    className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm hover:bg-slate-900"
                                >
                                    完成
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};