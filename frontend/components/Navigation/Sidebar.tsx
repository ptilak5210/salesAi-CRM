import React from 'react';
import { LayoutDashboard, Users, MessageSquare, Zap, Calendar, BarChart3, PieChart, Settings, Briefcase, LogOut } from 'lucide-react';

export const Sidebar = ({ currentView, onChangeView, onLogout, user }: any) => {
    const navItems = [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'leads', label: 'Leads', icon: Users },
        { id: 'inbox', label: 'Inbox', icon: MessageSquare },
        { id: 'automation', label: 'Automation', icon: Zap },
        { id: 'meetings', label: 'Meetings', icon: Calendar },
        { id: 'deals', label: 'Deals', icon: BarChart3 },
        { id: 'analytics', label: 'Analytics', icon: PieChart },
        { id: 'settings', label: 'Settings', icon: Settings },
    ];

    return (
        <aside className="hidden md:flex flex-col w-64 bg-slate-900 h-screen fixed left-0 top-0 border-r border-slate-800 text-slate-300 transition-all duration-300">
            <div className="p-6 flex items-center gap-3 text-white font-display font-bold text-xl tracking-tight border-b border-slate-800/50">
                <div className="p-2 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg shadow-lg shadow-cyan-500/20">
                    <Briefcase className="w-5 h-5 text-white" />
                </div>
                SalesAI
            </div>

            <div className="flex-1 overflow-y-auto py-6 px-4 space-y-1">
                <p className="px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Main Menu</p>
                {navItems.map((item) => (
                    <button
                        key={item.id}
                        type="button"
                        onClick={() => onChangeView(item.id)}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 group ${currentView === item.id
                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                            : 'hover:bg-slate-800 hover:text-white'
                            }`}
                    >
                        <item.icon className={`w-5 h-5 ${currentView === item.id ? 'text-white' : 'text-slate-400 group-hover:text-white'}`} />
                        {item.label}
                    </button>
                ))}
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-900/50">
                <div className="flex items-center gap-3 px-2 mb-4">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-inner text-sm">
                        {user.name.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-white truncate">{user.name}</p>
                        <p className="text-xs text-slate-500 truncate">{user.email}</p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={onLogout}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 rounded-lg transition-colors"
                >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                </button>
            </div>
        </aside>
    );
};
