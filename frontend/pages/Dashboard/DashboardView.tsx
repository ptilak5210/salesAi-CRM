import React, { useState, useEffect } from 'react';
import { Users, Briefcase, Calendar, BarChart3, Filter, Plus, Phone, ArrowRight, MessageCircle } from 'lucide-react';
import { Button } from '../../components/Button';
import { Deal, Lead, Meeting, AuthSession } from '../../../utils/types';

export const DashboardView = ({ session, leads, MOCK_DEALS, activities, refreshActivities }: { session: AuthSession, leads: Lead[], MOCK_DEALS: Deal[], activities: Meeting[], refreshActivities?: () => void }) => {

    const [timeFilter, setTimeFilter] = useState('All Time');
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [isWidgetModalOpen, setIsWidgetModalOpen] = useState(false);
    const [activeWidgets, setActiveWidgets] = useState<string[]>(['lead_sources']);

    // Real Data State
    const [metrics, setMetrics] = useState({
        totalLeads: leads.length,
        activeDeals: 0,
        revenue: 0,
        totalMeetings: activities.length,
        leadSources: [] as { name: string, percentage: number }[]
    });

    useEffect(() => {
        if (!session?.token) return;
        const fetchMetrics = async () => {
            try {
                const res = await fetch(`http://localhost:3001/api/dashboard/metrics?timeFilter=${timeFilter}`, {
                    headers: { 'Authorization': `Bearer ${session.token}` }
                });
                const { data } = await res.json();
                if (data) setMetrics(data);
            } catch (err) {
                console.error("Failed to fetch real dashboard metrics:", err);
            }
        };
        fetchMetrics();
    }, [timeFilter, session]);

    // Fallback lists for UI rendering
    const filteredLeads = leads; 
    const filteredActivities = activities;

    const pendingMeetings = filteredActivities.filter(m => m.status === 'pending');
    const upcomingMeetings = filteredActivities.filter(m => m.status !== 'pending' && m.status !== 'cancelled').slice(0, 5); // show top 5

    const formatTimeAMPM = (timeStr: string) => {
        if (!timeStr) return '';
        if (timeStr.includes('AM') || timeStr.includes('PM')) return timeStr;
        const [h, m] = timeStr.split(':');
        if (!h || !m) return timeStr;
        let hours = parseInt(h, 10);
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12 || 12;
        return `${hours}:${m} ${ampm}`;
    };

    const handleApprove = async (id: string, meetingTitle: string, attendeeName: string, date: string, time: string) => {
        try {
            const lead = leads.find(l => l.name === attendeeName);
            const phone = lead?.phone;

            const response = await fetch(`http://localhost:3001/api/activities/${id}/approve`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${session.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ phone, attendeeName, meetingTitle, date, time })
            });

            if (response.ok && refreshActivities) {
                alert(`Meeting "${meetingTitle}" confirmed! A WhatsApp message has been successfully triggered to the lead.`);
                refreshActivities();
            } else if (response.ok) {
                alert('Meeting confirmed, but there was an issue sending the WhatsApp message.');
            }
        } catch (e) {
            console.error("Failed to approve activity:", e);
        }
    };

    const handleDecline = async (id: string) => {
        if (!window.confirm("Are you sure you want to decline this AI meeting request?")) return;
        try {
            const response = await fetch(`http://localhost:3001/api/activities/${id}/decline`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${session.token}` }
            });
            if (response.ok && refreshActivities) {
                refreshActivities();
            }
        } catch (e) {
            console.error("Failed to decline activity:", e);
        }
    };

    const stats = [
        { label: 'Total Leads', value: metrics.totalLeads, change: metrics.totalLeads > 0 ? 'Active' : '0', icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
        { label: 'Active Deals', value: metrics.activeDeals, change: metrics.activeDeals > 0 ? 'Active' : '0', icon: Briefcase, color: 'text-indigo-600', bg: 'bg-indigo-50' },
        { label: 'Meetings', value: metrics.totalMeetings, change: metrics.totalMeetings > 0 ? 'Active' : '0', icon: Calendar, color: 'text-purple-600', bg: 'bg-purple-50' },
        { label: 'Revenue', value: `₹ ${metrics.revenue.toLocaleString()}`, change: metrics.revenue > 0 ? 'Growing' : '0', icon: BarChart3, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    ];

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Welcome back, {session.user.name}</h2>
                    <p className="text-slate-500">Here's what's happening with your pipeline today.</p>
                </div>
                <div className="flex gap-3 relative">
                    <div className="relative">
                        <div onClick={() => setIsFilterOpen(!isFilterOpen)}>
                            <Button variant="outline" icon={<Filter className="w-4 h-4" />}>Filter: {timeFilter}</Button>
                        </div>
                        {isFilterOpen && (
                            <div className="absolute right-0 mt-2 w-48 bg-white/90 backdrop-blur-xl border border-slate-200 shadow-xl rounded-xl p-2 z-50 animate-fade-in">
                                {['Today', 'This Week', 'This Month', 'This Year', 'All Time'].map(opt => (
                                    <button 
                                        key={opt}
                                        onClick={() => { setTimeFilter(opt); setIsFilterOpen(false); }}
                                        className={`w-full text-left px-4 py-2 text-sm rounded-lg hover:bg-indigo-50 transition-colors ${timeFilter === opt ? 'text-indigo-600 font-bold bg-indigo-50/50' : 'text-slate-600'}`}
                                    >
                                        {opt}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <div onClick={() => setIsWidgetModalOpen(true)}>
                        <Button icon={<Plus className="w-4 h-4" />}>Add Widget</Button>
                    </div>
                </div>
            </div>

            {/* QUICK ACTIONS BAR - Strongly emphasizing "Operation" over "Analytics" */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl shadow-lg p-1 animate-fade-in">
                <div className="bg-white/95 backdrop-blur-xl rounded-xl p-3 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-2 hidden md:block">Quick Actions:</span>
                        <Button className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-md hover:shadow-lg transition-all rounded-xl px-5" icon={<Plus className="w-4 h-4" />}>
                            Add New Lead
                        </Button>
                        <Button variant="outline" className="rounded-xl bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700" icon={<Phone className="w-4 h-4 text-indigo-500" />}>
                            Log a Call
                        </Button>
                        <Button variant="outline" className="rounded-xl bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700" icon={<Calendar className="w-4 h-4 text-purple-500" />}>
                            Schedule Meeting
                        </Button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat, i) => (
                    <div key={i} className="bg-white/80 backdrop-blur-xl p-6 rounded-xl border border-white/40 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                        <div className="flex items-center justify-between mb-4">
                            <div className={`p-3 rounded-lg ${stat.bg}`}>
                                <stat.icon className={`w-6 h-6 ${stat.color}`} />
                            </div>
                            <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">{stat.change}</span>
                        </div>
                        <p className="text-slate-500 text-sm font-medium">{stat.label}</p>
                        <h3 className="text-2xl font-bold text-slate-800 mt-1">{stat.value}</h3>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white/80 backdrop-blur-xl p-6 rounded-xl border border-white/40 shadow-sm hover:shadow-lg transition-all duration-300">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-bold text-slate-800">Recent Leads</h3>
                        <Button variant="ghost" size="sm" className="text-indigo-600">View All</Button>
                    </div>
                    <div className="space-y-4">
                        {filteredLeads.length > 0 ? (
                            filteredLeads.slice(0, 3).map(lead => (
                                <div key={lead.id} className="flex items-center justify-between p-4 rounded-lg bg-slate-50/50 border border-slate-100 hover:-translate-y-0.5 hover:shadow-sm transition-all duration-300">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold">
                                            {lead.name?.charAt(0) || '?'}
                                        </div>
                                        <div>
                                            <h4 className="font-semibold text-slate-800 text-sm">{lead.name || 'Unknown Lead'}</h4>
                                            <p className="text-xs text-slate-500">{lead.company || 'No Company'}</p>
                                        </div>
                                    </div>
                                    <div className="text-right flex flex-col items-end gap-2">
                                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${lead.score === 'Hot' ? 'bg-red-100 text-red-600' : lead.score === 'Warm' ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-600'}`}>
                                            {lead.score || 'Cold'}
                                        </span>
                                        <button className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded-md transition-colors border border-indigo-100/50">
                                            <MessageCircle className="w-3 h-3" /> Connect
                                        </button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="p-8 text-center text-slate-400 text-sm">
                                No leads captured yet
                            </div>
                        )}
                    </div>
                </div>

                <div className="bg-white/80 backdrop-blur-xl p-6 rounded-xl border border-white/40 shadow-sm flex flex-col h-full hover:shadow-lg transition-all duration-300">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-bold text-slate-800">
                            Upcoming / Pending Meetings
                            {pendingMeetings.length > 0 && (
                                <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold leading-none text-orange-100 bg-orange-500 rounded-full">
                                    {pendingMeetings.length} New
                                </span>
                            )}
                        </h3>
                        <Button variant="ghost" size="sm" className="text-indigo-600">View Calendar</Button>
                    </div>
                    <div className="space-y-4 flex-1">

                        {/* Show Pending Approvals first */}
                        {pendingMeetings.map(meeting => (
                            <div key={meeting.id} className="flex flex-col gap-3 p-4 rounded-lg border border-orange-200/60 bg-orange-50/60 relative hover:-translate-y-1 shadow-[0_0_15px_rgba(249,115,22,0.15)] hover:shadow-[0_0_20px_rgba(249,115,22,0.3)] transition-all duration-300">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1 text-orange-600 font-bold text-xs">
                                            <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse shadow-[0_0_8px_rgba(249,115,22,0.8)]"></div>
                                            AI Booking Request
                                        </div>
                                        <h4 className="font-bold text-slate-800 text-sm">{meeting.title || 'Untitled Meeting'}</h4>
                                        <p className="text-xs text-slate-500 font-medium">with {meeting.attendee || 'Guest'}</p>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-sm font-bold text-slate-700">{meeting.date || 'No Date'}</div>
                                        <div className="text-xs text-slate-500">{meeting.time ? formatTimeAMPM(meeting.time) : '--:--'}</div>
                                    </div>
                                </div>
                                <div className="flex gap-2 mt-2">
                                    <button
                                        onClick={() => handleApprove(meeting.id, meeting.title, meeting.attendee, meeting.date, meeting.time)}
                                        className="flex-1 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold rounded-md transition-colors shadow-sm"
                                    >
                                        Approve
                                    </button>
                                    <button
                                        onClick={() => handleDecline(meeting.id)}
                                        className="flex-1 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold rounded-md transition-colors"
                                    >
                                        Decline
                                    </button>
                                </div>
                            </div>
                        ))}

                        {/* Standard Upcoming Meetings */}
                        {upcomingMeetings.map(meeting => (
                            <div key={meeting.id} className="flex items-start gap-4 p-4 rounded-lg border-l-4 border-indigo-500 bg-indigo-50/30 hover:-translate-y-0.5 hover:shadow-sm transition-all duration-300">
                                <div className="flex flex-col items-center justify-center min-w-[4rem] text-center border-r border-indigo-100 pr-3">
                                    <span className="text-xs font-bold text-slate-500 uppercase">{(meeting.date || '?? ??').split(' ')[0]}</span>
                                    <span className="text-sm font-bold text-indigo-600 whitespace-nowrap">{meeting.time ? formatTimeAMPM(meeting.time).split(' ')[0] : '--:--'}</span>
                                    <span className="text-[10px] font-bold text-slate-400">{meeting.time ? (formatTimeAMPM(meeting.time).split(' ')[1] || '') : ''}</span>
                                </div>
                                <div>
                                    <h4 className="font-bold text-slate-800 text-sm">{meeting.title || 'Untitled Meeting'}</h4>
                                    <p className="text-xs text-slate-600 font-medium mt-0.5">with {meeting.attendee || 'Guest'}</p>
                                    <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-500">
                                        <div className={`w-1.5 h-1.5 rounded-full ${(meeting.type || 'Meeting').toLowerCase().includes('zoom') ? 'bg-blue-400' : 'bg-green-400'}`}></div>
                                        {meeting.type || 'Meeting'}
                                    </div>
                                </div>
                            </div>
                        ))}

                        {filteredActivities.length === 0 && (
                            <div className="p-8 text-center text-slate-400 text-sm">
                                No meetings scheduled.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Render Active Widgets */}
            {activeWidgets.includes('lead_sources') && (
                <div className="bg-white/80 backdrop-blur-xl p-6 rounded-xl border border-white/40 shadow-sm hover:shadow-lg transition-all duration-300 mt-8 animate-fade-in">
                    <h3 className="font-bold text-slate-800 mb-4">Lead Sources Breakdown</h3>
                    <div className="flex gap-4 flex-col sm:flex-row">
                        {metrics.leadSources.length > 0 ? (
                            metrics.leadSources.slice(0, 3).map((src, i) => (
                                <div key={src.name} className={`flex-1 p-4 rounded-lg border text-center ${i === 0 ? 'bg-blue-50/50 border-blue-100' : i === 1 ? 'bg-indigo-50/50 border-indigo-100' : 'bg-emerald-50/50 border-emerald-100'}`}>
                                    <div className={`text-2xl font-bold ${i === 0 ? 'text-blue-600' : i === 1 ? 'text-indigo-600' : 'text-emerald-600'}`}>{src.percentage}%</div>
                                    <div className="text-xs text-slate-500 font-medium">{src.name}</div>
                                </div>
                            ))
                        ) : (
                            <div className="text-sm text-slate-400 p-4 text-center w-full">No sources tracked yet.</div>
                        )}
                    </div>
                </div>
            )}

            {/* Widget Modal */}
            {isWidgetModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white/95 backdrop-blur-xl border border-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="font-bold text-lg text-slate-800">Add Widgets</h3>
                            <button onClick={() => setIsWidgetModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">&times;</button>
                        </div>
                        <div className="p-6 space-y-4">
                            {[
                                { id: 'lead_sources', name: 'Lead Sources Breakdown', desc: 'Shows where your leads are coming from.' },
                                { id: 'ai_performance', name: 'AI Performance Metrics', desc: 'Tracks messages handled by AI (Coming Soon).' }
                            ].map(widget => {
                                const isActive = activeWidgets.includes(widget.id);
                                return (
                                    <div key={widget.id} className="flex items-center justify-between p-4 rounded-xl border border-slate-100 bg-slate-50/50">
                                        <div>
                                            <h4 className="font-semibold text-sm text-slate-800">{widget.name}</h4>
                                            <p className="text-xs text-slate-500 mt-1">{widget.desc}</p>
                                        </div>
                                        <button 
                                            onClick={() => {
                                                if (widget.id === 'ai_performance') { alert("This widget is in development."); return; }
                                                if (isActive) setActiveWidgets(prev => prev.filter(w => w !== widget.id));
                                                else setActiveWidgets(prev => [...prev, widget.id]);
                                            }}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isActive ? 'bg-emerald-500' : 'bg-slate-300'}`}
                                        >
                                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isActive ? 'translate-x-6' : 'translate-x-1'}`} />
                                        </button>
                                    </div>
                                )
                            })}
                        </div>
                        <div className="p-6 bg-slate-50 border-t border-slate-100">
                            <Button className="w-full" onClick={() => setIsWidgetModalOpen(false)}>Done</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
