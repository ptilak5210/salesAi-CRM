import React, { useState, useEffect } from 'react';
import { AuthSession } from '../../../utils/types';
import { Download, Loader2, Calendar } from 'lucide-react';

interface AnalyticsViewProps {
    session: AuthSession;
}

export const AnalyticsView = ({ session }: AnalyticsViewProps) => {
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState<'today' | 'this_week' | 'this_month' | 'this_year' | 'all'>('all');
    const [data, setData] = useState<any>(null);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const res = await fetch(`http://localhost:3001/api/analytics/summary?dateRange=${dateRange}`, {
                    headers: { 'Authorization': `Bearer ${session.token}` }
                });
                const json = await res.json();
                if (json.success) {
                    setData(json.data);
                }
            } catch (err) {
                console.error("Failed to fetch analytics", err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [dateRange, session.token]);

    const handleExportCSV = () => {
        if (!data || !data.byTeamMember) return;
        
        // Define CSV Headers
        const headers = ['Sales Head Name', 'Total Leads', 'Open', 'Won', 'Lost', '% Won', '% Lost', 'Won Amount (INR)'];
        
        // Map data rows
        const rows = data.byTeamMember.map((row: any) => [
            row.name,
            row.total,
            row.open,
            row.won,
            row.lost,
            row.wonPercent,
            row.lostPercent,
            row.wonAmount
        ]);
        
        const csvContent = [
            headers.join(','),
            ...rows.map((r: any[]) => r.map(cell => `"${cell}"`).join(','))
        ].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `SalesAI_Analytics_${dateRange}_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const formatCurrency = (val: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);

    const GaugeCard = ({ title, value, max, isPercentage, colorHex }: { title: string, value: number, max: number, isPercentage?: boolean, colorHex: string }) => {
        const radius = 30;
        const circumference = 2 * Math.PI * radius;
        const safeMax = max > 0 ? max : 1;
        const displayValue = Math.min(value, safeMax);
        const strokeDashoffset = circumference - (displayValue / safeMax) * circumference;

        return (
            <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm flex items-center gap-4 hover:shadow-md transition-all group">
                <div className="relative w-16 h-16 shrink-0">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 80 80">
                        <circle cx="40" cy="40" r={radius} stroke="#f1f5f9" strokeWidth="8" fill="none" />
                        <circle 
                            cx="40" cy="40" r={radius} 
                            stroke={colorHex} 
                            strokeWidth="8" 
                            fill="none" 
                            strokeLinecap="round"
                            style={{ strokeDasharray: circumference, strokeDashoffset, transition: 'stroke-dashoffset 1s ease-out' }} 
                        />
                    </svg>
                </div>
                <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{title}</h3>
                    <p className="text-2xl font-black text-slate-700">
                        {isPercentage ? `${Number(value).toFixed(2)}%` : new Intl.NumberFormat('en-IN').format(value)}
                    </p>
                </div>
            </div>
        );
    };

    // Calculate maximums for gauges
    const maxTotal = data?.kpis?.totalLeads || 1;

    return (
        <div className="h-full flex flex-col space-y-6 animate-fade-in pb-8">
            {/* COMMAND CENTER HEADER - Distinctly analytical and strategic */}
            <div className="bg-slate-900 rounded-3xl p-6 md:p-8 shadow-2xl text-white relative overflow-hidden flex flex-col xl:flex-row xl:items-center justify-between gap-6 border border-slate-800">
                {/* Decorative background elements */}
                <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-indigo-500/20 blur-3xl pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-48 h-48 rounded-full bg-blue-500/10 blur-3xl pointer-events-none"></div>
                
                <div className="relative z-10">
                    <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-indigo-200 to-white bg-clip-text text-transparent">
                        Analytics Command Center
                    </h1>
                    <p className="text-sm text-slate-400 mt-1.5 font-medium max-w-md">
                        Strategic overview and performance breakdown by team members and product pipelines.
                    </p>
                </div>
                
                <div className="flex flex-wrap items-center gap-4 relative z-10">
                    <div className="bg-slate-800/80 backdrop-blur-md rounded-2xl shadow-inner border border-slate-700/50 p-1.5 flex items-center">
                        {[
                            { id: 'today', label: 'Today' },
                            { id: 'this_week', label: 'This Week' },
                            { id: 'this_month', label: 'This Month' },
                            { id: 'this_year', label: 'This Year' },
                            { id: 'all', label: 'All Time' },
                        ].map(t => (
                            <button
                                key={t.id}
                                onClick={() => setDateRange(t.id as any)}
                                className={`px-5 py-2 text-sm font-bold rounded-xl transition-all duration-300 ${dateRange === t.id ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/25' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>
                    <button 
                        onClick={handleExportCSV}
                        className="bg-white/10 hover:bg-white/20 border border-white/10 text-white px-5 py-2 rounded-2xl text-sm font-bold shadow-sm transition-all flex items-center gap-2 h-[44px] backdrop-blur-sm"
                    >
                        <Download className="w-4 h-4 text-indigo-300" /> Export CSV
                    </button>
                </div>
            </div>

            {loading && !data ? (
                <div className="space-y-6">
                    {/* KPI Skeleton */}
                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
                        {[1, 2, 3, 4, 5, 6].map(i => (
                            <div key={i} className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm flex items-center gap-4">
                                <div className="w-16 h-16 shrink-0 rounded-full border-8 border-slate-100 animate-pulse bg-slate-50"></div>
                                <div className="space-y-2 w-full">
                                    <div className="w-12 h-2.5 bg-slate-200 rounded animate-pulse"></div>
                                    <div className="w-20 h-5 bg-slate-200 rounded animate-pulse"></div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Table Skeleton */}
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                        {[1, 2].map(table => (
                            <div key={table} className="bg-white rounded-2xl shadow-sm border border-slate-200/60 flex flex-col overflow-hidden">
                                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                                    <div className="w-32 h-4 bg-slate-200 rounded animate-pulse"></div>
                                    <div className="w-20 h-5 bg-slate-200 rounded-lg animate-pulse"></div>
                                </div>
                                <div className="p-5 space-y-5">
                                    {[1, 2, 3, 4].map(i => (
                                        <div key={i} className="flex items-center gap-6">
                                            <div className="w-6 h-6 rounded-full bg-slate-200 animate-pulse shrink-0"></div>
                                            <div className="w-24 h-3 bg-slate-200 rounded animate-pulse"></div>
                                            <div className="w-12 h-3 bg-slate-200 rounded animate-pulse ml-auto"></div>
                                            <div className="w-12 h-3 bg-slate-200 rounded animate-pulse"></div>
                                            <div className="w-12 h-3 bg-slate-200 rounded animate-pulse"></div>
                                            <div className="w-12 h-3 bg-slate-200 rounded animate-pulse"></div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Bar Chart Skeleton */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-5">
                        <div className="mb-6 space-y-2">
                            <div className="w-48 h-4 bg-slate-200 rounded animate-pulse"></div>
                            <div className="w-64 h-3 bg-slate-100 rounded animate-pulse"></div>
                        </div>
                        <div className="space-y-4">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="flex items-center gap-4">
                                    <div className="w-24 h-3 bg-slate-200 rounded animate-pulse shrink-0"></div>
                                    <div className="flex-1 h-6 bg-slate-100 rounded-md animate-pulse"></div>
                                    <div className="w-16 h-3 bg-slate-200 rounded animate-pulse shrink-0"></div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            ) : !data ? null : (
                <>
                    {/* KPI Gauges */}
                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
                        <GaugeCard title="Total Leads" value={data.kpis.totalLeads} max={maxTotal} colorHex="#4f46e5" /> {/* Indigo */}
                        <GaugeCard title="Open" value={data.kpis.openLeads} max={maxTotal} colorHex="#f59e0b" /> {/* Amber */}
                        <GaugeCard title="Won" value={data.kpis.wonLeads} max={maxTotal} colorHex="#10b981" /> {/* Emerald */}
                        <GaugeCard title="Lost" value={data.kpis.lostLeads} max={maxTotal} colorHex="#f43f5e" /> {/* Rose */}
                        <GaugeCard title="% Won" value={data.kpis.wonPercent} max={100} isPercentage colorHex="#06b6d4" /> {/* Cyan */}
                        <GaugeCard title="% Lost" value={data.kpis.lostPercent} max={100} isPercentage colorHex="#8b5cf6" /> {/* Violet */}
                    </div>

                    {/* Data Tables */}
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                        
                        {/* TEAM MEMBER TABLE */}
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 flex flex-col overflow-hidden">
                            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                                <h2 className="font-bold text-slate-800">Team Member Performance</h2>
                                <span className="bg-indigo-100 text-indigo-700 text-[10px] font-bold px-2.5 py-1 rounded-lg">Sales Heads</span>
                            </div>
                            <div className="overflow-x-auto custom-scrollbar">
                                <table className="w-full text-left border-collapse whitespace-nowrap">
                                    <thead>
                                        <tr className="bg-white border-b border-slate-100">
                                            <th className="px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Name</th>
                                            <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Total</th>
                                            <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Open</th>
                                            <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Won</th>
                                            <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Lost</th>
                                            <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">% Won</th>
                                            <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">% Lost</th>
                                            <th className="px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">Won Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {/* TOTAL ROW */}
                                        <tr className="bg-indigo-50/50 border-b border-indigo-100">
                                            <td className="px-5 py-3 font-extrabold text-indigo-900 text-xs">GRAND TOTAL</td>
                                            <td className="px-4 py-3 font-extrabold text-indigo-900 text-xs text-center">{data.kpis.totalLeads}</td>
                                            <td className="px-4 py-3 font-bold text-indigo-800 text-xs text-center">{data.kpis.openLeads}</td>
                                            <td className="px-4 py-3 font-bold text-emerald-600 text-xs text-center">{data.kpis.wonLeads}</td>
                                            <td className="px-4 py-3 font-bold text-rose-600 text-xs text-center">{data.kpis.lostLeads}</td>
                                            <td className="px-4 py-3 font-bold text-emerald-600 text-xs text-center">{data.kpis.wonPercent}%</td>
                                            <td className="px-4 py-3 font-bold text-rose-600 text-xs text-center">{data.kpis.lostPercent}%</td>
                                            <td className="px-5 py-3 font-extrabold text-indigo-900 text-xs text-right">
                                                {formatCurrency(data.byTeamMember.reduce((sum: number, r: any) => sum + r.wonAmount, 0))}
                                            </td>
                                        </tr>
                                        {data.byTeamMember.length === 0 ? (
                                            <tr>
                                                <td colSpan={8} className="px-5 py-8 text-center text-sm font-bold text-slate-400">
                                                    No team members found. Assign leads to see data.
                                                </td>
                                            </tr>
                                        ) : data.byTeamMember.map((row: any, idx: number) => (
                                            <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                                                <td className="px-5 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] text-white font-bold shrink-0 ${idx === 0 ? 'bg-gradient-to-br from-amber-400 to-orange-500 shadow-sm' : 'bg-gradient-to-br from-indigo-500 to-purple-600'}`}>
                                                            {row.name.charAt(0).toUpperCase()}
                                                        </div>
                                                        <span className="font-bold text-slate-700 text-xs flex items-center gap-1.5">
                                                            {row.name}
                                                            {idx === 0 && <span title="Top Performer">👑</span>}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 font-bold text-slate-700 text-xs text-center">{row.total}</td>
                                                <td className="px-4 py-3 font-bold text-amber-600 text-xs text-center">{row.open}</td>
                                                <td className="px-4 py-3 font-bold text-emerald-600 text-xs text-center">{row.won}</td>
                                                <td className="px-4 py-3 font-bold text-rose-600 text-xs text-center">{row.lost}</td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full">{row.wonPercent}%</span>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className="bg-rose-100 text-rose-700 text-[10px] font-bold px-2 py-0.5 rounded-full">{row.lostPercent}%</span>
                                                </td>
                                                <td className="px-5 py-3 font-bold text-slate-700 text-xs text-right">
                                                    {formatCurrency(row.wonAmount)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* PIPELINE / PRODUCT TABLE */}
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 flex flex-col overflow-hidden">
                            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                                <h2 className="font-bold text-slate-800">Pipeline Breakdown</h2>
                                <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2.5 py-1 rounded-lg">Products / Services</span>
                            </div>
                            <div className="overflow-x-auto custom-scrollbar">
                                <table className="w-full text-left border-collapse whitespace-nowrap">
                                    <thead>
                                        <tr className="bg-white border-b border-slate-100">
                                            <th className="px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Product / Category</th>
                                            <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Total</th>
                                            <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Open</th>
                                            <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Won</th>
                                            <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Lost</th>
                                            <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">% Won</th>
                                            <th className="px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">% Lost</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {/* TOTAL ROW */}
                                        <tr className="bg-indigo-50/50 border-b border-indigo-100">
                                            <td className="px-5 py-3 font-extrabold text-indigo-900 text-xs">GRAND TOTAL</td>
                                            <td className="px-4 py-3 font-extrabold text-indigo-900 text-xs text-center">{data.byPipeline.reduce((s:number,r:any)=>s+r.total,0)}</td>
                                            <td className="px-4 py-3 font-bold text-indigo-800 text-xs text-center">{data.byPipeline.reduce((s:number,r:any)=>s+r.open,0)}</td>
                                            <td className="px-4 py-3 font-bold text-emerald-600 text-xs text-center">{data.byPipeline.reduce((s:number,r:any)=>s+r.won,0)}</td>
                                            <td className="px-4 py-3 font-bold text-rose-600 text-xs text-center">{data.byPipeline.reduce((s:number,r:any)=>s+r.lost,0)}</td>
                                            <td className="px-4 py-3 font-bold text-emerald-600 text-xs text-center">-</td>
                                            <td className="px-5 py-3 font-bold text-rose-600 text-xs text-center">-</td>
                                        </tr>
                                        {data.byPipeline.length === 0 ? (
                                            <tr>
                                                <td colSpan={7} className="px-5 py-8 text-center text-sm font-bold text-slate-400">
                                                    No products found. Add products to deals.
                                                </td>
                                            </tr>
                                        ) : data.byPipeline.map((row: any, idx: number) => (
                                            <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                                                <td className="px-5 py-3">
                                                    <span className="font-bold text-slate-700 text-xs">{row.product}</span>
                                                </td>
                                                <td className="px-4 py-3 font-bold text-slate-700 text-xs text-center">{row.total}</td>
                                                <td className="px-4 py-3 font-bold text-amber-600 text-xs text-center">{row.open}</td>
                                                <td className="px-4 py-3 font-bold text-emerald-600 text-xs text-center">{row.won}</td>
                                                <td className="px-4 py-3 font-bold text-rose-600 text-xs text-center">{row.lost}</td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full">{row.wonPercent}%</span>
                                                </td>
                                                <td className="px-5 py-3 text-center">
                                                    <span className="bg-rose-100 text-rose-700 text-[10px] font-bold px-2 py-0.5 rounded-full">{row.lostPercent}%</span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                    </div>

                    {/* BAR CHART: TEAM COMPARISON */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-5">
                        <div className="mb-6">
                            <h2 className="font-bold text-slate-800">Team Comparison (Total vs Open)</h2>
                            <p className="text-xs text-slate-500 mt-1">Comparing total leads versus currently open leads per member.</p>
                        </div>
                        
                        <div className="space-y-4">
                            {data.byTeamMember.map((row: any, idx: number) => {
                                const maxBarValue = Math.max(...data.byTeamMember.map((r: any) => r.total), 1);
                                const totalWidth = (row.total / maxBarValue) * 100;
                                const openWidth = row.total > 0 ? (row.open / row.total) * 100 : 0;
                                
                                return (
                                    <div key={idx} className="flex items-center gap-4">
                                        <div className="w-32 shrink-0 text-right">
                                            <p className="text-xs font-bold text-slate-700 truncate">{row.name}</p>
                                        </div>
                                        <div className="flex-1 flex items-center gap-3">
                                            {/* Bar Container */}
                                            <div className="flex-1 h-6 bg-slate-50 rounded-md relative overflow-hidden border border-slate-100">
                                                {/* Total Bar (Background) */}
                                                <div 
                                                    className="absolute top-0 left-0 h-full bg-slate-200 rounded-md transition-all duration-1000"
                                                    style={{ width: `${totalWidth}%` }}
                                                />
                                                {/* Open Bar (Foreground Overlay) */}
                                                <div 
                                                    className="absolute top-0 left-0 h-full bg-amber-400 rounded-md transition-all duration-1000"
                                                    style={{ width: `${(openWidth / 100) * totalWidth}%` }}
                                                />
                                            </div>
                                            <div className="w-24 shrink-0 text-xs font-bold text-slate-500">
                                                <span className="text-slate-700">{row.total}</span> Total / <span className="text-amber-600">{row.open}</span> Open
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            
                            {data.byTeamMember.length === 0 && (
                                <p className="text-sm font-bold text-slate-400 text-center py-4">No team data to display.</p>
                            )}
                        </div>
                    </div>

                </>
            )}
        </div>
    );
};
