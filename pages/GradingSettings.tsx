import React, { useState, useEffect } from 'react';
import { getGradeConfigs, saveGradeConfigs } from '../services/okrService';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { Role, GradeConfiguration } from '../types';
import { Save, Award, Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';

const getGradeStyle = (grade: string) => {
    if (grade === 'S') return 'bg-yellow-50 text-yellow-600 border-yellow-200';
    if (grade === 'A') return 'bg-green-50 text-green-600 border-green-200';
    if (grade === 'B' || grade === 'B-') return 'bg-blue-50 text-blue-600 border-blue-200';
    return 'bg-slate-100 text-slate-600 border-slate-300';
};

const normalizeWithBMinus = (configs: GradeConfiguration[]) => {
    if (configs.some(cfg => cfg.grade === 'B-')) return configs;
    const bIndex = configs.findIndex(cfg => cfg.grade === 'B');
    if (bIndex < 0) {
        return [
            ...configs,
            { grade: 'B-', minScore: 60, maxScore: 69, quota: 10, description: '基本合格，部分待改进' }
        ];
    }

    const next = [...configs];
    const bConfig = next[bIndex];
    next[bIndex] = {
        ...bConfig,
        minScore: Math.max(70, bConfig.minScore),
        quota: Math.max(0, bConfig.quota - 10)
    };
    next.splice(bIndex + 1, 0, {
        grade: 'B-',
        minScore: 60,
        maxScore: 69,
        quota: 10,
        description: '基本合格，部分待改进'
    });
    return next;
};

export const GradingSettings: React.FC = () => {
    const currentUser = useCurrentUser();
    const [gradeConfigs, setGradeConfigs] = useState<GradeConfiguration[]>([]);

    useEffect(() => {
        setGradeConfigs(normalizeWithBMinus(getGradeConfigs()));
    }, []);

    if (currentUser.role !== Role.ADMIN) {
        return <div className="text-center p-10 text-red-500">仅限管理员访问</div>;
    }

    const handleGradeConfigChange = (index: number, field: keyof GradeConfiguration, value: any) => {
        const newConfigs = [...gradeConfigs];
        newConfigs[index] = { ...newConfigs[index], [field]: value };
        setGradeConfigs(newConfigs);
    };

    const handleAddGradeConfig = () => {
        const existing = new Set(gradeConfigs.map(cfg => cfg.grade));
        const grade = existing.has('B-') ? `等级${gradeConfigs.length + 1}` : 'B-';
        setGradeConfigs([
            ...gradeConfigs,
            { grade, minScore: 0, maxScore: 0, quota: 0, description: '' }
        ]);
    };

    const handleDeleteGradeConfig = (index: number) => {
        if (gradeConfigs.length <= 1) {
            alert('至少保留一个绩效等级');
            return;
        }
        setGradeConfigs(gradeConfigs.filter((_, idx) => idx !== index));
    };

    const handleMoveGradeConfig = (index: number, direction: -1 | 1) => {
        const targetIndex = index + direction;
        if (targetIndex < 0 || targetIndex >= gradeConfigs.length) return;
        const newConfigs = [...gradeConfigs];
        const [moved] = newConfigs.splice(index, 1);
        newConfigs.splice(targetIndex, 0, moved);
        setGradeConfigs(newConfigs);
    };

    const handleSaveGradeConfig = async () => {
        const gradeNames = gradeConfigs.map(cfg => String(cfg.grade || '').trim()).filter(Boolean);
        if (gradeNames.length !== gradeConfigs.length) {
            alert('等级名称不能为空');
            return;
        }
        if (new Set(gradeNames).size !== gradeNames.length) {
            alert('等级名称不能重复');
            return;
        }
        if (gradeConfigs.some(cfg => Number(cfg.minScore) > Number(cfg.maxScore))) {
            alert('分数范围不合法，Min 不能大于 Max');
            return;
        }
        const totalQuota = gradeConfigs.reduce((sum, cfg) => sum + (cfg.quota || 0), 0);
        if (totalQuota !== 100) {
            alert(`当前比例总和为 ${totalQuota}%，必须等于 100%`);
            return;
        }

        try {
            // 等待保存完成，确保数据已保存到服务器
            await saveGradeConfigs(gradeConfigs.map((cfg, index) => ({ ...cfg, grade: String(cfg.grade).trim(), sortOrder: index })));
            alert("绩效等级配置已保存");
        } catch (error: any) {
            alert(error?.message ? `保存失败：${error.message}` : '保存失败，请检查网络/服务端日志');
        }
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
                    <p className="text-slate-500 text-sm">配置各绩效等级对应的总分范围及团队分布比例。</p>
                </div>
            </div>

            <div className="max-w-5xl bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-200 flex justify-between items-center">
                    <h2 className="font-bold text-slate-800">等级与分布配置</h2>
                    <div className="flex items-center gap-2">
                        <button onClick={handleAddGradeConfig} className="bg-white text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-50 border border-slate-200 flex items-center gap-2 shadow-sm text-sm">
                            <Plus size={16}/> 添加等级
                        </button>
                        <button onClick={handleSaveGradeConfig} className="bg-brand-600 text-white px-4 py-2 rounded-lg hover:bg-brand-700 flex items-center gap-2 shadow-sm text-sm">
                            <Save size={16}/> 保存配置
                        </button>
                    </div>
                </div>
                
                <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                        <tr>
                            <th className="p-4">等级</th>
                            <th className="p-4">分数范围 (Min-Max)</th>
                            <th className="p-4 w-[200px]">目标比例 (%)</th>
                            <th className="p-4">描述说明</th>
                            <th className="p-4 w-[132px] text-center">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {gradeConfigs.map((cfg, idx) => (
                            <tr key={`${cfg.grade}-${idx}`} className="hover:bg-slate-50">
                                <td className="p-4 font-bold">
                                    <div className="flex items-center gap-3">
                                        <span className={`w-8 h-8 flex items-center justify-center rounded-lg border ${getGradeStyle(String(cfg.grade))}`}>
                                            {cfg.grade || '-'}
                                        </span>
                                        <input
                                            className="border rounded p-2 w-20 text-center outline-none focus:ring-2 focus:ring-brand-500"
                                            value={cfg.grade}
                                            onChange={e => handleGradeConfigChange(idx, 'grade', e.target.value)}
                                            placeholder="等级"
                                        />
                                    </div>
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
                                <td className="p-4 text-center">
                                    <div className="inline-flex items-center justify-center gap-1">
                                    <button
                                        onClick={() => handleMoveGradeConfig(idx, -1)}
                                        disabled={idx === 0}
                                        className={`inline-flex items-center justify-center w-8 h-8 rounded-lg border border-transparent ${idx === 0 ? 'text-slate-300 cursor-not-allowed' : 'text-slate-500 hover:text-brand-600 hover:bg-brand-50 hover:border-brand-100'}`}
                                        title="上移"
                                    >
                                        <ArrowUp size={16} />
                                    </button>
                                    <button
                                        onClick={() => handleMoveGradeConfig(idx, 1)}
                                        disabled={idx === gradeConfigs.length - 1}
                                        className={`inline-flex items-center justify-center w-8 h-8 rounded-lg border border-transparent ${idx === gradeConfigs.length - 1 ? 'text-slate-300 cursor-not-allowed' : 'text-slate-500 hover:text-brand-600 hover:bg-brand-50 hover:border-brand-100'}`}
                                        title="下移"
                                    >
                                        <ArrowDown size={16} />
                                    </button>
                                    <button
                                        onClick={() => handleDeleteGradeConfig(idx)}
                                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-red-500 hover:bg-red-50 border border-transparent hover:border-red-100"
                                        title="删除等级"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                    </div>
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
                            <td colSpan={2}></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
};
