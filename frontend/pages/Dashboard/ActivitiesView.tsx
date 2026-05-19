import React, { useState } from 'react';
import { Calendar as CalendarIcon, Clock, FileText, Plus, X, Video, Phone, MessageSquare, Edit2, Trash2 } from 'lucide-react';
import { AuthSession, Meeting, Lead } from '../../../utils/types';

interface ActivitiesViewProps {
    session: AuthSession;
    activities: Meeting[];
    leads: Lead[];
    refreshActivities: () => void;
}

export const ActivitiesView: React.FC<ActivitiesViewProps> = ({ session, activities, leads, refreshActivities }) => {
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
    const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    // Modal State
    const [searchLeadQuery, setSearchLeadQuery] = useState('');
    const [isLeadDropdownOpen, setIsLeadDropdownOpen] = useState(false);
    
    const [saveError, setSaveError] = useState<string | null>(null);
    const [newMeeting, setNewMeeting] = useState({
        title: '',
        attendee: '',
        date: new Date().toISOString().split('T')[0],
        time: '10:00 AM',
        type: 'Google Meet' as 'Google Meet' | 'Phone Call' | 'Office Visit' | 'Client Site Visit',
        agenda: ''
    });

    const openCreateModal = () => {
        setModalMode('create');
        setSelectedActivityId(null);
        setSaveError(null);
        setNewMeeting({
            title: '',
            attendee: leads.length > 0 ? leads[0].name : '',
            date: selectedDate.getFullYear() + '-' + String(selectedDate.getMonth() + 1).padStart(2, '0') + '-' + String(selectedDate.getDate()).padStart(2, '0'),
            time: '10:00 AM',
            type: 'Google Meet',
            agenda: ''
        });
        setSearchLeadQuery('');
        setIsLeadDropdownOpen(false);
        setIsModalOpen(true);
    };

    const openEditModal = (activity: Meeting) => {
        setModalMode('edit');
        setSelectedActivityId(activity.id);
        setSaveError(null);

        const dateObj = new Date(activity.date);
        const yyyyMMdd = !isNaN(dateObj.getTime()) ? dateObj.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

        // Keep time as-is if already in AM/PM format (matches dropdown options)
        // If stored as 24h, convert to AM/PM to match dropdown
        let timeAmPm = activity.time || '10:00 AM';
        if (timeAmPm && !timeAmPm.includes('AM') && !timeAmPm.includes('PM')) {
            // Convert HH:MM to "HH:MM AM/PM"
            const [hoursStr, minutes] = timeAmPm.split(':');
            const hoursNum = parseInt(hoursStr, 10);
            const ampm = hoursNum >= 12 ? 'PM' : 'AM';
            const hours12 = hoursNum % 12 || 12;
            timeAmPm = `${String(hours12).padStart(2, '0')}:${minutes} ${ampm}`;
        }

        setNewMeeting({
            title: activity.title || '',
            attendee: activity.attendee || '',
            date: yyyyMMdd,
            time: timeAmPm,
            type: activity.type as any,
            agenda: activity.agenda || ''
        });
        setSearchLeadQuery(activity.attendee || '');
        setIsLeadDropdownOpen(false);
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm("Are you sure you want to delete this activity?")) return;
        try {
            const response = await fetch(`http://localhost:3001/api/activities/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${session.token}` }
            });
            if (response.ok) {
                refreshActivities();
            }
        } catch (e) {
            console.error("Failed to delete activity:", e);
        }
    };

    const handleSaveMeeting = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setSaveError(null);

        const [year, month, day] = newMeeting.date.split('-');
        const dateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        const formattedDate = dateObj.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });

        // Time is already in "HH:MM AM/PM" format from the dropdown — send it as-is
        const timeToSend = newMeeting.time;

        const payload = {
            title: newMeeting.title || 'New Activity',
            attendee: newMeeting.attendee || 'Unknown Lead',
            date: formattedDate,
            time: timeToSend,
            type: newMeeting.type,
            agenda: newMeeting.agenda
        };

        try {
            const url = modalMode === 'edit'
                ? `http://localhost:3001/api/activities/${selectedActivityId}`
                : 'http://localhost:3001/api/activities';
            const method = modalMode === 'edit' ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.token}`
                },
                body: JSON.stringify(payload)
            });

            const json = await response.json();

            if (!response.ok) {
                // Server returned an error (4xx/5xx)
                setSaveError(json.error || 'Failed to save meeting. Please try again.');
                return;
            }

            // Success — both POST and PUT return { data: {...} }
            refreshActivities();
            setIsModalOpen(false);
        } catch (error) {
            console.error("Error saving activity", error);
            setSaveError('Network error. Please check your connection and try again.');
        } finally {
            setIsLoading(false);
        }
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

            if (response.ok) {
                alert(`Meeting "${meetingTitle}" confirmed! A WhatsApp message has been successfully triggered to the lead.`);
                refreshActivities();
            } else {
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
            if (response.ok) {
                refreshActivities();
            }
        } catch (e) {
            console.error("Failed to decline activity:", e);
        }
    };



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

    const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
    const currentMonth = selectedDate.getMonth();
    const currentYear = selectedDate.getFullYear();
    const daysInMonth = getDaysInMonth(currentYear, currentMonth);
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();

    const calendarDays = Array.from({ length: 42 }, (_, i) => {
        const dayNumber = i - firstDayOfMonth + 1;
        if (dayNumber > 0 && dayNumber <= daysInMonth) {
            return dayNumber;
        }
        return null;
    });

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const dayNames = ["M", "T", "W", "T", "F", "S", "S"];

    const isToday = (dateStr: string) => {
        if (dateStr === 'Today' && selectedDate.toDateString() === new Date().toDateString()) return true;
        if (dateStr === 'Tomorrow' && selectedDate.toDateString() === new Date(new Date().setDate(new Date().getDate() + 1)).toDateString()) return true;
        return dateStr === selectedDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    const pendingRequests = activities.filter(m => m.status === 'pending');
    const selectedDateMeetings = activities.filter(m => isToday(m.date) && m.status !== 'pending' && m.status !== 'cancelled');

    return (
        <div className="max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-gradient-to-r from-indigo-50/50 to-purple-50/50 rounded-2xl p-6 sm:p-8 mb-8 border border-white shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>

                <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-display font-bold text-slate-800 tracking-tight">Activity Timeline</h1>
                        <p className="text-slate-500 mt-2 text-sm sm:text-base max-w-2xl">
                            Track your scheduled meetings, calls, and follow-ups. Schedule new activities to stay on top of your deals.
                        </p>
                    </div>
                    <button
                        onClick={openCreateModal}
                        className="group relative inline-flex items-center gap-2 px-5 py-3 bg-slate-900 border border-transparent rounded-xl text-white text-sm font-medium hover:bg-slate-800 transition-all shadow-md hover:shadow-lg w-full sm:w-auto overflow-hidden"
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <Plus className="w-5 h-5 relative z-10" />
                        <span className="relative z-10">Book Meeting</span>
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                            <h3 className="font-semibold text-slate-800">{monthNames[currentMonth]} {currentYear}</h3>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setSelectedDate(new Date(currentYear, currentMonth - 1, 1))}
                                    className="p-1 hover:bg-slate-100 rounded text-slate-500"
                                >
                                    &lt;
                                </button>
                                <button
                                    onClick={() => setSelectedDate(new Date(currentYear, currentMonth + 1, 1))}
                                    className="p-1 hover:bg-slate-100 rounded text-slate-500"
                                >
                                    &gt;
                                </button>
                            </div>
                        </div>
                        <div className="p-4">
                            <div className="grid grid-cols-7 gap-1 mb-2 text-center text-xs font-semibold text-slate-400">
                                {dayNames.map((day, i) => <div key={i}>{day}</div>)}
                            </div>
                            <div className="grid grid-cols-7 gap-1 text-center text-sm">
                                {calendarDays.map((day, i) => {
                                    if (!day) return <div key={i} className="p-2"></div>;
                                    const isSelected = selectedDate.getDate() === day && selectedDate.getMonth() === currentMonth;
                                    const isRealToday = new Date().getDate() === day && new Date().getMonth() === currentMonth && new Date().getFullYear() === currentYear;

                                    return (
                                        <button
                                            key={i}
                                            onClick={() => setSelectedDate(new Date(currentYear, currentMonth, day))}
                                            className={`p-2 rounded-full w-8 h-8 mx-auto flex items-center justify-center transition-all ${isSelected ? 'bg-indigo-600 text-white font-bold shadow-md shadow-indigo-500/20'
                                                : isRealToday ? 'bg-indigo-50 text-indigo-600 font-bold'
                                                    : 'text-slate-700 hover:bg-slate-100'
                                                }`}
                                        >
                                            {day}
                                        </button>
                                    );
                                })}
                            </div>
                            <div className="mt-4 text-center">
                                <button
                                    onClick={() => setSelectedDate(new Date())}
                                    className="text-xs font-bold text-indigo-600 uppercase tracking-wider hover:text-indigo-800 transition-colors"
                                >
                                    Today
                                </button>
                            </div>
                        </div>
                    </div>


                </div>

                <div className="lg:col-span-3">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-slate-800">Timeline</h2>
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 min-h-[500px]">
                        <div className="relative">
                            {/* Pending AI Requests Section */}
                            {pendingRequests.length > 0 && (
                                <div className="mb-12">
                                    <div className="flex items-center gap-2 mb-4 pb-2 border-b border-orange-100">
                                        <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></div>
                                        <h3 className="text-sm font-bold text-orange-600 uppercase tracking-wider">
                                            Pending AI Requests ({pendingRequests.length})
                                        </h3>
                                    </div>
                                    <div className="space-y-4">
                                        {pendingRequests.map((meeting) => (
                                            <div key={meeting.id} className="bg-orange-50/50 border border-orange-200 rounded-xl p-4 shadow-sm relative">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div>
                                                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-orange-700 bg-orange-100/50 text-xs font-semibold border border-orange-200/50 mb-2">
                                                            Needs Approval
                                                        </span>
                                                        <h4 className="text-base font-bold text-slate-800">{meeting.title}</h4>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 gap-4 mt-3 mb-4 text-sm">
                                                    <div>
                                                        <p className="text-xs text-slate-500 mb-0.5">Attendee / Lead</p>
                                                        <p className="font-medium text-slate-800">{meeting.attendee}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-slate-500 mb-0.5">Proposed Time</p>
                                                        <p className="font-medium text-slate-800">{meeting.date} at {meeting.time}</p>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-3 pt-3 border-t border-orange-200/50">
                                                    <button
                                                        onClick={() => handleDecline(meeting.id)}
                                                        className="flex-1 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors"
                                                    >
                                                        Decline / Reschedule
                                                    </button>
                                                    <button
                                                        onClick={() => handleApprove(meeting.id, meeting.title, meeting.attendee, meeting.date, meeting.time)}
                                                        className="flex-1 px-3 py-1.5 text-xs font-semibold text-white bg-orange-500 hover:bg-orange-600 shadow-sm shadow-orange-500/20 rounded-lg transition-colors"
                                                    >
                                                        Approve
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="text-center text-sm text-slate-400 mb-8 border-b border-dashed border-slate-200 pb-4">
                                Beginning of timeline activities
                            </div>

                            <div className="mb-6">
                                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                                    {selectedDate.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}
                                </h3>
                            </div>

                            {selectedDateMeetings.length === 0 ? (
                                <div className="py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200 flex flex-col items-center justify-center text-center">
                                    <CalendarIcon className="w-12 h-12 text-slate-300 mb-4" />
                                    <p className="text-slate-500 font-medium">You don't have any activities on this day</p>
                                    <button
                                        onClick={openCreateModal}
                                        className="mt-4 text-sm font-medium text-indigo-600 hover:text-indigo-800"
                                    >
                                        + Book a Meeting
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-6 relative before:absolute before:inset-y-0 before:left-[19px] before:w-0.5 before:bg-slate-100">
                                    {selectedDateMeetings.map((meeting, index) => (
                                        <div key={meeting.id || index} className="relative flex gap-6 anim-fade-in group">
                                            <div className="w-10 h-10 rounded-full bg-indigo-50 border-4 border-white shadow-sm flex items-center justify-center flex-shrink-0 relative z-10 text-indigo-600">
                                                {meeting.type === 'Zoom' || meeting.type === 'Google Meet' ? <Video className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
                                            </div>
                                            <div className="flex-1 bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow group-hover:border-indigo-100 relative">
                                                <div className="absolute top-4 right-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => openEditModal(meeting)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors hover:text-indigo-600" title="Edit Meeting">
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => handleDelete(meeting.id)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors hover:text-red-500" title="Delete Meeting">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>

                                                <div className="flex justify-between items-start mb-2 pr-12">
                                                    <div>
                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 text-xs font-semibold mb-2">
                                                            <CalendarIcon className="w-3.5 h-3.5" /> Scheduled {meeting.type || 'Meeting'}
                                                        </span>
                                                        <h4 className="text-base font-bold text-slate-800">{meeting.title}</h4>
                                                    </div>
                                                    <div className="text-sm font-medium text-slate-500 flex items-center gap-1 mt-1">
                                                        <Clock className="w-4 h-4" /> {formatTimeAMPM(meeting.time)}
                                                    </div>
                                                </div>
                                                
                                                {meeting.agenda && (
                                                    <div className="mt-3 p-3 bg-slate-50 border border-slate-100 rounded-lg">
                                                        <p className="text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">Agenda / Notes</p>
                                                        <p className="text-sm text-slate-700 whitespace-pre-wrap">{meeting.agenda}</p>
                                                    </div>
                                                )}

                                                <div className="flex items-center gap-3 mt-4 pt-4 border-t border-slate-100">
                                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 text-white flex items-center justify-center text-xs font-bold">
                                                        {meeting.attendee ? meeting.attendee.charAt(0) : '?'}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-medium text-slate-700">With {meeting.attendee}</p>
                                                        <p className="text-xs text-slate-500">Lead • Priority</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="text-center text-sm text-slate-400 mt-12 pt-4 border-t border-dashed border-slate-200">
                                End of timeline activities
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
                    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={() => setIsModalOpen(false)} />

                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden relative z-10 transform transition-all animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <CalendarIcon className="w-5 h-5 text-indigo-600" />
                                {modalMode === 'edit' ? 'Reschedule / Edit Meeting' : 'Book New Meeting'}
                            </h2>
                            <button title="Close modal" onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-lg hover:bg-slate-100">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSaveMeeting} className="p-6 space-y-5">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Meeting Title</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. Discovery Call"
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400 text-slate-800 text-sm"
                                        value={newMeeting.title}
                                        onChange={(e) => setNewMeeting({ ...newMeeting, title: e.target.value })}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Attendee (Lead Name)</label>
                                    <div className="relative">
                                        <div 
                                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between cursor-pointer focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition-all text-slate-800 text-sm"
                                            onClick={() => setIsLeadDropdownOpen(!isLeadDropdownOpen)}
                                        >
                                            <span className={newMeeting.attendee ? 'text-slate-800' : 'text-slate-400'}>
                                                {newMeeting.attendee || 'Search and select a Lead...'}
                                            </span>
                                            <svg className={`w-4 h-4 text-slate-400 transition-transform ${isLeadDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                        </div>

                                        {isLeadDropdownOpen && (
                                            <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                                                <div className="p-2 border-b border-slate-100 bg-slate-50/50">
                                                    <input 
                                                        type="text" 
                                                        placeholder="Search by name or phone..." 
                                                        className="w-full px-3 py-1.5 text-sm text-slate-900 bg-white border border-slate-200 rounded-lg outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 placeholder:text-slate-400"
                                                        value={searchLeadQuery}
                                                        onChange={(e) => setSearchLeadQuery(e.target.value)}
                                                        autoFocus
                                                    />
                                                </div>
                                                <div className="overflow-y-auto">
                                                    {leads
                                                        .filter(l => 
                                                            l.name.toLowerCase().includes(searchLeadQuery.toLowerCase()) || 
                                                            l.company.toLowerCase().includes(searchLeadQuery.toLowerCase()) ||
                                                            (l.phone && l.phone.includes(searchLeadQuery))
                                                        )
                                                        .map(lead => (
                                                            <div 
                                                                key={lead.id} 
                                                                className={`px-4 py-2.5 text-sm cursor-pointer transition-colors ${newMeeting.attendee === lead.name ? 'bg-indigo-50 text-indigo-700 font-bold' : 'hover:bg-slate-50 text-slate-700'}`}
                                                                onClick={() => {
                                                                    setNewMeeting({ ...newMeeting, attendee: lead.name });
                                                                    setSearchLeadQuery('');
                                                                    setIsLeadDropdownOpen(false);
                                                                }}
                                                            >
                                                                <div className="font-medium">{lead.name}</div>
                                                                <div className="text-xs text-slate-400 mt-0.5">{lead.company}{lead.phone ? ` • ${lead.phone}` : ''}</div>
                                                            </div>
                                                        ))
                                                    }
                                                    {leads.filter(l => 
                                                        l.name.toLowerCase().includes(searchLeadQuery.toLowerCase()) || 
                                                        l.company.toLowerCase().includes(searchLeadQuery.toLowerCase()) ||
                                                        (l.phone && l.phone.includes(searchLeadQuery))
                                                    ).length === 0 && (
                                                        <div className="px-4 py-3 text-sm text-slate-500 text-center">No leads found.</div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Date</label>
                                        <input
                                            type="date"
                                            title="Meeting Date"
                                            required
                                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-slate-800 text-sm"
                                            value={newMeeting.date}
                                            onChange={(e) => setNewMeeting({ ...newMeeting, date: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Time</label>
                                        <div className="relative">
                                            <select
                                                title="Meeting Time"
                                                required
                                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-slate-800 text-sm appearance-none pr-10"
                                                value={newMeeting.time}
                                                onChange={(e) => setNewMeeting({ ...newMeeting, time: e.target.value })}
                                            >
                                                <option value="" disabled>Select Time</option>
                                                {/* Generate some common PM/AM times (e.g. 8 AM to 6 PM) */}
                                                {["08:00 AM", "08:30 AM", "09:00 AM", "09:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM", "12:00 PM", "12:30 PM", "01:00 PM", "01:30 PM", "02:00 PM", "02:30 PM", "03:00 PM", "03:30 PM", "04:00 PM", "04:30 PM", "05:00 PM", "05:30 PM", "06:00 PM"].map(t => (
                                                    <option key={t} value={t}>{t}</option>
                                                ))}
                                            </select>
                                            <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-slate-400">
                                                <Clock className="w-4 h-4" />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Meeting Type</label>
                                    <select
                                        title="Meeting Type"
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-slate-800 text-sm cursor-pointer appearance-none"
                                        value={newMeeting.type}
                                        onChange={(e) => setNewMeeting({ ...newMeeting, type: e.target.value as any })}
                                    >
                                        <option value="Google Meet">Google Meet</option>
                                        <option value="Phone Call">Phone Call</option>
                                        <option value="Office Visit">Office Visit</option>
                                        <option value="Client Site Visit">Client Site Visit</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Meeting Agenda / Notes (Optional)</label>
                                    <textarea
                                        rows={3}
                                        placeholder="Add discussion points, links, or notes for this meeting..."
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400 text-slate-800 text-sm resize-none"
                                        value={newMeeting.agenda}
                                        onChange={(e) => setNewMeeting({ ...newMeeting, agenda: e.target.value })}
                                    ></textarea>
                                </div>
                            </div>

                            {saveError && (
                                <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 font-medium">
                                    ⚠️ {saveError}
                                </div>
                            )}
                            <div className="pt-2 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 px-5 py-2.5 bg-white border border-slate-200 text-slate-600 text-sm font-semibold rounded-xl hover:bg-slate-50 hover:text-slate-800 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="flex-1 px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-500/20 disabled:opacity-50"
                                >
                                    {isLoading ? 'Saving...' : (modalMode === 'edit' ? 'Save Changes' : 'Schedule Meeting')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
