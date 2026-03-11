import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    Search, Sparkles, Send, Loader2, MessageCircle, AlertCircle,
    MoreVertical, Paperclip, Smile, Phone, Video, X, Reply,
    Download, ChevronDown, Check, CheckCheck, User, Info
} from 'lucide-react';
import { Lead, Message, AuthSession, Channel } from '../../../utils/types';
import { analyzeLeadIntent, generateReply } from '../../../automation/geminiService';
import { getWhatsAppCredentials, getWhatsAppMessageHistory, initInboxSocket, sendWhatsAppTextMessage, sendWhatsAppMedia } from '../../services/whatsappService';
import { supabase } from '../../lib/supabase';

import './InboxView.css';

// ── Types ────────────────────────────────────────────────────────────────────
interface WaConversation {
    phone: string; name: string; lastMessage: string;
    lastTimestamp: Date; hasUnread: boolean; unreadCount: number;
    isGroup?: boolean;
    profilePictureUrl?: string | null;
}
interface WaMessage extends Message {
    message_id?: string; status?: 'sent' | 'delivered' | 'read' | 'received' | 'pending' | string;
    quotedContent?: string;
}

// ── Emoji picker data (common emojis, no package needed) ─────────────────────
const EMOJI_GROUPS = [
    { label: '😀', emojis: ['😀', '😂', '😍', '🥳', '😎', '🤔', '😅', '🙏', '❤️', '🔥', '👍', '🎉', '✅', '🚀', '💯', '🤝', '😊', '🥰', '😘', '😜'] },
    { label: '🌟', emojis: ['⭐', '🌟', '✨', '💫', '🎊', '🎁', '🏆', '🥇', '💪', '🎯', '📱', '💡', '📊', '📈', '🤑', '💰', '🎈', '🌈', '🌺', '🦋'] },
    { label: '👋', emojis: ['👋', '🤚', '✋', '🖐️', '👌', '🤌', '🤙', '👊', '🤜', '🫶', '🫂', '🤗', '😴', '🤩', '🤯', '🥺', '😤', '😡', '🤤', '😇'] },
];

// ── Helpers ──────────────────────────────────────────────────────────────────
const isGroupPhone = (phone: string) => phone?.includes('@g.us') || (phone?.length > 15 && /^\d+$/.test(phone || ''));
// Format JID for display: 919876543210@s.whatsapp.net → +919876543210, groups → "Group" (use contact name when available)
const formatPhone = (phone: string) => {
    if (!phone) return 'Unknown';
    const clean = phone.replace(/@.*/, '');
    if (isGroupPhone(phone)) return 'Group';
    return `+${clean}`;
};
const formatTime = (date: Date) => {
    if (!date || isNaN(date.getTime())) return '';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};
const formatDate = (date: Date) => {
    if (!date || isNaN(date.getTime())) return '';
    const today = new Date();
    if (date.toDateString() === today.toDateString()) return 'Today';
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
};
const getInitials = (name: string = '') => {
    const safeName = name || 'User';
    // If it starts with "Group:" or is a long number, show a group icon text
    if (safeName.startsWith('Group:') || isGroupPhone(safeName)) return '\uD83D\uDC65'; // 👥
    return safeName.split(' ').map(n => n?.[0] || '').join('').toUpperCase().slice(0, 2) || '?';
};
const AVATAR_COLORS = ['#DFD3C3', '#C8D9E6', '#D4E6C3', '#E6D4C8', '#C3D4E6', '#E6C8D9', '#D9E6C3', '#C3C8E6'];
const getAvatarColor = (str: string = '') => AVATAR_COLORS[(str || '').charCodeAt(0) % AVATAR_COLORS.length] || AVATAR_COLORS[0];

// Friendly preview of the last message — makes special types readable
const formatMessagePreview = (content: string): string => {
    if (!content) return '';
    if (content === '[Unsupported Message Type]') return '\uD83D\uDCCE Attachment';
    if (content === '[Audio]') return '\uD83C\uDFA4 Audio';
    if (content === '[Video]') return '\uD83C\uDFA5 Video';
    if (content === '[Sticker]') return '\uD83C\uDF9F\uFE0F Sticker';
    if (content === '[Live Location]') return '\uD83D\uDCCD Live Location';
    if (content.startsWith('[Location:')) return '\uD83D\uDCCD ' + content.replace('[Location:', '').replace(']', '').trim();
    if (content.startsWith('[File:')) return '\uD83D\uDCC4 ' + content.replace('[File:', '').replace(']', '').trim();
    if (content.startsWith('[Contact:')) return '\uD83D\uDC64 ' + content.replace('[Contact:', '').replace(']', '').trim();
    if (content.startsWith('[Poll:')) return '\uD83D\uDCCA ' + content.replace('[Poll:', '').replace(']', '').trim();
    if (content === '[Poll Vote]') return '\uD83D\uDCCA Poll Vote';
    if (content.startsWith('[IMAGE:data:')) return '\uD83D\uDDBC\uFE0F Photo';
    if (content.startsWith('[VIDEO:data:')) return '\uD83C\uDFA5 Video';
    return content;
};

// ── Tick component ────────────────────────────────────────────────────────────
const Tick = ({ status }: { status?: string }) => {
    if (status === 'read') return <CheckCheck size={15} style={{ color: '#53bdeb', flexShrink: 0 }} />;
    if (status === 'delivered') return <CheckCheck size={15} style={{ color: '#8696a0', flexShrink: 0 }} />;
    return <Check size={15} style={{ color: '#8696a0', flexShrink: 0 }} />;
};

// ── Main Component ────────────────────────────────────────────────────────────
export const InboxView = ({ leads, session }: { leads: Lead[]; session: AuthSession }) => {
    const [selectedPhone, setSelectedPhone] = useState('');
    const [inputText, setInputText] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [error, setError] = useState('');
    const [messages, setMessages] = useState<WaMessage[]>([]);
    const [conversations, setConversations] = useState<WaConversation[]>([]);
    const [isWaConnected, setIsWaConnected] = useState(false);
    const [isLoadingStatus, setIsLoadingStatus] = useState(true);
    const [isLoadingConversations, setIsLoadingConversations] = useState(true);
    // UI state
    const [showTemplates, setShowTemplates] = useState(false);
    const [showEmoji, setShowEmoji] = useState(false);
    const [showContactPanel, setShowContactPanel] = useState(false);
    const [replyTo, setReplyTo] = useState<WaMessage | null>(null);
    const [typingContact, setTypingContact] = useState<string | null>(null);
    const [selectedEmojiGroup, setSelectedEmojiGroup] = useState(0);
    const [hoveredMsgId, setHoveredMsgId] = useState<string | null>(null);
    const [mediaPreview, setMediaPreview] = useState<{ file: File; preview: string } | null>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Track selectedPhone in a ref so socket handlers (closed over on mount) always see the current value
    const selectedPhoneRef = useRef<string>(selectedPhone);
    useEffect(() => { selectedPhoneRef.current = selectedPhone; }, [selectedPhone]);

    // Resolve a display name — priority: DB contact_name > leads > formatted phone
    const getContactName = useCallback((phone: string = '', contactNameFromDb?: string): string => {
        if (contactNameFromDb) return contactNameFromDb;
        const safePhone = (phone || '').replace(/\D/g, '');
        const lead = leads.find(l => (l.phone || '').replace(/\D/g, '') === safePhone);
        if (lead?.name) return lead.name;
        // Use the smart formatPhone helper which handles groups and normal numbers
        return formatPhone(phone);
    }, [leads]);

    const getContactLead = (phone: string) => leads.find(l => l.phone?.replace(/\D/g, '') === phone);

    // ── 1. Check WA connection status ─────────────────────────────────────────
    useEffect(() => {
        getWhatsAppCredentials(session.token).then(creds => setIsWaConnected(!!creds?.is_connected));
    }, [session.token]);

    // ── 2. Load conversations from DB ─────────────────────────────────────────
    const loadConversations = useCallback(async () => {
        const { data: messagesData, error: msgError } = await supabase.from('whatsapp_messages')
            .select('lead_phone, content, timestamp, sender, contact_name, is_group')
            .eq('user_id', session.user.id)
            .order('timestamp', { ascending: false });

        if (msgError || !messagesData) return;

        let contactsData: any[] = [];
        try {
            const { data } = await supabase.from('whatsapp_contacts')
                .select('lead_phone, contact_name, profile_picture_url, is_group')
                .eq('user_id', session.user.id);
            contactsData = data || [];
        } catch {
            // whatsapp_contacts table may not exist yet
        }

        const contactMap = new Map(contactsData.map((c: any) => [c.lead_phone, c]));
        const nameMap = new Map<string, string>();
        messagesData.forEach(m => {
            const fromContact = contactMap.get(m.lead_phone)?.contact_name;
            const name = fromContact || m.contact_name;
            if (name && !nameMap.has(m.lead_phone)) nameMap.set(m.lead_phone, name);
        });

        const seen = new Set<string>();
        const convs: WaConversation[] = [];
        messagesData.forEach(m => {
            if (seen.has(m.lead_phone)) return;
            seen.add(m.lead_phone);
            const meta = contactMap.get(m.lead_phone);
            const group = m.is_group === true || isGroupPhone(m.lead_phone);
            convs.push({
                phone: m.lead_phone,
                name: getContactName(m.lead_phone, meta?.contact_name || nameMap.get(m.lead_phone) || m.contact_name),
                lastMessage: m.content,
                lastTimestamp: new Date(m.timestamp),
                hasUnread: false,
                unreadCount: 0,
                isGroup: group,
                profilePictureUrl: meta?.profile_picture_url,
            });
        });
        setConversations(convs);
        if (!selectedPhone && convs.length > 0) setSelectedPhone(convs[0].phone);
    }, [session.user.id, getContactName, selectedPhone]);

    useEffect(() => {
        loadConversations().finally(() => setIsLoadingConversations(false));
        // Sync WA connection status from DB on mount
        setIsLoadingStatus(true);
        getWhatsAppCredentials(session.token).then(creds => {
            if (creds?.is_connected) setIsWaConnected(true);
        }).finally(() => setIsLoadingStatus(false));
    }, [session.user.id]);

    // ── 3. Socket.IO realtime ─────────────────────────────────────────────────
    useEffect(() => {
        const cleanup = initInboxSocket(session.user.id, {
            onMessage: (m: any) => {
                setConversations(prev => {
                    const idx = prev.findIndex(c => c.phone === m.lead_phone);
                    const bestName = getContactName(m.lead_phone, m.contact_name);
                    const group = m.is_group === true || isGroupPhone(m.lead_phone);
                    const isFromLead = m.sender === 'lead';
                    const updated: WaConversation = {
                        phone: m.lead_phone,
                        name: bestName,
                        lastMessage: m.content,
                        lastTimestamp: new Date(m.timestamp),
                        hasUnread: isFromLead && selectedPhoneRef.current !== m.lead_phone,
                        unreadCount: isFromLead && selectedPhoneRef.current !== m.lead_phone
                            ? (idx >= 0 ? (prev[idx].unreadCount || 0) + 1 : 1) : 0,
                        isGroup: group,
                    };
                    const copy = prev.filter(c => c.phone !== m.lead_phone);
                    return [updated, ...copy];
                });
                // Only add to the chat view if this message belongs to the open conversation
                if (m.lead_phone === selectedPhoneRef.current) {
                    setMessages(prev => {
                        if (prev.find(msg => msg.id === m.id || (m.message_id && msg.message_id === m.message_id))) return prev;
                        return [...prev, {
                            id: m.id || `socket-${Date.now()}`,
                            sender: m.sender, content: m.content,
                            timestamp: new Date(m.timestamp), channel: 'WhatsApp' as Channel,
                            message_id: m.message_id, status: m.status,
                        }];
                    });
                }
            },
            onTyping: ({ leadPhone, isTyping }) => {
                if (isTyping) {
                    setTypingContact(leadPhone);
                    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
                    typingTimerRef.current = setTimeout(() => setTypingContact(null), 4000);
                } else {
                    setTypingContact(null);
                }
            },
            onStatus: ({ messageId, status }) => {
                setMessages(prev => prev.map(m => m.message_id === messageId ? { ...m, status } : m));
            },
            onConnected: () => setIsWaConnected(true),
            onDisconnected: () => setIsWaConnected(false),
            onHistorySynced: () => {
                loadConversations();
                if (selectedPhoneRef.current) {
                    getWhatsAppMessageHistory(session.token, selectedPhoneRef.current).then(data => {
                        setMessages(data.map((m: any) => ({
                            id: m.id, sender: m.sender, content: m.content,
                            timestamp: new Date(m.timestamp), channel: 'WhatsApp' as Channel,
                            message_id: m.message_id, status: m.status,
                        })));
                    });
                }
            },
            onChatUpdate: ({ lead_phone, contact_name }) => {
                if (contact_name) {
                    setConversations(prev => prev.map(c =>
                        c.phone === lead_phone ? { ...c, name: contact_name } : c
                    ));
                }
            },
        });
        return cleanup;
    }, [session.user.id, getContactName, loadConversations]);

    // ── 4. Supabase realtime (backup) ─────────────────────────────────────────
    useEffect(() => {
        const channel = supabase.channel('inbox-realtime')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'whatsapp_messages', filter: `user_id=eq.${session.user.id}` },
                (payload) => {
                    const m = payload.new as any;
                    setConversations(prev => {
                        const idx = prev.findIndex(c => c.phone === m.lead_phone);
                        const updated: WaConversation = {
                            phone: m.lead_phone, name: getContactName(m.lead_phone),
                            lastMessage: m.content, lastTimestamp: new Date(m.timestamp),
                            hasUnread: m.sender === 'lead',
                            unreadCount: m.sender === 'lead' ? ((idx >= 0 ? prev[idx].unreadCount : 0) || 0) + 1 : 0,
                        };
                        return [updated, ...prev.filter(c => c.phone !== m.lead_phone)];
                    });
                    if (m.lead_phone === selectedPhone) {
                        setMessages(prev => {
                            if (prev.find(msg => msg.id === m.id)) return prev;
                            return [...prev, { id: m.id, sender: m.sender, content: m.content, timestamp: new Date(m.timestamp), channel: 'WhatsApp' as Channel, status: m.status }];
                        });
                    }
                })
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [session.user.id, selectedPhone, getContactName]);

    // ── 5. Load messages on conversation select (always fetch latest from DB, no cache) ─
    useEffect(() => {
        if (!selectedPhone) { setMessages([]); return; }
        setReplyTo(null);
        setMessages([]);
        getWhatsAppMessageHistory(session.token, selectedPhone).then(data => {
            setMessages(data.map((m: any) => ({
                id: m.id, sender: m.sender, content: m.content,
                timestamp: new Date(m.timestamp), channel: 'WhatsApp' as Channel,
                message_id: m.message_id, status: m.status,
            })));
        });
        setConversations(prev => prev.map(c => c.phone === selectedPhone ? { ...c, hasUnread: false, unreadCount: 0 } : c));
    }, [selectedPhone, session.token]);

    // ── 5b. Refetch when tab becomes visible (always show latest, no stale cache) ─
    useEffect(() => {
        const onVisibility = () => {
            if (document.visibilityState !== 'visible') return;
            loadConversations();
            if (selectedPhone) {
                getWhatsAppMessageHistory(session.token, selectedPhone).then(data => {
                    setMessages(data.map((m: any) => ({
                        id: m.id, sender: m.sender, content: m.content,
                        timestamp: new Date(m.timestamp), channel: 'WhatsApp' as Channel,
                        message_id: m.message_id, status: m.status,
                    })));
                });
            }
        };
        document.addEventListener('visibilitychange', onVisibility);
        return () => document.removeEventListener('visibilitychange', onVisibility);
    }, [selectedPhone, session.token, loadConversations]);

    // ── 6. Auto-scroll ────────────────────────────────────────────────────────
    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

    // ── 7. Auto-resize textarea ───────────────────────────────────────────────
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
        }
    }, [inputText]);

    const selectedConversation = conversations.find(c => c.phone === selectedPhone);
    const selectedLead = getContactLead(selectedPhone);

    // ── Actions ───────────────────────────────────────────────────────────────
    const handleSendMessage = async () => {
        if (mediaPreview) { await handleSendMedia(); return; }
        if (!inputText.trim() || !selectedPhone) return;
        const textToSend = inputText;
        const quotedId = replyTo?.message_id;
        setInputText('');
        setReplyTo(null);
        setError('');

        // Removed optimistic update to wait for real-time delivery via socket

        try {
            setIsSending(true);
            const result = await sendWhatsAppTextMessage(session.token, selectedPhone, textToSend, quotedId);
            if (!result.success) setError(`Error: ${result.message || 'Message not sent'}`);
        } catch (e: any) {
            setError(`Failed: ${e.message}`);
        } finally {
            setIsSending(false);
        }
    };

    const handleSendMedia = async () => {
        if (!mediaPreview || !selectedPhone) return;
        setIsSending(true);
        try {
            const result = await sendWhatsAppMedia(session.token, selectedPhone, mediaPreview.file, inputText || undefined);
            if (!result.success) setError(result.error || 'Media not sent');
            else { setInputText(''); setMediaPreview(null); }
        } catch (e: any) {
            setError(e.message);
        } finally {
            setIsSending(false);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 64 * 1024 * 1024) { setError('File too large (max 64MB)'); return; }
        const preview = URL.createObjectURL(file);
        setMediaPreview({ file, preview });
    };

    const handleGenerateReply = async () => {
        if (!selectedConversation || messages.length === 0) return;
        setIsGenerating(true); setError('');
        try {
            const lastMsg = messages[messages.length - 1];
            const intent = await analyzeLeadIntent(lastMsg.content);
            const fakeLead: Lead = {
                id: selectedConversation.phone, name: selectedConversation.name,
                email: '', phone: selectedConversation.phone, company: '', role: '',
                status: 'New', score: 'Warm', source: 'WhatsApp', lastContact: '',
            };
            const reply = await generateReply(fakeLead, messages, intent);
            setInputText(reply);
        } catch { setError('AI reply failed.'); }
        finally { setIsGenerating(false); }
    };

    const handleUseTemplate = (body: string) => {
        setInputText(body.replace('{{1}}', selectedConversation?.name || 'there'));
        setShowTemplates(false);
    };

    const insertEmoji = (emoji: string) => {
        setInputText(prev => prev + emoji);
        textareaRef.current?.focus();
    };

    const filtered = conversations.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) || c.phone.includes(searchTerm)
    );

    // Group by date
    const groupedMessages: { date: string; msgs: WaMessage[] }[] = [];
    messages.forEach(msg => {
        const d = formatDate(msg.timestamp);
        const last = groupedMessages[groupedMessages.length - 1];
        if (last && last.date === d) last.msgs.push(msg);
        else groupedMessages.push({ date: d, msgs: [msg] });
    });

    return (
        <div className="inbox-root" onClick={() => { setShowEmoji(false); setShowTemplates(false); }}>

            {/* ── Sidebar ─────────────────────────────────────────────── */}
            <div className="inbox-sidebar">
                {/* Header */}
                <div className="inbox-sidebar-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div className="avatar-circle" style={{ width: '40px', height: '40px', backgroundColor: '#00a884', color: 'white', fontSize: '16px' }}>
                            {session.user.email?.[0]?.toUpperCase() || 'U'}
                        </div>
                        <span style={{ color: '#e9edef', fontWeight: 600, fontSize: '16px' }}>Inbox</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {isWaConnected && <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#00a884' }} title="WhatsApp Connected" />}
                        <button title="More options" aria-label="More options" style={{ background: 'none', border: 'none', color: '#aebac1', cursor: 'pointer', padding: '8px', borderRadius: '50%' }}><MoreVertical size={20} /></button>
                    </div>
                </div>

                {/* WA offline warning */}
                {!isLoadingStatus && !isWaConnected && (
                    <div className="offline-warning">
                        <AlertCircle size={16} style={{ color: '#ffd279', flexShrink: 0 }} />
                        <p className="offline-warning-text">WhatsApp offline. Go to Automations to connect.</p>
                    </div>
                )}

                {isLoadingStatus && (
                    <div className="checking-connection-wrapper">
                        <div className="checking-connection-inner">
                            <div className="loading-spinner-xs"></div>
                            Checking connection...
                        </div>
                    </div>
                )}

                {/* Search */}
                <div className="inbox-search-box">
                    <div className="inbox-search-input-wrapper">
                        <Search size={16} style={{ position: 'absolute', left: '12px', color: '#aebac1' }} />
                        <input type="text" placeholder="Search or start new chat" value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full bg-transparent border-none outline-none text-slate-200 text-sm py-[9px] pl-[38px] pr-[12px]"
                            style={{ fontFamily: 'inherit' }} />
                    </div>
                </div>

                {/* Conversations */}
                <div className="inbox-conv-list">
                    {isLoadingConversations ? (
                        <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                            <div className="flex flex-col items-center gap-2">
                                <div className="loading-spinner-md"></div>
                                <span className="text-slate-400 text-sm">Loading chats...</span>
                            </div>
                        </div>
                    ) : filtered.length === 0 && (
                        <div style={{ padding: '40px 20px', textAlign: 'center', color: '#8696a0', fontSize: '13px' }}>
                            {conversations.length === 0 ? 'No messages yet' : 'No results found'}
                        </div>
                    )}
                    {filtered.map(conv => {
                        const isSelected = conv.phone === selectedPhone;
                        const avatarBg = conv.isGroup ? '#2a3942' : getAvatarColor(conv.name);
                        const initials = conv.isGroup ? '\uD83D\uDC65' : getInitials(conv.name);
                        return (
                            <div key={conv.phone} onClick={() => setSelectedPhone(conv.phone)}
                                className={`conv-item ${isSelected ? 'selected' : ''}`}
                            >
                                <div className="avatar-circle" style={{ width: '49px', height: '49px', backgroundColor: avatarBg, color: conv.isGroup ? 'white' : '#3b4a54', flexShrink: 0, fontSize: conv.isGroup ? '22px' : '18px', overflow: 'hidden' }}>
                                    {conv.profilePictureUrl ? (
                                        <img src={conv.profilePictureUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : (
                                        initials
                                    )}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div className="conv-name-row">
                                        <span className="conv-name">
                                            {conv.isGroup && <span style={{ fontSize: '11px', color: '#8696a0', marginRight: '4px' }}>[Group]</span>}
                                            {conv.name}
                                        </span>
                                        <span className="conv-time" style={{ color: conv.hasUnread && !isSelected ? '#00a884' : '#8696a0' }}>{formatTime(conv.lastTimestamp)}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span className="conv-last-msg">{formatMessagePreview(conv.lastMessage)}</span>
                                        {conv.unreadCount > 0 && !isSelected && (
                                            <div className="unread-badge" style={{ backgroundColor: '#00a884', color: 'white' }}>{conv.unreadCount}</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ── Chat Area ───────────────────────────────────────────── */}
            {selectedConversation ? (
                <div className="inbox-chat-area" onClick={e => e.stopPropagation()}>

                    {/* Header */}
                    <div className="inbox-chat-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, cursor: 'pointer' }}
                            onClick={() => setShowContactPanel(p => !p)}>
                            <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: selectedConversation.isGroup ? '#2a3942' : getAvatarColor(selectedConversation.name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: selectedConversation.isGroup ? '20px' : '16px', color: selectedConversation.isGroup ? 'white' : '#3b4a54' }}>
                                {selectedConversation.isGroup ? '\uD83D\uDC65' : getInitials(selectedConversation.name)}
                            </div>
                            <div>
                                <div style={{ color: '#111b21', fontSize: '15px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    {selectedConversation.isGroup && <span style={{ fontSize: '11px', background: '#e9f5e0', color: '#2d7534', padding: '1px 5px', borderRadius: '4px', fontWeight: 500 }}>Group</span>}
                                    {selectedConversation.name}
                                </div>
                                <div style={{ color: '#667781', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    {typingContact === selectedPhone
                                        ? <span style={{ color: '#00a884', fontStyle: 'italic' }}>typing...</span>
                                        : <><span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: isWaConnected ? '#00a884' : '#8696a0' }} />{isWaConnected ? 'WhatsApp Connected' : 'WhatsApp Offline'}</>
                                    }
                                </div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '2px', color: '#54656f' }}>
                            <button title="Search" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#54656f', borderRadius: '50%', padding: '8px' }}><Search size={20} /></button>
                            <button title="Contact info" onClick={() => setShowContactPanel(p => !p)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: showContactPanel ? '#00a884' : '#54656f', borderRadius: '50%', padding: '8px' }}><Info size={20} /></button>
                            <button title="More" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#54656f', borderRadius: '50%', padding: '8px' }}><MoreVertical size={20} /></button>
                        </div>
                    </div>

                    {/* Error bar */}
                    {error && (
                        <div style={{ backgroundColor: '#fef2f2', color: '#b91c1c', fontSize: '12px', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #fecaca' }}>
                            <AlertCircle size={14} /> {error}
                            <button onClick={() => setError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#b91c1c' }}><X size={14} /></button>
                        </div>
                    )}

                    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                        {/* Messages */}
                        <div className="inbox-messages-area" style={{ flex: 1 }}>
                            {messages.length === 0 && (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#8696a0', textAlign: 'center' }}>
                                    <MessageCircle size={48} style={{ opacity: 0.3, marginBottom: '12px' }} />
                                    <p style={{ fontSize: '14px' }}>No messages yet.</p>
                                </div>
                            )}

                            {groupedMessages.map(group => (
                                <div key={group.date}>
                                    {/* Date divider */}
                                    <div style={{ display: 'flex', justifyContent: 'center', margin: '8px 0 12px' }}>
                                        <span style={{ backgroundColor: '#ffffff', color: '#54656f', fontSize: '11.5px', fontWeight: 500, padding: '5px 12px', borderRadius: '7.5px', boxShadow: '0 1px 1px rgba(0,0,0,0.13)', border: '1px solid #e9edef' }}>
                                            {group.date}
                                        </span>
                                    </div>

                                    {group.msgs.map(msg => {
                                        const isOut = msg.sender === 'user' || msg.sender === 'ai';
                                        return (
                                            <div key={msg.message_id || msg.id || Math.random().toString()}
                                                style={{ display: 'flex', justifyContent: isOut ? 'flex-end' : 'flex-start', marginBottom: '2px', position: 'relative' }}
                                                onMouseEnter={() => setHoveredMsgId(msg.id)}
                                                onMouseLeave={() => setHoveredMsgId(null)}
                                            >
                                                {/* Reply button on hover */}
                                                {hoveredMsgId === msg.id && (
                                                    <button
                                                        onClick={() => setReplyTo(msg)}
                                                        title="Reply"
                                                        style={{ position: 'absolute', [isOut ? 'left' : 'right']: '-4px', top: '50%', transform: 'translateY(-50%) translateX(' + (isOut ? '-100%' : '100%') + ')', background: '#ffffff', border: '1px solid #e9edef', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 1, boxShadow: '0 1px 3px rgba(0,0,0,0.15)' }}
                                                    >
                                                        <Reply size={14} style={{ color: '#54656f' }} />
                                                    </button>
                                                )}

                                                <div style={{
                                                    maxWidth: '65%', minWidth: '80px',
                                                    backgroundColor: isOut ? '#d9fdd3' : '#ffffff',
                                                    borderRadius: isOut ? '7.5px 7.5px 0 7.5px' : '7.5px 7.5px 7.5px 0',
                                                    padding: '6px 9px 8px',
                                                    boxShadow: '0 1px 1px rgba(0,0,0,0.13)',
                                                }}>
                                                    {/* AI label */}
                                                    {msg.sender === 'ai' && (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '3px' }}>
                                                            <Sparkles size={11} style={{ color: '#00a884' }} />
                                                            <span style={{ color: '#00a884', fontSize: '11px', fontWeight: 600 }}>AI Reply</span>
                                                        </div>
                                                    )}
                                                    {/* Quoted message */}
                                                    {msg.quotedContent && (
                                                        <div style={{ backgroundColor: isOut ? '#b7f5b0' : '#f0f2f5', borderLeft: '3px solid #00a884', borderRadius: '4px', padding: '4px 8px', marginBottom: '4px', fontSize: '12px', color: '#667781' }}>
                                                            <Reply size={10} style={{ display: 'inline', marginRight: '4px' }} />
                                                            {msg.quotedContent.slice(0, 80)}{msg.quotedContent.length > 80 ? '…' : ''}
                                                        </div>
                                                    )}
                                                    {/* Content */}
                                                    <div style={{ color: '#111b21', fontSize: '13.6px', lineHeight: '19px', margin: 0, wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                                                        {msg.content.startsWith('[IMAGE:data:') ? (
                                                            <img
                                                                src={msg.content.replace('[IMAGE:', '').replace(/\]$/, '')}
                                                                alt="Attachment"
                                                                style={{ maxWidth: '100%', borderRadius: '6px', maxHeight: '300px', objectFit: 'contain' }}
                                                            />
                                                        ) : msg.content.startsWith('[VIDEO:data:') ? (
                                                            <video
                                                                src={msg.content.replace('[VIDEO:', '').replace(/\]$/, '')}
                                                                controls
                                                                style={{ maxWidth: '100%', borderRadius: '6px', maxHeight: '300px' }}
                                                            />
                                                        ) : (
                                                            msg.content
                                                        )}
                                                    </div>
                                                    {/* Timestamp + tick */}
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '3px', marginTop: '2px' }}>
                                                        <span style={{ color: '#667781', fontSize: '11px' }}>{formatTime(msg.timestamp)}</span>
                                                        {isOut && <Tick status={msg.status} />}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ))}

                            {/* Typing indicator */}
                            {typingContact === selectedPhone && (
                                <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '4px' }}>
                                    <div style={{ backgroundColor: '#ffffff', borderRadius: '7.5px 7.5px 7.5px 0', padding: '10px 14px', boxShadow: '0 1px 1px rgba(0,0,0,0.13)', display: 'flex', gap: '4px', alignItems: 'center' }}>
                                        {[0, 0.2, 0.4].map((delay, i) => (
                                            <div key={i} style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#8696a0', animation: `bounce 1.2s ${delay}s infinite`, animationTimingFunction: 'ease-in-out' }} />
                                        ))}
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* ── Contact Info Panel ────────────────────────── */}
                        {showContactPanel && (
                            <div style={{ width: '280px', backgroundColor: '#ffffff', borderLeft: '1px solid #e9edef', display: 'flex', flexDirection: 'column', flexShrink: 0, overflowY: 'auto' }}>
                                <div style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e9edef' }}>
                                    <span style={{ fontWeight: 700, color: '#111b21', fontSize: '16px' }}>Contact Info</span>
                                    <button onClick={() => setShowContactPanel(false)} title="Close contact info" aria-label="Close contact info" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#54656f' }}><X size={20} /></button>
                                </div>
                                <div style={{ padding: '24px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', borderBottom: '1px solid #e9edef' }}>
                                    <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: getAvatarColor(selectedConversation.name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '32px', color: '#3b4a54' }}>
                                        {getInitials(selectedConversation.name)}
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontWeight: 700, color: '#111b21', fontSize: '18px' }}>{selectedConversation.name}</div>
                                        <div style={{ color: '#8696a0', fontSize: '13px', marginTop: '2px' }}>
                                            {selectedConversation.isGroup ? 'Group chat' : formatPhone(selectedConversation.phone)}
                                        </div>
                                    </div>
                                </div>
                                <div style={{ padding: '16px' }}>
                                    {selectedLead ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                            {[
                                                { label: 'Email', value: selectedLead.email },
                                                { label: 'Company', value: selectedLead.company },
                                                { label: 'Role', value: selectedLead.role },
                                                { label: 'Status', value: selectedLead.status },
                                                { label: 'Score', value: selectedLead.score },
                                                { label: 'Source', value: selectedLead.source },
                                            ].filter(f => f.value).map(({ label, value }) => (
                                                <div key={label}>
                                                    <div style={{ fontSize: '11px', color: '#8696a0', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>{label}</div>
                                                    <div style={{ fontSize: '14px', color: '#111b21' }}>{value}</div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div style={{ color: '#8696a0', fontSize: '13px', textAlign: 'center', marginTop: '20px' }}>
                                            <User size={32} style={{ opacity: 0.3, marginBottom: '8px' }} />
                                            <p>No lead record found for this contact.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ── Media preview ─────────────────────────────────── */}
                    {mediaPreview && (
                        <div style={{ padding: '8px 16px', backgroundColor: '#f0f2f5', borderTop: '1px solid #e9edef', display: 'flex', alignItems: 'center', gap: '12px' }}>
                            {mediaPreview.file.type.startsWith('image/') ? (
                                <img src={mediaPreview.preview} alt="preview" style={{ height: '60px', width: '60px', objectFit: 'cover', borderRadius: '8px' }} />
                            ) : (
                                <div style={{ height: '60px', width: '60px', backgroundColor: '#e9edef', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                                    <Download size={20} style={{ color: '#54656f' }} />
                                    <span style={{ fontSize: '10px', color: '#54656f' }}>{mediaPreview.file.name.slice(-8)}</span>
                                </div>
                            )}
                            <div style={{ flex: 1, fontSize: '13px', color: '#111b21' }}>{mediaPreview.file.name}</div>
                            <button onClick={() => setMediaPreview(null)} title="Remove attachment" aria-label="Remove attachment" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#54656f' }}><X size={18} /></button>
                        </div>
                    )}

                    {/* ── Reply preview ─────────────────────────────────── */}
                    {replyTo && (
                        <div style={{ padding: '8px 16px', backgroundColor: '#f0f2f5', borderTop: '1px solid #e9edef', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ flex: 1, borderLeft: '3px solid #00a884', paddingLeft: '10px' }}>
                                <div style={{ fontSize: '12px', color: '#00a884', fontWeight: 600, marginBottom: '2px' }}>
                                    {replyTo.sender === 'user' || replyTo.sender === 'ai' ? 'You' : selectedConversation.name}
                                </div>
                                <div style={{ fontSize: '12px', color: '#667781', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{replyTo.content}</div>
                            </div>
                            <button onClick={() => setReplyTo(null)} title="Cancel reply" aria-label="Cancel reply" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8696a0' }}><X size={16} /></button>
                        </div>
                    )}

                    {/* ── Emoji picker ──────────────────────────────────── */}
                    {showEmoji && (
                        <div style={{ backgroundColor: '#ffffff', borderTop: '1px solid #e9edef', padding: '8px' }} onClick={e => e.stopPropagation()}>
                            <div style={{ display: 'flex', gap: '4px', marginBottom: '6px', borderBottom: '1px solid #f0f2f5', paddingBottom: '6px' }}>
                                {EMOJI_GROUPS.map((g, i) => (
                                    <button key={i} onClick={() => setSelectedEmojiGroup(i)} title={`Emoji group ${i + 1}`} aria-label={`Emoji group ${i + 1}`}
                                        style={{ background: selectedEmojiGroup === i ? '#f0f2f5' : 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: '6px', fontSize: '18px' }}>
                                        {g.label}
                                    </button>
                                ))}
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px' }}>
                                {EMOJI_GROUPS[selectedEmojiGroup].emojis.map(e => (
                                    <button key={e} onClick={() => insertEmoji(e)}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '22px', padding: '4px', borderRadius: '4px', lineHeight: 1 }}
                                        onMouseEnter={ev => (ev.currentTarget.style.backgroundColor = '#f0f2f5')}
                                        onMouseLeave={ev => (ev.currentTarget.style.backgroundColor = 'transparent')}>
                                        {e}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── AI + Templates bar ────────────────────────────── */}
                    <div className="inbox-tools-bar" onClick={e => e.stopPropagation()}>
                        <button onClick={handleGenerateReply} disabled={isGenerating || messages.length === 0}
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 12px', backgroundColor: '#e7f8f2', color: '#00a884', border: '1px solid #00a884', borderRadius: '12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', opacity: messages.length === 0 ? 0.4 : 1, fontFamily: 'inherit' }}>
                            <Sparkles size={13} style={{ animation: isGenerating ? 'spin 1s linear infinite' : 'none' }} />
                            {isGenerating ? 'Thinking...' : 'AI Reply'}
                        </button>

                        <div style={{ position: 'relative' }}>
                            <button onClick={e => { e.stopPropagation(); setShowTemplates(p => !p); setShowEmoji(false); }}
                                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 12px', backgroundColor: '#ffffff', color: '#54656f', border: '1px solid #e9edef', borderRadius: '12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                                Templates <ChevronDown size={12} />
                            </button>
                            {showTemplates && (
                                <div style={{ position: 'absolute', bottom: '110%', left: 0, backgroundColor: '#ffffff', border: '1px solid #e9edef', borderRadius: '12px', padding: '8px', minWidth: '220px', boxShadow: '0 8px 24px rgba(0,0,0,0.15)', zIndex: 50 }}
                                    onClick={e => e.stopPropagation()}>
                                    <p style={{ color: '#8696a0', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '4px 8px 8px', margin: 0, borderBottom: '1px solid #e9edef' }}>Templates</p>
                                    {[
                                        { label: 'Welcome', body: "Hi {{1}}, thanks for reaching out! How can we help you today?" },
                                        { label: 'Follow Up', body: "Hi {{1}}, just checking in — any questions about our services?" },
                                        { label: 'Confirm Meeting', body: "Hi {{1}}, your meeting is confirmed for tomorrow. See you then!" },
                                        { label: 'Pricing Info', body: "Hi {{1}}, I'd be happy to share our pricing details. Can I set up a quick call?" },
                                    ].map(t => (
                                        <button key={t.label} onClick={() => handleUseTemplate(t.body)}
                                            style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px', backgroundColor: 'transparent', border: 'none', color: '#111b21', fontSize: '13px', cursor: 'pointer', borderRadius: '8px', fontFamily: 'inherit' }}
                                            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f0f2f5')}
                                            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                                            {t.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── Input Bar ─────────────────────────────────────── */}
                    <div className="inbox-input-bar" onClick={e => e.stopPropagation()}>
                        <input ref={fileInputRef} type="file" accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt,audio/*" style={{ display: 'none' }} onChange={handleFileSelect} aria-label="Attach file" title="Attach file" />

                        <button onClick={e => { e.stopPropagation(); setShowEmoji(p => !p); setShowTemplates(false); }}
                            title="Emoji" className="emoji-picker-btn" style={{ color: showEmoji ? '#00a884' : '#54656f' }}>
                            <Smile size={24} />
                        </button>
                        <button onClick={() => fileInputRef.current?.click()}
                            title="Attach file" className="attach-btn">
                            <Paperclip size={24} />
                        </button>

                        <div className="input-container">
                            <textarea ref={textareaRef} value={inputText}
                                onChange={e => setInputText(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                                placeholder={mediaPreview ? 'Add a caption...' : `Message ${selectedConversation.name}...`}
                                rows={1}
                                className="input-textarea"
                            />
                        </div>

                        <button onClick={handleSendMessage}
                            disabled={(!inputText.trim() && !mediaPreview) || isSending || !isWaConnected}
                            title={isWaConnected ? 'Send' : 'WhatsApp not connected'}
                            className="send-btn" style={{ opacity: !isWaConnected ? 0.5 : 1 }}>
                            {isSending ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                        </button>
                    </div>
                </div>
            ) : (
                /* Empty state */
                <div className="empty-state">
                    <div className="empty-state-icon-wrapper">
                        <MessageCircle size={80} style={{ color: '#aebac1', opacity: 0.6 }} />
                    </div>
                    <h3 className="empty-state-title">SalesAI Inbox</h3>
                    <p className="empty-state-text">
                        Send and receive WhatsApp messages without keeping your phone online.<br />Select a conversation from the left to start chatting.
                    </p>
                </div>
            )}
        </div>
    );
};
