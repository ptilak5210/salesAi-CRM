import React, { useState, useEffect } from 'react';
import { 
    Smartphone, Shield, Power, RefreshCw, 
    CheckCircle2, AlertCircle, Clock, Bot, 
    MessageCircle, Loader2, QrCode
} from 'lucide-react';
import { getSessionStatus, createSession, logoutSession, SessionStatus } from '../../services/sessionService';
import { ConnectWhatsAppModal } from '../../components/Dashboard/ConnectWhatsAppModal';

export const SessionView = ({ session }: { session: any }) => {
    const [status, setStatus] = useState<SessionStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);

    useEffect(() => {
        fetchStatus();
        const interval = setInterval(fetchStatus, 10000); // Poll every 10s
        return () => clearInterval(interval);
    }, []);

    const fetchStatus = async () => {
        const data = await getSessionStatus();
        setStatus(data);
        setLoading(false);
    };

    const handleConnect = async () => {
        setIsConnectModalOpen(true);
    };

    const handleLogout = async () => {
        if (!window.confirm('Are you sure you want to disconnect WhatsApp? You will not be able to send or receive messages.')) return;
        setActionLoading(true);
        const res = await logoutSession();
        if (res.success) {
            fetchStatus();
        } else {
            alert('Logout failed: ' + res.error);
        }
        setActionLoading(false);
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
                <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
                <p className="text-slate-500 font-medium">Checking WhatsApp status...</p>
            </div>
        );
    }

    const isConnected = status?.socketActive || status?.dbConnected;
    const isActuallyLive = status?.socketActive;

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">WhatsApp Session</h1>
                    <p className="text-slate-500">Manage your connection to the WhatsApp network</p>
                </div>
                {isConnected ? (
                    <button 
                        onClick={handleLogout}
                        disabled={actionLoading}
                        className="flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2.5 rounded-xl font-semibold transition-all border border-red-200"
                    >
                        {actionLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Power className="w-5 h-5" />}
                        Disconnect WhatsApp
                    </button>
                ) : (
                    <button 
                        onClick={handleConnect}
                        className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-semibold transition-all shadow-lg shadow-indigo-200"
                    >
                        <QrCode className="w-5 h-5" />
                        Connect WhatsApp
                    </button>
                )}
            </div>

            {/* Status Card */}
            <div className={`p-8 rounded-3xl border ${isActuallyLive ? 'bg-emerald-50/30 border-emerald-100' : 'bg-slate-50 border-slate-200'} transition-all`}>
                <div className="flex flex-col md:flex-row items-center gap-8">
                    <div className={`w-24 h-24 rounded-3xl flex items-center justify-center shrink-0 shadow-sm ${isActuallyLive ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'}`}>
                        <Smartphone size={48} strokeWidth={1.5} />
                    </div>
                    <div className="flex-1 text-center md:text-left">
                        <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mb-2">
                            <h2 className="text-2xl font-bold text-slate-800">WhatsApp Multi-Device</h2>
                            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${isActuallyLive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                                <div className={`w-1.5 h-1.5 rounded-full ${isActuallyLive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                                {isActuallyLive ? 'Connected' : isConnected ? 'Disconnected (Stale)' : 'Offline'}
                            </span>
                        </div>
                        <p className="text-slate-600 max-w-lg">
                            {isActuallyLive 
                                ? 'Your WhatsApp account is active and ready to handle incoming leads. AI automation is monitoring your chats.'
                                : isConnected 
                                    ? 'A session exists but the background runner is idle. Click connect to restart the session.'
                                    : 'Connect your WhatsApp via QR code to enable real-time messaging and AI replies on your dashboard.'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                    <div className="flex items-center gap-3 text-indigo-600">
                        <Shield className="w-5 h-5" />
                        <h3 className="font-bold text-slate-800">Security</h3>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                        WhasApp Session uses end-to-end encryption. Your messages are sent directly from your paired device.
                    </p>
                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 bg-emerald-50 p-2 rounded-lg">
                        <CheckCircle2 className="w-4 h-4" />
                        End-to-end Encrypted
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                    <div className="flex items-center gap-3 text-indigo-600">
                        <Bot className="w-5 h-5" />
                        <h3 className="font-bold text-slate-800">AI Engagement</h3>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                        When enabled, Gemini AI will automatically respond to new leads and qualify them based on your settings.
                    </p>
                    <div className={`flex items-center gap-2 text-xs font-bold p-2 rounded-lg ${status?.aiEnabled ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400 bg-slate-50'}`}>
                        {status?.aiEnabled ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                        AI Status: {status?.aiEnabled ? 'Enabled' : 'Disabled'}
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                    <div className="flex items-center gap-3 text-indigo-600">
                        <Clock className="w-5 h-5" />
                        <h3 className="font-bold text-slate-800">Last Synced</h3>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                        Last time your session metadata was updated in our secure database.
                    </p>
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-600 bg-slate-50 p-2 rounded-lg">
                        <RefreshCw className="w-4 h-4" />
                        {status?.connectedSince ? new Date(status.connectedSince).toLocaleString() : 'Never'}
                    </div>
                </div>
            </div>

            {/* Re-use existing QR modal */}
            <ConnectWhatsAppModal 
                isOpen={isConnectModalOpen} 
                onClose={() => {
                    setIsConnectModalOpen(false);
                    fetchStatus();
                }} 
                onSuccess={() => {
                    setIsConnectModalOpen(false);
                    fetchStatus();
                }}
                session={session}
            />
        </div>
    );
};
