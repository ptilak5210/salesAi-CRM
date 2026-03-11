import React, { useState, useEffect } from 'react';
import { Facebook, Instagram, ArrowRight, Briefcase, Zap, X } from 'lucide-react';

interface ConnectMetaModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    userId?: string; // To use user-specific localStorage key
}

declare global {
    interface Window {
        FB: any;
        fbAsyncInit: () => void;
    }
}

export const ConnectMetaModal = ({ isOpen, onClose, onSuccess, userId }: ConnectMetaModalProps) => {
    const metaKey = userId ? `metaConnected_${userId}` : 'metaConnected';
    const [isConnecting, setIsConnecting] = useState(false);
    const [isConnected, setIsConnected] = useState(localStorage.getItem(metaKey) === 'true');
    const [error, setError] = useState<string | null>(null);

    // Keep state in sync with localStorage when modal opens
    useEffect(() => {
        if (isOpen) {
            setIsConnected(localStorage.getItem(metaKey) === 'true');
        }
    }, [isOpen, metaKey]);

    if (!isOpen) return null;

    const handleConnect = () => {
        setError(null);

        // Wait up to 5 seconds for FB SDK to load
        const tryLogin = (attempt: number) => {
            if (!window.FB) {
                if (attempt < 5) {
                    setTimeout(() => tryLogin(attempt + 1), 1000);
                } else {
                    setError('Facebook SDK load nahi hua. Page refresh karein aur dubara try karein.');
                }
                return;
            }

            setIsConnecting(true);

            const timeoutId = setTimeout(() => {
                setIsConnecting(false);
                setError('Connection timeout. Dubara try karein.');
            }, 30000);

            window.FB.login((response: any) => {
                clearTimeout(timeoutId);
                setIsConnecting(false);
                console.log('[Meta] FB.login response:', response);
                if (response.authResponse) {
                    console.log('[Meta] Connection Successful:', response);
                    localStorage.setItem(metaKey, 'true');
                    setIsConnected(true);
                    onSuccess();
                } else {
                    const status = response.status;
                    if (status !== 'unknown') {
                        setError('Login cancel ho gaya ya permission nahi mili. Dubara try karein.');
                    }
                    console.log('[Meta] User cancelled or denied. Status:', status);
                }
            }, {
                config_id: '1457401106035702', // SalesAI Login configuration
                response_type: 'code',
                override_default_response_type: true,
                auth_type: 'rerequest'
            });
        };

        tryLogin(0);
    };

    const handleDisconnect = () => {
        if (window.confirm("Are you sure you want to disconnect your Facebook & Instagram accounts? You will stop receiving leads.")) {
            localStorage.removeItem(metaKey);
            setIsConnected(false);
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-[440px] overflow-hidden flex flex-col relative">

                {/* Close Button */}
                <button
                    type="button"
                    onClick={onClose}
                    title="Close"
                    aria-label="Close"
                    className="absolute top-5 right-5 z-20 p-2 bg-slate-100/50 hover:bg-slate-100 rounded-full text-slate-500 hover:text-slate-700 transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="flex flex-col items-center pt-10 pb-8 px-6 w-full relative">
                    {/* Graphics Area */}
                    <div className="relative w-[280px] h-[160px] mb-8 flex items-center justify-center">
                        <div className="absolute inset-0 bg-[#EAF5F8] rounded-[60px] transform -rotate-6 w-[260px] h-[150px] translate-x-3 -z-10 meta-blob"></div>

                        <div className="flex items-center gap-5 z-10">
                            <div className="flex flex-col gap-3">
                                <div className="w-[48px] h-[48px] bg-[#1877F2] rounded-full flex items-center justify-center shadow-lg border-[3px] border-white">
                                    <Facebook className="w-6 h-6 text-white" fill="currentColor" />
                                </div>
                                <div className="w-[48px] h-[48px] bg-gradient-to-tr from-[#FD1D1D] via-[#E1306C] to-[#833AB4] rounded-full flex items-center justify-center shadow-lg border-[3px] border-white">
                                    <Instagram className="w-6 h-6 text-white" />
                                </div>
                            </div>
                            <ArrowRight className="w-7 h-7 text-slate-700 mx-1" strokeWidth={3} />
                            <div className="w-[64px] h-[64px] bg-gradient-to-br from-[#E2B0FF] to-[#9F7AEA] rounded-2xl flex items-center justify-center shadow-xl border-[3px] border-white text-white">
                                <Briefcase className="w-8 h-8" />
                            </div>
                        </div>
                    </div>

                    {/* Typography */}
                    <h1 className="text-[28px] font-extrabold text-[#1a2332] leading-[1.2] mb-4 tracking-tight font-display text-center">
                        {isConnected ? 'Meta Integration Active' : 'Connect Facebook Lead Ads'}
                    </h1>

                    <p className="text-[#4b5563] text-[15px] leading-relaxed mb-8 text-center px-4">
                        {isConnected
                            ? 'Your Facebook and Instagram accounts are successfully linked to SalesAI. Your leads are being synced in real-time.'
                            : 'Get instant alerts of new leads, and contact them within seconds via WhatsApp, SMS, phone call, or email.'
                        }
                    </p>

                    {/* Error Message */}
                    {error && (
                        <div className="w-full mb-4 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600 text-center">
                            ⚠️ {error}
                        </div>
                    )}

                    {/* Actions */}
                    <div className="w-full space-y-3">
                        {isConnected ? (
                            <button
                                type="button"
                                onClick={handleDisconnect}
                                className="w-full bg-red-50 hover:bg-red-100 text-red-600 py-4 rounded-lg font-bold text-[14px] uppercase tracking-wider transition-colors flex items-center justify-center gap-2 border border-red-100"
                            >
                                DISCONNECT ACCOUNT
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={handleConnect}
                                disabled={isConnecting}
                                className="w-full bg-[#1ab0c6] hover:bg-[#159cb0] text-white py-4 rounded-lg font-bold text-[14px] uppercase tracking-wider transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-80 disabled:cursor-not-allowed"
                            >
                                {isConnecting ? <Zap className="w-5 h-5 animate-pulse" /> : <Facebook className="w-5 h-5" fill="currentColor" />}
                                {isConnecting ? 'CONNECTING...' : 'CONNECT ACCOUNT'}
                            </button>
                        )}

                        <button
                            type="button"
                            onClick={onClose}
                            className="w-full text-[#2c8fa2] hover:text-[#1d7485] hover:bg-[#f0f9fa] py-4 rounded-lg font-bold text-[14px] uppercase tracking-wider transition-colors bg-transparent border-none"
                        >
                            {isConnected ? 'CLOSE' : 'MAYBE LATER'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
