import React, { useState, useEffect } from 'react';
import {
    Facebook, MessageCircle, Upload, Download, Smartphone, Zap, Settings, Share2, CheckCircle2, X
} from 'lucide-react';

import { ConnectWhatsAppModal } from '../../components/Dashboard/ConnectWhatsAppModal';
import { getWhatsAppCredentials, updateAutoReplyConfig } from '../../services/whatsappService';
import { AuthSession } from '../../../utils/types';

interface AutomationsViewProps {
    onOpenMetaModal: () => void;
    onWhatsAppSuccess: () => void;
    session: AuthSession;
}

const DEFAULT_AUTO_REPLY_TEXT = 'Thank you for your message! Our team will get back to you shortly.';

export const AutomationsView = ({ onOpenMetaModal, onWhatsAppSuccess, session }: AutomationsViewProps) => {
    const [activeTab, setActiveTab] = useState('Marketplace');
    const [whatsAppModalOpen, setWhatsAppModalOpen] = useState(false);
    const [autoReplyModalOpen, setAutoReplyModalOpen] = useState(false);
    const [isMetaConnected, setIsMetaConnected] = useState(localStorage.getItem('metaConnected') === 'true');
    const [isWhatsAppConnected, setIsWhatsAppConnected] = useState(false);
    const [aiEnabled, setAiEnabled] = useState(false);
    const [autoReplyEnabled, setAutoReplyEnabled] = useState(false);
    const [autoReplyText, setAutoReplyText] = useState(DEFAULT_AUTO_REPLY_TEXT);
    const [autoReplySaving, setAutoReplySaving] = useState(false);
    const [autoReplyError, setAutoReplyError] = useState('');

    // Poll for changes
    useEffect(() => {
        const checkStatuses = async () => {
            // Meta Status
            const meta = localStorage.getItem('metaConnected') === 'true';
            if (meta !== isMetaConnected) setIsMetaConnected(meta);

            // WhatsApp Status (via service)
            try {
                const creds = await getWhatsAppCredentials(session.token);
                if (creds) {
                    setIsWhatsAppConnected(!!creds.is_connected);
                    setAiEnabled(!!creds.ai_enabled);
                    setAutoReplyEnabled(!!creds.auto_reply_enabled);
                    if (creds.auto_reply_text != null) setAutoReplyText(creds.auto_reply_text);
                }
            } catch (e) {
                console.error("Failed to fetch WhatsApp status", e);
            }
        };

        checkStatuses();
        const interval = setInterval(checkStatuses, 8000);
        return () => clearInterval(interval);
    }, [isMetaConnected, isWhatsAppConnected, aiEnabled, autoReplyEnabled, session.token]);

    const toggleAi = async () => {
        if (!isWhatsAppConnected) {
            setWhatsAppModalOpen(true);
            return;
        }

        try {
            const newState = !aiEnabled;
            setAiEnabled(newState); // Optimistic update
            await fetch('http://localhost:3001/api/whatsapp/ai-toggle', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.token}`
                },
                body: JSON.stringify({ enabled: newState })
            });
        } catch (error) {
            console.error('Failed to toggle AI settings', error);
            // Revert state on failure
            setAiEnabled(!aiEnabled);
        }
    };

    const openAutoReplyModal = () => {
        if (!isWhatsAppConnected) {
            setWhatsAppModalOpen(true);
            return;
        }
        setAutoReplyError('');
        setAutoReplyModalOpen(true);
    };

    const saveAutoReplyConfig = async () => {
        setAutoReplySaving(true);
        setAutoReplyError('');
        try {
            const res = await updateAutoReplyConfig(session.token, autoReplyEnabled, autoReplyText);
            if (res.success) {
                setAutoReplyModalOpen(false);
            } else {
                setAutoReplyError(res.error ?? 'Failed to save');
            }
        } catch (e) {
            setAutoReplyError('Failed to save');
        } finally {
            setAutoReplySaving(false);
        }
    };


    const tabs = ['Marketplace', 'Active Integrations'];

    const marketingIntegrations = [
        {
            title: 'Lead Generation',
            description: 'Connect your ads to capture leads automatically into your CRM.',
            items: [
                {
                    name: 'Facebook & Instagram',
                    description: 'Capture leads directly from your Meta Lead Ads and Instagram story ads.',
                    icon: <Facebook className={`w-6 h-6 ${isMetaConnected ? 'text-blue-600' : 'text-slate-400'}`} />,
                    status: isMetaConnected ? 'CONNECTED' : 'Connect >',
                    isConnected: isMetaConnected,
                    onClick: onOpenMetaModal
                }
            ]
        },
        {
            title: 'WhatsApp Marketing Suite',
            description: 'Communicate with your leads instantly using your own WhatsApp number.',
            items: [
                {
                    name: 'WhatsApp Connection',
                    description: 'Link your personal or business WhatsApp to enable automation features.',
                    icon: <Settings className={`w-6 h-6 ${isWhatsAppConnected ? 'text-slate-600' : 'text-slate-400'}`} />,
                    status: isWhatsAppConnected ? 'CONNECTED' : 'Setup >',
                    isConnected: isWhatsAppConnected,
                    onClick: () => setWhatsAppModalOpen(true)
                },
                {
                    name: 'Auto-Responder',
                    description: 'Send instant "Thank You" messages to new leads the moment they inquire.',
                    icon: <Zap className={`w-6 h-6 ${isWhatsAppConnected ? (autoReplyEnabled ? 'text-green-500' : 'text-slate-500') : 'text-slate-400'}`} />,
                    status: isWhatsAppConnected ? (autoReplyEnabled ? 'ACTIVE' : 'Configure >') : 'Requires WA >',
                    isConnected: isWhatsAppConnected && autoReplyEnabled,
                    onClick: openAutoReplyModal
                },
                {
                    name: 'AI Agent Replier',
                    description: 'Automatically handle customer inquiries using your configured AI agent prompt.',
                    icon: <Share2 className={`w-6 h-6 ${isWhatsAppConnected ? (aiEnabled ? 'text-purple-600' : 'text-slate-400') : 'text-slate-300'}`} />,
                    status: isWhatsAppConnected ? (aiEnabled ? 'ACTIVE' : 'INACTIVE') : 'Requires WA >',
                    isConnected: aiEnabled,
                    onClick: toggleAi
                }
            ]
        },
        {
            title: 'Data & Utilities',
            description: 'Manage your lead data with easy import and export tools.',
            items: [
                {
                    name: 'Bulk Import',
                    description: 'Upload leads from Excel or CSV files directly into your SalesAI account.',
                    icon: <Upload className="w-6 h-6 text-purple-600" />,
                    status: 'Upload >',
                    onClick: () => { }
                },
                {
                    name: 'Data Export',
                    description: 'Download your lead database for offline analysis or backup.',
                    icon: <Download className="w-6 h-6 text-orange-600" />,
                    status: 'Download >',
                    onClick: () => { }
                }
            ]
        }
    ];

    return (
        <div className="flex flex-col h-full bg-[#f8fafc] -m-4 md:-m-8 p-4 md:p-8 animate-fade-in relative min-h-[80vh]">
            {/* Header */}
            <div className="flex flex-col mb-8">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight font-display">
                            Automations
                        </h2>
                        <p className="text-slate-500 mt-1">Configure and manage your sales tools in one place.</p>
                    </div>
                </div>

                {/* Simplified Tabs */}
                <div className="flex border-b border-slate-200">
                    {tabs.map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`
                                whitespace-nowrap py-4 px-6 border-b-2 font-bold text-sm transition-all
                                ${activeTab === tab
                                    ? 'border-blue-600 text-blue-600 bg-blue-50/30'
                                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                                }
                            `}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 space-y-12">
                {marketingIntegrations.map((section, idx) => (
                    <div key={idx} className="space-y-6">
                        <div className="border-l-4 border-blue-500 pl-4">
                            <h3 className="text-xl font-bold text-slate-900">{section.title}</h3>
                            <p className="text-sm text-slate-500 mt-0.5">{section.description}</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {section.items.map((item, itemIdx) => {
                                const isLinkConnected = (item as any).isConnected;
                                return (
                                    <div
                                        key={itemIdx}
                                        onClick={item.onClick}
                                        className={`group bg-white rounded-2xl p-6 border transition-all cursor-pointer flex flex-col ${isLinkConnected ? 'border-green-100 shadow-md hover:shadow-2xl hover:border-green-200' : 'border-slate-200 shadow-sm hover:shadow-xl hover:border-blue-100'}`}
                                    >
                                        <div className="flex items-center justify-between mb-4">
                                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-all ${isLinkConnected ? 'bg-green-50' : 'bg-slate-50'}`}>
                                                {item.icon}
                                            </div>
                                            <span className={`text-[10px] font-black px-3 py-1 rounded-full transition-all tracking-widest ${isLinkConnected
                                                ? 'bg-green-500 text-white opacity-100'
                                                : 'bg-blue-50 text-blue-600 opacity-0 group-hover:opacity-100 uppercase'
                                                }`}>
                                                {isLinkConnected ? (
                                                    <span className="flex items-center gap-1.5">
                                                        <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>
                                                        ACTIVE
                                                    </span>
                                                ) : item.status}
                                            </span>
                                        </div>

                                        <h4 className="font-bold text-slate-900 text-lg mb-2 flex items-center gap-2">
                                            {item.name}
                                            {isLinkConnected && <CheckCircle2 className="w-5 h-5 text-green-500" />}
                                        </h4>
                                        <p className="text-sm text-slate-500 leading-relaxed mb-6 flex-1">
                                            {item.description}
                                        </p>

                                        <div className={`pt-4 border-t flex items-center text-sm font-bold transition-colors ${isLinkConnected ? 'border-green-50 text-green-600' : 'border-slate-50 text-slate-400 group-hover:text-blue-600'}`}>
                                            {isLinkConnected ? 'Manage Integration' : 'Open Settings'}
                                            <span className={`ml-2 transition-transform ${isLinkConnected ? '' : 'group-hover:translate-x-1'}`}>
                                                {isLinkConnected ? '●' : '→'}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>

            <ConnectWhatsAppModal
                isOpen={whatsAppModalOpen}
                onClose={() => setWhatsAppModalOpen(false)}
                onSuccess={() => {
                    setWhatsAppModalOpen(false);
                    onWhatsAppSuccess();
                }}
                session={session}
            />

            {/* Auto-Responder settings modal */}
            {autoReplyModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => !autoReplySaving && setAutoReplyModalOpen(false)}>
                    <div className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 p-6" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-slate-900">Auto-Responder settings</h3>
                            <button type="button" onClick={() => !autoReplySaving && setAutoReplyModalOpen(false)} className="p-1 rounded-lg hover:bg-slate-100" aria-label="Close">
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>
                        <p className="text-sm text-slate-500 mb-4">Send a fixed message when a lead sends their first message.</p>
                        <div className="flex items-center gap-3 mb-4">
                            {autoReplyEnabled ? (
                                <button
                                    type="button"
                                    role="switch"
                                    aria-checked="true"
                                    aria-label="Toggle auto-reply"
                                    onClick={() => setAutoReplyEnabled(false)}
                                    className="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 bg-green-500"
                                >
                                    <span className="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out translate-x-5" />
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    role="switch"
                                    aria-checked="false"
                                    aria-label="Toggle auto-reply"
                                    onClick={() => setAutoReplyEnabled(true)}
                                    className="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 bg-slate-200"
                                >
                                    <span className="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out translate-x-1" />
                                </button>
                            )}
                            <span className="text-sm font-medium text-slate-700">Enable auto-reply</span>
                        </div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Message</label>
                        <textarea
                            value={autoReplyText}
                            onChange={e => setAutoReplyText(e.target.value)}
                            placeholder="e.g. Thank you for your message! We'll reply shortly."
                            rows={4}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        {autoReplyError && <p className="mt-2 text-sm text-red-600">{autoReplyError}</p>}
                        <div className="mt-6 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => !autoReplySaving && setAutoReplyModalOpen(false)}
                                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={saveAutoReplyConfig}
                                disabled={autoReplySaving}
                                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg"
                            >
                                {autoReplySaving ? 'Saving…' : 'Save'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
