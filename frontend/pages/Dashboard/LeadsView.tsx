import React, { useState } from 'react';
import { Plus, Clock, Users, PhoneCall, RefreshCw, Phone, Mail, MessageSquare } from 'lucide-react';
import { Lead } from '../../../utils/types';
import { AddLeadModal } from '../../components/Dashboard/AddLeadModal';

export const LeadsView = ({ leads }: { leads: Lead[] }) => {
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('All Clients');

    const tabs = [
        { id: 'All Clients', label: 'All Clients', icon: Users },
        { id: 'Uncontacted', label: 'Uncontacted', icon: PhoneCall },
        { id: 'Follow Ups', label: 'Follow Ups', icon: RefreshCw },
        { id: 'Recently Viewed', label: 'Recently Viewed', icon: Clock },
    ];

    const filteredLeads = leads.filter(lead => {
        if (activeTab === 'All Clients') return true;
        if (activeTab === 'Uncontacted') return lead.status === 'New' || lead.lastContact === 'Never';
        if (activeTab === 'Follow Ups') return lead.status === 'Follow Up' || lead.score === 'Hot' || lead.score === 'Warm';
        if (activeTab === 'Recently Viewed') {
            // Show leads added/updated in the last 7 days
            return lead.lastContact !== 'Never';
        }
        return true;
    });

    const getScoreBadge = (score: string) => {
        if (score === 'Hot') return 'bg-red-100 text-red-700 border border-red-200';
        if (score === 'Warm') return 'bg-orange-100 text-orange-700 border border-orange-200';
        return 'bg-slate-100 text-slate-600 border border-slate-200';
    };

    const getStatusBadge = (status: string) => {
        if (status === 'New') return 'bg-blue-100 text-blue-700';
        if (status === 'Follow Up') return 'bg-purple-100 text-purple-700';
        if (status === 'Contacted') return 'bg-green-100 text-green-700';
        if (status === 'Qualified') return 'bg-teal-100 text-teal-700';
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
                        {tab === 'Uncontacted' ? 'No uncontacted clients yet.' :
                         tab === 'Follow Ups' ? 'No follow-ups needed right now.' :
                         tab === 'Recently Viewed' ? 'No recently added or updated clients.' :
                         'No clients added yet.'}
                    </p>
                    <p className="text-slate-400 text-xs max-w-xs">
                        {tab === 'All Clients' ? 'Click "ADD NEW CLIENT" to add your first client, or send a WhatsApp message with "I am interested" to auto-capture leads.' : ''}
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
                    <div className="w-full md:w-auto px-2">
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

                    {/* Add Button */}
                    <div className="py-2 md:py-0 md:pb-2 mt-2 md:mt-0 px-2 md:px-0 text-right">
                        <button
                            onClick={() => setIsAddModalOpen(true)}
                            className="bg-[#1ab0c6] hover:bg-[#159cb0] text-white px-4 py-2 rounded font-bold text-[12px] uppercase tracking-wide transition-colors inline-flex items-center justify-center gap-2 shadow-sm whitespace-nowrap"
                        >
                            <Plus className="w-4 h-4" strokeWidth={3} />
                            ADD NEW CLIENT
                        </button>
                    </div>
                </div>
            </div>

            {/* Content Box */}
            <div className="bg-white rounded shadow-sm border border-gray-100 flex-1 flex flex-col min-h-[500px]">
                <div className="overflow-x-auto flex-1 p-2">
                    <table className="w-full text-sm text-left border-separate border-spacing-0">
                        <thead className="bg-white text-gray-400 font-medium text-[10px] uppercase tracking-widest">
                            <tr>
                                <th className="px-6 pb-4 pt-6 border-b border-gray-100 font-semibold w-1/4">Name</th>
                                <th className="px-6 pb-4 pt-6 border-b border-gray-100 font-semibold">Phone / WhatsApp</th>
                                <th className="px-6 pb-4 pt-6 border-b border-gray-100 font-semibold">Email</th>
                                <th className="px-6 pb-4 pt-6 border-b border-gray-100 font-semibold text-center">Status</th>
                                <th className="px-6 pb-4 pt-6 border-b border-gray-100 font-semibold text-right">Source / Score</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {filteredLeads.length === 0 ? (
                                <EmptyState tab={activeTab} />
                            ) : filteredLeads.map((lead) => (
                                <tr key={lead.id} className="hover:bg-slate-50 transition-colors cursor-pointer group">
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-[#1a2332] text-sm">{lead.name}</div>
                                        {lead.company && lead.company !== lead.name && (
                                            <div className="text-[11px] text-gray-400 mt-0.5">{lead.company}</div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        {lead.phone ? (
                                            <div className="flex items-center gap-1.5 text-gray-600 text-xs">
                                                <MessageSquare className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                                                <span className="font-mono">{lead.phone}</span>
                                            </div>
                                        ) : (
                                            <span className="text-gray-300 text-xs">—</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        {lead.email ? (
                                            <div className="flex items-center gap-1.5 text-gray-600 text-xs">
                                                <Mail className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                                                <span>{lead.email}</span>
                                            </div>
                                        ) : (
                                            <span className="text-gray-300 text-xs">—</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${getStatusBadge(lead.status)}`}>
                                            {lead.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex flex-col items-end gap-1">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${getScoreBadge(lead.score)}`}>
                                                {lead.score}
                                            </span>
                                            {lead.source && (
                                                <span className="text-[10px] text-gray-400">{lead.source}</span>
                                            )}
                                        </div>
                                    </td>
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
            />
        </div>
    );
};
