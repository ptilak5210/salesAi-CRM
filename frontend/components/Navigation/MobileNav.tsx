import React from 'react';
import { Home, Users, MessageSquare, PieChart, Settings, X, Briefcase, Zap, Calendar, BarChart3, LogOut } from 'lucide-react';

export const MobileBottomNav = ({ currentView, onChangeView }: any) => {
    const navItems = [
        { id: 'dashboard', label: 'Home', icon: Home },
        { id: 'leads', label: 'Leads', icon: Users },
        { id: 'inbox', label: 'Inbox', icon: MessageSquare },
        { id: 'analytics', label: 'Stats', icon: PieChart },
        { id: 'settings', label: 'Settings', icon: Settings },
    ];

    return (
        <div className="md:hidden fixed bottom-0 left-0 w-full bg-white border-t border-slate-200 z-40 pb-safe shadow-[0_-1px_3px_rgba(0,0,0,0.05)]">
            <div className="flex justify-around items-center h-16 px-1">
                {navItems.map((item) => (
                    <button
                        key={item.id}
                        type="button"
                        onClick={() => onChangeView(item.id)}
                        className={`flex flex-col items-center justify-center w-full h-full space-y-1 active:scale-95 transition-transform ${currentView === item.id ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'
                            }`}
                    >
                        <item.icon className={`w-6 h-6 ${currentView === item.id ? 'fill-current opacity-20' : ''}`} strokeWidth={currentView === item.id ? 2.5 : 2} />
                        <span className="text-[10px] font-medium">{item.label}</span>
                    </button>
                ))}
            </div>
        </div>
    );
};

export const MobileDrawer = ({ isOpen, onClose, currentView, onChangeView, onLogout, user }: any) => {
    if (!isOpen) return null;

    return (
        <div className="md:hidden fixed inset-0 z-50 flex">
            <div
                className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity animate-fade-in"
                onClick={onClose}
            ></div>

            <div className="relative w-[85%] max-w-xs bg-slate-900 h-full shadow-2xl flex flex-col animate-slide-in-left border-r border-slate-800">
                <div className="p-6 flex items-center justify-between border-b border-slate-800">
                    <div className="flex items-center gap-2 text-white font-display font-bold text-xl">
                        <div className="p-1.5 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg shadow-lg shadow-cyan-500/20"><Briefcase className="w-5 h-5 text-white" /></div>
                        SalesAI
                    </div>
                    <button type="button" onClick={onClose} aria-label="Close menu" className="text-slate-400 hover:text-white p-1">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto py-6 px-4">
                    <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-800/50 border border-slate-700 mb-8">
                        <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold shrink-0 shadow-inner">
                            {user.name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                            <p className="text-white font-medium text-sm truncate">{user.name}</p>
                            <p className="text-slate-500 text-xs truncate">{user.email}</p>
                        </div>
                        <div className="text-[10px] bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full uppercase font-bold tracking-wider">
                            {user.role}
                        </div>
                    </div>

                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 px-2">Menu</div>
                    <nav className="space-y-2">
                        {[
                            { id: 'automation', label: 'Automation', icon: Zap },
                            { id: 'meetings', label: 'Meetings', icon: Calendar },
                            { id: 'deals', label: 'Deals', icon: BarChart3 },
                        ].map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => { onChangeView(item.id); onClose(); }}
                                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all ${currentView === item.id
                                    ? 'bg-indigo-600/20 text-cyan-400 border border-indigo-500/20'
                                    : 'text-slate-300 hover:bg-slate-800'
                                    }`}
                            >
                                <item.icon className="w-5 h-5" />
                                {item.label}
                            </button>
                        ))}
                    </nav>
                </div>

                <div className="p-4 border-t border-slate-800 safe-bottom">
                    <button type="button" onClick={onLogout} className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-red-400 hover:bg-red-500/10 rounded-xl transition-colors">
                        <LogOut className="w-5 h-5" />
                        Sign Out
                    </button>
                </div>
            </div>
        </div>
    );
};
