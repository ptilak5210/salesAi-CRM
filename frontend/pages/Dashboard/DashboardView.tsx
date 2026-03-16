import React from 'react';
import { Users, Briefcase, Calendar, BarChart3, Filter, Plus } from 'lucide-react';
import { Button } from '../../components/Button';
import { Deal, Lead, Meeting, AuthSession } from '../../../utils/types';

export const DashboardView = ({ session, leads, MOCK_DEALS, activities, refreshActivities }: { session: AuthSession, leads: Lead[], MOCK_DEALS: Deal[], activities: Meeting[], refreshActivities?: () => void }) => {

    // Filter activities
    const pendingMeetings = activities.filter(m => m.status === 'pending');
    const upcomingMeetings = activities.filter(m => m.status !== 'pending' && m.status !== 'cancelled').slice(0, 5); // show top 5

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
        { label: 'Total Leads', value: leads.length, change: '+12%', icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
        { label: 'Active Deals', value: MOCK_DEALS.length, change: '+5%', icon: Briefcase, color: 'text-indigo-600', bg: 'bg-indigo-50' },
        { label: 'Meetings', value: activities.length, change: '+2', icon: Calendar, color: 'text-purple-600', bg: 'bg-purple-50' },
        { label: 'Revenue', value: '$' + MOCK_DEALS.reduce((acc, d) => acc + d.amount, 0).toLocaleString(), change: '+18%', icon: BarChart3, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    ];

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Welcome back, {session.user.name}</h2>
                    <p className="text-slate-500">Here's what's happening with your pipeline today.</p>
                </div>
                <div className="flex gap-3">
                    <Button variant="outline" icon={<Filter className="w-4 h-4" />}>Filter</Button>
                    <Button icon={<Plus className="w-4 h-4" />}>Add Widget</Button>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat, i) => (
                    <div key={i} className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-4">
                            <div className={`p-3 rounded-lg ${stat.bg}`}>
                                <stat.icon className={`w-6 h-6 ${stat.color}`} />
                            </div>
                            <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">{stat.change}</span>
                        </div>
                        <p className="text-slate-500 text-sm font-medium">{stat.label}</p>
                        <h3 className="text-2xl font-bold text-slate-800 mt-1">{stat.value}</h3>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-bold text-slate-800">Recent Leads</h3>
                        <Button variant="ghost" size="sm" className="text-indigo-600">View All</Button>
                    </div>
                    <div className="space-y-4">
                        {leads.length > 0 ? (
                            leads.slice(0, 3).map(lead => (
                                <div key={lead.id} className="flex items-center justify-between p-4 rounded-lg bg-slate-50 border border-slate-100">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold">
                                            {lead.name?.charAt(0) || '?'}
                                        </div>
                                        <div>
                                            <h4 className="font-semibold text-slate-800 text-sm">{lead.name || 'Unknown Lead'}</h4>
                                            <p className="text-xs text-slate-500">{lead.company || 'No Company'}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${lead.score === 'Hot' ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'}`}>
                                            {lead.score || 'Cold'}
                                        </span>
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

                <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm flex flex-col h-full">
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
                            <div key={meeting.id} className="flex flex-col gap-3 p-4 rounded-lg border border-orange-200 bg-orange-50/50 relative">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1 text-orange-600 font-semibold text-xs">
                                            <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"></div>
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
                            <div key={meeting.id} className="flex items-start gap-4 p-4 rounded-lg border-l-4 border-indigo-500 bg-indigo-50/30">
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

                        {activities.length === 0 && (
                            <div className="p-8 text-center text-slate-400 text-sm">
                                No meetings scheduled.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
