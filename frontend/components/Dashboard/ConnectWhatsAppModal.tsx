import React, { useState, useEffect } from 'react';
import { MessageCircle, Loader2, CheckCircle2, ShieldCheck, X, Zap, RefreshCw } from 'lucide-react';
import {
    getWhatsAppCredentials,
    initWhatsAppSocket,
    disconnectWhatsApp
} from '../../services/whatsappService';
import { AuthSession } from '../../../utils/types';

interface ConnectWhatsAppModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    session: AuthSession;
}

export const ConnectWhatsAppModal = ({ isOpen, onClose, onSuccess, session }: ConnectWhatsAppModalProps) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [isConnected, setIsConnected] = useState(false);

    // QR Code State
    const [qrCode, setQrCode] = useState<string | null>(null);
    const [isGeneratingQr, setIsGeneratingQr] = useState(false);
    const [qrTimeLeft, setQrTimeLeft] = useState<number>(0);
    const [qrExpired, setQrExpired] = useState(false);

    // Countdown timer for QR code
    useEffect(() => {
        if (!qrCode) return;
        setQrTimeLeft(60);
        setQrExpired(false);
        const interval = setInterval(() => {
            setQrTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(interval);
                    setQrExpired(true);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(interval);
    }, [qrCode]);

    // Fetch current status on mount
    useEffect(() => {
        if (isOpen) {
            checkStatus();
        }
    }, [isOpen]);

    const checkStatus = async () => {
        try {
            const creds = await getWhatsAppCredentials(session.token);
            if (creds && creds.is_connected) {
                setIsConnected(true);
            }
        } catch (e) {
            console.error(e);
        }
    };

    const handleGenerateQR = () => {
        setError('');
        setSuccessMsg('');
        setIsGeneratingQr(true);
        setQrCode(null);

        initWhatsAppSocket(session.user.id, {
            onQr: (qr) => {
                setQrCode(qr);
                setIsGeneratingQr(false);
            },
            onConnected: () => {
                setIsConnected(true);
                setSuccessMsg('WhatsApp connected successfully!');
                setQrCode(null);
                onSuccess();
            },
            onDisconnected: () => {
                setIsConnected(false);
                setQrCode(null);
                setIsGeneratingQr(false);
                setError('WhatsApp session disconnected. Please try again.');
            },
            onError: (msg) => {
                setError(msg);
                setIsGeneratingQr(false);
            },
            onMessage: () => {
                // Handle test message if needed
            }
        });
    };

    const handleDisconnect = async () => {
        if (confirm('Are you sure you want to disconnect WhatsApp? All automated messaging will stop.')) {
            setLoading(true);
            try {
                await disconnectWhatsApp(session.token);
                setIsConnected(false);
                setQrCode(null);
                setSuccessMsg('WhatsApp disconnected successfully.');
            } catch (err: any) {
                setError('Failed to disconnect. ' + err.message);
            } finally {
                setLoading(false);
            }
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-[480px] overflow-hidden flex flex-col relative animate-in zoom-in-95 duration-200">
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

                {/* Header Section */}
                <div className="flex flex-col items-center pt-10 pb-6 px-8 w-full border-b border-slate-50">
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-lg transition-all ${isConnected ? 'bg-green-500 text-white' : 'bg-[#21c25e] text-white'}`}>
                        <MessageCircle className="w-8 h-8" />
                    </div>
                    <h2 className="text-2xl font-extrabold text-[#1a2332] tracking-tight font-display mb-1">
                        {isConnected ? 'WhatsApp Active' : 'Connect WhatsApp'}
                    </h2>
                    <p className="text-slate-500 text-sm font-medium text-center">
                        {isConnected ? 'Your CRM is now linked to your WhatsApp' : 'Scan the QR code to link your account'}
                    </p>
                </div>

                {/* Body */}
                <div className="p-8 overflow-y-auto max-h-[70vh]">
                    {error && (
                        <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-xl text-sm border border-red-100 flex flex-col gap-3">
                            <div className="flex items-start gap-2">
                                <strong className="font-bold whitespace-nowrap">Error:</strong> {error}
                            </div>
                            <button
                                onClick={handleDisconnect}
                                className="text-[10px] uppercase tracking-widest font-bold text-red-700 hover:text-red-900 bg-red-100/50 hover:bg-red-100 py-2 px-3 rounded-lg w-fit transition-all"
                            >
                                Force Disconnect & Reset
                            </button>
                        </div>
                    )}

                    {successMsg && (
                        <div className="mb-6 p-4 bg-green-50 text-green-700 rounded-xl text-sm border border-green-100 flex items-center gap-2">
                            <CheckCircle2 className="w-5 h-5 text-green-500" />
                            {successMsg}
                        </div>
                    )}

                    <div className="space-y-6">
                        {isConnected ? (
                            <div className="bg-green-50/50 border border-green-100 rounded-xl p-6 flex flex-col items-center justify-center gap-3 text-center">
                                <CheckCircle2 className="w-12 h-12 text-green-500 mb-2" />
                                <h3 className="text-lg font-bold text-green-800">WhatsApp is Active</h3>
                                <p className="text-sm text-green-700/80 font-medium px-4">
                                    Your WhatsApp account is successfully linked. You can now receive messages and use AI auto-replies.
                                </p>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center w-full">
                                {qrCode ? (
                                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 shadow-inner flex flex-col items-center w-full relative">
                                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-4">Scan with WhatsApp</h3>
                                        <div className="relative bg-white p-2 rounded-xl border-2 border-[#21c25e]/20 shadow-sm overflow-hidden">
                                            <img src={qrCode} alt="WhatsApp QR Code" className={`w-48 h-48 transition-all duration-300 ${qrExpired ? 'blur-sm opacity-40' : ''}`} />
                                            {/* Scanning animation overlay (only when active) */}
                                            {!qrExpired && <div className="absolute top-0 left-0 w-full h-full bg-[#21c25e]/10 animate-pulse mix-blend-overlay pointer-events-none" />}
                                            {/* Expired overlay */}
                                            {qrExpired && (
                                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/70 backdrop-blur-sm rounded-xl">
                                                    <RefreshCw className="w-8 h-8 text-slate-400 mb-2" />
                                                    <span className="text-xs font-bold text-slate-500 text-center">QR Code Expired<br />Click Refresh</span>
                                                </div>
                                            )}
                                        </div>
                                        {/* Countdown timer */}
                                        {!qrExpired ? (
                                            <div className="mt-4 flex items-center gap-2">
                                                <div className={`w-2 h-2 rounded-full animate-pulse ${qrTimeLeft <= 15 ? 'bg-red-500' : 'bg-green-500'}`} />
                                                <span className={`text-xs font-bold ${qrTimeLeft <= 15 ? 'text-red-500' : 'text-slate-500'}`}>
                                                    Expires in {qrTimeLeft}s
                                                </span>
                                            </div>
                                        ) : (
                                            <button onClick={handleGenerateQR} className="mt-4 flex items-center gap-2 bg-[#21c25e] text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-[#1da851] transition-all">
                                                <RefreshCw className="w-4 h-4" /> Generate New QR
                                            </button>
                                        )}
                                        <p className="text-[11px] text-slate-400 font-medium text-center mt-3">
                                            Open WhatsApp on your phone &gt; Settings &gt; Linked Devices &gt; Link a Device
                                        </p>
                                    </div>
                                ) : (
                                    <div className="w-full flex flex-col items-center gap-6">
                                        <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-4 flex items-start gap-3 w-full">
                                            <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                                            <div className="text-xs text-emerald-800 leading-relaxed font-medium">
                                                <p className="mb-1"><strong>Unofficial API Note:</strong></p>
                                                <p>This will connect your personal WhatsApp number by acting as a WhatsApp Web session. Keep your phone connected to the internet.</p>
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={handleGenerateQR}
                                            disabled={isGeneratingQr}
                                            className="w-full flex items-center justify-center gap-2 bg-[#21c25e] hover:bg-[#1da851] text-white px-6 py-4 rounded-xl font-bold text-sm uppercase tracking-wider transition-all shadow-lg hover:shadow-xl active:scale-[0.98] disabled:opacity-70"
                                        >
                                            {isGeneratingQr ? (
                                                <>
                                                    <Loader2 className="w-5 h-5 animate-spin" />
                                                    Generating QR...
                                                </>
                                            ) : (
                                                <>
                                                    <Zap className="w-5 h-5" />
                                                    Generate QR Code
                                                </>
                                            )}
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Actions */}
                        <div className="pt-4 border-t border-slate-50 mt-4">
                            {isConnected ? (
                                <button
                                    type="button"
                                    onClick={handleDisconnect}
                                    disabled={loading}
                                    className="w-full flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 text-red-500 px-6 py-3 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all border border-red-100 disabled:opacity-50"
                                >
                                    {loading ? <Loader2 className="w-4 h-4 animate-spin text-red-300" /> : null}
                                    Disconnect WhatsApp
                                </button>
                            ) : (
                                qrCode ? (
                                    <button
                                        type="button"
                                        onClick={handleGenerateQR}
                                        className="w-full flex items-center justify-center gap-2 py-4 text-slate-500 font-bold text-xs uppercase tracking-wider hover:bg-slate-50 rounded-xl transition-all"
                                    >
                                        <RefreshCw className="w-4 h-4" />
                                        Refresh QR Code
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={onClose}
                                        className="w-full py-4 text-slate-500 font-bold text-sm uppercase tracking-wider hover:bg-slate-50 rounded-xl transition-all"
                                    >
                                        Cancel
                                    </button>
                                )
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
