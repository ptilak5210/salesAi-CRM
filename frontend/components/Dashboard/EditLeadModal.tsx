import React, { useState, useEffect } from 'react';
import { X, Loader, GitBranch, User, Building, Briefcase, Phone, Mail, MapPin, DollarSign, Tag, Zap, Users } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Lead } from '../../../utils/types';

// ── Types ─────────────────────────────────────────────────────────────────────
interface PipelineStage { id: string; name: string; }
interface Pipeline { id: string; name: string; stages: PipelineStage[]; }

interface RawLead {
    id: string;
    name: string;
    display_name: string;
    company: string | null;
    role: string | null;
    mobile: string | null;
    whatsapp: string | null;
    email: string | null;
    address: string | null;
    status: string;
    score: string;
    source: string;
    deal_value: number;
    pipeline_id: string | null;
    stage_id: string | null;
    assigned_to_id: string | null;
}

interface EditLeadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    lead: Lead | null;
    session?: any;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const COUNTRY_CODES = [
    { code: '+91', country: 'IN' },
    { code: '+1',  country: 'US/CA' },
    { code: '+44', country: 'UK' },
    { code: '+61', country: 'AU' },
    { code: '+60', country: 'MY' },
    { code: '+65', country: 'SG' },
    { code: '+971', country: 'UAE' },
];

// Extract country code prefix from a mobile string like "+917848746487" 
const extractCode = (mobile: string): { code: string; number: string } => {
    for (const c of COUNTRY_CODES) {
        if (mobile.startsWith(c.code)) {
            return { code: c.code, number: mobile.slice(c.code.length) };
        }
    }
    return { code: '+91', number: mobile.replace(/^\+\d{1,3}/, '') };
};

// ── Component ─────────────────────────────────────────────────────────────────
export const EditLeadModal = ({ isOpen, onClose, onSuccess, lead, session }: EditLeadModalProps) => {
    // Basic Fields
    const [clientName,  setClientName]  = useState('');
    const [companyName, setCompanyName] = useState('');
    const [jobRole,     setJobRole]     = useState('');
    const [whatsappCode,   setWhatsappCode]   = useState('+91');
    const [whatsappNumber, setWhatsappNumber] = useState('');
    const [email,       setEmail]       = useState('');
    const [address,     setAddress]     = useState('');
    const [source,      setSource]      = useState('Manual');
    const [status,      setStatus]      = useState('New');
    const [score,       setScore]       = useState('Cold');
    const [dealValue,   setDealValue]   = useState('');

    // Pipeline
    const [pipelines,          setPipelines]          = useState<Pipeline[]>([]);
    const [selectedPipelineId, setSelectedPipelineId] = useState('');
    const [selectedStageId,    setSelectedStageId]    = useState('');

    // Team
    const [teamMembers, setTeamMembers] = useState<any[]>([]);
    const [assignedToId, setAssignedToId] = useState('');

    // UI State
    const [loading,   setLoading]   = useState(false);
    const [fetching,  setFetching]  = useState(false);
    const [success,   setSuccess]   = useState(false);
    const [error,     setError]     = useState<string | null>(null);

    // ── Load full raw lead + pipelines + team on open ─────────────────────────
    useEffect(() => {
        if (!isOpen || !lead?.id) return;

        const loadData = async () => {
            setFetching(true);
            setError(null);
            try {
                // 1. Fetch raw lead from DB to get ALL fields
                const { data: raw, error: rErr } = await supabase
                    .from('leads')
                    .select('*')
                    .eq('id', lead.id)
                    .single();

                if (rErr) throw new Error(rErr.message);

                const rawLead = raw as RawLead;

                // Populate form state
                setClientName(rawLead.name || '');
                setCompanyName(rawLead.company || '');
                setJobRole(rawLead.role || '');
                setEmail(rawLead.email || '');
                setAddress(rawLead.address || '');
                setSource(rawLead.source || 'Manual');
                setStatus(rawLead.status || 'New');
                setScore(rawLead.score || 'Cold');
                setDealValue(rawLead.deal_value ? String(rawLead.deal_value) : '');
                setSelectedPipelineId(rawLead.pipeline_id || '');
                setSelectedStageId(rawLead.stage_id || '');
                setAssignedToId(rawLead.assigned_to_id || '');

                // Parse WhatsApp number into code + digits
                if (rawLead.mobile) {
                    const { code, number } = extractCode(rawLead.mobile);
                    setWhatsappCode(code);
                    setWhatsappNumber(number);
                } else {
                    setWhatsappCode('+91');
                    setWhatsappNumber('');
                }

                // 2. Fetch Pipelines directly via Supabase (no backend needed)
                const { data: pipelineData } = await supabase
                    .from('pipelines')
                    .select('id, name, pipeline_stages(id, name)')
                    .order('created_at', { ascending: true });

                if (pipelineData) {
                    const allPipelines = pipelineData.map((p: any) => ({
                        id: p.id,
                        name: p.name,
                        stages: (p.pipeline_stages || []).sort((a: any, b: any) => (a.order_index ?? 0) - (b.order_index ?? 0)),
                    })) as Pipeline[];

                    const isTeamMember = session?.user?.role === 'team_member';
                    const assignedPipelineIds: string[] = session?.user?.pipeline_ids || [];
                    const visible = isTeamMember && assignedPipelineIds.length > 0
                        ? allPipelines.filter(p => assignedPipelineIds.includes(p.id))
                        : allPipelines;
                    setPipelines(visible);
                }

                // 3. Fetch Team Members directly via Supabase (no backend needed)
                const { data: tmData } = await supabase
                    .from('team_members')
                    .select('id, name, role, is_active')
                    .eq('is_active', true)
                    .order('name', { ascending: true });

                if (tmData) setTeamMembers(tmData);

            } catch (err: any) {
                setError(err.message || 'Failed to load lead data.');
            } finally {
                setFetching(false);
            }
        };

        loadData();
    }, [isOpen, lead?.id]);

    // ── Reset when closed ─────────────────────────────────────────────────────
    const handleClose = () => {
        setClientName(''); setCompanyName(''); setJobRole('');
        setWhatsappNumber(''); setEmail(''); setAddress('');
        setSource('Manual'); setStatus('New'); setScore('Cold');
        setDealValue(''); setError(null); setSuccess(false);
        setAssignedToId(''); setSelectedPipelineId(''); setSelectedStageId('');
        onClose();
    };

    // ── Pipeline stage update on pipeline change ──────────────────────────────
    const handlePipelineChange = (pipelineId: string) => {
        setSelectedPipelineId(pipelineId);
        const p = pipelines.find(p => p.id === pipelineId);
        if (p && p.stages?.length > 0) setSelectedStageId(p.stages[0].id);
        else setSelectedStageId('');
    };

    const selectedPipeline = pipelines.find(p => p.id === selectedPipelineId);

    // ── Submit ────────────────────────────────────────────────────────────────
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!clientName.trim()) { setError('Client Name is required.'); return; }
        if (!lead?.id) { setError('Lead ID missing — cannot update.'); return; }

        setLoading(true);
        try {
            const fullMobile = whatsappNumber.trim() ? `${whatsappCode}${whatsappNumber.trim()}` : null;
            const cleanMobileNumber = whatsappNumber.trim().replace(/\D/g, '');
            const cleanCode = whatsappCode.replace(/\D/g, '');
            const whatsappJid = cleanMobileNumber ? `${cleanCode}${cleanMobileNumber}@s.whatsapp.net` : null;
            const finalDisplayName = companyName.trim()
                ? `${clientName.trim()} (${companyName.trim()})`
                : clientName.trim();

            // Update lead in DB
            const { error: updateErr } = await supabase
                .from('leads')
                .update({
                    name: clientName.trim(),
                    display_name: finalDisplayName,
                    company: companyName.trim() || null,
                    role: jobRole.trim() || null,
                    mobile: fullMobile,
                    whatsapp: whatsappJid,
                    email: email.trim() || null,
                    address: address.trim() || null,
                    status,
                    score,
                    source,
                    deal_value: dealValue ? Number(dealValue) : 0,
                    pipeline_id: selectedPipelineId || null,
                    stage_id: selectedStageId || null,
                    assigned_to_id: assignedToId || null,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', lead.id);

            if (updateErr) throw new Error(updateErr.message);

            // ── Sync the deal record in Deals/Pipeline view ────────────────
            if (selectedPipelineId && selectedStageId) {
                // Check if a deal already exists for this lead
                const { data: existingDeal } = await supabase
                    .from('deals')
                    .select('id')
                    .eq('lead_id', lead.id)
                    .maybeSingle();

                if (existingDeal?.id) {
                    // UPDATE existing deal
                    await supabase
                        .from('deals')
                        .update({
                            pipeline_id: selectedPipelineId,
                            stage_id: selectedStageId,
                            value: dealValue ? Number(dealValue) : 0,
                            score,
                            lead_name: clientName.trim(),
                            company: companyName.trim() || null,
                            phone: fullMobile || null,
                            title: finalDisplayName,
                            updated_at: new Date().toISOString(),
                        })
                        .eq('id', existingDeal.id);
                } else {
                    // CREATE new deal — lead had no deal record before
                    const { data: { user } } = await supabase.auth.getUser();
                    await supabase
                        .from('deals')
                        .insert({
                            user_id: user?.id,
                            lead_id: lead.id,
                            pipeline_id: selectedPipelineId,
                            stage_id: selectedStageId,
                            title: finalDisplayName,
                            lead_name: clientName.trim(),
                            company: companyName.trim() || null,
                            phone: fullMobile || null,
                            value: dealValue ? Number(dealValue) : 0,
                            score,
                        });
                }
            }

            setSuccess(true);
            setTimeout(() => { onSuccess(); handleClose(); }, 800);
        } catch (err: any) {
            setError(err.message || 'Failed to update client. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen || !lead) return null;

    // ── Styles ────────────────────────────────────────────────────────────────
    const inputClasses = "w-full px-4 py-3 bg-slate-50/50 border border-slate-200/60 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white transition-all duration-300 hover:border-indigo-200 hover:bg-slate-50 text-sm";
    const labelClasses = "block text-xs font-bold text-slate-600 mb-1.5 ml-0.5 uppercase tracking-wider";
    const sectionLabel = "text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-md animate-fade-in">
            <div className="bg-white/95 backdrop-blur-xl border border-white/60 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                
                {/* ── Header ─────────────────────────────────────────────────── */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-indigo-50/80 to-purple-50/40">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-indigo-200">
                            {lead.name?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-slate-800 tracking-tight">Edit Lead</h2>
                            <p className="text-xs text-slate-500 font-medium">{lead.name}</p>
                        </div>
                    </div>
                    <button onClick={handleClose} className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all duration-300 hover:rotate-90">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* ── Loading state ───────────────────────────────────────────── */}
                {fetching ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-16 gap-3">
                        <Loader className="w-8 h-8 animate-spin text-indigo-500" />
                        <p className="text-sm text-slate-500 font-medium">Loading lead data...</p>
                    </div>
                ) : (
                    <>
                        {/* ── Form Body ───────────────────────────────────────── */}
                        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                            {/* Error / Success */}
                            {error && (
                                <div className="mb-5 p-4 bg-red-50 text-red-600 text-sm font-medium rounded-xl border border-red-100 flex items-center gap-2">
                                    <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-red-500" />
                                    {error}
                                </div>
                            )}
                            {success && (
                                <div className="mb-5 p-4 bg-emerald-50 text-emerald-600 text-sm font-medium rounded-xl border border-emerald-100 flex items-center gap-2">
                                    <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                    Client updated successfully!
                                </div>
                            )}

                            <form id="edit-lead-form" onSubmit={handleSubmit} className="space-y-6">

                                {/* ─ PERSONAL INFO ─────────────────────────────── */}
                                <div>
                                    <p className={sectionLabel}><User className="w-3 h-3" /> Personal Info</p>
                                    <div className="space-y-4">
                                        <div>
                                            <label className={labelClasses}>Client Name <span className="text-red-500">*</span></label>
                                            <input type="text" value={clientName} onChange={e => setClientName(e.target.value)} placeholder="e.g. Rahul Sharma" className={inputClasses} required />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className={labelClasses}><Building className="w-3 h-3 inline mr-1" />Company</label>
                                                <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="e.g. Acme Corp" className={inputClasses} />
                                            </div>
                                            <div>
                                                <label className={labelClasses}><Briefcase className="w-3 h-3 inline mr-1" />Job Role</label>
                                                <input type="text" value={jobRole} onChange={e => setJobRole(e.target.value)} placeholder="e.g. Founder" className={inputClasses} />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* ─ CONTACT ───────────────────────────────────── */}
                                <div>
                                    <p className={sectionLabel}><Phone className="w-3 h-3" /> Contact Details</p>
                                    <div className="space-y-4">
                                        <div>
                                            <label className={labelClasses}>WhatsApp Number</label>
                                            <div className="flex gap-2">
                                                <select value={whatsappCode} onChange={e => setWhatsappCode(e.target.value)} title="Country code" className="px-3 py-3 bg-slate-50/50 border border-slate-200/60 rounded-xl text-slate-700 font-bold text-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all cursor-pointer">
                                                    {COUNTRY_CODES.map(c => <option key={c.code} value={c.code}>{c.country} ({c.code})</option>)}
                                                </select>
                                                <input type="tel" value={whatsappNumber} onChange={e => setWhatsappNumber(e.target.value.replace(/\D/g, ''))} placeholder="10-digit number" className={`flex-1 ${inputClasses}`} />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className={labelClasses}><Mail className="w-3 h-3 inline mr-1" />Email</label>
                                                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com" className={inputClasses} />
                                            </div>
                                            <div>
                                                <label className={labelClasses}><MapPin className="w-3 h-3 inline mr-1" />Address</label>
                                                <input type="text" value={address} onChange={e => setAddress(e.target.value)} placeholder="City, State" className={inputClasses} />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* ─ LEAD QUALIFICATION ────────────────────────── */}
                                <div>
                                    <p className={sectionLabel}><Zap className="w-3 h-3" /> Lead Qualification</p>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div>
                                            <label className={labelClasses}>Status</label>
                                            <select value={status} onChange={e => setStatus(e.target.value)} className={`${inputClasses} cursor-pointer font-medium`}>
                                                <option value="New">New</option>
                                                <option value="Contacted">Contacted</option>
                                                <option value="Replied">Replied</option>
                                                <option value="Qualified">Qualified</option>
                                                <option value="Follow Up">Follow Up</option>
                                                <option value="Closed">Closed</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className={labelClasses}>Score</label>
                                            <select value={score} onChange={e => setScore(e.target.value)} className={`${inputClasses} cursor-pointer font-medium`}>
                                                <option value="Cold">❄️ Cold</option>
                                                <option value="Warm">🌟 Warm</option>
                                                <option value="Hot">🔥 Hot</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className={labelClasses}>Source</label>
                                            <select value={source} onChange={e => setSource(e.target.value)} className={`${inputClasses} cursor-pointer font-medium`}>
                                                <option value="Manual">Manual</option>
                                                <option value="WhatsApp">WhatsApp</option>
                                                <option value="Meta Ads">Meta Ads</option>
                                                <option value="Referrals">Referrals</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* ─ DEAL VALUE & TEAM ─────────────────────────── */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className={labelClasses}><DollarSign className="w-3 h-3 inline mr-1" />Deal Value (₹)</label>
                                        <div className="relative">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-sm">₹</span>
                                            <input type="number" value={dealValue} onChange={e => setDealValue(e.target.value)} placeholder="0" min="0" className={`${inputClasses} pl-8`} />
                                        </div>
                                    </div>
                                    <div>
                                        <label className={labelClasses}><Users className="w-3 h-3 inline mr-1" />Assigned To</label>
                                        <select value={assignedToId} onChange={e => setAssignedToId(e.target.value)} className={`${inputClasses} cursor-pointer font-medium`}>
                                            <option value="">— Unassigned —</option>
                                            {teamMembers.map(m => (
                                                <option key={m.id} value={m.id}>{m.name} ({m.role})</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* ─ PIPELINE ──────────────────────────────────── */}
                                <div className="border border-indigo-200 rounded-2xl overflow-hidden bg-indigo-50/30">
                                    <div className="px-4 py-3 bg-indigo-50 border-b border-indigo-100 flex items-center gap-2">
                                        <GitBranch className="w-4 h-4 text-indigo-600" />
                                        <span className="text-sm font-bold text-indigo-700">Pipeline Assignment</span>
                                        <span className="text-xs text-slate-400 font-normal">(Optional)</span>
                                    </div>
                                    <div className="p-4 space-y-4">
                                        {pipelines.length === 0 ? (
                                            <p className="text-sm text-orange-500 text-center py-2">⚠ No pipelines found. Create one in the Deals section first.</p>
                                        ) : (
                                            <>
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Select Pipeline</label>
                                                    <select value={selectedPipelineId} onChange={e => handlePipelineChange(e.target.value)} className="w-full px-4 py-2.5 bg-white border border-indigo-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none">
                                                        <option value="">-- None (Remove from Pipeline) --</option>
                                                        {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                                    </select>
                                                </div>
                                                {selectedPipelineId && (
                                                    <div>
                                                        <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Select Stage</label>
                                                        <select value={selectedStageId} onChange={e => setSelectedStageId(e.target.value)} className="w-full px-4 py-2.5 bg-white border border-indigo-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none">
                                                            {(selectedPipeline?.stages || []).map(s => (
                                                                <option key={s.id} value={s.id}>{s.name}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>

                            </form>
                        </div>

                        {/* ── Footer ──────────────────────────────────────────── */}
                        <div className="p-6 border-t border-slate-100 bg-slate-50/50">
                            <div className="flex gap-4">
                                <button type="button" onClick={handleClose} className="flex-1 py-3.5 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl transition-all hover:bg-slate-50 hover:text-slate-800 hover:-translate-y-0.5 text-sm">
                                    Cancel
                                </button>
                                <button type="submit" form="edit-lead-form" disabled={loading || success} className="flex-1 py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold rounded-xl transition-all duration-300 shadow-md hover:shadow-xl hover:-translate-y-0.5 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none text-sm">
                                    {loading && <Loader className="w-4 h-4 animate-spin" />}
                                    {success ? '✓ Updated!' : loading ? 'Updating...' : 'Update Client'}
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};
