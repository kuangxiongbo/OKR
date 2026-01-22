import React, { useState, useEffect } from 'react';
import { getGradeConfigs, saveGradeConfigs } from '../services/okrService';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { Role, GradeConfiguration } from '../types';
import { Save, Award, PieChart } from 'lucide-react';

export const GradingSettings: React.FC = () => {
    const currentUser = useCurrentUser();
    const [gradeConfigs, setGradeConfigs] = useState<GradeConfiguration[]>([]);

    useEffect(() => {
        setGradeConfigs(getGradeConfigs());
    }, []);

    if (currentUser.role !== Role.ADMIN) {
        return <div className="text-center p-10 text-red-500">仅限管理员访问</div>;
    }

    const handleGradeConfigChange = (index: number, field: keyof GradeConfiguration, value: any) => {
        const newConfigs = [...gradeConfigs];
        newConfigs[index] = { ...newConfigs[index], [field]: value };
        setGradeConfigs(newConfigs);
    };

    const handleSaveGradeConfig = () => {
        const totalQuota = gradeConfigs.reduce((sum, cfg) => sum + (cfg.quota || 0), 0);
        if (totalQuota !== 100) {
            alert(`当前比例总和为 ${totalQuota}%，必须等于 100%`);
            return;
        }

        saveGradeConfigs(gradeConfigs);
        alert("绩效等级配置已保存");
    };

    const totalQuota = gradeConfigs.reduce((sum, cfg) => sum + (cfg.quota || 0), 0);

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
             <div className="flex items-center gap-3 mb-6">
                <div className="bg-orange-100 text-orange-600 p-2 rounded-lg">
                    <Award size={24} />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">绩效设置</h1>
                    <p className="text-slate-500 text-sm">配置各绩效等级 (S/A/B/C) 对应的总分范围及团队分布比例。</p>
                </div>
            </div>

            <div className="max-w-5xl bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-200 flex justify-between items-center">
                    <h2 className="font-bold text-slate-800">等级与分布配置</h2>
                    <button onClick={handleSaveGradeConfig} className="bg-brand-600 text-white px-4 py-2 rounded-lg hover:bg-brand-700 flex items-center gap-2 shadow-sm text-sm">
                        <Save size={16}/> 保存配置
                    </button>
                </div>
                
                <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                        <tr>
                            <th className="p-4">等级</th>
                            <th className="p-4">分数范围 (Min-Max)</th>
                            <th className="p-4 w-[200px]">目标比例 (%)</th>
                            <th className="p-4">描述说明</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {gradeConfigs.map((cfg, idx) => (
                            <tr key={cfg.grade} className="hover:bg-slate-50">
                                <td className="p-4 font-bold">
                                    <span className={`w-8 h-8 flex items-center justify-center rounded-lg border ${
                                        cfg.grade === 'S' ? 'bg-yellow-50 text-yellow-600 border-yellow-200' : 
                                        cfg.grade === 'A' ? 'bg-green-50 text-green-600 border-green-200' :
                                        cfg.grade === 'B' ? 'bg-blue-50 text-blue-600 border-blue-200' :
                                        'bg-slate-100 text-slate-600 border-slate-300'
                                    }`}>
                                        {cfg.grade}
                                    </span>
                                </td>
                                <td className="p-4">
                                    <div className="flex items-center gap-2">
                                        <input 
                                            type="number" 
                                            className="border rounded p-2 w-16 text-center outline-none focus:ring-2 focus:ring-brand-500"
                                            value={cfg.minScore}
                                            onChange={e => handleGradeConfigChange(idx, 'minScore', Number(e.target.value))}
                                        />
                                        <span className="text-slate-400">-</span>
                                        <input 
                                            type="number" 
                                            className="border rounded p-2 w-16 text-center outline-none focus:ring-2 focus:ring-brand-500"
                                            value={cfg.maxScore}
                                            onChange={e => handleGradeConfigChange(idx, 'maxScore', Number(e.target.value))}
                                        />
                                    </div>
                                </td>
                                <td className="p-4">
                                    <div className="flex items-center gap-2">
                                        <input 
                                            type="number" 
                                            min="0" max="100"
                                            className="border rounded p-2 w-20 text-center outline-none focus:ring-2 focus:ring-brand-500"
                                            value={cfg.quota}
                                            onChange={e => handleGradeConfigChange(idx, 'quota', Number(e.target.value))}
                                        />
                                        <span className="text-slate-400">%</span>
                                    </div>
                                </td>
                                <td className="p-4">
                                        <input 
                                        className="border rounded p-2 w-full max-w-xs outline-none focus:ring-2 focus:ring-brand-500 text-slate-600"
                                        value={cfg.description || ''}
                                        onChange={e => handleGradeConfigChange(idx, 'description', e.target.value)}
                                        placeholder="例如：远超预期"
                                    />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot className="bg-slate-50 border-t border-slate-200">
                        <tr>
                            <td colSpan={2} className="p-4 text-right font-bold text-slate-500">比例总计:</td>
                            <td className="p-4">
                                <span className={`font-bold ${totalQuota === 100 ? 'text-green-600' : 'text-red-500'}`}>
                                    {totalQuota}%
                                </span>
                                {totalQuota !== 100 && <span className="text-xs text-red-500 ml-2 block">需等于 100%</span>}
                            </td>
                            <td></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
};