import React, { useEffect, useState } from 'react';
import { getLogs } from '../services/okrService';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { Role, OperationLog } from '../types';
import { History, Shield, Clock, User, Activity } from 'lucide-react';

export const OperationLogs: React.FC = () => {
    const currentUser = useCurrentUser();
    const [logs, setLogs] = useState<OperationLog[]>([]);

    useEffect(() => {
        setLogs(getLogs());
    }, []);

    if (currentUser?.role !== Role.ADMIN) {
        return <div className="text-center p-10 text-red-500">仅限管理员访问</div>;
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
             <div className="flex items-center gap-3 mb-6">
                <div className="bg-slate-100 text-slate-600 p-2 rounded-lg">
                    <History size={24} />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">操作日志</h1>
                    <p className="text-slate-500 text-sm">记录系统的关键操作行为，用于审计与安全追踪。</p>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                            <tr>
                                <th className="p-4 whitespace-nowrap"><Clock size={14} className="inline mr-1"/> 时间</th>
                                <th className="p-4 whitespace-nowrap"><User size={14} className="inline mr-1"/> 操作人</th>
                                <th className="p-4 whitespace-nowrap"><Activity size={14} className="inline mr-1"/> 模块</th>
                                <th className="p-4 whitespace-nowrap">动作</th>
                                <th className="p-4 w-full">详情内容</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {logs.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="p-10 text-center text-slate-400">暂无日志记录</td>
                                </tr>
                            )}
                            {logs.map(log => (
                                <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="p-4 text-slate-500 whitespace-nowrap font-mono text-xs">
                                        {new Date(log.timestamp).toLocaleString()}
                                    </td>
                                    <td className="p-4 font-medium text-slate-800 whitespace-nowrap">
                                        {log.userName}
                                    </td>
                                    <td className="p-4 whitespace-nowrap">
                                        <span className="px-2 py-1 rounded bg-slate-100 text-slate-600 text-xs font-bold border border-slate-200">
                                            {log.module}
                                        </span>
                                    </td>
                                    <td className="p-4 whitespace-nowrap font-medium text-slate-700">
                                        {log.action}
                                    </td>
                                    <td className="p-4 text-slate-600 break-all">
                                        {log.details}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};