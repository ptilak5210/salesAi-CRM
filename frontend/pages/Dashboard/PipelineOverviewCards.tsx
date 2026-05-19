import React from 'react';
import { Plus, TrendingUp, BarChart3, Layers, ArrowRight, Settings2 } from 'lucide-react';

interface PipelineStage { id: string; name: string; color: string; bg_color: string; border_color: string; }
interface Pipeline { id: string; name: string; stages: PipelineStage[]; }
interface Deal { id: string; pipeline_id: string; stage_id: string; value: number; }

interface Props {
    pipelines: (Pipeline & { stages: PipelineStage[] })[];
    allDeals: Deal[];
    onSelectPipeline: (id: string) => void;
    onOpenManager: () => void;
    onCreateDeal: (pipelineId: string) => void;
    onEditPipeline: (id: string) => void;
}

const PIPELINE_ACCENT_COLORS = [
    { border: 'border-t-indigo-500', bg: 'from-indigo-50', icon: 'text-indigo-600', badge: 'bg-indigo-100 text-indigo-700' },
    { border: 'border-t-emerald-500', bg: 'from-emerald-50', icon: 'text-emerald-600', badge: 'bg-emerald-100 text-emerald-700' },
    { border: 'border-t-violet-500', bg: 'from-violet-50', icon: 'text-violet-600', badge: 'bg-violet-100 text-violet-700' },
    { border: 'border-t-amber-500', bg: 'from-amber-50', icon: 'text-amber-600', badge: 'bg-amber-100 text-amber-700' },
    { border: 'border-t-rose-500', bg: 'from-rose-50', icon: 'text-rose-600', badge: 'bg-rose-100 text-rose-700' },
    { border: 'border-t-cyan-500', bg: 'from-cyan-50', icon: 'text-cyan-600', badge: 'bg-cyan-100 text-cyan-700' },
];

const fmt = (v: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v);

const fmtShort = (v: number) =>
    v > 0
        ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0, notation: 'compact' } as any).format(v)
        : '₹0';

export const PipelineOverviewCards = ({ pipelines, allDeals, onSelectPipeline, onOpenManager, onCreateDeal, onEditPipeline }: Props) => {
    const getPipelineStats = (pipelineId: string, stages: PipelineStage[]) => {
        const deals = allDeals.filter(d => d.pipeline_id === pipelineId);
        const wonStageIds = stages.filter(s => s.name.toLowerCase().includes('won')).map(s => s.id);
        const lostStageIds = stages.filter(s => s.name.toLowerCase().includes('lost')).map(s => s.id);
        const wonDeals = deals.filter(d => wonStageIds.includes(d.stage_id));
        const lostDeals = deals.filter(d => lostStageIds.includes(d.stage_id));
        const openDeals = deals.filter(d => !wonStageIds.includes(d.stage_id) && !lostStageIds.includes(d.stage_id));
        const wonRev = wonDeals.reduce((s, d) => s + (Number(d.value) || 0), 0);
        const lostRev = lostDeals.reduce((s, d) => s + (Number(d.value) || 0), 0);
        const openRev = openDeals.reduce((s, d) => s + (Number(d.value) || 0), 0);
        return { total: deals.length, open: openDeals.length, won: wonDeals.length, lost: lostDeals.length, openRev, wonRev, lostRev };
    };

    const globalStats = pipelines.reduce((acc, p) => {
        const s = getPipelineStats(p.id, p.stages);
        return {
            total: acc.total + s.total,
            open: acc.open + s.open,
            won: acc.won + s.won,
            lost: acc.lost + s.lost,
            openRev: acc.openRev + s.openRev,
            wonRev: acc.wonRev + s.wonRev,
            lostRev: acc.lostRev + s.lostRev,
        };
    }, { total: 0, open: 0, won: 0, lost: 0, openRev: 0, wonRev: 0, lostRev: 0 });

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                        <TrendingUp className="w-6 h-6 text-indigo-600" /> Sales Pipelines
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                        {pipelines.length} pipeline{pipelines.length !== 1 ? 's' : ''} • {globalStats.total} total leads
                    </p>
                </div>
                <button onClick={onOpenManager} className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl shadow-md shadow-indigo-600/20 transition-all">
                    <Plus className="w-4 h-4" /> New Pipeline
                </button>
            </div>

            {/* Global Summary Banner */}
            <div className="bg-gradient-to-r from-indigo-600 to-violet-600 rounded-2xl p-5 text-white shadow-lg shadow-indigo-500/20">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-white/80" />
                        <span className="text-sm font-bold text-white/80 uppercase tracking-wider">All Pipelines Combined</span>
                    </div>
                    <span className="text-xs font-bold bg-white/20 px-2 py-1 rounded-full">{pipelines.length} Pipelines</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {/* Total Leads */}
                    <div className="bg-white/10 rounded-xl p-3">
                        <p className="text-white/60 text-[10px] font-bold uppercase tracking-wider mb-1">Total Leads</p>
                        <p className="text-3xl font-black">{globalStats.total}</p>
                        <p className="text-white/50 text-[10px] font-bold mt-0.5">in pipeline</p>
                    </div>
                    {/* Open */}
                    <div className="bg-white/10 rounded-xl p-3">
                        <p className="text-white/60 text-[10px] font-bold uppercase tracking-wider mb-1">🔵 Open</p>
                        <p className="text-2xl font-black">{globalStats.open} <span className="text-sm font-bold text-white/60">leads</span></p>
                        <p className="text-white/70 text-[10px] font-bold mt-0.5">{globalStats.openRev > 0 ? fmt(globalStats.openRev) : 'TBD'}</p>
                    </div>
                    {/* Won */}
                    <div className="bg-emerald-500/30 rounded-xl p-3">
                        <p className="text-emerald-200 text-[10px] font-bold uppercase tracking-wider mb-1">✅ Won</p>
                        <p className="text-2xl font-black text-emerald-100">{globalStats.won} <span className="text-sm font-bold text-emerald-200/70">leads</span></p>
                        <p className="text-emerald-200 text-[10px] font-bold mt-0.5">{fmt(globalStats.wonRev)}</p>
                    </div>
                    {/* Lost */}
                    <div className="bg-rose-500/30 rounded-xl p-3">
                        <p className="text-rose-200 text-[10px] font-bold uppercase tracking-wider mb-1">❌ Lost</p>
                        <p className="text-2xl font-black text-rose-100">{globalStats.lost} <span className="text-sm font-bold text-rose-200/70">leads</span></p>
                        <p className="text-rose-200 text-[10px] font-bold mt-0.5">{fmt(globalStats.lostRev)}</p>
                    </div>
                </div>
            </div>

            {/* Pipeline Cards Grid */}
            {pipelines.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                    <Layers className="w-10 h-10 text-slate-300 mb-3" />
                    <h3 className="font-bold text-slate-600 mb-1">No Pipelines Yet</h3>
                    <p className="text-sm text-slate-400 mb-4">Create your first pipeline to start tracking leads.</p>
                    <button onClick={onOpenManager} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold">Create Pipeline</button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                    {pipelines.map((pipeline, idx) => {
                        const accent = PIPELINE_ACCENT_COLORS[idx % PIPELINE_ACCENT_COLORS.length];
                        const stats = getPipelineStats(pipeline.id, pipeline.stages);
                        return (
                            <div key={pipeline.id} className={`bg-white rounded-2xl border border-slate-200 border-t-4 ${accent.border} shadow-sm hover:shadow-md transition-all group overflow-hidden`}>
                                {/* Card Header */}
                                <div className={`p-5 bg-gradient-to-b ${accent.bg} to-white`}>
                                    <div className="flex items-start justify-between mb-3">
                                        <div>
                                            <h3 className="font-black text-slate-800 text-lg leading-tight group-hover:text-indigo-700 transition-colors">{pipeline.name}</h3>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${accent.badge}`}>{pipeline.stages.length} stages</span>
                                                <span className="text-[10px] font-bold text-slate-400">{stats.total} leads</span>
                                            </div>
                                        </div>
                                        <button onClick={(e) => { e.stopPropagation(); onEditPipeline(pipeline.id); }} title="Edit Pipeline" className="p-1.5 text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors">
                                            <Settings2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                    {/* Stage Pills */}
                                    <div className="flex flex-wrap gap-1 mt-2">
                                        {pipeline.stages.map(stage => (
                                            <span key={stage.id} className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${stage.bg_color} ${stage.color} ${stage.border_color}`}>
                                                {stage.name}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                {/* Stats Grid — Total + Open / Won / Lost */}
                                <div className="px-4 pt-3 pb-1 border-t border-slate-100">
                                    <div className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 mb-3">
                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Leads</span>
                                        <span className="text-lg font-black text-slate-800">{stats.total}</span>
                                    </div>
                                <div className="grid grid-cols-3 gap-2">
                                    <div className="text-center">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Open</p>
                                        <p className="text-xl font-black text-slate-700">{stats.open}</p>
                                        <p className="text-[10px] text-indigo-500 font-bold mt-0.5">
                                            {stats.openRev > 0 ? fmtShort(stats.openRev) : 'TBD'}
                                        </p>
                                    </div>
                                    <div className="text-center border-x border-slate-100">
                                        <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider mb-1">Won</p>
                                        <p className="text-xl font-black text-emerald-600">{stats.won}</p>
                                        <p className="text-[10px] text-emerald-500 font-bold mt-0.5">{fmtShort(stats.wonRev)}</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-[10px] font-bold text-rose-400 uppercase tracking-wider mb-1">Lost</p>
                                        <p className="text-xl font-black text-rose-500">{stats.lost}</p>
                                        <p className="text-[10px] text-rose-400 font-bold mt-0.5">{fmtShort(stats.lostRev)}</p>
                                    </div>
                                 </div>
                                </div>

                                {/* Action Footer */}
                                <div className="px-4 pb-4 flex gap-2">
                                    <button
                                        onClick={() => onSelectPipeline(pipeline.id)}
                                        className={`flex-1 py-2.5 ${accent.badge} font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 hover:opacity-80 transition-opacity`}
                                    >
                                        View Kanban <ArrowRight className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                        onClick={() => onCreateDeal(pipeline.id)}
                                        className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl transition-colors flex items-center gap-1"
                                    >
                                        <Plus className="w-3.5 h-3.5" /> Add Lead
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
