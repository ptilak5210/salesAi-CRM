import React, { useState, useEffect } from 'react';
import {
    User, Building2, Bell, Shield, Key, Mail, Save, Check,
    Eye, EyeOff, AlertTriangle, ChevronRight, Lock, Globe, Settings, RefreshCw,
    Briefcase, AlertOctagon, Trash2, Download, Database, LayoutDashboard
} from 'lucide-react';
import { AuthSession } from '../../../utils/types';
import { supabase } from '../../lib/supabase';

interface SettingsViewProps { session: AuthSession; }

// ── Toggle Component ─────────────────────────────────────────────────────────
const Toggle = ({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
    <button
        type="button" role="switch" aria-checked={checked} onClick={onChange}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${checked ? 'bg-indigo-600' : 'bg-slate-200'}`}
    >
        <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
);

// ── Save Button ──────────────────────────────────────────────────────────────
const SaveBtn = ({ saving, saved, label = 'Save Changes' }: { saving: boolean; saved: boolean; label?: string }) => (
    <button type="submit" disabled={saving || saved}
        className={`flex items-center gap-2 px-6 py-2.5 text-sm font-bold rounded-xl transition-all shadow-md disabled:opacity-60 ${saved ? 'bg-emerald-500 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}>
        {saved ? <><Check className="w-4 h-4" /> Saved!</> : saving ? <><RefreshCw className="w-4 h-4 animate-spin" /> Saving…</> : <><Save className="w-4 h-4" />{label}</>}
    </button>
);

// ── Section 1: Account Profile ───────────────────────────────────────────────
const ProfileSection = ({ session }: { session: AuthSession }) => {
    const [name, setName]           = useState(session.user.name || '');
    const [businessName, setBusinessName] = useState('');
    const [businessType, setBusinessType] = useState('');
    const [saving, setSaving]       = useState(false);
    const [saved, setSaved]         = useState(false);
    const [error, setError]         = useState('');
    const [profileLoaded, setProfileLoaded] = useState(false);

    const isAdmin = session.user.role === 'super_admin';
    const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';

    useEffect(() => {
        if (!isAdmin) { setProfileLoaded(true); return; }
        supabase.from('clients')
            .select('business_name, business_type')
            .eq('user_id', session.user.id)
            .maybeSingle()
            .then(({ data }) => {
                if (data) {
                    setBusinessName(data.business_name || '');
                    setBusinessType(data.business_type || '');
                }
                setProfileLoaded(true);
            });
    }, [session.user.id, isAdmin]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true); setError('');
        try {
            const { error: authErr } = await supabase.auth.updateUser({ data: { name } });
            if (authErr) throw new Error(authErr.message);

            if (isAdmin) {
                const { error: clientErr } = await supabase.from('clients')
                    .update({ business_name: businessName, business_type: businessType, updated_at: new Date().toISOString() })
                    .eq('user_id', session.user.id);
                if (clientErr) throw new Error(clientErr.message);
            }

            setSaved(true);
            setTimeout(() => setSaved(false), 2500);
        } catch (err: any) {
            setError(err.message || 'Failed to save. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const businessTypes = ['Local Service', 'Real Estate', 'Marketing Agency', 'Online Business', 'Other'];

    if (!profileLoaded) return (
        <div className="flex items-center justify-center py-16">
            <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
        </div>
    );

    return (
        <form onSubmit={handleSave} className="space-y-6">
            <div className="flex items-center gap-4 p-5 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl border border-indigo-100">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-indigo-200 shrink-0">
                    {initials}
                </div>
                <div>
                    <p className="font-bold text-slate-900">{session.user.name}</p>
                    <p className="text-sm text-slate-500">{session.user.email}</p>
                    <span className="inline-block mt-1.5 px-2.5 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded-full uppercase tracking-wider">
                        {isAdmin ? 'Super Admin' : (session.user.title || 'Team Member')}
                    </span>
                </div>
            </div>

            {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-xl border border-red-200 text-sm">
                    <AlertTriangle className="w-4 h-4 shrink-0" />{error}
                </div>
            )}

            <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Personal Info</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Full Name</label>
                        <div className="relative">
                            <User className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                            <input type="text" value={name} onChange={e => setName(e.target.value)} required
                                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                placeholder="Your full name" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Email Address</label>
                        <div className="relative">
                            <Mail className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                            <input type="email" value={session.user.email} disabled
                                className="w-full pl-10 pr-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-sm text-slate-400 cursor-not-allowed" />
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1 ml-1">Email cannot be changed.</p>
                    </div>
                </div>
            </div>

            {isAdmin && (
                <div>
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Business Info</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Business / Workspace Name</label>
                            <div className="relative">
                                <Building2 className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                                <input type="text" value={businessName} onChange={e => setBusinessName(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                    placeholder="Your business name" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Business Type</label>
                            <select value={businessType} onChange={e => setBusinessType(e.target.value)}
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 appearance-none cursor-pointer transition-all">
                                <option value="">Select type…</option>
                                {businessTypes.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl">
                <Globe className="w-5 h-5 text-amber-600 shrink-0" />
                <div className="flex-1">
                    <p className="text-sm font-bold text-amber-800">Starter Plan</p>
                    <p className="text-xs text-amber-600">50 leads/day · 100 messages/day</p>
                </div>
                <span className="text-[10px] font-black text-amber-700 bg-amber-100 px-2.5 py-0.5 rounded-full uppercase tracking-wider">Active</span>
            </div>

            <div className="flex justify-end pt-2">
                <SaveBtn saving={saving} saved={saved} label="Save Profile" />
            </div>
        </form>
    );
};

// ── Section 2: Notifications ─────────────────────────────────────────────────
const NOTIF_KEY = 'salesai_notif_prefs';
const NOTIF_DEFAULTS = {
    newLead: true, hotLead: true, dealUpdated: true,
    teamActivity: false, weeklyReport: true, whatsappIncoming: true,
};
const NOTIF_ITEMS = [
    { key: 'newLead',         label: 'New Lead Captured',        desc: 'Alert when a new lead is added via any channel' },
    { key: 'hotLead',         label: 'Hot Lead Alert',           desc: 'Notify when a lead score changes to Hot' },
    { key: 'dealUpdated',     label: 'Deal Stage Updated',       desc: 'Alert when a deal moves to a new pipeline stage' },
    { key: 'teamActivity',    label: 'Team Member Activity',     desc: 'Track when team members add or edit leads' },
    { key: 'weeklyReport',    label: 'Weekly Summary Report',    desc: 'Receive a weekly performance report every Monday' },
    { key: 'whatsappIncoming',label: 'WhatsApp Message Received',desc: 'Notify when a lead sends a new WhatsApp message' },
];

const NotificationsSection = ({ session }: { session: AuthSession }) => {
    const isAdmin = session.user.role === 'super_admin';
    const [prefs, setPrefs] = useState<Record<string, boolean>>(NOTIF_DEFAULTS);
    const [saved, setSaved] = useState(false);
    const [saving, setSaving] = useState(false);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        const loadPrefs = async () => {
            try {
                if (isAdmin) {
                    const { data, error } = await supabase.from('clients')
                        .select('notification_prefs')
                        .eq('user_id', session.user.id)
                        .maybeSingle();
                    if (!error && data?.notification_prefs) {
                        setPrefs({ ...NOTIF_DEFAULTS, ...data.notification_prefs });
                    }
                } else {
                    const { data: { user } } = await supabase.auth.getUser();
                    if (user?.user_metadata?.notification_prefs) {
                        setPrefs({ ...NOTIF_DEFAULTS, ...user.user_metadata.notification_prefs });
                    }
                }
            } catch (err) {
                console.error("Failed to load notifications", err);
            } finally {
                setLoaded(true);
            }
        };
        loadPrefs();
    }, [session.user.id, isAdmin]);

    const toggle = (key: string) => setPrefs(prev => ({ ...prev, [key]: !prev[key] }));

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            if (isAdmin) {
                await supabase.from('clients').update({ notification_prefs: prefs }).eq('user_id', session.user.id);
            } else {
                await supabase.auth.updateUser({ data: { notification_prefs: prefs } });
            }
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch (err) {
            console.error("Error saving preferences", err);
        } finally {
            setSaving(false);
        }
    };

    if (!loaded) return <div className="flex justify-center py-12"><RefreshCw className="w-6 h-6 animate-spin text-indigo-400" /></div>;

    return (
        <form onSubmit={handleSave} className="space-y-6">
            <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Notification Preferences</h4>
                <div className="space-y-2">
                    {NOTIF_ITEMS.map(item => (
                        <div key={item.key} className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-xl hover:border-indigo-100 hover:bg-indigo-50/30 transition-all">
                            <div>
                                <p className="text-sm font-semibold text-slate-800">{item.label}</p>
                                <p className="text-xs text-slate-500 mt-0.5">{item.desc}</p>
                            </div>
                            <Toggle checked={!!prefs[item.key]} onChange={() => toggle(item.key)} />
                        </div>
                    ))}
                </div>
            </div>
            <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl text-xs text-emerald-700">
                <strong>✓ Cloud Synced:</strong> Preferences are saved to your account and sync across all devices.
            </div>
            <div className="flex justify-end">
                <SaveBtn saving={saving} saved={saved} label="Save Preferences" />
            </div>
        </form>
    );
};

// ── Section 3: Security ──────────────────────────────────────────────────────
const SecuritySection = ({ session }: { session: AuthSession }) => {
    const [newPass, setNewPass]     = useState('');
    const [confirmPass, setConfirm] = useState('');
    const [showNew, setShowNew]     = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [saving, setSaving]       = useState(false);
    const [saved, setSaved]         = useState(false);
    const [error, setError]         = useState('');

    const strength = !newPass ? 0
        : newPass.length < 6  ? 1
        : newPass.length < 10 ? 2
        : /[A-Z]/.test(newPass) && /[0-9]/.test(newPass) && /[^A-Za-z0-9]/.test(newPass) ? 4
        : /[A-Z]/.test(newPass) && /[0-9]/.test(newPass) ? 3 : 2;

    const strengthMeta = [
        { label: '', color: '' },
        { label: 'Weak',   color: 'bg-red-500' },
        { label: 'Fair',   color: 'bg-yellow-500' },
        { label: 'Good',   color: 'bg-blue-500' },
        { label: 'Strong', color: 'bg-emerald-500' },
    ];

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (newPass.length < 6)       { setError('Password must be at least 6 characters.'); return; }
        if (newPass !== confirmPass)  { setError('Passwords do not match.'); return; }
        setSaving(true);
        try {
            const { error: err } = await supabase.auth.updateUser({ password: newPass });
            if (err) throw new Error(err.message);
            setSaved(true);
            setNewPass(''); setConfirm('');
            setTimeout(() => setSaved(false), 3000);
        } catch (err: any) {
            setError(err.message || 'Failed to update password.');
        } finally { setSaving(false); }
    };

    const passMatch = confirmPass.length > 0 && newPass !== confirmPass;

    return (
        <div className="space-y-6">
            <form onSubmit={handleSave} className="space-y-4">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Change Password</h4>

                {error && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-xl border border-red-200 text-sm">
                        <AlertTriangle className="w-4 h-4 shrink-0" />{error}
                    </div>
                )}
                {saved && (
                    <div className="flex items-center gap-2 p-3 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-200 text-sm">
                        <Check className="w-4 h-4 shrink-0" />Password updated successfully!
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">New Password</label>
                        <div className="relative">
                            <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                            <input type={showNew ? 'text' : 'password'} value={newPass} onChange={e => setNewPass(e.target.value)}
                                className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                placeholder="Min. 6 characters" />
                            <button type="button" onClick={() => setShowNew(s => !s)} className="absolute right-3 top-3 text-slate-400 hover:text-slate-600">
                                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                        {newPass && (
                            <div className="mt-2 flex items-center gap-2">
                                <div className="flex gap-1 flex-1">
                                    {[1,2,3,4].map(i => (
                                        <div key={i} className={`h-1.5 flex-1 rounded-full transition-all ${i <= strength ? strengthMeta[strength].color : 'bg-slate-200'}`} />
                                    ))}
                                </div>
                                <span className="text-[11px] font-bold text-slate-500">{strengthMeta[strength].label}</span>
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Confirm New Password</label>
                        <div className="relative">
                            <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                            <input type={showConfirm ? 'text' : 'password'} value={confirmPass} onChange={e => setConfirm(e.target.value)}
                                className={`w-full pl-10 pr-10 py-2.5 bg-slate-50 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all ${passMatch ? 'border-red-300 focus:border-red-400' : 'border-slate-200 focus:border-indigo-500'}`}
                                placeholder="Re-enter new password" />
                            <button type="button" onClick={() => setShowConfirm(s => !s)} className="absolute right-3 top-3 text-slate-400 hover:text-slate-600">
                                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                        {passMatch && <p className="text-[11px] text-red-500 mt-1 ml-1">Passwords do not match</p>}
                    </div>
                </div>

                <div className="flex justify-end">
                    <button type="submit" disabled={saving || !newPass || !confirmPass || passMatch}
                        className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all shadow-md disabled:opacity-50">
                        {saving ? <><RefreshCw className="w-4 h-4 animate-spin" /> Updating…</> : <><Key className="w-4 h-4" /> Update Password</>}
                    </button>
                </div>
            </form>

            <div className="border-t border-slate-100 pt-6">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Account Security Status</h4>
                <div className="divide-y divide-slate-50 border border-slate-100 rounded-2xl overflow-hidden">
                    {[
                        { label: 'Email',          value: session.user.email,          badge: '✓ Verified',  badgeClass: 'bg-emerald-100 text-emerald-700' },
                        { label: 'Role',           value: session.user.role === 'super_admin' ? 'Super Admin (Owner)' : `Team Member${session.user.title ? ` — ${session.user.title}` : ''}`, badge: session.user.role === 'super_admin' ? 'Owner' : 'Member', badgeClass: 'bg-indigo-100 text-indigo-700' },
                        { label: 'Two-Factor Auth',value: 'Not enabled',               badge: '! Disabled',  badgeClass: 'bg-amber-100 text-amber-700' },
                    ].map(row => (
                        <div key={row.label} className="flex items-center justify-between px-5 py-3.5 bg-white">
                            <span className="text-sm text-slate-600 font-medium">{row.label}</span>
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-slate-800 truncate max-w-[200px]">{row.value}</span>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${row.badgeClass}`}>{row.badge}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

// ── Section 4: Workspace ─────────────────────────────────────────────────────
const WorkspaceSection = ({ session }: { session: AuthSession }) => {
    const [metrics, setMetrics] = useState<any>(null);
    const [pipelines, setPipelines] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const headers = { Authorization: `Bearer ${session.token}` };
                const [mRes, pRes] = await Promise.all([
                    fetch('/api/dashboard/metrics?timeFilter=This Month', { headers }),
                    fetch('/api/pipelines', { headers })
                ]);
                if (mRes.ok) setMetrics((await mRes.json()).data);
                if (pRes.ok) setPipelines((await pRes.json()).data || []);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [session.token]);

    if (loading) return <div className="flex justify-center py-12"><RefreshCw className="w-6 h-6 animate-spin text-indigo-400" /></div>;

    return (
        <div className="space-y-8">
            <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Workspace Usage (This Month)</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-5 border border-slate-200 rounded-2xl bg-white shadow-sm">
                        <p className="text-sm font-semibold text-slate-600 mb-2">Lead Limits</p>
                        <div className="flex items-end gap-2">
                            <span className="text-3xl font-black text-slate-800">{metrics?.totalLeads || 0}</span>
                            <span className="text-sm text-slate-500 mb-1">/ 500 per month</span>
                        </div>
                        <div className="mt-3 w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${Math.min(((metrics?.totalLeads || 0) / 500) * 100, 100)}%` }} />
                        </div>
                    </div>
                    <div className="p-5 border border-slate-200 rounded-2xl bg-white shadow-sm">
                        <p className="text-sm font-semibold text-slate-600 mb-2">Active Deals</p>
                        <div className="flex items-end gap-2">
                            <span className="text-3xl font-black text-slate-800">{metrics?.activeDeals || 0}</span>
                        </div>
                        <p className="text-xs text-emerald-600 mt-2 font-medium bg-emerald-50 inline-block px-2 py-0.5 rounded-full">Good performance</p>
                    </div>
                </div>
            </div>

            <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Pipeline Overview</h4>
                <div className="border border-slate-200 rounded-2xl bg-white overflow-hidden shadow-sm">
                    {pipelines.map((p, i) => (
                        <div key={p.id} className={`p-4 flex items-center justify-between ${i > 0 ? 'border-t border-slate-100' : ''}`}>
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                                    <LayoutDashboard className="w-5 h-5 text-indigo-500" />
                                </div>
                                <div>
                                    <p className="font-bold text-slate-800">{p.name}</p>
                                    <p className="text-xs text-slate-500 mt-0.5">{p.stages?.length || 0} Stages configured</p>
                                </div>
                            </div>
                            <span className="px-3 py-1 bg-slate-100 text-slate-600 text-xs font-bold rounded-full">Active</span>
                        </div>
                    ))}
                    {pipelines.length === 0 && (
                        <div className="p-6 text-center text-sm text-slate-500">No pipelines configured.</div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ── Section 5: Danger Zone ───────────────────────────────────────────────────
const DangerZoneSection = ({ session }: { session: AuthSession }) => {
    const [deleteText, setDeleteText] = useState('');
    const [resetText, setResetText] = useState('');
    const [deleting, setDeleting] = useState(false);
    const [exporting, setExporting] = useState(false);

    const token = session.token;

    const exportData = async (type: 'leads' | 'deals') => {
        setExporting(true);
        try {
            const res = await fetch(`/api/${type}/export`, { headers: { Authorization: `Bearer ${token}` } });
            if (!res.ok) throw new Error('Export failed');
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${type}_export.csv`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (err: any) {
            alert('Error exporting data: ' + err.message);
        } finally {
            setExporting(false);
        }
    };

    const performDelete = async (type: 'leads' | 'deals') => {
        if (!confirm(`Are you absolutely sure you want to delete all ${type}?`)) return;
        setDeleting(true);
        try {
            const res = await fetch(`/api/${type}/all`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) throw new Error(`Failed to delete ${type}`);
            alert(`Successfully deleted all ${type}`);
            if (type === 'leads') setDeleteText('');
            if (type === 'deals') setResetText('');
        } catch (err: any) {
            alert('Error deleting data: ' + err.message);
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="p-5 border border-indigo-200 bg-indigo-50 rounded-2xl">
                <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shrink-0 shadow-sm">
                        <Database className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div className="flex-1">
                        <h4 className="font-bold text-indigo-900">Export Backup</h4>
                        <p className="text-sm text-indigo-700 mt-1 mb-4">Download your complete CRM data including all leads and deals in CSV format.</p>
                        
                        <div className="flex gap-3">
                            <button onClick={() => exportData('leads')} disabled={exporting}
                                className="flex items-center gap-2 px-4 py-2 bg-white border border-indigo-200 text-indigo-700 font-bold rounded-xl text-sm hover:bg-indigo-100 transition-all shadow-sm">
                                <Download className="w-4 h-4" /> Export Leads
                            </button>
                            <button onClick={() => exportData('deals')} disabled={exporting}
                                className="flex items-center gap-2 px-4 py-2 bg-white border border-indigo-200 text-indigo-700 font-bold rounded-xl text-sm hover:bg-indigo-100 transition-all shadow-sm">
                                <Download className="w-4 h-4" /> Export Deals
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="p-5 border border-red-200 bg-red-50 rounded-2xl">
                <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shrink-0 shadow-sm">
                        <Trash2 className="w-5 h-5 text-red-600" />
                    </div>
                    <div className="flex-1">
                        <h4 className="font-bold text-red-900">Reset Pipeline Deals</h4>
                        <p className="text-sm text-red-700 mt-1 mb-4">This will remove all deals from all pipelines. Pipelines and stages will remain intact.</p>
                        
                        <div className="flex gap-3">
                            <input type="text" value={resetText} onChange={e => setResetText(e.target.value)}
                                placeholder="Type RESET to confirm" 
                                className="w-full px-4 py-2 border border-red-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20" />
                            <button onClick={() => performDelete('deals')} disabled={resetText !== 'RESET' || deleting}
                                className="px-6 py-2 bg-red-600 text-white font-bold rounded-xl text-sm disabled:opacity-50 hover:bg-red-700 transition-all shadow-sm shrink-0">
                                {deleting ? 'Reset...' : 'Reset Deals'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="p-5 border border-red-200 bg-red-50 rounded-2xl">
                <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shrink-0 shadow-sm">
                        <AlertOctagon className="w-5 h-5 text-red-600" />
                    </div>
                    <div className="flex-1">
                        <h4 className="font-bold text-red-900">Delete All Leads</h4>
                        <p className="text-sm text-red-700 mt-1 mb-4">This will permanently delete all leads, activity history, and messages. This action cannot be undone.</p>
                        
                        <div className="flex gap-3">
                            <input type="text" value={deleteText} onChange={e => setDeleteText(e.target.value)}
                                placeholder="Type DELETE to confirm" 
                                className="w-full px-4 py-2 border border-red-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20" />
                            <button onClick={() => performDelete('leads')} disabled={deleteText !== 'DELETE' || deleting}
                                className="px-6 py-2 bg-red-600 text-white font-bold rounded-xl text-sm disabled:opacity-50 hover:bg-red-700 transition-all shadow-sm shrink-0">
                                {deleting ? 'Deleting...' : 'Delete Leads'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ── Main SettingsView ────────────────────────────────────────────────────────
export const SettingsView = ({ session }: SettingsViewProps) => {
    const [active, setActive] = useState('profile');
    const isAdmin = session.user.role === 'super_admin';

    const SECTIONS = [
        { id: 'profile',       label: 'Account Profile', icon: User },
        { id: 'notifications', label: 'Notifications',   icon: Bell },
        { id: 'security',      label: 'Security',         icon: Shield },
        ...(isAdmin ? [
            { id: 'workspace', label: 'Workspace',        icon: Briefcase },
            { id: 'danger',    label: 'Danger Zone',      icon: AlertOctagon }
        ] : [])
    ];

    const current = SECTIONS.find(s => s.id === active) || SECTIONS[0];

    return (
        <div className="flex flex-col gap-6">
            {/* Header */}
            <div className="bg-gradient-to-r from-slate-900 to-slate-700 rounded-2xl px-7 py-5 flex items-center gap-4">
                <div className="w-11 h-11 bg-white/10 rounded-xl flex items-center justify-center">
                    <Settings className="w-5 h-5 text-white" />
                </div>
                <div>
                    <h2 className="text-xl font-extrabold text-white tracking-tight">Settings</h2>
                    <p className="text-slate-400 text-sm">Manage your account, notifications, and security.</p>
                </div>
            </div>

            <div className="flex flex-col md:flex-row gap-5">
                {/* Sidebar */}
                <nav className="md:w-52 shrink-0 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden h-fit">
                    {SECTIONS.map(sec => {
                        const Icon = sec.icon;
                        const isActive = active === sec.id;
                        return (
                            <button key={sec.id} onClick={() => setActive(sec.id)}
                                className={`w-full flex items-center gap-3 px-4 py-3.5 text-sm font-semibold border-l-2 transition-all ${isActive ? 'border-indigo-500 text-indigo-700 bg-indigo-50' : 'border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
                                <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-500' : 'text-slate-400'}`} />
                                {sec.label}
                                {isActive && <ChevronRight className="ml-auto w-4 h-4 text-indigo-400" />}
                            </button>
                        );
                    })}
                </nav>

                {/* Content Panel */}
                <div className="flex-1 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
                        <h3 className="font-bold text-slate-800">{current.label}</h3>
                    </div>
                    <div className="p-6">
                        {active === 'profile'       && <ProfileSection session={session} />}
                        {active === 'notifications' && <NotificationsSection session={session} />}
                        {active === 'security'      && <SecuritySection session={session} />}
                        {active === 'workspace'     && <WorkspaceSection session={session} />}
                        {active === 'danger'        && <DangerZoneSection session={session} />}
                    </div>
                </div>
            </div>
        </div>
    );
};
