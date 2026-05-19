import React, { useState, useEffect } from 'react';
import { X, Phone, Mail, Building, Briefcase, Activity, Calendar, Bot, Loader2, Sparkles, MessageSquare, Pencil, Trash2, DollarSign, MapPin, Tag, User } from 'lucide-react';
import { Lead } from '../../../utils/types';
import { AuthSession } from '../../../utils/types';
import { usePermissions } from '../../hooks/usePermissions';
import { supabase } from '../../lib/supabase';

interface LeadDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    lead: Lead | null;
    session: AuthSession | null;
    onEdit?: (lead: Lead) => void;
    onDelete?: (lead: Lead) => void;
}

interface AILog {
    id: string;
    action: string;
    details: string;
    created_at: string;
}

// Extra raw fields fetched from DB
interface RawLeadDetails {
    address: string | null;
    deal_value: number | null;
    source: string | null;
    assigned_to_id: string | null;
    assigned_to_name?: string | null;
    pipeline_name?: string | null;
    stage_name?: string | null;
}

export const LeadDetailModal = ({ isOpen, onClose, lead, session, onEdit, onDelete }: LeadDetailModalProps) => {
    const [logs, setLogs] = useState<AILog[]>([]);
    const [loading, setLoading] = useState(false);
    const [rawDetails, setRawDetails] = useState<RawLeadDetails | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [activeTab, setActiveTab] = useState<'info' | 'ai'>('info');

    const perms = usePermissions(session);

    // ── Fetch AI logs + extra raw fields on open ──────────────────────────────
    useEffect(() => {
        if (!isOpen || !lead || !session) return;

        // Reset
        setLogs([]);
        setRawDetails(null);
        setActiveTab('info');

        // Fetch raw extra details from DB
        const fetchRawDetails = async () => {
            try {
                // Step 1: Fetch lead's own fields (including pipeline_id, stage_id directly)
                const { data } = await supabase
                    .from('leads')
                    .select('address, deal_value, source, assigned_to_id, pipeline_id, stage_id, team_members(name)')
                    .eq('id', lead.id)
                    .single();

                if (!data) return;

                // Step 2: Resolve pipeline name if pipeline_id exists
                let pipeline_name: string | null = null;
                let stage_name: string | null = null;

                if (data.pipeline_id) {
                    const { data: pData } = await supabase
                        .from('pipelines')
                        .select('name')
                        .eq('id', data.pipeline_id)
                        .single();
                    pipeline_name = pData?.name || null;
                }

                if (data.stage_id) {
                    const { data: sData } = await supabase
                        .from('pipeline_stages')
                        .select('name')
                        .eq('id', data.stage_id)
                        .single();
                    stage_name = sData?.name || null;
                }

                // Step 3: Fallback — try deals table if pipeline_id not on leads row
                if (!pipeline_name) {
                    const { data: dealData } = await supabase
                        .from('deals')
                        .select('pipelines(name), pipeline_stages(name)')
                        .eq('lead_id', lead.id)
                        .maybeSingle();
                    if (dealData) {
                        pipeline_name = (dealData.pipelines as any)?.name || null;
                        stage_name = (dealData.pipeline_stages as any)?.name || null;
                    }
                }

                setRawDetails({
                    address: data.address || null,
                    deal_value: data.deal_value || null,
                    source: data.source || null,
                    assigned_to_id: data.assigned_to_id || null,
                    assigned_to_name: (data.team_members as any)?.name || lead.assigned_to_name || null,
                    pipeline_name,
                    stage_name,
                });
            } catch (err) {
                console.error("Failed to fetch raw details:", err);
            }
        };

        // Fetch AI logs
        const fetchLogs = async () => {
            setLoading(true);
            try {
                if (!lead.phone) {
                    setLogs([]);
                    return;
                }
                const cleanPhone = lead.phone.replace(/[^0-9]/g, '');
                const response = await fetch(`http://localhost:3001/api/leads/${cleanPhone}/logs`, {
                    headers: { 'Authorization': `Bearer ${session.token}` }
                });
                const json = await response.json();
                setLogs(json.data || []);
            } catch (err) {
                console.error("Failed to fetch AI logs:", err);
                setLogs([]);
            } finally {
                setLoading(false);
            }
        };

        fetchRawDetails();
        fetchLogs();
    }, [isOpen, lead?.id, session]);

    if (!isOpen || !lead) return null;

    const getScoreColor = (score: string) => {
        if (score === 'Hot') return 'bg-red-500 shadow-red-500/20';
        if (score === 'Warm') return 'bg-orange-500 shadow-orange-500/20';
        return 'bg-blue-500 shadow-blue-500/20';
    };

    const getStatusBadge = (status: string) => {
        if (status === 'New') return 'bg-blue-100 text-blue-700';
        if (status === 'Follow Up') return 'bg-purple-100 text-purple-700';
        if (status === 'Contacted') return 'bg-green-100 text-green-700';
        if (status === 'Qualified') return 'bg-teal-100 text-teal-700';
        if (status === 'Replied') return 'bg-indigo-100 text-indigo-700';
        if (status === 'Closed') return 'bg-slate-100 text-slate-600';
        return 'bg-slate-100 text-slate-600';
    };

    // ── Delete handler ────────────────────────────────────────────────────────
    const handleDelete = async () => {
        if (!confirm(`Delete "${lead.name}"? This action cannot be undone.`)) return;
        setDeleting(true);
        try {
            // First delete associated deals (DB uses ON DELETE SET NULL, not CASCADE)
            await supabase.from('deals').delete().eq('lead_id', lead.id);
            // Now delete the lead
            const { error } = await supabase.from('leads').delete().eq('id', lead.id);
            if (error) throw new Error(error.message);
            onClose();
            if (onDelete) onDelete(lead);
        } catch (err: any) {
            alert('Failed to delete lead: ' + err.message);
        } finally {
            setDeleting(false);
        }
    };

    // ── Edit handler ──────────────────────────────────────────────────────────
    const handleEdit = () => {
        onClose();
        if (onEdit) onEdit(lead);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-fade-in">
            <div className="bg-white/95 backdrop-blur-xl border border-white/60 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] transition-shadow duration-500">
                
                {/* ── TOP HEADER ─────────────────────────────────────────────── */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-indigo-50/30 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-indigo-500/20">
                            {lead.name.charAt(0)}
                        </div>
                        <div>
                            <h2 className="text-base font-black text-slate-800">{lead.name}</h2>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold text-white uppercase shadow-sm ${getScoreColor(lead.score)}`}>
                                    {lead.score} Lead
                                </span>
                                <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${getStatusBadge(lead.status)}`}>
                                    {lead.status}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2">
                        {perms.canEdit && (
                            <button
                                onClick={handleEdit}
                                title="Edit Lead"
                                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition-all hover:-translate-y-0.5"
                            >
                                <Pencil className="w-3.5 h-3.5" /> Edit
                            </button>
                        )}
                        {perms.canDelete && (
                            <button
                                onClick={handleDelete}
                                disabled={deleting}
                                title="Delete Lead"
                                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition-all hover:-translate-y-0.5 disabled:opacity-50"
                            >
                                <Trash2 className="w-3.5 h-3.5" /> {deleting ? 'Deleting...' : 'Delete'}
                            </button>
                        )}
                        <button onClick={onClose} aria-label="Close dialog" className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all duration-300 hover:rotate-90">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* ── BODY: two columns ─────────────────────────────────────── */}
                <div className="flex flex-1 overflow-hidden">

                    {/* LEFT PANEL — Lead Info (35%) */}
                    <div className="w-full md:w-[35%] bg-slate-50/50 border-r border-slate-200/60 overflow-y-auto custom-scrollbar">
                        
                        {/* Tab switcher for mobile */}
                        <div className="flex border-b border-slate-100 md:hidden">
                            <button onClick={() => setActiveTab('info')} className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors ${activeTab === 'info' ? 'text-indigo-700 border-b-2 border-indigo-500 bg-indigo-50' : 'text-slate-500'}`}>Lead Info</button>
                            <button onClick={() => setActiveTab('ai')} className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors ${activeTab === 'ai' ? 'text-indigo-700 border-b-2 border-indigo-500 bg-indigo-50' : 'text-slate-500'}`}>AI History</button>
                        </div>

                        <div className="p-5 space-y-4">
                            {/* Professional Info */}
                            <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Professional Info</h3>
                                <div className="space-y-3">
                                    <div className="flex items-center gap-3 text-sm">
                                        <Building className="w-4 h-4 text-slate-400 shrink-0" />
                                        <span className="font-medium text-slate-700">{lead.company || 'No Company'}</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-sm">
                                        <Briefcase className="w-4 h-4 text-slate-400 shrink-0" />
                                        <span className="font-medium text-slate-700">{lead.role || 'No Role'}</span>
                                    </div>
                                    {rawDetails?.source && (
                                        <div className="flex items-center gap-3 text-sm">
                                            <Tag className="w-4 h-4 text-slate-400 shrink-0" />
                                            <span className="font-medium text-slate-600">Source: {rawDetails.source}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Contact Info */}
                            <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Contact Details</h3>
                                <div className="space-y-3">
                                    <div className="flex items-center gap-3 text-sm">
                                        <Phone className="w-4 h-4 text-emerald-500 shrink-0" />
                                        <span className="font-medium text-slate-700 font-mono">{lead.phone || 'No Phone'}</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-sm">
                                        <Mail className="w-4 h-4 text-blue-400 shrink-0" />
                                        <span className="font-medium text-slate-700 break-all">{lead.email || 'No Email'}</span>
                                    </div>
                                    {rawDetails?.address && (
                                        <div className="flex items-center gap-3 text-sm">
                                            <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                                            <span className="font-medium text-slate-600">{rawDetails.address}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Deal Details */}
                            <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Deal Details</h3>
                                <div className="space-y-3">
                                    <div className="flex items-center gap-3 text-sm">
                                        <Activity className="w-4 h-4 text-purple-500 shrink-0" />
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${getStatusBadge(lead.status)}`}>
                                            {lead.status}
                                        </span>
                                    </div>
                                    {rawDetails?.deal_value != null && rawDetails.deal_value > 0 && (
                                        <div className="flex items-center gap-3 text-sm">
                                            <DollarSign className="w-4 h-4 text-emerald-500 shrink-0" />
                                            <span className="font-bold text-emerald-700">₹{rawDetails.deal_value.toLocaleString('en-IN')}</span>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-3 text-sm">
                                        <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                                        <div>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase">Created</p>
                                            <p className="font-medium text-slate-700 text-xs">
                                                {lead.created_at
                                                    ? new Date(lead.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                                                    : 'Unknown'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 text-sm">
                                        <Calendar className="w-4 h-4 text-indigo-400 shrink-0" />
                                        <div>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase">Last Updated</p>
                                            <p className="font-medium text-slate-700 text-xs">
                                                {lead.updated_at
                                                    ? new Date(lead.updated_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                                                    : lead.lastContact}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Pipeline & Assignment Info */}
                            {(rawDetails?.assigned_to_name || rawDetails?.pipeline_name) && (
                                <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Assignment & Pipeline</h3>
                                    <div className="space-y-4">
                                        {rawDetails?.assigned_to_name && (
                                            <div>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1.5">Assigned To</p>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-bold shrink-0">
                                                        {rawDetails.assigned_to_name.charAt(0)}
                                                    </div>
                                                    <span className="text-sm font-semibold text-slate-700">{rawDetails.assigned_to_name}</span>
                                                </div>
                                            </div>
                                        )}
                                        {rawDetails?.pipeline_name && (
                                            <div>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1.5">Pipeline</p>
                                                <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                                                    <span className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg">{rawDetails.pipeline_name}</span>
                                                    {rawDetails.stage_name && (
                                                        <>
                                                            <span className="text-slate-300">→</span>
                                                            <span className="px-2 py-1 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-lg">{rawDetails.stage_name}</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* RIGHT PANEL — AI Chat History (65%) */}
                    <div className={`w-full md:w-[65%] flex flex-col bg-white ${activeTab === 'info' ? 'hidden md:flex' : 'flex'}`}>
                        {/* Right Header */}
                        <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-100 bg-white shrink-0">
                            <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center">
                                <Bot className="w-4 h-4 text-indigo-600" />
                            </div>
                            <h2 className="text-base font-black bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-slate-500 tracking-tight">
                                AI Interaction History
                            </h2>
                            {logs.length > 0 && (
                                <span className="ml-auto text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">{logs.length} events</span>
                            )}
                        </div>

                        {/* Timeline / Logs Content */}
                        <div className="flex-1 p-6 overflow-y-auto custom-scrollbar bg-slate-50/30">
                            {loading ? (
                                <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
                                    <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                                    <span className="font-medium text-sm">Fetching AI records...</span>
                                </div>
                            ) : logs.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-4">
                                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-2">
                                        <MessageSquare className="w-8 h-8 text-slate-300" />
                                    </div>
                                    <h3 className="text-lg font-bold text-slate-700">No AI Activity Yet</h3>
                                    <p className="text-sm text-center max-w-sm text-slate-500">The AI Agent hasn't interacted with this lead yet, or no logs were found.</p>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {logs.map((log, index) => (
                                        <div key={log.id} className="relative flex gap-4">
                                            {/* Timeline Line */}
                                            {index !== logs.length - 1 && (
                                                <div className="absolute left-[19px] top-10 bottom-[-24px] w-[2px] bg-indigo-100"></div>
                                            )}

                                            {/* Icon */}
                                            <div className="relative z-10 w-10 h-10 rounded-full bg-indigo-50 border-2 border-white shadow-sm flex items-center justify-center flex-shrink-0">
                                                {log.action.toLowerCase().includes('message') ? (
                                                    <MessageSquare className="w-4 h-4 text-indigo-500" />
                                                ) : (
                                                    <Sparkles className="w-4 h-4 text-blue-500" />
                                                )}
                                            </div>

                                            {/* Content Card */}
                                            <div className="flex-1 bg-white border border-slate-200/60 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
                                                <div className="flex items-center justify-between mb-2">
                                                    <h4 className="font-bold text-slate-800 text-sm">{log.action}</h4>
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                                        {new Date(log.created_at).toLocaleString()}
                                                    </span>
                                                </div>
                                                {log.details && (
                                                    <div className="text-sm text-slate-600 bg-slate-50 rounded-xl p-3 border border-slate-100">
                                                        {log.details}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
