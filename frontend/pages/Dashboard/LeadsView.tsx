import React, { useState } from 'react';
import { Plus, EyeOff } from 'lucide-react';
import { Lead } from '../../../utils/types';
import { AddLeadModal } from '../../components/Dashboard/AddLeadModal';

export const LeadsView = ({ leads }: { leads: Lead[] }) => {
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('Recently Viewed Content');

    const tabs = ['All Clients', 'Uncontacted', 'Follow Ups', 'Recently Viewed Content'];

    const handleAddSuccess = () => {
        // Real-time subscription in App.tsx handles the refresh
    };

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
                        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                            {tabs.map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`
                                        whitespace-nowrap py-4 px-1 border-b-4 font-bold text-[12px] uppercase tracking-wide transition-colors
                                        ${activeTab === tab
                                            ? 'border-[#1a2332] text-[#1a2332]'
                                            : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-900'
                                        }
                                    `}
                                >
                                    {tab}
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
                {activeTab === 'Recently Viewed Content' ? (
                    // Empty State matching the screenshot exactly
                    <div className="flex-1 flex flex-col items-center justify-center py-24 px-4 text-center">
                        <div className="mb-4 text-gray-300">
                            <EyeOff className="w-12 h-12 stroke-[1]" />
                        </div>
                        <h3 className="text-[#1a2332] font-bold text-[15px] mb-2">No Recent Content Views</h3>
                        <p className="text-gray-500 text-[13px] leading-relaxed max-w-sm mb-6">
                            None of your content links were opened in<br />the last 7 days.<br /><br />
                            Clients will appear here once they open a File<br />or Page link that you share with them.
                        </p>
                        <button className="text-[#1ab0c6] font-bold text-[13px] uppercase tracking-wide hover:text-[#159cb0] transition-colors">
                            MANAGE YOUR CONTENT
                        </button>
                    </div>
                ) : (
                    // List View (Original Leads Table translated to Privyr style)
                    <div className="overflow-x-auto flex-1 p-2">
                        <table className="w-full text-sm text-left border-separate border-spacing-0">
                            <thead className="bg-white text-gray-400 font-medium text-[10px] uppercase tracking-widest">
                                <tr>
                                    <th className="px-6 pb-4 pt-6 border-b border-gray-100 font-semibold w-1/3">Name</th>
                                    <th className="px-6 pb-4 pt-6 border-b border-gray-100 font-semibold">Details</th>
                                    <th className="px-6 pb-4 pt-6 border-b border-gray-100 font-semibold text-center">Viewed Item</th>
                                    <th className="px-6 pb-4 pt-6 border-b border-gray-100 font-semibold text-right">Last Viewed</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {/* Table Empty State if no leads matching tab */}
                                {leads.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="text-center py-16 text-gray-400 text-sm">
                                            No clients found in this category.
                                        </td>
                                    </tr>
                                ) : leads.map((lead) => (
                                    <tr key={lead.id} className="hover:bg-slate-50 transition-colors cursor-pointer group">
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-[#1a2332]">{lead.name}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-gray-500 text-xs">
                                                {lead.email}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-gray-400 text-xs text-center">-</td>
                                        <td className="px-6 py-4 text-gray-400 text-xs text-right">{lead.lastContact !== 'Never' ? lead.lastContact : '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <AddLeadModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                onSuccess={handleAddSuccess}
            />
        </div>
    );
};
