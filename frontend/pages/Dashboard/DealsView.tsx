import React, { useState, useEffect } from 'react';
import { Plus, Search, Loader2, IndianRupee, TrendingUp, Calendar as CalendarIcon, CheckCircle2, List, X, Settings2, Trash2, Edit2, Check, ArrowRightLeft, Globe, LayoutGrid, ArrowLeft } from 'lucide-react';
import { AuthSession, Deal, Pipeline, PipelineStage, Lead } from '../../../utils/types';
import { PipelineOverviewCards } from './PipelineOverviewCards';
import { AddLeadModal } from '../../components/Dashboard/AddLeadModal';
import { usePermissions } from '../../hooks/usePermissions';

interface DealsViewProps {
    session: AuthSession;
    leads: Lead[];
    initialView?: 'overview' | 'kanban';
}

const DEFAULT_THEMES = [
    { id: 'slate', name: 'Slate', color: 'text-slate-600', bg_color: 'bg-slate-50', border_color: 'border-slate-200' },
    { id: 'blue', name: 'Blue', color: 'text-blue-600', bg_color: 'bg-blue-50', border_color: 'border-blue-200' },
    { id: 'indigo', name: 'Indigo', color: 'text-indigo-600', bg_color: 'bg-indigo-50', border_color: 'border-indigo-200' },
    { id: 'emerald', name: 'Emerald', color: 'text-emerald-600', bg_color: 'bg-emerald-50', border_color: 'border-emerald-200' },
    { id: 'amber', name: 'Amber', color: 'text-amber-600', bg_color: 'bg-amber-50', border_color: 'border-amber-200' },
    { id: 'orange', name: 'Orange', color: 'text-orange-600', bg_color: 'bg-orange-50', border_color: 'border-orange-200' },
    { id: 'rose', name: 'Rose', color: 'text-rose-600', bg_color: 'bg-rose-50', border_color: 'border-rose-200' },
];

export const DealsView = ({ session, leads, initialView }: DealsViewProps) => {
    const perms = usePermissions(session);
    
    // Page view: 'overview' shows pipeline cards, 'kanban' shows board
    const [pageView, setPageView] = useState<'overview' | 'kanban'>(initialView || 'overview');

    // Pipelines State
    const [pipelines, setPipelines] = useState<(Pipeline & { stages: PipelineStage[] })[]>([]);
    const [activePipelineId, setActivePipelineId] = useState<string>('');
    
    // Pipeline Modal State
    const [isPipelineModalOpen, setIsPipelineModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'manage' | 'create'>('manage');
    const [newPipelineName, setNewPipelineName] = useState('');
    const [newPipelineStages, setNewPipelineStages] = useState([
        { id: '1', name: 'New Lead', theme: 'slate' },
        { id: '2', name: 'Contacted', theme: 'blue' },
        { id: '3', name: 'Qualified', theme: 'indigo' },
        { id: '4', name: 'Won', theme: 'emerald' },
        { id: '5', name: 'Lost', theme: 'rose' },
    ]);
    const [editingPipelineId, setEditingPipelineId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [editStages, setEditStages] = useState<{ id: string; name: string; theme: string }[]>([]);

    // Transfer State
    const [deletingPipelineId, setDeletingPipelineId] = useState<string | null>(null);
    const [transferPipelineId, setTransferPipelineId] = useState<string>('');

    // Deals State
    const [allDeals, setAllDeals] = useState<Deal[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState<'active' | 'all'>('active');
    
    // Deal Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [newDeal, setNewDeal] = useState({
        lead_id: '',
        title: '',
        value: '',
        stage_id: '',
        score: 'Cold',
        expected_close_date: ''
    });
    // Deal Detail / Edit Modal State
    const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
    const [editingDeal, setEditingDeal] = useState<any>(null);

    const activePipeline = pipelines.find(p => p.id === activePipelineId);
    const STAGES = activePipeline?.stages || [];

    const fetchPipelines = async () => {
        try {
            const res = await fetch('http://localhost:3001/api/pipelines', {
                headers: { 'Authorization': `Bearer ${session.token}` }
            });
            const data = await res.json();
            if (data.success && data.data && data.data.length > 0) {
                setPipelines(data.data);
                if (!activePipelineId || !data.data.find((p:any) => p.id === activePipelineId)) {
                    setActivePipelineId(data.data[0].id);
                }
            } else if (data.success && data.data && data.data.length === 0) {
                setPipelines([]);
                setActivePipelineId('');
                setLoading(false);
            } else {
                setLoading(false);
            }
        } catch (error) {
            console.error('Failed to fetch pipelines:', error);
            setLoading(false);
        }
    };

    const fetchAllDeals = async () => {
        setLoading(true);
        try {
            const response = await fetch(`http://localhost:3001/api/deals`, {
                headers: { 'Authorization': `Bearer ${session.token}` }
            });
            const data = await response.json();
            if (data.success) {
                setAllDeals(data.data);
            }
        } catch (error) {
            console.error('Failed to fetch deals:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPipelines();
        fetchAllDeals();
    }, [session]);

    useEffect(() => {
        if (activePipelineId && STAGES.length > 0 && !newDeal.stage_id) {
            setNewDeal(prev => ({ ...prev, stage_id: STAGES[0].id }));
        }
    }, [activePipelineId, pipelines]);

    const handleCreatePipeline = async () => {
        if (!newPipelineName.trim() || newPipelineStages.length === 0) return;
        setSubmitting(true);
        
        const formattedStages = newPipelineStages.map(s => {
            const theme = DEFAULT_THEMES.find(t => t.id === s.theme) || DEFAULT_THEMES[0];
            return {
                name: s.name,
                color: theme.color,
                bg_color: theme.bg_color,
                border_color: theme.border_color
            };
        });

        try {
            const res = await fetch('http://localhost:3001/api/pipelines', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.token}` },
                body: JSON.stringify({ name: newPipelineName, stages: formattedStages })
            });
            const data = await res.json();
            if (data.success) {
                await fetchPipelines();
                setActivePipelineId(data.data.id);
                setModalMode('manage');
                setNewPipelineName('');
                setNewPipelineStages([
                    { id: '1', name: 'New Lead', theme: 'slate' },
                    { id: '2', name: 'Contacted', theme: 'blue' },
                    { id: '3', name: 'Qualified', theme: 'indigo' },
                    { id: '4', name: 'Won', theme: 'emerald' },
                    { id: '5', name: 'Lost', theme: 'rose' },
                ]);
            }
        } catch (err) {
            console.error('Failed to create pipeline:', err);
        } finally {
            setSubmitting(false);
        }
    };

    const confirmDeletePipeline = async () => {
        if (!deletingPipelineId) return;
        setSubmitting(true);
        try {
            if (transferPipelineId) {
                const res = await fetch(`http://localhost:3001/api/pipelines/${deletingPipelineId}/transfer`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.token}` },
                    body: JSON.stringify({ target_pipeline_id: transferPipelineId })
                });
                if (res.ok) {
                    await fetchPipelines();
                    await fetchAllDeals();
                }
            } else {
                const res = await fetch(`http://localhost:3001/api/pipelines/${deletingPipelineId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${session.token}` }
                });
                if (res.ok) {
                    await fetchPipelines();
                    await fetchAllDeals();
                }
            }
        } catch (err) {
            console.error('Failed to delete/transfer pipeline', err);
        } finally {
            setSubmitting(false);
            setDeletingPipelineId(null);
            setTransferPipelineId('');
        }
    };

    const handleSavePipeline = async (id: string) => {
        if (!editName.trim() || editStages.length === 0) return;
        setSubmitting(true);
        
        const formattedStages = editStages.map(s => {
            const theme = DEFAULT_THEMES.find(t => t.id === s.theme) || DEFAULT_THEMES[0];
            return {
                name: s.name,
                color: theme.color,
                bg_color: theme.bg_color,
                border_color: theme.border_color
            };
        });
        
        try {
            const res = await fetch(`http://localhost:3001/api/pipelines/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.token}` },
                body: JSON.stringify({ name: editName, stages: formattedStages })
            });
            if (res.ok) {
                await fetchPipelines();
                setEditingPipelineId(null);
                setEditStages([]);
            }
        } catch (err) {
            console.error('Failed to save pipeline', err);
        } finally {
            setSubmitting(false);
        }
    };

    const handleCreateDeal = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        const selectedLead = leads.find(l => l.id === newDeal.lead_id);
        try {
            const response = await fetch('http://localhost:3001/api/deals', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.token}`
                },
                body: JSON.stringify({
                    ...newDeal,
                    value: newDeal.value ? Number(newDeal.value) : 0,
                    pipeline_id: activePipelineId,
                    lead_name: selectedLead?.name || 'Unknown',
                    company: selectedLead?.company || '',
                    phone: selectedLead?.phone || ''
                })
            });
            if (response.ok) {
                setIsModalOpen(false);
                setNewDeal({ lead_id: '', title: '', value: '', stage_id: STAGES[0]?.id || '', score: 'Cold', expected_close_date: '' });
                fetchAllDeals();
            }
        } catch (error) {
            console.error('Failed to create deal:', error);
        } finally {
            setSubmitting(false);
        }
    };

    const handleStageChange = async (dealId: string, newStageId: string) => {
        const targetStage = STAGES.find(s => s.id === newStageId);
        if (!targetStage) return;
        
        const isWon = targetStage.name.toLowerCase().includes('won');
        const isLost = targetStage.name.toLowerCase().includes('lost');

        try {
            // Optimistic update
            setAllDeals(allDeals.map(d => d.id === dealId ? { ...d, stage_id: newStageId } : d));
            
            await fetch(`http://localhost:3001/api/deals/${dealId}/stage`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.token}` },
                body: JSON.stringify({ stage_id: newStageId, is_won: isWon, is_lost: isLost })
            });
        } catch (error) {
            console.error('Failed to update stage:', error);
            fetchAllDeals();
        }
    };

    const handleSaveDealEdit = async () => {
        if (!editingDeal || !selectedDeal) return;
        setSubmitting(true);
        try {
            const res = await fetch(`http://localhost:3001/api/deals/${selectedDeal.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.token}` },
                body: JSON.stringify({
                    title: editingDeal.title,
                    value: editingDeal.value ? Number(editingDeal.value) : 0,
                    stage_id: editingDeal.stage_id,
                    score: editingDeal.score,
                    expected_close_date: editingDeal.expected_close_date || null,
                })
            });
            if (res.ok) { setSelectedDeal(null); setEditingDeal(null); fetchAllDeals(); }
        } catch (err) { console.error('Failed to save deal edit:', err); }
        finally { setSubmitting(false); }
    };

    const handleDeleteDeal = async (dealId: string) => {
        if (!confirm('Are you sure you want to delete this deal?')) return;
        try {
            await fetch(`http://localhost:3001/api/deals/${dealId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${session.token}` }
            });
            setSelectedDeal(null); setEditingDeal(null); fetchAllDeals();
        } catch (err) { console.error('Failed to delete deal:', err); }
    };

    const formatCurrency = (amount: number | string | null | undefined) => {
        const parsed = Number(amount);
        if (!parsed || parsed === 0) return <span className="text-slate-400 font-bold text-[10px] bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200 shadow-sm">TBD</span>;
        return <span className="text-slate-700 font-black">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(parsed)}</span>;
    };

    const getScoreBadge = (score: string) => {
        switch(score) {
            case 'Hot': return <span className="bg-rose-100 text-rose-700 text-[10px] font-bold px-2 py-0.5 rounded-full">🔥 HOT</span>;
            case 'Warm': return <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full">🌡 WARM</span>;
            default: return <span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-full">❄ COLD</span>;
        }
    };

    // Filter deals for Kanban Board (Only Active Pipeline)
    const activeDeals = allDeals.filter(d => d.pipeline_id === activePipelineId);
    const filteredDeals = activeDeals.filter(d => 
        (d.title || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
        (d.lead_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (d.company || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Dynamic Logic for Global/Active Metrics
    const isDealWon = (deal: Deal) => {
        const pipeline = pipelines.find(p => p.id === deal.pipeline_id);
        const stage = pipeline?.stages?.find(s => s.id === deal.stage_id);
        return stage?.name.toLowerCase().includes('won') || false;
    };
    
    const isDealLost = (deal: Deal) => {
        const pipeline = pipelines.find(p => p.id === deal.pipeline_id);
        const stage = pipeline?.stages?.find(s => s.id === deal.stage_id);
        return stage?.name.toLowerCase().includes('lost') || false;
    };

    const metricsDeals = viewMode === 'all' ? allDeals : activeDeals;
    const totalPipelineValue = metricsDeals.filter(d => !isDealWon(d) && !isDealLost(d)).reduce((sum, d) => sum + (Number(d.value) || 0), 0);
    const wonDeals = metricsDeals.filter(d => isDealWon(d));
    const wonRevenue = wonDeals.reduce((sum, d) => sum + (Number(d.value) || 0), 0);
    const winRate = metricsDeals.length > 0 ? Math.round((wonDeals.length / metricsDeals.length) * 100) : 0;

    return (
        <div className="h-full flex flex-col space-y-6 animate-fade-in">

            {/* ─── OVERVIEW MODE ─── */}
            {pageView === 'overview' && (
                <PipelineOverviewCards
                    pipelines={pipelines}
                    allDeals={allDeals}
                    onSelectPipeline={(id) => { setActivePipelineId(id); setPageView('kanban'); }}
                    onOpenManager={() => { setIsPipelineModalOpen(true); setModalMode('create'); }}
                    onCreateDeal={(pipelineId) => { setActivePipelineId(pipelineId); setPageView('kanban'); setIsModalOpen(true); }}
                    onEditPipeline={(id) => {
                        const pipeline = pipelines.find(p => p.id === id);
                        if (!pipeline) return;
                        setEditingPipelineId(id);
                        setEditName(pipeline.name);
                        setEditStages(pipeline.stages.map(s => {
                            const matchedTheme = DEFAULT_THEMES.find(t => t.color === s.color) || DEFAULT_THEMES[0];
                            return { id: s.id, name: s.name, theme: matchedTheme.id };
                        }));
                        setModalMode('manage');
                        setIsPipelineModalOpen(true);
                    }}
                />
            )}

            {/* ─── KANBAN MODE ─── */}
            {pageView === 'kanban' && (<>
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                    <button onClick={() => setPageView('overview')} className="flex items-center gap-1.5 text-sm text-indigo-600 font-bold hover:text-indigo-700 mb-2 transition-colors">
                        <ArrowLeft className="w-4 h-4" /> All Pipelines
                    </button>
                    <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                        <TrendingUp className="w-6 h-6 text-indigo-600" />
                        {pipelines.find(p => p.id === activePipelineId)?.name || 'Deals Pipeline'}
                    </h1>
                    <div className="flex items-center gap-3 mt-2">
                        <select
                            value={activePipelineId}
                            onChange={(e) => setActivePipelineId(e.target.value)}
                            className="bg-white border border-slate-200 text-slate-700 font-bold text-sm rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm outline-none cursor-pointer"
                        >
                            {pipelines.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                        {perms.canManagePipelines && (
                            <button onClick={() => setIsPipelineModalOpen(true)} className="text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-2 py-1.5 rounded-lg flex items-center gap-1 transition-colors">
                                <Settings2 className="w-3.5 h-3.5" /> Manage / New
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input 
                            type="text" 
                            placeholder="Search leads..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 w-64 shadow-sm"
                        />
                    </div>
                    <button onClick={() => setIsModalOpen(true)} disabled={!activePipelineId} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md shadow-indigo-600/20 transition-all flex items-center gap-2 disabled:opacity-50">
                        <Plus className="w-4 h-4" /> Add Lead to Pipeline
                    </button>
                </div>
            </div>

            {/* Top Summary Cards */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wider flex items-center gap-2">
                        {viewMode === 'all' ? <Globe className="w-4 h-4 text-indigo-500" /> : <List className="w-4 h-4 text-indigo-500" />}
                        {viewMode === 'all' ? 'Global Metrics (All Pipelines)' : 'Active Pipeline Metrics'}
                    </h3>
                    <div className="bg-slate-200/50 p-1 rounded-lg flex items-center gap-1">
                        <button onClick={() => setViewMode('active')} className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${viewMode === 'active' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Active Pipeline</button>
                        <button onClick={() => setViewMode('all')} className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${viewMode === 'all' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Global (All)</button>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
                        <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shrink-0">
                            <IndianRupee className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Open Revenue</p>
                            <p className="text-2xl">{formatCurrency(totalPipelineValue)}</p>
                        </div>
                    </div>
                    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
                        <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shrink-0">
                            <CheckCircle2 className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Won Revenue</p>
                            <p className="text-2xl">{formatCurrency(wonRevenue)}</p>
                        </div>
                    </div>
                    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
                        <div className="w-12 h-12 bg-orange-50 text-orange-600 rounded-xl flex items-center justify-center shrink-0">
                            <TrendingUp className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Overall Win Rate</p>
                            <p className="text-2xl font-black text-slate-700">{winRate}%</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Kanban Board */}
            <div className="flex-1 overflow-x-auto pb-4 custom-scrollbar">
                {loading ? (
                    <div className="flex justify-center items-center h-64">
                        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                    </div>
                ) : pipelines.length === 0 ? (
                    <div className="flex flex-col justify-center items-center h-64 bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-200">
                        <List className="w-10 h-10 text-slate-300 mb-2" />
                        <h3 className="text-slate-600 font-bold">No Pipelines Found</h3>
                        <p className="text-sm text-slate-400 mb-4">Create your first sales pipeline to track deals.</p>
                        <button onClick={() => { setIsPipelineModalOpen(true); setModalMode('create'); }} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm">
                            Create Pipeline
                        </button>
                    </div>
                ) : (
                    <div className="flex gap-4 h-full min-h-[500px]">
                        {STAGES.map(stage => {
                            const stageDeals = filteredDeals.filter(d => d.stage_id === stage.id);
                            const stageTotal = stageDeals.reduce((sum, d) => sum + (Number(d.value) || 0), 0);

                            return (
                                <div key={stage.id} className="w-[300px] shrink-0 flex flex-col bg-slate-100/50 rounded-2xl border border-slate-200/60 overflow-hidden">
                                    {/* Column Header */}
                                    <div className={`p-3 border-b ${stage.border_color} ${stage.bg_color}`}>
                                        <div className="flex items-center justify-between mb-1">
                                            <h3 className={`font-black text-sm uppercase tracking-wide ${stage.color}`}>{stage.name}</h3>
                                            <span className="bg-white text-slate-600 text-xs font-bold px-2 py-0.5 rounded-md shadow-sm border border-slate-200">
                                                {stageDeals.length}
                                            </span>
                                        </div>
                                        <p className="text-xs font-bold text-slate-500">{formatCurrency(stageTotal)}</p>
                                    </div>

                                    {/* Cards Container */}
                                    <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
                                        {stageDeals.map(deal => (
                                            <div key={deal.id} onClick={() => { setSelectedDeal(deal); setEditingDeal({ title: deal.title, value: deal.value || '', stage_id: deal.stage_id, score: deal.score, expected_close_date: deal.expected_close_date || '' }); }} className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer group">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div>
                                                        <h4 className="font-bold text-slate-800 text-sm leading-tight group-hover:text-indigo-600 transition-colors">{deal.title}</h4>
                                                        <p className="text-xs text-slate-500 mt-1 line-clamp-1">{deal.lead_name} {deal.company && `• ${deal.company}`}</p>
                                                    </div>
                                                    <select 
                                                        value={deal.stage_id}
                                                        onClick={(e) => e.stopPropagation()}
                                                        onChange={(e) => { e.stopPropagation(); handleStageChange(deal.id, e.target.value); }}
                                                        className="text-[10px] font-bold uppercase tracking-wider bg-slate-50 border border-slate-200 text-slate-600 rounded-md py-1 px-1.5 outline-none cursor-pointer hover:border-indigo-300 focus:border-indigo-500 transition-colors"
                                                    >
                                                        {STAGES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                                    </select>
                                                </div>
                                                
                                                <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                                                    {formatCurrency(deal.value)}
                                                    {getScoreBadge(deal.score)}
                                                </div>
                                                
                                                {deal.expected_close_date && (
                                                    <div className="mt-2 flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                                                        <CalendarIcon className="w-3 h-3" />
                                                        {new Date(deal.expected_close_date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                        
                                        {stageDeals.length === 0 && (
                                            <div className="h-24 flex items-center justify-center border-2 border-dashed border-slate-200 rounded-xl">
                                                <p className="text-xs font-bold text-slate-400">No leads in this stage</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

        </>)}

            {/* Deal Details Modal */}
            {selectedDeal && editingDeal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in">
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-black text-slate-800">Deal Details</h2>
                                <p className="text-xs text-slate-500 mt-0.5">{selectedDeal.lead_name}{(selectedDeal as any).company ? ` • ${(selectedDeal as any).company}` : ''}</p>
                            </div>
                            <button onClick={() => { setSelectedDeal(null); setEditingDeal(null); }} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Deal Title</label>
                                <input type="text" value={editingDeal.title} onChange={e => setEditingDeal({...editingDeal, title: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Value (₹) <span className="text-slate-400 font-normal">(Optional)</span></label>
                                    <input type="number" min="0" value={editingDeal.value} onChange={e => setEditingDeal({...editingDeal, value: e.target.value})} placeholder="Leave empty = TBD" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Expected Close</label>
                                    <input type="date" value={editingDeal.expected_close_date} onChange={e => setEditingDeal({...editingDeal, expected_close_date: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Stage</label>
                                    <select value={editingDeal.stage_id} onChange={e => setEditingDeal({...editingDeal, stage_id: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none">
                                        {STAGES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Score</label>
                                    <select value={editingDeal.score} onChange={e => setEditingDeal({...editingDeal, score: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none">
                                        <option value="Cold">❄ Cold</option>
                                        <option value="Warm">🌡 Warm</option>
                                        <option value="Hot">🔥 Hot</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div className="px-6 pb-6 flex items-center justify-between">
                            {perms.canDelete ? (
                                <button onClick={() => handleDeleteDeal(selectedDeal.id)} className="px-4 py-2.5 text-rose-600 hover:bg-rose-50 font-bold text-sm rounded-xl transition-colors flex items-center gap-2">
                                    <Trash2 className="w-4 h-4" /> Delete Deal
                                </button>
                            ) : <div></div>}
                            <div className="flex gap-3">
                                <button onClick={() => { setSelectedDeal(null); setEditingDeal(null); }} className="px-5 py-2.5 font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors text-sm">Cancel</button>
                                {perms.canEdit && (
                                    <button onClick={handleSaveDealEdit} disabled={submitting} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl shadow-md shadow-indigo-600/20 transition-all disabled:opacity-70 flex items-center gap-2">
                                        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Save Changes
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Pipeline Manager Modal */}
            {isPipelineModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-fade-in flex flex-col max-h-[90vh]">
                        
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
                            <h2 className="text-xl font-bold text-slate-800">
                                {editingPipelineId ? 'Edit Pipeline' : deletingPipelineId ? 'Delete Pipeline' : 'Pipeline Manager'}
                            </h2>
                            <button onClick={() => { setIsPipelineModalOpen(false); setDeletingPipelineId(null); setEditingPipelineId(null); setEditStages([]); }} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        
                        {/* Show tabs only when NOT editing/deleting a specific pipeline */}
                        {!editingPipelineId && !deletingPipelineId && (
                        <div className="flex border-b border-slate-100 shrink-0">
                            <button onClick={() => setModalMode('manage')} className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${modalMode === 'manage' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}>
                                Manage Existing
                            </button>
                            <button onClick={() => setModalMode('create')} className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${modalMode === 'create' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}>
                                Create New Pipeline
                            </button>
                        </div>
                        )}

                        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar relative">
                            {modalMode === 'manage' ? (
                                <div className="space-y-4">
                                    {pipelines.length === 0 ? (
                                        <p className="text-sm text-slate-500 text-center py-8">No pipelines found.</p>
                                    ) : editingPipelineId ? (() => {
                                        const pipeline = pipelines.find(p => p.id === editingPipelineId);
                                        if (!pipeline) return null;
                                        return (
                                            <div className="animate-fade-in">
                                                <button onClick={() => { setEditingPipelineId(null); setEditStages([]); }} className="flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-indigo-600 mb-4 transition-colors">
                                                    <ArrowLeft className="w-4 h-4" /> Back to All Pipelines
                                                </button>
                                                <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/20">
                                                    <div className="mb-4">
                                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Pipeline Name</label>
                                                        <input autoFocus type="text" value={editName} onChange={e => setEditName(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none" />
                                                    </div>
                                                    <div className="mb-4">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Stages</label>
                                                            <button onClick={() => setEditStages([...editStages, { id: Date.now().toString(), name: 'New Stage', theme: 'slate' }])} className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md flex items-center gap-1 hover:bg-indigo-100 transition-colors">
                                                                <Plus className="w-3 h-3" /> Add Stage
                                                            </button>
                                                        </div>
                                                        <div className="space-y-2">
                                                            {editStages.map((stage, index) => (
                                                                <div key={stage.id} className="flex items-center gap-2 bg-white p-2 rounded-lg border border-slate-200">
                                                                    <span className="w-5 h-5 flex items-center justify-center bg-slate-100 text-slate-500 text-[10px] font-bold rounded-full shrink-0">{index + 1}</span>
                                                                    <input type="text" value={stage.name} onChange={(e) => { const s = [...editStages]; s[index].name = e.target.value; setEditStages(s); }} className="flex-1 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 focus:ring-1 focus:ring-indigo-500 outline-none" />
                                                                    <select value={stage.theme} onChange={(e) => { const s = [...editStages]; s[index].theme = e.target.value; setEditStages(s); }} className="w-24 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 focus:ring-1 focus:ring-indigo-500 outline-none">
                                                                        {DEFAULT_THEMES.map(t => (<option key={t.id} value={t.id}>{t.name}</option>))}
                                                                    </select>
                                                                    <button onClick={() => { if (editStages.length <= 1) return; setEditStages(editStages.filter((_, i) => i !== index)); }} disabled={editStages.length <= 1} className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-md disabled:opacity-30 transition-colors shrink-0">
                                                                        <Trash2 className="w-3.5 h-3.5" />
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                                                        <button onClick={() => { setEditingPipelineId(null); setEditStages([]); }} className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Cancel</button>
                                                        <button onClick={() => handleSavePipeline(pipeline.id)} disabled={submitting || !editName.trim() || editStages.length === 0} className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50">
                                                            {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Save Changes
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })() : deletingPipelineId ? (() => {
                                        const pipeline = pipelines.find(p => p.id === deletingPipelineId);
                                        if (!pipeline) return null;
                                        return (
                                            <div className="animate-fade-in">
                                                <button onClick={() => setDeletingPipelineId(null)} className="flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-rose-600 mb-4 transition-colors">
                                                    <ArrowLeft className="w-4 h-4" /> Back to All Pipelines
                                                </button>
                                                <div className="p-4 bg-white rounded-xl border border-rose-200 shadow-sm">
                                                    <h4 className="text-sm font-bold text-rose-700 mb-2 flex items-center gap-2"><Trash2 className="w-4 h-4" /> Delete: {pipeline.name}</h4>
                                                    <p className="text-xs text-slate-600 mb-4">What would you like to do with the existing deals in this pipeline?</p>
                                                    <div className="space-y-3 mb-4">
                                                        <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                                                            <input type="radio" name="transferOption" checked={transferPipelineId === ''} onChange={() => setTransferPipelineId('')} className="text-rose-600 focus:ring-rose-500" />
                                                            <div>
                                                                <p className="text-sm font-bold text-slate-800">Delete all deals permanently</p>
                                                                <p className="text-xs text-slate-500">Deals inside this pipeline will be lost forever.</p>
                                                            </div>
                                                        </label>
                                                        <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                                                            <input type="radio" name="transferOption" checked={transferPipelineId !== ''} onChange={() => setTransferPipelineId(pipelines.find(p => p.id !== pipeline.id)?.id || '')} className="text-indigo-600 focus:ring-indigo-500" />
                                                            <div className="flex-1">
                                                                <p className="text-sm font-bold text-slate-800 mb-1">Transfer deals to another pipeline</p>
                                                                <select disabled={transferPipelineId === ''} value={transferPipelineId} onChange={e => setTransferPipelineId(e.target.value)} className="w-full px-2 py-1.5 text-sm bg-white border border-slate-300 rounded-md outline-none focus:border-indigo-500 disabled:bg-slate-50 disabled:text-slate-400">
                                                                    {pipelines.filter(p => p.id !== pipeline.id).map(p => (<option key={p.id} value={p.id}>{p.name}</option>))}
                                                                </select>
                                                            </div>
                                                        </label>
                                                    </div>
                                                    <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                                                        <button onClick={() => setDeletingPipelineId(null)} className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Cancel</button>
                                                        <button onClick={confirmDeletePipeline} disabled={submitting} className={`px-4 py-2 text-xs font-bold text-white rounded-lg transition-colors flex items-center gap-2 ${transferPipelineId ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-rose-600 hover:bg-rose-700'}`}>
                                                            {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : transferPipelineId ? <><ArrowRightLeft className="w-3.5 h-3.5" /> Transfer & Delete</> : <><Trash2 className="w-3.5 h-3.5" /> Permanently Delete</>}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })() : (
                                        pipelines.map(pipeline => (
                                            <div key={pipeline.id} className="flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-slate-50 hover:border-slate-300 transition-colors">
                                                <div>
                                                    <h3 className="font-bold text-slate-800">{pipeline.name}</h3>
                                                    <p className="text-xs text-slate-500">{pipeline.stages.length} stages • {allDeals.filter(d => d.pipeline_id === pipeline.id).length} deals</p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button onClick={() => { setEditingPipelineId(pipeline.id); setEditName(pipeline.name); setEditStages(pipeline.stages.map(s => { const matchedTheme = DEFAULT_THEMES.find(t => t.color === s.color) || DEFAULT_THEMES[0]; return { id: s.id, name: s.name, theme: matchedTheme.id }; })); }} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => { setDeletingPipelineId(pipeline.id); setTransferPipelineId(''); }} disabled={pipelines.length === 1} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-30 disabled:hover:bg-transparent">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1.5">Pipeline Name</label>
                                        <input 
                                            autoFocus
                                            type="text" 
                                            placeholder="e.g. B2B Software Sales" 
                                            value={newPipelineName} 
                                            onChange={e => setNewPipelineName(e.target.value)} 
                                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none" 
                                        />
                                    </div>
                                    
                                    <div>
                                        <div className="flex items-center justify-between mb-3">
                                            <label className="block text-sm font-bold text-slate-700">Custom Stages</label>
                                            <button onClick={() => setNewPipelineStages([...newPipelineStages, { id: Date.now().toString(), name: 'New Stage', theme: 'slate' }])} className="text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition-colors">
                                                <Plus className="w-3.5 h-3.5" /> Add Stage
                                            </button>
                                        </div>
                                        
                                        <div className="space-y-3">
                                            {newPipelineStages.map((stage, index) => (
                                                <div key={stage.id} className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                                                    <span className="w-6 h-6 flex items-center justify-center bg-slate-100 text-slate-500 text-xs font-bold rounded-full shrink-0">{index + 1}</span>
                                                    
                                                    <input 
                                                        type="text" 
                                                        value={stage.name}
                                                        onChange={(e) => {
                                                            const newStages = [...newPipelineStages];
                                                            newStages[index].name = e.target.value;
                                                            setNewPipelineStages(newStages);
                                                        }}
                                                        className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-700"
                                                    />
                                                    
                                                    <select 
                                                        value={stage.theme}
                                                        onChange={(e) => {
                                                            const newStages = [...newPipelineStages];
                                                            newStages[index].theme = e.target.value;
                                                            setNewPipelineStages(newStages);
                                                        }}
                                                        className="w-32 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-600"
                                                    >
                                                        {DEFAULT_THEMES.map(theme => (
                                                            <option key={theme.id} value={theme.id}>{theme.name}</option>
                                                        ))}
                                                    </select>
                                                    
                                                    <button 
                                                        onClick={() => {
                                                            if (newPipelineStages.length <= 1) return;
                                                            setNewPipelineStages(newPipelineStages.filter((_, i) => i !== index));
                                                        }}
                                                        disabled={newPipelineStages.length <= 1}
                                                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400 transition-colors shrink-0"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    
                                    <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                                        <button onClick={() => setIsPipelineModalOpen(false)} className="px-5 py-2.5 font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">Cancel</button>
                                        <button onClick={() => handleCreatePipeline()} disabled={!newPipelineName.trim() || submitting || newPipelineStages.length === 0} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md disabled:opacity-50 flex items-center gap-2">
                                            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Pipeline'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <AddLeadModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={() => { setIsModalOpen(false); fetchAllDeals(); }}
                session={session}
                defaultPipelineId={activePipelineId}
            />
        </div>
    );
};
