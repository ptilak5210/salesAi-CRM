import React, { useState, useEffect, useRef } from 'react';
import { Shield, Plus, Users, Search, MoreVertical, X, Check, Mail, Phone, Briefcase, Edit2, Trash2, PowerOff, Power, AlertTriangle } from 'lucide-react';
import { TeamMember, Pipeline as PipelineType, AuthSession } from '../../../utils/types';

interface Props {
    session: AuthSession;
}

export const AdminView = ({ session }: Props) => {
    const [members, setMembers] = useState<TeamMember[]>([]);
    const [pipelines, setPipelines] = useState<PipelineType[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [editMember, setEditMember] = useState<TeamMember | null>(null);
    const [deleteMember, setDeleteMember] = useState<TeamMember | null>(null);
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchMembers = async () => {
        try {
            const res = await fetch('http://localhost:3001/api/team-members', {
                headers: { 'Authorization': `Bearer ${session.token}` }
            });
            const { data } = await res.json();
            if (data) setMembers(data);
        } catch (e) {
            console.error("Failed to fetch team members", e);
        } finally {
            setLoading(false);
        }
    };

    const fetchPipelines = async () => {
        try {
            const res = await fetch('http://localhost:3001/api/pipelines', {
                headers: { 'Authorization': `Bearer ${session.token}` }
            });
            const { data } = await res.json();
            if (data) setPipelines(data);
        } catch (e) {
            console.error("Failed to fetch pipelines", e);
        }
    };

    useEffect(() => {
        if (session.user.role === 'super_admin') {
            fetchMembers();
            fetchPipelines();
        }
    }, [session]);

    if (session.user.role !== 'super_admin') {
        return (
            <div className="flex flex-col items-center justify-center h-96">
                <Shield className="w-12 h-12 text-slate-300 mb-4" />
                <h2 className="text-xl font-bold text-slate-700">Access Denied</h2>
                <p className="text-slate-500">Only Super Admins can access this page.</p>
            </div>
        );
    }

    const filteredMembers = members.filter(m => 
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        m.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 bg-slate-900 rounded-3xl p-6 md:p-8 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-2xl translate-y-1/2 -translate-x-1/4"></div>
                
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center backdrop-blur-sm border border-white/10">
                            <Shield className="w-5 h-5 text-indigo-400" />
                        </div>
                        <h1 className="text-2xl md:text-3xl font-display font-bold tracking-tight">Admin & Team</h1>
                    </div>
                    <p className="text-slate-400 text-sm md:text-base max-w-xl">
                        Manage your sales team, assign pipelines, and control access permissions across your CRM.
                    </p>
                </div>

                <div className="flex items-center gap-3 relative z-10 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Search team..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-4 py-2.5 bg-slate-800/50 border border-slate-700/50 rounded-xl text-sm text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all backdrop-blur-sm"
                        />
                    </div>
                    <button 
                        onClick={() => setIsAddModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium rounded-xl transition-colors shrink-0 shadow-lg shadow-indigo-500/20"
                    >
                        <Plus className="w-4 h-4" />
                        <span className="hidden sm:inline">Add Member</span>
                    </button>
                </div>
            </div>

            {/* Team Members List */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-visible">
                <div className="overflow-visible">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-200 text-left">
                                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider rounded-tl-2xl">Member</th>
                                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Role</th>
                                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Assigned Pipelines</th>
                                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Permissions</th>
                                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right rounded-tr-2xl">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">Loading team members...</td>
                                </tr>
                            ) : filteredMembers.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center">
                                        <Users className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                                        <p className="text-slate-600 font-medium">No team members found</p>
                                        <p className="text-slate-400 text-sm mt-1">Click 'Add Member' to invite someone to your team.</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredMembers.map(member => (
                                    <tr key={member.id} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm shrink-0">
                                                    {member.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <div className="font-medium text-slate-900">{member.name}</div>
                                                    <div className="text-sm text-slate-500 flex items-center gap-2">
                                                        <span>{member.email}</span>
                                                        {member.phone && (
                                                            <>
                                                                <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                                                <span>{member.phone}</span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                                                {member.role}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-wrap gap-1.5">
                                                {member.pipeline_ids?.length > 0 ? (
                                                    member.pipeline_ids.map(id => {
                                                        const pName = pipelines.find(p => p.id === id)?.name;
                                                        return pName ? (
                                                            <span key={id} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-600 border border-indigo-100">
                                                                {pName}
                                                            </span>
                                                        ) : null;
                                                    })
                                                ) : (
                                                    <span className="text-sm text-slate-400">All / None</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {member.is_active ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                                    Active
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                                                    Inactive
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-wrap gap-1">
                                                {member.permissions?.can_export ? (
                                                    <span title="Can Export" className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-blue-50 text-blue-600 border border-blue-100">Export ✓</span>
                                                ) : (
                                                    <span title="Cannot Export" className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-slate-50 text-slate-400 border border-slate-100 line-through">Export</span>
                                                )}
                                                {member.permissions?.can_delete ? (
                                                    <span title="Can Delete" className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-red-50 text-red-500 border border-red-100">Delete ✓</span>
                                                ) : (
                                                    <span title="Cannot Delete" className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-slate-50 text-slate-400 border border-slate-100 line-through">Delete</span>
                                                )}
                                                {(member.permissions as any)?.can_import ? (
                                                    <span title="Can Import" className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-emerald-50 text-emerald-600 border border-emerald-100">Import ✓</span>
                                                ) : (
                                                    <span title="Cannot Import" className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-slate-50 text-slate-400 border border-slate-100 line-through">Import</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="relative inline-block">
                                                <button
                                                    onClick={() => setOpenMenuId(openMenuId === member.id ? null : member.id)}
                                                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                                >
                                                    <MoreVertical className="w-4 h-4" />
                                                </button>
                                                {openMenuId === member.id && (
                                                    <div className="absolute right-0 top-9 z-30 w-48 bg-white rounded-xl border border-slate-200 shadow-xl py-1 animate-in fade-in zoom-in-95 duration-150">
                                                        <button
                                                            onClick={() => { setEditMember(member); setOpenMenuId(null); }}
                                                            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                                                        >
                                                            <Edit2 className="w-4 h-4 text-slate-400" /> Edit Member
                                                        </button>
                                                        <button
                                                            onClick={async () => {
                                                                setOpenMenuId(null);
                                                                await fetch(`http://localhost:3001/api/team-members/${member.id}`, {
                                                                    method: 'PUT',
                                                                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.token}` },
                                                                    body: JSON.stringify({ ...member, is_active: !member.is_active })
                                                                });
                                                                fetchMembers();
                                                            }}
                                                            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                                                        >
                                                            {member.is_active
                                                                ? <><PowerOff className="w-4 h-4 text-amber-500" /> Deactivate</>
                                                                : <><Power className="w-4 h-4 text-emerald-500" /> Activate</>
                                                            }
                                                        </button>
                                                        <div className="border-t border-slate-100 my-1" />
                                                        <button
                                                            onClick={() => { setDeleteMember(member); setOpenMenuId(null); }}
                                                            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                                                        >
                                                            <Trash2 className="w-4 h-4" /> Remove Member
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Backdrop to close dropdown */}
            {openMenuId && (
                <div className="fixed inset-0 z-20" onClick={() => setOpenMenuId(null)} />
            )}

            {/* Add Member Modal */}
            {isAddModalOpen && (
                <AddMemberModal
                    session={session}
                    pipelines={pipelines}
                    onClose={() => setIsAddModalOpen(false)}
                    onSuccess={() => { setIsAddModalOpen(false); fetchMembers(); }}
                />
            )}

            {/* Edit Member Modal */}
            {editMember && (
                <EditMemberModal
                    session={session}
                    pipelines={pipelines}
                    member={editMember}
                    onClose={() => setEditMember(null)}
                    onSuccess={() => { setEditMember(null); fetchMembers(); }}
                />
            )}

            {/* Delete Confirm Modal */}
            {deleteMember && (
                <DeleteConfirmModal
                    session={session}
                    member={deleteMember}
                    onClose={() => setDeleteMember(null)}
                    onSuccess={() => { setDeleteMember(null); fetchMembers(); }}
                />
            )}
        </div>
    );
};

// ── Add Member Modal ─────────────────────────────────────────────────────────
const AddMemberModal = ({ session, pipelines, onClose, onSuccess }: any) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        role: 'Sales Executive',
        password: '',
        pipeline_ids: [] as string[],
        permissions: { can_export: false, can_delete: false, can_import: false, can_edit: true }
    });

    const togglePipeline = (id: string) => {
        setFormData(prev => ({
            ...prev,
            pipeline_ids: prev.pipeline_ids.includes(id)
                ? prev.pipeline_ids.filter(pId => pId !== id)
                : [...prev.pipeline_ids, id]
        }));
    };

    const togglePermission = (key: keyof typeof formData.permissions) => {
        setFormData(prev => ({
            ...prev,
            permissions: { ...prev.permissions, [key]: !prev.permissions[key] }
        }));
    };

    const generatePassword = () => {
        const randomString = Math.random().toString(36).slice(-6);
        setFormData(prev => ({ ...prev, password: `SalesAI@${randomString}` }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const res = await fetch('http://localhost:3001/api/team-members', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.token}`
                },
                body: JSON.stringify(formData)
            });

            const data = await res.json();
            
            if (!res.ok) throw new Error(data.error || 'Failed to create team member');
            
            setSuccessMsg(`Success! Created account with password: ${data.generated_password}`);
            setTimeout(() => {
                onSuccess();
            }, 5000);
            
        } catch (err: any) {
            setError(err.message);
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between px-8 py-6 bg-gradient-to-r from-indigo-50 to-white border-b border-indigo-100/50">
                    <div>
                        <h3 className="text-xl font-bold text-slate-900 font-display">New Team Member</h3>
                        <p className="text-sm text-slate-500 mt-1">Set up their profile, access, and permissions.</p>
                    </div>
                    <button onClick={onClose} className="p-2.5 text-slate-400 hover:text-slate-600 hover:bg-white rounded-xl transition-all shadow-sm">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {successMsg ? (
                    <div className="p-12 text-center flex-1 overflow-y-auto">
                        <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner shadow-emerald-200">
                            <Check className="w-10 h-10" />
                        </div>
                        <h4 className="text-2xl font-bold text-slate-900 mb-3 font-display">Member Added Successfully</h4>
                        <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl mb-8 max-w-sm mx-auto shadow-sm">
                            <p className="text-sm text-slate-500 mb-3 uppercase tracking-wider font-semibold">Share these credentials</p>
                            <p className="font-mono text-lg font-bold text-slate-900 bg-white border border-slate-200 py-3 rounded-xl shadow-sm">{successMsg.split(': ')[1]}</p>
                        </div>
                        <button onClick={onSuccess} className="px-8 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200">
                            Close & Refresh
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                        <div className="flex-1 overflow-y-auto p-8 space-y-8">
                            {error && (
                                <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-200 text-sm flex items-start gap-3">
                                    <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                                    <p>{error}</p>
                                </div>
                            )}

                            {/* Section 1: Profile Details */}
                            <div>
                                <h4 className="text-sm font-bold text-indigo-600 uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <span className="w-6 h-px bg-indigo-200"></span> Profile Details
                                </h4>
                                <div className="grid grid-cols-2 gap-5">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Full Name</label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none"><Users className="h-4 w-4 text-slate-400" /></div>
                                            <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}
                                                className="block w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                                placeholder="e.g. John Doe" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Role Title</label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none"><Briefcase className="h-4 w-4 text-slate-400" /></div>
                                            <select required value={formData.role} onChange={e => {
                                                const newRole = e.target.value;
                                                setFormData(prev => ({
                                                    ...prev, 
                                                    role: newRole,
                                                    permissions: newRole === 'Admin' || newRole === 'Manager' 
                                                        ? { can_export: true, can_delete: true, can_import: true, can_edit: true } 
                                                        : { can_export: false, can_delete: false, can_import: false, can_edit: true }
                                                }));
                                            }}
                                                className="block w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all appearance-none cursor-pointer"
                                            >
                                                <option value="Sales Executive">Sales Executive</option>
                                                <option value="Manager">Manager</option>
                                                <option value="Admin">Admin</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Section 2: Security */}
                            <div>
                                <h4 className="text-sm font-bold text-indigo-600 uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <span className="w-6 h-px bg-indigo-200"></span> Security & Login
                                </h4>
                                <div className="grid grid-cols-2 gap-5">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Email Address</label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none"><Mail className="h-4 w-4 text-slate-400" /></div>
                                            <input type="email" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})}
                                                className="block w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                                placeholder="john@company.com" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Initial Password</label>
                                        <div className="flex gap-2">
                                            <input type="text" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})}
                                                className="block w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-mono text-sm"
                                                placeholder="Leave blank to auto-generate" />
                                            <button type="button" onClick={generatePassword} className="px-4 py-3 bg-slate-100 text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-200 transition-colors shrink-0 text-sm font-medium">
                                                Auto
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Section 3: Access */}
                            <div>
                                <h4 className="text-sm font-bold text-indigo-600 uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <span className="w-6 h-px bg-indigo-200"></span> Access & Permissions
                                </h4>
                                
                                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden mb-5">
                                    <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
                                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Granular Permissions</p>
                                    </div>
                                    <div className="p-5 grid grid-cols-2 gap-4">
                                        <label className="flex items-start gap-3 cursor-pointer group">
                                            <div className="mt-0.5">
                                                <input type="checkbox" checked={formData.permissions.can_export} onChange={() => togglePermission('can_export')}
                                                    className="w-5 h-5 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer" />
                                            </div>
                                            <div>
                                                <span className="block text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">Export Data</span>
                                                <span className="block text-xs text-slate-500">Allow exporting leads to CSV</span>
                                            </div>
                                        </label>
                                        <label className="flex items-start gap-3 cursor-pointer group">
                                            <div className="mt-0.5">
                                                <input type="checkbox" checked={formData.permissions.can_delete} onChange={() => togglePermission('can_delete')}
                                                    className="w-5 h-5 text-red-500 border-slate-300 rounded focus:ring-red-500 cursor-pointer" />
                                            </div>
                                            <div>
                                                <span className="block text-sm font-bold text-slate-900 group-hover:text-red-600 transition-colors">Delete Leads</span>
                                                <span className="block text-xs text-slate-500">Allow permanent deletion</span>
                                            </div>
                                        </label>
                                        <label className="flex items-start gap-3 cursor-pointer group">
                                            <div className="mt-0.5">
                                                <input type="checkbox" checked={formData.permissions.can_import} onChange={() => togglePermission('can_import')}
                                                    className="w-5 h-5 text-emerald-500 border-slate-300 rounded focus:ring-emerald-500 cursor-pointer" />
                                            </div>
                                            <div>
                                                <span className="block text-sm font-bold text-slate-900 group-hover:text-emerald-600 transition-colors">Import Leads</span>
                                                <span className="block text-xs text-slate-500">Allow bulk importing leads</span>
                                            </div>
                                        </label>
                                    </div>
                                </div>

                                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                                    <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Assigned Pipelines</p>
                                        <div className="flex items-center gap-3">
                                            <button type="button" onClick={() => setFormData(prev => ({...prev, pipeline_ids: pipelines.map((p: any) => p.id)}))} className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition-colors">Select All</button>
                                            <button type="button" onClick={() => setFormData(prev => ({...prev, pipeline_ids: []}))} className="text-xs font-semibold text-slate-500 hover:text-slate-700 transition-colors">Clear All</button>
                                            <span className="text-xs font-medium text-slate-400 ml-2 px-2 py-0.5 bg-slate-200 rounded-md">{formData.pipeline_ids.length} selected</span>
                                        </div>
                                    </div>
                                    <div className="max-h-48 overflow-y-auto p-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                                        {pipelines.length === 0 ? (
                                            <p className="text-sm text-slate-500 italic p-3 text-center col-span-2">No pipelines found. Create one first.</p>
                                        ) : (
                                            pipelines.map((p: any) => (
                                                <label key={p.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${formData.pipeline_ids.includes(p.id) ? 'border-indigo-600 bg-indigo-50/30 shadow-sm' : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'}`}>
                                                    <input type="checkbox" checked={formData.pipeline_ids.includes(p.id)} onChange={() => togglePipeline(p.id)}
                                                        className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer" />
                                                    <span className={`text-sm font-semibold truncate block ${formData.pipeline_ids.includes(p.id) ? 'text-indigo-900' : 'text-slate-700'}`}>{p.name}</span>
                                                </label>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 shrink-0">
                            <button type="button" onClick={onClose}
                                className="px-6 py-3 text-sm font-semibold text-slate-600 bg-white border border-slate-300 hover:bg-slate-100 rounded-xl transition-all">
                                Cancel
                            </button>
                            <button type="submit" disabled={loading}
                                className="px-8 py-3 text-sm font-bold text-white bg-slate-900 hover:bg-black rounded-xl transition-all shadow-lg shadow-slate-900/20 disabled:opacity-50 flex items-center gap-2">
                                {loading ? 'Creating...' : 'Create Team Member'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

// ── Edit Member Modal ─────────────────────────────────────────────────────────
const EditMemberModal = ({ session, pipelines, member, onClose, onSuccess }: any) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [formData, setFormData] = useState({
        name: member.name || '',
        email: member.email || '',
        phone: member.phone || '',
        role: member.role || 'Sales Executive',
        pipeline_ids: member.pipeline_ids || [] as string[],
        is_active: member.is_active,
        permissions: { can_export: false, can_delete: false, can_import: false, can_edit: true, ...(member.permissions || {}) }
    });

    const togglePipeline = (id: string) => {
        setFormData(prev => ({
            ...prev,
            pipeline_ids: prev.pipeline_ids.includes(id)
                ? prev.pipeline_ids.filter((pId: string) => pId !== id)
                : [...prev.pipeline_ids, id]
        }));
    };

    const togglePermission = (key: keyof typeof formData.permissions) => {
        setFormData(prev => ({
            ...prev,
            permissions: { ...prev.permissions, [key]: !prev.permissions[key] }
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const res = await fetch(`http://localhost:3001/api/team-members/${member.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.token}` },
                body: JSON.stringify(formData)
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Update failed');
            onSuccess();
        } catch (err: any) {
            setError(err.message);
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between px-8 py-6 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
                    <div>
                        <h3 className="text-xl font-bold text-slate-900 font-display flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center"><Edit2 className="w-5 h-5 text-slate-600" /></div>
                            Edit Team Member
                        </h3>
                    </div>
                    <button onClick={onClose} className="p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                    <div className="flex-1 overflow-y-auto p-8 space-y-8">
                        {error && <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-200 text-sm flex gap-3"><AlertTriangle className="w-5 h-5 shrink-0" /><p>{error}</p></div>}
                        
                        <div>
                            <h4 className="text-sm font-bold text-slate-600 uppercase tracking-wider mb-4 flex items-center gap-2">Profile</h4>
                            <div className="grid grid-cols-2 gap-5">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Full Name</label>
                                    <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}
                                        className="block w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-slate-500/20 text-sm" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Role / Title</label>
                                    <select required value={formData.role} onChange={e => {
                                        const newRole = e.target.value;
                                        setFormData(prev => ({
                                            ...prev, 
                                            role: newRole,
                                            permissions: newRole === 'Admin' || newRole === 'Manager' 
                                                ? { can_export: true, can_delete: true, can_import: true, can_edit: true } 
                                                : { can_export: false, can_delete: false, can_import: false, can_edit: true }
                                        }));
                                    }}
                                        className="block w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-slate-500/20 text-sm cursor-pointer appearance-none" >
                                        <option value="Sales Executive">Sales Executive</option>
                                        <option value="Manager">Manager</option>
                                        <option value="Admin">Admin</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div>
                            <h4 className="text-sm font-bold text-slate-600 uppercase tracking-wider mb-4 flex items-center gap-2">Access & Permissions</h4>
                            
                            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden mb-5">
                                <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Granular Permissions</p>
                                </div>
                                <div className="p-5 grid grid-cols-2 gap-4">
                                    <label className="flex items-start gap-3 cursor-pointer group">
                                        <div className="mt-0.5"><input type="checkbox" checked={formData.permissions.can_export} onChange={() => togglePermission('can_export')} className="w-5 h-5 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer" /></div>
                                        <div>
                                            <span className="block text-sm font-bold text-slate-900 group-hover:text-indigo-600">Export Data</span>
                                            <span className="block text-xs text-slate-500">Allow exporting leads to CSV</span>
                                        </div>
                                    </label>
                                    <label className="flex items-start gap-3 cursor-pointer group">
                                        <div className="mt-0.5"><input type="checkbox" checked={formData.permissions.can_delete} onChange={() => togglePermission('can_delete')} className="w-5 h-5 text-red-500 border-slate-300 rounded focus:ring-red-500 cursor-pointer" /></div>
                                        <div>
                                            <span className="block text-sm font-bold text-slate-900 group-hover:text-red-600">Delete Leads</span>
                                            <span className="block text-xs text-slate-500">Allow permanent deletion</span>
                                        </div>
                                    </label>
                                    <label className="flex items-start gap-3 cursor-pointer group">
                                        <div className="mt-0.5"><input type="checkbox" checked={formData.permissions.can_import} onChange={() => togglePermission('can_import')} className="w-5 h-5 text-emerald-500 border-slate-300 rounded focus:ring-emerald-500 cursor-pointer" /></div>
                                        <div>
                                            <span className="block text-sm font-bold text-slate-900 group-hover:text-emerald-600">Import Leads</span>
                                            <span className="block text-xs text-slate-500">Allow bulk importing leads</span>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                                <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Assigned Pipelines</p>
                                    <div className="flex items-center gap-3">
                                        <button type="button" onClick={() => setFormData(prev => ({...prev, pipeline_ids: pipelines.map((p: any) => p.id)}))} className="text-xs font-semibold text-slate-600 hover:text-slate-800 transition-colors">Select All</button>
                                        <button type="button" onClick={() => setFormData(prev => ({...prev, pipeline_ids: []}))} className="text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors">Clear</button>
                                        <span className="text-xs font-medium text-slate-400 ml-2 px-2 py-0.5 bg-slate-200 rounded-md">{formData.pipeline_ids.length} selected</span>
                                    </div>
                                </div>
                                <div className="max-h-48 overflow-y-auto p-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                                    {pipelines.map((p: any) => (
                                        <label key={p.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${formData.pipeline_ids.includes(p.id) ? 'border-slate-800 bg-slate-50 shadow-sm' : 'border-slate-200 hover:border-slate-300'}`}>
                                            <input type="checkbox" checked={formData.pipeline_ids.includes(p.id)} onChange={() => togglePipeline(p.id)} className="w-4 h-4 text-slate-800 border-slate-300 rounded focus:ring-slate-800 cursor-pointer" />
                                            <span className="text-sm font-semibold text-slate-700 truncate">{p.name}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 shrink-0">
                        <button type="button" onClick={onClose} className="px-6 py-3 text-sm font-semibold text-slate-600 bg-white border border-slate-300 hover:bg-slate-100 rounded-xl transition-all">Cancel</button>
                        <button type="submit" disabled={loading} className="px-8 py-3 text-sm font-bold text-white bg-slate-900 hover:bg-black rounded-xl transition-all shadow-lg shadow-slate-900/20 disabled:opacity-50">
                            {loading ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// ── Delete Confirm Modal ──────────────────────────────────────────────────────
const DeleteConfirmModal = ({ session, member, onClose, onSuccess }: any) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleDelete = async () => {
        setLoading(true);
        try {
            const res = await fetch(`http://localhost:3001/api/team-members/${member.id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${session.token}` }
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Delete failed');
            onSuccess();
        } catch (err: any) {
            setError(err.message);
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
                <div className="p-8 text-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <AlertTriangle className="w-8 h-8 text-red-600" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-2">Remove Team Member?</h3>
                    <p className="text-slate-500 text-sm mb-1">You are about to permanently remove:</p>
                    <p className="text-slate-900 font-semibold mb-4">{member.name} ({member.email})</p>
                    <p className="text-sm text-red-600 bg-red-50 rounded-xl p-3 mb-6">
                        This will delete their login account. Leads assigned to them will become unassigned. This cannot be undone.
                    </p>
                    {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
                    <div className="flex gap-3">
                        <button onClick={onClose}
                            className="flex-1 px-5 py-2.5 text-sm font-medium text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition-all">
                            Cancel
                        </button>
                        <button onClick={handleDelete} disabled={loading}
                            className="flex-1 px-5 py-2.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-xl transition-all disabled:opacity-50">
                            {loading ? 'Removing...' : 'Yes, Remove'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
