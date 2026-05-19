import React, { useState, useRef, useEffect } from 'react';
import { Plus, Clock, Users, PhoneCall, RefreshCw, Mail, MessageSquare, Search, Filter, Upload, Download, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { Lead } from '../../../utils/types';
import { AddLeadModal } from '../../components/Dashboard/AddLeadModal';
import { EditLeadModal } from '../../components/Dashboard/EditLeadModal';
import { LeadDetailModal } from '../../components/Dashboard/LeadDetailModal';
import { DataActivityModal } from '../../components/Dashboard/DataActivityModal';
import { usePermissions } from '../../hooks/usePermissions';
import { supabase } from '../../lib/supabase';

export const LeadsView = ({ leads, session }: { leads: Lead[], session: any }) => {
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isDataModalOpen, setIsDataModalOpen] = useState(false);
    const [dataModalTab, setDataModalTab] = useState<'import' | 'export' | 'history'>('import');
    const [activeTab, setActiveTab] = useState('All Clients');
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
    // Edit/Delete State
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [leadToEdit, setLeadToEdit] = useState<Lead | null>(null);
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const perms = usePermissions(session);

    // Close dropdown when clicking outside
    const menuRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setOpenMenuId(null);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleDeleteLead = async (lead: Lead) => {
        if (!confirm(`Delete "${lead.name}"? This cannot be undone.`)) return;
        setDeletingId(lead.id);
        try {
            // First delete any associated deals (DB has ON DELETE SET NULL, not CASCADE)
            await supabase.from('deals').delete().eq('lead_id', lead.id);
            // Now delete the lead itself
            const { error } = await supabase.from('leads').delete().eq('id', lead.id);
            if (error) throw new Error(error.message);
            // Realtime subscription in App.tsx will auto-refresh the list
        } catch (err: any) {
            alert('Failed to delete lead: ' + err.message);
        } finally {
            setDeletingId(null);
            setOpenMenuId(null);
        }
    };


    const tabs = [
        { id: 'All Clients', label: 'All Clients', icon: Users },
        { id: 'Uncontacted', label: 'Uncontacted', icon: PhoneCall },
        { id: 'Follow Ups', label: 'Follow Ups', icon: RefreshCw },
        { id: 'Recently Viewed', label: 'Recently Viewed', icon: Clock },
    ];

    const filteredLeads = leads.filter(lead => {
        // 1. Tab filtering
        let matchesTab = true;
        if (activeTab === 'Uncontacted') matchesTab = lead.status === 'New' || lead.lastContact === 'Never';
        if (activeTab === 'Follow Ups') matchesTab = lead.status === 'Follow Up' || lead.score === 'Hot' || lead.score === 'Warm';
        if (activeTab === 'Recently Viewed') matchesTab = lead.lastContact !== 'Never';

        // 2. Search filtering
        const searchLower = searchQuery.toLowerCase();
        const matchesSearch = !searchQuery || 
            (lead.name && lead.name.toLowerCase().includes(searchLower)) ||
            (lead.company && lead.company.toLowerCase().includes(searchLower)) ||
            (lead.phone && lead.phone.includes(searchQuery));

        // 3. Status filtering
        const matchesStatus = statusFilter === 'All' || lead.status === statusFilter;

        return matchesTab && matchesSearch && matchesStatus;
    });

    const getScoreBadge = (score: string) => {
        if (score === 'Hot') return 'bg-red-100 text-red-700 border border-red-200';
        if (score === 'Warm') return 'bg-orange-100 text-orange-700 border border-orange-200';
        return 'bg-blue-100 text-blue-700 border border-blue-200';
    };

    const getStatusBadge = (status: string) => {
        if (status === 'New') return 'bg-blue-100 text-blue-700';
        if (status === 'Follow Up') return 'bg-purple-100 text-purple-700';
        if (status === 'Contacted') return 'bg-green-100 text-green-700';
        if (status === 'Qualified') return 'bg-teal-100 text-teal-700';
        if (status === 'Proposal') return 'bg-orange-100 text-orange-700';
        if (status === 'Won') return 'bg-emerald-100 text-emerald-700';
        if (status === 'Lost') return 'bg-red-100 text-red-700';
        if (status === 'Replied') return 'bg-indigo-100 text-indigo-700';
        return 'bg-slate-100 text-slate-600';
    };

    const EmptyState = ({ tab }: { tab: string }) => (
        <tr>
            <td colSpan={5} className="py-20 text-center">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center">
                        <Users className="w-6 h-6 text-slate-400" />
                    </div>
                    <p className="text-slate-500 font-medium text-sm">
                        {searchQuery ? 'No clients match your search.' :
                         tab === 'Uncontacted' ? 'No uncontacted clients yet.' :
                         tab === 'Follow Ups' ? 'No follow-ups needed right now.' :
                         tab === 'Recently Viewed' ? 'No recently added or updated clients.' :
                         'No clients added yet.'}
                    </p>
                    <p className="text-slate-400 text-xs max-w-xs">
                        {tab === 'All Clients' && !searchQuery ? 'Click "ADD NEW CLIENT" to add your first client, or send a WhatsApp message with "I am interested" to auto-capture leads.' : ''}
                    </p>
                </div>
            </td>
        </tr>
    );

    return (
        <div className="flex flex-col h-full bg-[#f4f6f8] -m-4 md:-m-8 p-4 md:p-8 animate-fade-in relative min-h-[80vh]">

            {/* Page Header */}
            <div className="flex flex-col mb-4">
                <h2 className="text-[24px] font-extrabold text-[#1a2332] tracking-tight mb-4">
                    Clients
                </h2>

                {/* Tabs and Add Button Container */}
                <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-gray-200">

                    {/* Tabs */}
                    <div className="w-full md:w-auto px-2 overflow-x-auto custom-scrollbar">
                        <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                            {tabs.map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`
                                        whitespace-nowrap py-4 px-1 border-b-4 font-bold text-[12px] uppercase tracking-wide transition-colors flex items-center gap-1.5
                                        ${activeTab === tab.id
                                            ? 'border-[#1a2332] text-[#1a2332]'
                                            : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-900'
                                        }
                                    `}
                                >
                                    {tab.label}
                                    {tab.id !== 'Recently Viewed' && (
                                        <span className={`ml-1 text-[10px] px-1.5 py-0.5 rounded-full font-bold ${activeTab === tab.id ? 'bg-[#1a2332] text-white' : 'bg-gray-100 text-gray-500'}`}>
                                            {tab.id === 'All Clients' ? leads.length :
                                             tab.id === 'Uncontacted' ? leads.filter(l => l.status === 'New' || l.lastContact === 'Never').length :
                                             leads.filter(l => l.status === 'Follow Up' || l.score === 'Hot' || l.score === 'Warm').length}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </nav>
                    </div>

                    {/* Action Buttons */}
                    <div className="py-2 md:py-0 md:pb-2 mt-2 md:mt-0 px-2 md:px-0 flex items-center gap-2 shrink-0">
                        {/* Export CSV — only shown if user has permission */}
                        {perms.canExport && (
                            <button
                                onClick={() => { setDataModalTab('export'); setIsDataModalOpen(true); }}
                                title="Export leads to CSV"
                                className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-600 font-bold text-xs rounded-xl transition-all duration-300 hover:bg-slate-50 hover:border-slate-300 hover:-translate-y-0.5 shadow-sm whitespace-nowrap"
                            >
                                <Download className="w-4 h-4" />
                                Export
                            </button>
                        )}
                        {/* Import CSV — only shown if user has permission */}
                        {perms.canImport && (
                            <button
                                onClick={() => { setDataModalTab('import'); setIsDataModalOpen(true); }}
                                title="Import leads from CSV"
                                className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-600 font-bold text-xs rounded-xl transition-all duration-300 hover:bg-slate-50 hover:border-slate-300 hover:-translate-y-0.5 shadow-sm whitespace-nowrap"
                            >
                                <Upload className="w-4 h-4" />
                                Import
                            </button>
                        )}
                        {/* Add New — all users can add leads */}
                        <button
                            onClick={() => setIsAddModalOpen(true)}
                            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-bold text-xs uppercase tracking-wide rounded-xl transition-all duration-300 shadow-md hover:shadow-lg hover:-translate-y-0.5 whitespace-nowrap"
                        >
                            <Plus className="w-4 h-4" strokeWidth={3} />
                            Add New
                        </button>
                    </div>
                </div>
            </div>

            {/* Content Box */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 flex-1 flex flex-col min-h-[500px] overflow-hidden">
                
                {/* Search & Filter Bar */}
                <div className="flex flex-col md:flex-row gap-4 p-5 border-b border-slate-100 bg-slate-50/50">
                    {/* Search */}
                    <div className="relative flex-1 group">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                        <input
                            type="text"
                            placeholder="Search leads by name, company, or phone..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200/80 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all shadow-sm"
                        />
                    </div>
                    
                    {/* Filter Dropdown */}
                    <div className="relative w-full md:w-64 shrink-0 group">
                        <Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200/80 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 appearance-none cursor-pointer shadow-sm transition-all"
                        >
                            <option value="All">All Statuses</option>
                            <option value="New">New</option>
                            <option value="Contacted">Contacted</option>
                            <option value="Qualified">Qualified</option>
                            <option value="Proposal">Proposal</option>
                            <option value="Won">Won</option>
                            <option value="Lost">Lost</option>
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                            ▼
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto flex-1 p-2">
                    <table className="w-full text-sm text-left border-separate border-spacing-0">
                        <thead className="bg-white text-slate-400 font-bold text-[10px] uppercase tracking-widest">
                            <tr>
                                <th className="px-6 pb-4 pt-4 border-b border-slate-100 w-1/4">Name</th>
                                <th className="px-6 pb-4 pt-4 border-b border-slate-100">Phone / WhatsApp</th>
                                <th className="px-6 pb-4 pt-4 border-b border-slate-100">Email</th>
                                <th className="px-6 pb-4 pt-4 border-b border-slate-100">Assigned To</th>
                                <th className="px-6 pb-4 pt-4 border-b border-slate-100 text-center">Status</th>
                                <th className="px-6 pb-4 pt-4 border-b border-slate-100 text-right">Source / Score</th>
                                {(perms.canEdit || perms.canDelete) && <th className="px-4 pb-4 pt-4 border-b border-slate-100 text-center w-12"></th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filteredLeads.length === 0 ? (
                                <EmptyState tab={activeTab} />
                            ) : filteredLeads.map((lead) => (
                                <tr 
                                    key={lead.id} 
                                    onClick={() => setSelectedLead(lead)}
                                    className="hover:bg-slate-50/80 transition-all cursor-pointer group"
                                >
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-slate-800 text-sm group-hover:text-indigo-600 transition-colors">{lead.name}</div>
                                        {lead.company && lead.company !== lead.name && (
                                            <div className="text-[11px] text-slate-400 font-medium mt-0.5">{lead.company}</div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        {lead.phone ? (
                                            <div className="flex items-center gap-1.5 text-slate-600 text-xs font-medium">
                                                <MessageSquare className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                                <span className="font-mono">{lead.phone}</span>
                                            </div>
                                        ) : (
                                            <span className="text-slate-300 text-xs">—</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        {lead.email ? (
                                            <div className="flex items-center gap-1.5 text-slate-600 text-xs font-medium">
                                                <Mail className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                                                <span>{lead.email}</span>
                                            </div>
                                        ) : (
                                            <span className="text-slate-300 text-xs">—</span>
                                        )}
                                    </td>
                                    {/* Assigned To column */}
                                    <td className="px-6 py-4">
                                        {(lead as any).assigned_to_name ? (
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-[10px] font-bold shrink-0">
                                                    {(lead as any).assigned_to_name.charAt(0)}
                                                </div>
                                                <span className="text-xs font-medium text-slate-700">{(lead as any).assigned_to_name}</span>
                                            </div>
                                        ) : (
                                            <span className="text-slate-300 text-xs">—</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${getStatusBadge(lead.status)}`}>
                                            {lead.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex flex-col items-end gap-1.5">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-sm ${getScoreBadge(lead.score)}`}>
                                                {lead.score}
                                            </span>
                                            {lead.source && (
                                                <span className="text-[10px] text-slate-400 font-bold tracking-wide uppercase">{lead.source}</span>
                                            )}
                                        </div>
                                    </td>
                                    {/* ── Row Action Menu ── */}
                                    {(perms.canEdit || perms.canDelete) && (
                                        <td className="px-4 py-4 text-center" onClick={e => e.stopPropagation()}>
                                            <div className="relative" ref={openMenuId === lead.id ? menuRef : null}>
                                                <button
                                                    onClick={() => setOpenMenuId(openMenuId === lead.id ? null : lead.id)}
                                                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                                    title="Actions"
                                                >
                                                    <MoreVertical className="w-4 h-4" />
                                                </button>
                                                {openMenuId === lead.id && (
                                                    <div className="absolute right-0 top-8 z-50 w-36 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-fade-in">
                                                        {perms.canEdit && (
                                                            <button
                                                                onClick={() => { setLeadToEdit(lead); setIsEditModalOpen(true); setOpenMenuId(null); }}
                                                                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
                                                            >
                                                                <Pencil className="w-3.5 h-3.5" /> Edit
                                                            </button>
                                                        )}
                                                        {perms.canDelete && (
                                                            <button
                                                                onClick={() => handleDeleteLead(lead)}
                                                                disabled={deletingId === lead.id}
                                                                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" /> {deletingId === lead.id ? 'Deleting...' : 'Delete'}
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <AddLeadModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                onSuccess={() => setIsAddModalOpen(false)}
                session={session}
            />

            <EditLeadModal
                isOpen={isEditModalOpen}
                onClose={() => { setIsEditModalOpen(false); setLeadToEdit(null); }}
                onSuccess={() => { setIsEditModalOpen(false); setLeadToEdit(null); }}
                lead={leadToEdit}
                session={session}
            />

            <DataActivityModal
                isOpen={isDataModalOpen}
                onClose={() => setIsDataModalOpen(false)}
                onSuccess={() => setIsDataModalOpen(false)}
                session={session}
                defaultTab={dataModalTab}
            />

            <LeadDetailModal
                isOpen={!!selectedLead}
                onClose={() => setSelectedLead(null)}
                lead={selectedLead}
                session={session}
                onEdit={(lead) => {
                    setSelectedLead(null);
                    setLeadToEdit(lead);
                    setIsEditModalOpen(true);
                }}
                onDelete={() => {
                    setSelectedLead(null);
                    // Realtime subscription in App.tsx will auto-refresh the list
                }}
            />
        </div>
    );
};
