import React, { useState, useEffect } from 'react';
import { X, Loader, ChevronDown, GitBranch } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface AddLeadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    session?: any;
    defaultPipelineId?: string;
}

interface PipelineStage { id: string; name: string; }
interface Pipeline { id: string; name: string; stages: PipelineStage[]; }

const COUNTRY_CODES = [
    { code: '+91', country: 'IN' },
    { code: '+1', country: 'US/CA' },
    { code: '+44', country: 'UK' },
    { code: '+61', country: 'AU' },
    { code: '+60', country: 'MY' },
    { code: '+65', country: 'SG' },
    { code: '+971', country: 'UAE' },
];

export const AddLeadModal = ({ isOpen, onClose, onSuccess, session, defaultPipelineId }: AddLeadModalProps) => {
    const [clientName, setClientName] = useState('');
    const [companyName, setCompanyName] = useState('');
    const [jobRole, setJobRole] = useState('');
    const [whatsappCode, setWhatsappCode] = useState('+91');
    const [whatsappNumber, setWhatsappNumber] = useState('');
    const [email, setEmail] = useState('');
    const [address, setAddress] = useState('');
    const [source, setSource] = useState('Manual');
    const [status, setStatus] = useState('New');
    const [score, setScore] = useState('Cold');
    const [dealValue, setDealValue] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    // Pipeline Assignment State
    const [addToPipeline, setAddToPipeline] = useState(true);
    const [pipelines, setPipelines] = useState<Pipeline[]>([]);
    const [selectedPipelineId, setSelectedPipelineId] = useState('');
    const [selectedStageId, setSelectedStageId] = useState('');

    // Assignment State
    const [assignedToId, setAssignedToId] = useState('');
    const [teamMembers, setTeamMembers] = useState<any[]>([]);

    // Fetch pipelines and team members on open
    useEffect(() => {
        if (!isOpen) return;
        const fetchData = async () => {
            try {
                const token = session?.token;
                const headers: any = { 'Content-Type': 'application/json' };
                if (token) headers['Authorization'] = `Bearer ${token}`;
                
                // Fetch Pipelines
                const pRes = await fetch('http://localhost:3001/api/pipelines', { headers });
                const pJson = await pRes.json();
                if (pJson.data) {
                    // If team member, only show their assigned pipelines
                    const allPipelines: Pipeline[] = pJson.data;
                    const isTeamMember = session?.user?.role === 'team_member';
                    const assignedPipelineIds: string[] = session?.user?.pipeline_ids || [];
                    const visiblePipelines = isTeamMember && assignedPipelineIds.length > 0
                        ? allPipelines.filter(p => assignedPipelineIds.includes(p.id))
                        : allPipelines;
                    
                    setPipelines(visiblePipelines);
                    const targetId = defaultPipelineId || visiblePipelines[0]?.id || '';
                    setSelectedPipelineId(targetId);
                    const targetPipeline = visiblePipelines.find((p: Pipeline) => p.id === targetId) || visiblePipelines[0];
                    if (targetPipeline?.stages?.length > 0) setSelectedStageId(targetPipeline.stages[0].id);
                    if (defaultPipelineId) setAddToPipeline(true);
                }

                // Fetch Team Members from real API
                if (token) {
                    const tmRes = await fetch('http://localhost:3001/api/team-members', { headers });
                    const tmJson = await tmRes.json();
                    if (tmJson.data) setTeamMembers(tmJson.data.filter((m: any) => m.is_active));
                }
            } catch (e) { console.error(e); }
        };
        fetchData();
    }, [isOpen, defaultPipelineId]);

    // Update stage when pipeline changes
    const handlePipelineChange = (pipelineId: string) => {
        setSelectedPipelineId(pipelineId);
        const p = pipelines.find(p => p.id === pipelineId);
        if (p && p?.stages && p.stages.length > 0) setSelectedStageId(p.stages[0].id);
        else setSelectedStageId('');
    };

    const selectedPipeline = pipelines.find(p => p.id === selectedPipelineId);

    if (!isOpen) return null;

    const handleClose = () => {
        setClientName(''); setCompanyName(''); setJobRole('');
        setWhatsappNumber(''); setEmail(''); setAddress('');
        setSource('Manual'); setStatus('New'); setScore('Cold');
        setDealValue(''); setError(null); setSuccess(false);
        setAddToPipeline(false); setAssignedToId('');
        onClose();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (!clientName.trim()) { setError('Client Name is required.'); return; }
        if (addToPipeline && !selectedPipelineId) { setError('Please select a pipeline.'); return; }
        if (addToPipeline && !selectedStageId) { setError('Please select a stage.'); return; }
        setLoading(true);

        try {
            const fullMobile = whatsappNumber.trim() ? `${whatsappCode}${whatsappNumber.trim()}` : null;
            const cleanMobileNumber = whatsappNumber.trim().replace(/\D/g, '');
            const cleanCode = whatsappCode.replace(/\D/g, '');
            const whatsappJid = cleanMobileNumber ? `${cleanCode}${cleanMobileNumber}@s.whatsapp.net` : null;
            const finalDisplayName = companyName.trim() ? `${clientName.trim()} (${companyName.trim()})` : clientName.trim();

            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('You must be logged in.');

            // Step 1: Save Lead
            const { data: insertedLeads, error: dbError } = await supabase
                .from('leads')
                .insert([{
                    user_id: session?.user?.owner_id || user.id,
                    name: clientName.trim(),
                    display_name: finalDisplayName,
                    company: companyName.trim() || null,
                    role: jobRole.trim() || null,
                    mobile: fullMobile,
                    whatsapp: whatsappJid,
                    email: email.trim() || null,
                    address: address.trim() || null,
                    status, score, source,
                    deal_value: dealValue ? Number(dealValue) : 0,
                    pipeline_id: addToPipeline ? selectedPipelineId : null,
                    stage_id: addToPipeline ? selectedStageId : null,
                    assigned_to_id: assignedToId || null
                }])
                .select();

            if (dbError) throw new Error(dbError.message);

            // Step 2: If pipeline selected, add to pipeline
            if (addToPipeline && selectedPipelineId && selectedStageId && insertedLeads?.[0]) {
                const newLeadId = insertedLeads[0].id;
                const token = session?.token;
                await fetch('http://localhost:3001/api/deals', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                    },
                    body: JSON.stringify({
                        pipeline_id: selectedPipelineId,
                        stage_id: selectedStageId,
                        lead_id: newLeadId,
                        title: finalDisplayName,
                        value: dealValue ? Number(dealValue) : null,
                        score,
                        lead_name: clientName.trim(),
                        company: companyName.trim() || null,
                        phone: fullMobile || null,
                    })
                });
            }

            setSuccess(true);
            setTimeout(() => { onSuccess(); handleClose(); }, 800);
        } catch (err: any) {
            setError(err.message || 'Failed to add client.');
        } finally {
            setLoading(false);
        }
    };

    const inputClasses = "w-full px-4 py-3 bg-slate-50/50 border border-slate-200/60 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white transition-all duration-300 hover:border-indigo-200 hover:bg-slate-50";
    const labelClasses = "block text-sm font-bold text-slate-700 mb-1.5 ml-0.5";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-fade-in">
            <div className="bg-white/95 backdrop-blur-xl border border-white/60 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100/50 bg-white/50">
                    <h2 className="text-xl font-black bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-slate-500 tracking-tight">Add New Client</h2>
                    <button onClick={handleClose} className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all duration-300 hover:rotate-90">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form Body */}
                <div className="p-6 overflow-y-auto custom-scrollbar">
                    {error && (
                        <div className="mb-5 p-4 bg-red-50 text-red-600 text-sm font-medium rounded-xl border border-red-100 animate-fade-in flex items-center gap-2">
                            <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-red-500"></span>
                            {error}
                        </div>
                    )}
                    {success && (
                        <div className="mb-5 p-4 bg-emerald-50 text-emerald-600 text-sm font-medium rounded-xl border border-emerald-100 animate-fade-in flex items-center gap-2">
                            <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            Client saved{addToPipeline ? ' & added to pipeline' : ''}!
                        </div>
                    )}

                    <form id="add-lead-form" onSubmit={handleSubmit} className="space-y-5">
                        {/* Client Name */}
                        <div className="group">
                            <label className={labelClasses}>Client Name <span className="text-red-500 ml-0.5">*</span></label>
                            <input type="text" value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="e.g. Rahul Sharma" className={inputClasses} required />
                        </div>

                        {/* Company & Role */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="group">
                                <label className={labelClasses}>Company</label>
                                <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="e.g. Acme Corp" className={inputClasses} />
                            </div>
                            <div className="group">
                                <label className={labelClasses}>Job Role</label>
                                <input type="text" value={jobRole} onChange={(e) => setJobRole(e.target.value)} placeholder="e.g. Founder" className={inputClasses} />
                            </div>
                        </div>

                        {/* WhatsApp Number */}
                        <div className="group">
                            <label className={labelClasses}>WhatsApp Number</label>
                            <div className="flex gap-2">
                                <select value={whatsappCode} onChange={(e) => setWhatsappCode(e.target.value)} title="Country code" className="px-3 py-3 bg-slate-50/50 border border-slate-200/60 rounded-xl text-slate-700 font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all duration-300 hover:border-indigo-200 hover:bg-slate-50 cursor-pointer">
                                    {COUNTRY_CODES.map(c => (<option key={c.code} value={c.code}>{c.country} ({c.code})</option>))}
                                </select>
                                <input type="tel" value={whatsappNumber} onChange={(e) => setWhatsappNumber(e.target.value.replace(/\D/g, ''))} placeholder="10-digit number" className={`flex-1 ${inputClasses}`} />
                            </div>
                            <p className="text-xs text-slate-400 mt-1.5 ml-1 font-medium">AI uses this to automatically message the client.</p>
                        </div>

                        {/* Email Address */}
                        <div className="group">
                            <label className={labelClasses}>Email Address</label>
                            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="e.g. email@example.com (optional)" className={inputClasses} />
                        </div>

                        {/* Address */}
                        <div className="group">
                            <label className={labelClasses}>Address</label>
                            <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="e.g. 12, MG Road, Ahmedabad" className={inputClasses} />
                        </div>

                        {/* Source & Score (Status removed) */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="group">
                                <label className={labelClasses}>Source</label>
                                <select value={source} onChange={(e) => setSource(e.target.value)} className={`${inputClasses} font-medium cursor-pointer`}>
                                    <option value="Manual">Manual</option>
                                    <option value="WhatsApp">WhatsApp</option>
                                    <option value="Meta Ads">Meta Ads</option>
                                    <option value="Referrals">Referrals</option>
                                </select>
                            </div>
                            <div className="group">
                                <label className={labelClasses}>Score</label>
                                <select value={score} onChange={(e) => setScore(e.target.value)} className={`${inputClasses} font-medium cursor-pointer`}>
                                    <option value="Cold">❌️ Cold</option>
                                    <option value="Warm">🌟 Warm</option>
                                    <option value="Hot">🔥 Hot</option>
                                </select>
                            </div>
                        </div>

                        {/* Assigned To — Real Dropdown */}
                        <div className="group">
                            <label className={labelClasses}>Assign To Team Member</label>
                            <select
                                value={assignedToId}
                                onChange={(e) => setAssignedToId(e.target.value)}
                                className={`${inputClasses} font-medium cursor-pointer`}
                            >
                                <option value="">— Unassigned —</option>
                                {teamMembers.map(m => (
                                    <option key={m.id} value={m.id}>
                                        {m.name} ({m.role})
                                    </option>
                                ))}
                            </select>
                            <p className="text-xs text-slate-400 mt-1.5 ml-1 font-medium">
                                {teamMembers.length === 0
                                    ? 'No active team members found. Add members in Admin & Team.'
                                    : 'Assign this lead to a specific team member.'}
                            </p>
                        </div>

                        {/* Deal Value */}
                        <div className="group">
                            <label className={labelClasses}>Deal Value (₹)</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">₹</span>
                                <input type="number" value={dealValue} onChange={(e) => setDealValue(e.target.value)} placeholder="0" min="0" className={`${inputClasses} pl-8`} />
                            </div>
                        </div>

                        {/* ─── Pipeline & Stage (Always Visible) ─── */}
                        <div className="border border-indigo-200 rounded-2xl overflow-hidden bg-indigo-50/30">
                            <div className="px-4 py-3 bg-indigo-50 border-b border-indigo-100 flex items-center gap-2">
                                <GitBranch className="w-4 h-4 text-indigo-600" />
                                <span className="text-sm font-bold text-indigo-700">Add to Pipeline</span>
                                <span className="text-xs text-slate-400 font-normal">(Optional)</span>
                            </div>
                            <div className="p-4 space-y-4">
                                {pipelines.length === 0 ? (
                                    <p className="text-sm text-orange-500 text-center py-2">⚠ No pipelines found. Create a pipeline in the Deals section first.</p>
                                ) : (
                                    <>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Select Pipeline</label>
                                            <select value={selectedPipelineId} onChange={e => handlePipelineChange(e.target.value)} className="w-full px-4 py-2.5 bg-white border border-indigo-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none">
                                                <option value="">-- None (Skip Pipeline) --</option>
                                                {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                            </select>
                                        </div>
                                        {selectedPipelineId && (
                                            <div>
                                                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Select Stage</label>
                                                <select value={selectedStageId} onChange={e => setSelectedStageId(e.target.value)} className="w-full px-4 py-2.5 bg-white border border-indigo-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none">
                                                    {(selectedPipeline?.stages || []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                                </select>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    </form>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-100/50 bg-white/50 mt-auto">
                    <div className="flex gap-4">
                        <button type="button" onClick={handleClose} className="flex-1 py-3.5 bg-slate-50 border border-slate-200/60 text-slate-600 font-bold rounded-xl transition-all duration-300 hover:bg-slate-100 hover:text-slate-800 hover:-translate-y-0.5">
                            Cancel
                        </button>
                        <button type="submit" form="add-lead-form" disabled={loading || success} className="flex-1 py-3.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-bold rounded-xl transition-all duration-300 shadow-md hover:shadow-xl hover:-translate-y-0.5 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none">
                            {loading && <Loader className="w-5 h-5 animate-spin" />}
                            {success ? '✓ Saved!' : loading ? 'Saving...' : addToPipeline ? 'SAVE & ADD TO PIPELINE' : 'SAVE CLIENT'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
