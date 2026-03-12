import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    Search, Sparkles, Send, Loader2, MessageCircle, AlertCircle,
    MoreVertical, Paperclip, Smile, Phone, Video, X, Reply,
    Download, ChevronDown, Check, CheckCheck, User, Info, RefreshCw
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
    jid?: string;
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
// Raw format for comparison: 919876543210@s.whatsapp.net → 919876543210, groups → full JID
const formatPhone = (phone: string) => {
    if (!phone) return 'Unknown';
    const clean = phone.replace(/@.*/, '');
    if (isGroupPhone(phone)) return 'Group';
    return `+${clean}`;
};
// Human-readable mobile number (e.g. +91 74909 61147) so it doesn't look like an ID
const formatPhoneDisplay = (phone: string) => {
    if (!phone) return 'Unknown';
    const clean = (phone || '').replace(/@.*/, '').replace(/\D/g, '');
    if (isGroupPhone(phone)) return 'Group';
    // LID check: LIDs are usually 14-16 digits and don't look like standard country code formats
    const isLid = clean.length >= 15;
    if (isLid) return `ID: ${clean}`;

    if (clean.length === 12 && clean.startsWith('91')) return `+91 ${clean.slice(2, 7)} ${clean.slice(7)}`;
    if (clean.length >= 10) return `+${clean.slice(0, clean.length - 10)} ${clean.slice(-10).replace(/(\d{5})(\d+)/, '$1 $2')}`.trim();
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
const getAvatarClass = (name: string = '') => {
    const safeName = name || 'User';
    let hash = 0;
    for (let i = 0; i < safeName.length; i++) {
        hash = safeName.charCodeAt(i) + ((hash << 5) - hash);
    }
    return `avatar-bg-${Math.abs(hash) % 8}`;
};

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
    if (status === 'read') return <CheckCheck size={15} className="text-[#53bdeb] flex-shrink-0" />;
    if (status === 'delivered') return <CheckCheck size={15} className="text-[#8696a0] flex-shrink-0" />;
    return <Check size={15} className="text-[#8696a0] flex-shrink-0" />;
};

// ── Media Renderer ────────────────────────────────────────────────────────────
const renderMessageContent = (content: string) => {
    if (!content) return null;

    // Image preview
    if (content.startsWith('[IMAGE:http') || content.startsWith('[IMAGE:data:')) {
        const src = content.replace('[IMAGE:', '').replace(/\](?: .*)?$/, '');
        return (
            <div className="msg-media-container">
                <img src={src} alt="Photo" className="msg-media-img" loading="lazy" />
            </div>
        );
    }
    if (content === '[Image]' || content === '[Photo]' || content.includes('Photo')) {
        return (
            <div className="msg-attachment-box media">
                <div className="attachment-icon-circle bg-[#ffbc2e]"><Paperclip size={16} /></div>
                <div className="attachment-info">
                    <span className="attachment-name">Photo</span>
                    <span className="attachment-sub">View on mobile</span>
                </div>
            </div>
        );
    }

    // Video preview
    if (content.startsWith('[VIDEO:http') || content.startsWith('[VIDEO:data:')) {
        const src = content.replace('[VIDEO:', '').replace(/\](?: .*)?$/, '');
        return (
            <div className="msg-media-container">
                <video src={src} controls preload="metadata" className="msg-media-video" />
            </div>
        );
    }
    if (content === '[Video]') {
        return (
            <div className="msg-attachment-box media">
                <div className="attachment-icon-circle bg-[#7467ef]"><Video size={16} /></div>
                <div className="attachment-info">
                    <span className="attachment-name">Video</span>
                    <span className="attachment-sub">View on mobile</span>
                </div>
            </div>
        );
    }

    // Audio
    if (content === '[Audio]') {
        return (
            <div className="msg-attachment-box audio">
                <div className="attachment-icon-circle"><Phone size={16} /></div>
                <div className="attachment-info">
                    <span className="attachment-name">Audio Message</span>
                    <span className="attachment-sub">Voice record</span>
                </div>
            </div>
        );
    }

    // File/Document
    if (content.startsWith('[File:')) {
        const fileName = content.replace('[File:', '').replace(/\]$/, '').trim();
        return (
            <div className="msg-attachment-box document">
                <div className="attachment-icon-circle"><Download size={16} /></div>
                <div className="attachment-info">
                    <span className="attachment-name">{fileName}</span>
                    <span className="attachment-sub">Document</span>
                </div>
            </div>
        );
    }

    // Location
    if (content.startsWith('[Location:')) {
        const locName = content.replace('[Location:', '').replace(/\]$/, '').trim();
        return (
            <div className="msg-attachment-box location">
                <div className="attachment-marker-circle"><Info size={16} /></div>
                <div className="attachment-info">
                    <span className="attachment-name">Location</span>
                    <span className="attachment-sub">{locName}</span>
                </div>
            </div>
        );
    }

    // Contact
    if (content.startsWith('[Contact:')) {
        const contactName = content.replace('[Contact:', '').replace(/\]$/, '').trim();
        return (
            <div className="msg-attachment-box contact">
                <div className="attachment-icon-circle"><User size={16} /></div>
                <div className="attachment-info">
                    <span className="attachment-name">{contactName}</span>
                    <span className="attachment-sub">Contact Card</span>
                </div>
            </div>
        );
    }

    // Fallback for generic unsupported types - show as generic attachment for a cleaner look
    if (content === '[Unsupported Message Type]' || content.includes('Unsupported')) {
        return (
            <div className="msg-attachment-box attachment">
                <div className="attachment-icon-circle opacity-80"><Paperclip size={16} /></div>
                <div className="attachment-info">
                    <span className="attachment-name">Attachment</span>
                    <span className="attachment-sub">Format not supported in browser</span>
                </div>
            </div>
        );
    }

    return content;
};

// ── Main Component ────────────────────────────────────────────────────────────
export const InboxView = ({ leads, session }: { leads: Lead[]; session: AuthSession }) => {
    const [selectedJid, setSelectedJid] = useState('');
    const [inputText, setInputText] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [error, setError] = useState('');
    const [messages, setMessages] = useState<WaMessage[]>([]);
    const [conversations, setConversations] = useState<WaConversation[]>([]);
    const [isWaConnected, setIsWaConnected] = useState(false);
    const [socketConnected, setSocketConnected] = useState(false);
    const [isLoadingStatus, setIsLoadingStatus] = useState(true);
    const [isLoadingConversations, setIsLoadingConversations] = useState(true);
    const [hasMoreMessages, setHasMoreMessages] = useState(true);
    const [isLoadingMoreMessages, setIsLoadingMoreMessages] = useState(false);
    // UI state
    const [showTemplates, setShowTemplates] = useState(false);
    const [showEmoji, setShowEmoji] = useState(false);
    const [showContactPanel, setShowContactPanel] = useState(false);
    const [replyTo, setReplyTo] = useState<WaMessage | null>(null);
    const [typingContact, setTypingContact] = useState<string | null>(null);
    const [selectedEmojiGroup, setSelectedEmojiGroup] = useState(0);
    const [hoveredMsgId, setHoveredMsgId] = useState<string | null>(null);
    const [mediaPreview, setMediaPreview] = useState<{ file: File; preview: string } | null>(null);

    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Track selectedJid in a ref so socket handlers (closed over on mount) always see the current value
    const selectedJidRef = useRef<string>(selectedJid);
    useEffect(() => { selectedJidRef.current = selectedJid; }, [selectedJid]);

    // Resolve a display name — priority: DB contact_name > leads > formatted phone (human-readable, not raw id)
    const getContactName = useCallback((phone: string = '', contactNameFromDb?: string): string => {
        const trimmed = (contactNameFromDb || '').trim();
        if (trimmed) return trimmed;
        const safePhone = (phone || '').replace(/\D/g, '');
        const lead = leads.find(l => (l.phone || '').replace(/\D/g, '') === safePhone);
        if (lead?.name) return lead.name;
        return formatPhoneDisplay(phone);
    }, [leads]);

    const getContactLead = (phone: string) => leads.find(l => l.phone?.replace(/\D/g, '') === phone);

    // ── 1. Check WA connection status (initial + periodic so "WhatsApp offline" clears after connecting) ──
    useEffect(() => {
        const check = () => getWhatsAppCredentials(session.token).then(creds => setIsWaConnected(!!creds?.is_connected));
        check();
        const interval = setInterval(check, 12000);
        return () => clearInterval(interval);
    }, [session.token]);

    // Track loading state explicitly to prevent spamming
    const isFetchingRef = useRef(false);

    // ── 2. Load conversations from DB ─────────────────────────────────────────
    const loadConversations = useCallback(async (showLoader: boolean = true) => {
        if (isFetchingRef.current) return;
        isFetchingRef.current = true;
        if (showLoader) setIsLoadingConversations(true);
        const { data: messagesData, error: msgError } = await supabase.from('whatsapp_messages')
            .select('lead_phone, jid, content, timestamp, sender, contact_name, is_group')
            .eq('user_id', session.user.id)
            .order('timestamp', { ascending: false })
            .limit(1000);

        if (msgError || !messagesData) {
            setIsLoadingConversations(false);
            return;
        }

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
        (messagesData as any[]).forEach(m => {
            const rowJid = m.jid || m.lead_phone; // fallback to lead_phone if jid is null
            if (seen.has(rowJid)) return;
            seen.add(rowJid);
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
                jid: rowJid,
            });
        });
        const uniqueConversations = Object.values(
            convs.reduce((acc, convo) => {
                const key = convo.jid || convo.phone;
                // keep the first one we saw natively (which is the most recent because order is descending)
                if (!acc[key]) acc[key] = convo;
                return acc;
            }, {} as Record<string, WaConversation>)
        );

        setConversations(uniqueConversations);
        setSelectedJid(prev => {
            if (!prev && uniqueConversations.length > 0 && uniqueConversations[0].jid) {
                return uniqueConversations[0].jid;
            }
            return prev;
        });
        if (showLoader) setIsLoadingConversations(false);
        isFetchingRef.current = false;
    }, [session.user.id, getContactName]);

    // Initial load and status sync
    useEffect(() => {
        loadConversations();

        // Sync WA connection status from DB on mount
        setIsLoadingStatus(true);
        getWhatsAppCredentials(session.token).then(creds => {
            if (creds?.is_connected) setIsWaConnected(true);
        }).finally(() => setIsLoadingStatus(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── 3. Socket.IO realtime ─────────────────────────────────────────────────
    useEffect(() => {
        const cleanup = initInboxSocket(session.user.id, {
            onMessage: (m: any) => {
                setConversations(prev => {
                    const rowJid = m.jid || m.lead_phone;
                    const idx = prev.findIndex(c => (c.jid === rowJid) || (c.phone === m.lead_phone));
                    const existingName = idx >= 0 ? prev[idx].name : '';
                    const bestName = getContactName(m.lead_phone, m.contact_name) || existingName || formatPhoneDisplay(m.lead_phone);
                    const group = m.is_group === true || isGroupPhone(m.lead_phone);
                    const isFromLead = m.sender === 'lead';
                    const updated: WaConversation = {
                        phone: m.lead_phone,
                        name: bestName,
                        lastMessage: m.content,
                        lastTimestamp: new Date(m.timestamp),
                        hasUnread: isFromLead && String(selectedJidRef.current) !== String(rowJid),
                        unreadCount: isFromLead && String(selectedJidRef.current) !== String(rowJid)
                            ? (idx >= 0 ? (prev[idx].unreadCount || 0) + 1 : 1) : 0,
                        isGroup: group,
                        profilePictureUrl: idx >= 0 ? prev[idx].profilePictureUrl : undefined,
                        jid: rowJid,
                    };
                    const copy = prev.filter(c => c.jid !== rowJid);
                    return [updated, ...copy];
                });
                // Only add to the chat view if this message belongs to the open conversation
                setConversations(conversations => {
                    const rowJid = m.jid || m.lead_phone;
                    const isForCurrent = String(rowJid) === String(selectedJidRef.current);

                    if (isForCurrent) {
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
                    return conversations; // return same array, we just used it for lookup
                });
            },
            onTyping: ({ leadPhone, jid, isTyping }) => {
                const typingId = jid || leadPhone;
                if (isTyping && typingId) {
                    setTypingContact(typingId);
                    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
                    typingTimerRef.current = setTimeout(() => setTypingContact(null), 4000);
                } else {
                    setTypingContact(null);
                }
            },
            onStatus: ({ messageId, status }) => {
                setMessages(prev => prev.map(m => m.message_id === messageId ? { ...m, status } : m));
            },
            onConnected: () => { setIsWaConnected(true); setSocketConnected(true); },
            onDisconnected: () => { setIsWaConnected(false); setSocketConnected(false); },
            onHistorySynced: () => {
                loadConversations(false);
                if (selectedJidRef.current) {
                    getWhatsAppMessageHistory(session.token, selectedJidRef.current).then(data => {
                        setMessages(data.map((m: any) => ({
                            id: m.id, sender: m.sender, content: m.content,
                            timestamp: new Date(m.timestamp), channel: 'WhatsApp' as Channel,
                            message_id: m.message_id, status: m.status,
                        })));
                    });
                }
            },
            onChatUpdate: ({ lead_phone, contact_name, jid, resolved_from_lid }) => {
                setConversations(prev => {
                    const updated = prev.map(c => {
                        const isMatch = (jid && c.jid === jid) || (c.phone === lead_phone);
                        if (isMatch) {
                            return {
                                ...c,
                                name: contact_name || c.name,
                                phone: lead_phone || c.phone,
                                jid: jid || c.jid
                            };
                        }
                        return c;
                    });

                    // If an LID was resolved, and the current selected jid was that LID, update it
                    if (resolved_from_lid && jid && String(selectedJidRef.current) === lead_phone) {
                        const match = updated.find(u => u.jid === jid && u.phone === lead_phone);
                        if (match) {
                            setTimeout(() => setSelectedJid(jid), 100);
                        }
                    }
                    return updated;
                });
            },
        });
        return cleanup;
    }, [session.user.id, getContactName, loadConversations]);

    // Removed polling fallback as requested by user.

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
                    const rowJid = m.jid || m.lead_phone;
                    if (rowJid === selectedJid) {
                        setMessages(prev => {
                            if (prev.find(msg => msg.id === m.id)) return prev;
                            const newMsg = { id: m.id, sender: m.sender, content: m.content, timestamp: new Date(m.timestamp), channel: 'WhatsApp' as Channel, status: m.status };
                            // Scroll to bottom when a new realtime message arrives
                            setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
                            return [...prev, newMsg];
                        });
                    }
                })
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [session.user.id, selectedJid, getContactName]);

    // ── 5. Load messages on conversation select (always fetch latest from DB, no cache) ─
    useEffect(() => {
        if (!selectedJid) { setMessages([]); return; }
        setReplyTo(null);
        setMessages([]);
        setHasMoreMessages(true);
        getWhatsAppMessageHistory(session.token, selectedJid).then(data => {
            setMessages(data.map((m: any) => ({
                id: m.id, sender: m.sender, content: m.content,
                timestamp: new Date(m.timestamp), channel: 'WhatsApp' as Channel,
                message_id: m.message_id, status: m.status,
            })));
            setHasMoreMessages(data.length >= 20); // API limit is 20
            // Scroll to bottom on initial load
            setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'auto' }), 100);
        });
        setConversations(prev => prev.map(c => c.jid === selectedJid ? { ...c, hasUnread: false, unreadCount: 0 } : c));
    }, [selectedJid, session.token]);

    // ── 5b. Refetch when tab becomes visible (always show latest, no stale cache) ─
    useEffect(() => {
        const onVisibility = () => {
            if (document.visibilityState !== 'visible') return;
            loadConversations(false);
            if (selectedJid) {
                getWhatsAppMessageHistory(session.token, selectedJid).then(data => {
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
    }, [selectedJid, session.token, loadConversations]);

    // ── 6. Pagination & Infinite Scroll ───────────────────────────────────────
    const handleScroll = async () => {
        if (!messagesContainerRef.current) return;
        const { scrollTop, scrollHeight } = messagesContainerRef.current;

        // Load more when scrolled to top
        if (scrollTop === 0 && hasMoreMessages && !isLoadingMoreMessages && messages.length > 0) {
            setIsLoadingMoreMessages(true);
            const oldestMessage = messages[0];
            const cursor = oldestMessage.timestamp.toISOString();

            try {
                const data = await getWhatsAppMessageHistory(session.token, selectedJid, cursor);
                if (data.length > 0) {
                    const newMessages = data.map((m: any) => ({
                        id: m.id, sender: m.sender, content: m.content,
                        timestamp: new Date(m.timestamp), channel: 'WhatsApp' as Channel,
                        message_id: m.message_id, status: m.status,
                    }));

                    // Maintain scroll position after prepending
                    const prevScrollHeight = scrollHeight;
                    setMessages(prev => [...newMessages, ...prev]);
                    setHasMoreMessages(data.length >= 20);

                    setTimeout(() => {
                        if (messagesContainerRef.current) {
                            messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight - prevScrollHeight;
                        }
                    }, 0);
                } else {
                    setHasMoreMessages(false);
                }
            } catch (e) {
                console.error("Failed to load more messages", e);
            } finally {
                setIsLoadingMoreMessages(false);
            }
        }
    };

    // ── 7. Auto-resize textarea ───────────────────────────────────────────────
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
        }
    }, [inputText]);

    const selectedConversation = conversations.find(c => c.jid === selectedJid);
    const selectedLead = selectedConversation ? getContactLead(selectedConversation.phone) : undefined;

    // ── Actions ───────────────────────────────────────────────────────────────
    const handleSendMessage = async () => {
        if (mediaPreview) { await handleSendMedia(); return; }
        if (!inputText.trim() || !selectedJid || !selectedConversation) return;
        const textToSend = inputText;
        const quotedId = replyTo?.message_id;
        setInputText('');
        setReplyTo(null);
        setError('');

        // Removed optimistic update to wait for real-time delivery via socket

        try {
            setIsSending(true);
            const result = await sendWhatsAppTextMessage(session.token, selectedJid, textToSend, quotedId, selectedConversation.name);
            if (!result.success) setError(`Error: ${result.message || 'Message not sent'}`);
        } catch (e: any) {
            setError(`Failed: ${e.message}`);
        } finally {
            setIsSending(false);
        }
    };

    const handleSendMedia = async () => {
        if (!mediaPreview || !selectedJid) return;
        setIsSending(true);
        try {
            const result = await sendWhatsAppMedia(session.token, selectedJid, mediaPreview.file, inputText || undefined, selectedConversation?.name);
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

    const handleManualRefresh = () => {
        setIsLoadingConversations(true);
        loadConversations().finally(() => setIsLoadingConversations(false));
        if (selectedJid) {
            getWhatsAppMessageHistory(session.token, selectedJid).then(data => {
                setMessages(data.map((m: any) => ({
                    id: m.id, sender: m.sender, content: m.content,
                    timestamp: new Date(m.timestamp), channel: 'WhatsApp' as Channel,
                    message_id: m.message_id, status: m.status,
                })));
            });
        }
    };

    return (
        <div className="inbox-root" onClick={() => { setShowEmoji(false); setShowTemplates(false); }}>

            {/* ── Sidebar ─────────────────────────────────────────────── */}
            <div className="inbox-sidebar">
                {/* Header */}
                <div className="inbox-sidebar-header">
                    <div className="flex items-center gap-3">
                        <div className="avatar-circle w-10 h-10 bg-[#00a884] text-white text-base">
                            {session.user.email?.[0]?.toUpperCase() || 'U'}
                        </div>
                        <span className="text-[#e9edef] font-semibold text-base">Inbox</span>
                    </div>
                    <div className="flex items-center gap-1">
                        {isWaConnected && <div className="w-2 h-2 rounded-full bg-[#00a884]" title="WhatsApp Connected" />}
                        <button onClick={handleManualRefresh} title="Refresh messages" aria-label="Refresh messages" className="bg-transparent border-none text-[#aebac1] cursor-pointer p-2 rounded-full hover:bg-[#2a3942]">
                            <RefreshCw size={20} className={isLoadingConversations ? "animate-spin" : ""} />
                        </button>
                        <button title="More options" aria-label="More options" className="bg-transparent border-none text-[#aebac1] cursor-pointer p-2 rounded-full hover:bg-[#2a3942]"><MoreVertical size={20} /></button>
                    </div>
                </div>

                {/* WA offline warning */}
                {!isLoadingStatus && !isWaConnected && (
                    <div className="offline-warning">
                        <AlertCircle size={16} className="text-[#ffd279] flex-shrink-0" />
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
                        <Search size={16} className="absolute left-3 text-[#aebac1]" />
                        <input type="text" placeholder="Search or start new chat" value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full bg-transparent border-none outline-none text-slate-200 text-sm py-[9px] pl-[38px] pr-[12px] font-inherit" />
                    </div>
                </div>

                {/* Conversations */}
                <div className="inbox-conv-list">
                    {isLoadingConversations ? (
                        <div className="py-10 px-5 text-center">
                            <div className="flex flex-col items-center gap-2">
                                <div className="loading-spinner-md"></div>
                                <span className="text-slate-400 text-sm">Loading chats...</span>
                            </div>
                        </div>
                    ) : filtered.length === 0 && (
                        <div className="py-10 px-5 text-center text-[#8696a0] text-xs">
                            {conversations.length === 0 ? 'No messages yet' : 'No results found'}
                        </div>
                    )}
                    {filtered.map(conv => {
                        const isSelected = conv.jid === selectedJid;
                        const avatarClass = conv.isGroup ? 'avatar-bg-group' : getAvatarClass(conv.name);
                        const initials = conv.isGroup ? '\uD83D\uDC65' : getInitials(conv.name);
                        return (
                            <div key={conv.jid || conv.phone} onClick={() => setSelectedJid(conv.jid || conv.phone)}
                                className={`conv-item ${isSelected ? 'selected' : ''}`}
                            >
                                <div className={`avatar-circle w-[49px] h-[49px] flex-shrink-0 overflow-hidden ${avatarClass}`}>
                                    {conv.profilePictureUrl ? (
                                        <img src={conv.profilePictureUrl} alt="" loading="lazy" className="w-full h-full object-cover" />
                                    ) : (
                                        initials
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="conv-name-row">
                                        <span className="conv-name">
                                            {conv.isGroup && <span className="text-[11px] text-[#8696a0] mr-1">[Group]</span>}
                                            {conv.name}
                                        </span>
                                        <span className={`conv-time ${conv.hasUnread && !isSelected ? 'text-[#00a884]' : 'text-[#8696a0]'}`}>{formatTime(conv.lastTimestamp)}</span>
                                    </div>
                                    {conv.name !== formatPhoneDisplay(conv.phone) && !conv.isGroup && !formatPhoneDisplay(conv.phone).startsWith('ID:') && (
                                        <div className="text-[11px] text-[#8696a0] mt-[1px]">{formatPhoneDisplay(conv.phone)}</div>
                                    )}
                                    <div className="flex justify-between items-center">
                                        <span className="conv-last-msg">{formatMessagePreview(conv.lastMessage)}</span>
                                        {conv.unreadCount > 0 && !isSelected && (
                                            <div className="unread-badge bg-[#00a884] text-white">{conv.unreadCount}</div>
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
                        <div className="chat-header-user"
                            onClick={() => setShowContactPanel(p => !p)}>
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-base ${selectedConversation.isGroup ? 'avatar-bg-group' : getAvatarClass(selectedConversation.name)}`}>
                                {selectedConversation.isGroup ? '\uD83D\uDC65' : getInitials(selectedConversation.name)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-[#e9edef] text-[15.5px] font-semibold truncate">
                                    {selectedConversation.name}
                                </div>
                                <div className="text-[#8696a0] text-[12.5px] flex items-center gap-[5px]">
                                    {typingContact === selectedJid ? (
                                        <span className="text-[#00a884] font-medium">typing...</span>
                                    ) : (
                                        <>
                                            <span className={`w-2 h-2 rounded-full ${isWaConnected ? 'bg-[#00a884]' : 'bg-[#8696a0]'}`} />
                                            {isWaConnected ? 'online' : 'offline'}
                                            {!selectedConversation.isGroup && !formatPhoneDisplay(selectedConversation.phone).startsWith('ID:') && (
                                                <span className="text-xs text-[#8696a0] ml-1">• {formatPhoneDisplay(selectedConversation.phone)}</span>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-[2px] text-[#aebac1]">
                            <button title="Search" className="bg-transparent border-none cursor-pointer text-[#aebac1] rounded-full p-2 hover:bg-[#2a3942]"><Search size={20} /></button>
                            <button title="Contact info" onClick={() => setShowContactPanel(p => !p)} className={`bg-transparent border-none cursor-pointer rounded-full p-2 hover:bg-[#2a3942] ${showContactPanel ? 'text-[#00a884]' : 'text-[#aebac1]'}`}><Info size={20} /></button>
                            <button title="More" className="bg-transparent border-none cursor-pointer text-[#aebac1] rounded-full p-2 hover:bg-[#2a3942]"><MoreVertical size={20} /></button>
                        </div>
                    </div>

                    {/* Error bar */}
                    {error && (
                        <div className="bg-[#fef2f2] text-[#b91c1c] text-xs px-4 py-2 flex items-center gap-2 border-b border-[#fecaca]">
                            <AlertCircle size={14} /> {error}
                            <button onClick={() => setError('')} className="ml-auto bg-transparent border-none cursor-pointer text-[#b91c1c]" aria-label="Dismiss error"><X size={14} /></button>
                        </div>
                    )}

                    <div className="flex-1 flex overflow-hidden">
                        {/* Messages */}
                        <div className="inbox-messages-area flex-1" ref={messagesContainerRef} onScroll={handleScroll}>

                            {/* Loading spinner for infinite scroll */}
                            {isLoadingMoreMessages && (
                                <div className="flex justify-center py-2">
                                    <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-[#00a884]"></div>
                                </div>
                            )}

                            {messages.length === 0 && !isLoadingMoreMessages && (
                                <div className="flex flex-col items-center justify-center h-full text-[#8696a0] text-center">
                                    <MessageCircle size={48} className="opacity-30 mb-3" />
                                    <p className="text-sm">No messages yet.</p>
                                </div>
                            )}

                            {groupedMessages.map(group => (
                                <div key={group.date}>
                                    {/* Date divider */}
                                    <div className="msg-date-bubble">
                                        <span className="msg-date-inner">
                                            {group.date}
                                        </span>
                                    </div>

                                    {group.msgs.map(msg => {
                                        const isOut = msg.sender === 'user' || msg.sender === 'ai';
                                        return (
                                            <div key={msg.message_id || msg.id || Math.random().toString()}
                                                className={`flex mb-[2px] relative ${isOut ? 'justify-end' : 'justify-start'}`}
                                                onMouseEnter={() => setHoveredMsgId(msg.id)}
                                                onMouseLeave={() => setHoveredMsgId(null)}
                                            >
                                                {/* Reply button on hover */}
                                                {hoveredMsgId === msg.id && (
                                                    <button
                                                        onClick={() => setReplyTo(msg)}
                                                        title="Reply"
                                                        className={`absolute top-1/2 -translate-y-1/2 bg-[#2a3942] border border-transparent rounded-full w-7 h-7 flex items-center justify-center cursor-pointer z-[1] shadow-[0_1px_3px_rgba(0,0,0,0.3)] ${isOut ? 'left-[-4px] -translate-x-full' : 'right-[-4px] translate-x-full'}`}
                                                    >
                                                        <Reply size={14} className="text-[#54656f]" />
                                                    </button>
                                                )}

                                                <div className={`msg-bubble ${isOut ? 'sent' : 'received'}`}>
                                                    {/* AI label */}
                                                    {msg.sender === 'ai' && (
                                                        <div className="flex items-center gap-1 mb-[3px]">
                                                            <Sparkles size={11} className="text-[#00a884]" />
                                                            <span className="text-[#00a884] text-[11px] font-semibold">AI Reply</span>
                                                        </div>
                                                    )}
                                                    {/* Quoted message */}
                                                    {msg.quotedContent && (
                                                        <div className="msg-quoted">
                                                            <Reply size={10} className="inline mr-1" />
                                                            {msg.quotedContent.slice(0, 80)}{msg.quotedContent.length > 80 ? '…' : ''}
                                                        </div>
                                                    )}
                                                    {/* Content */}
                                                    <div className="text-[13.6px] leading-[19px] m-0 break-words whitespace-pre-wrap">
                                                        {renderMessageContent(msg.content)}
                                                    </div>
                                                    {/* Timestamp + tick */}
                                                    <div className="flex items-center justify-end gap-[3px] mt-[2px]">
                                                        <span className="text-[#667781] text-[11px]">{formatTime(msg.timestamp)}</span>
                                                        {isOut && <Tick status={msg.status} />}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ))}

                            {/* Typing indicator */}
                            {typingContact === selectedJid && (
                                <div className="flex justify-start mb-1">
                                    <div className="msg-bubble received flex gap-1 items-center !minw-0 !p-[10px_16px]">
                                        {[0, 1, 2].map(idx => (
                                            <div key={idx} className={`w-2 h-2 rounded-full bg-[#8696a0] animate-bounce delay-${idx}`} />
                                        ))}
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* ── Contact Info Panel ────────────────────────── */}
                        {showContactPanel && (
                            <div className="contact-panel">
                                <div className="panel-header">
                                    <span className="font-bold text-[#e9edef] text-base">Contact Info</span>
                                    <button onClick={() => setShowContactPanel(false)} title="Close contact info" aria-label="Close contact info" className="bg-transparent border-none cursor-pointer text-[#8696a0]"><X size={20} /></button>
                                </div>
                                <div className="p-[24px_16px] flex flex-col items-center gap-3 border-b border-[#2a3942]">
                                    <div className={`w-20 h-20 rounded-full flex items-center justify-center font-bold text-[32px] ${getAvatarClass(selectedConversation.name)}`}>
                                        {getInitials(selectedConversation.name)}
                                    </div>
                                    <div className="text-center">
                                        <div className="font-bold text-[#e9edef] text-lg">{selectedConversation.name}</div>
                                        <div className="text-[#8696a0] text-[13px] mt-[2px]">
                                            {selectedConversation.isGroup ? 'Group chat' : formatPhoneDisplay(selectedConversation.phone)}
                                        </div>
                                    </div>
                                </div>
                                <div className="p-4">
                                    {selectedLead ? (
                                        <div className="flex flex-col gap-3">
                                            {[
                                                { label: 'Email', value: selectedLead.email },
                                                { label: 'Company', value: selectedLead.company },
                                                { label: 'Role', value: selectedLead.role },
                                                { label: 'Status', value: selectedLead.status },
                                                { label: 'Score', value: selectedLead.score },
                                                { label: 'Source', value: selectedLead.source },
                                            ].filter(f => f.value).map(({ label, value }) => (
                                                <div key={label}>
                                                    <div className="text-[11px] text-[#8696a0] font-semibold uppercase tracking-wider mb-[2px]">{label}</div>
                                                    <div className="text-sm text-[#e9edef]">{value}</div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-[#8696a0] text-[13px] text-center mt-5">
                                            <User size={32} className="opacity-30 mb-2 mx-auto" />
                                            <p>No lead record found for this contact.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ── Media preview ─────────────────────────────────── */}
                    {mediaPreview && (
                        <div className="p-[8px_16px] bg-[#111b21] border-t border-[#2a3942] flex items-center gap-3">
                            {mediaPreview.file.type.startsWith('image/') ? (
                                <img src={mediaPreview.preview} alt="preview" className="h-[60px] w-[60px] object-cover rounded-lg" />
                            ) : (
                                <div className="h-[60px] w-[60px] bg-[#2a3942] rounded-lg flex flex-col items-center justify-center">
                                    <Download size={20} className="text-[#8696a0]" />
                                    <span className="text-[10px] text-[#8696a0]">{mediaPreview.file.name.slice(-8)}</span>
                                </div>
                            )}
                            <div className="flex-1 text-[13px] text-[#e9edef]">{mediaPreview.file.name}</div>
                            <button onClick={() => setMediaPreview(null)} title="Remove attachment" aria-label="Remove attachment" className="bg-none border-none cursor-pointer text-[#8696a0]"><X size={18} /></button>
                        </div>
                    )}

                    {/* ── Reply preview ─────────────────────────────────── */}
                    {replyTo && (
                        <div className="p-[8px_16px] bg-[#111b21] border-t border-[#2a3942] flex items-center gap-[10px]">
                            <div className="flex-1 border-l-2 border-[#00a884] pl-[10px] bg-[#202c33] rounded-r-md py-1">
                                <div className="text-xs text-[#00a884] font-semibold mb-[2px] px-2">
                                    {replyTo.sender === 'user' || replyTo.sender === 'ai' ? 'You' : selectedConversation.name}
                                </div>
                                <div className="text-xs text-[#8696a0] overflow-hidden text-ellipsis whitespace-nowrap px-2">{replyTo.content}</div>
                            </div>
                            <button onClick={() => setReplyTo(null)} title="Cancel reply" aria-label="Cancel reply" className="bg-none border-none cursor-pointer text-[#8696a0]"><X size={16} /></button>
                        </div>
                    )}

                    {/* ── Emoji picker ──────────────────────────────────── */}
                    {showEmoji && (
                        <div className="bg-[#111b21] border-t border-[#2a3942] p-2" onClick={e => e.stopPropagation()}>
                            <div className="flex gap-1 mb-1.5 border-b border-[#2a3942] pb-1.5 overflow-x-auto">
                                {EMOJI_GROUPS.map((g, i) => (
                                    <button key={i} onClick={() => setSelectedEmojiGroup(i)} title={`Emoji group ${i + 1}`} aria-label={`Emoji group ${i + 1}`}
                                        className={`border-none cursor-pointer p-[4px_8px] rounded-md text-[18px] ${selectedEmojiGroup === i ? 'bg-[#2a3942]' : 'bg-transparent'}`}>
                                        {g.label}
                                    </button>
                                ))}
                            </div>
                            <div className="flex flex-wrap gap-[2px]">
                                {EMOJI_GROUPS[selectedEmojiGroup].emojis.map(e => (
                                    <button key={e} onClick={() => insertEmoji(e)}
                                        className="bg-transparent border-none cursor-pointer text-[22px] p-1 rounded font-inherit leading-none hover:bg-[#202c33]">
                                        {e}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── AI + Templates bar ────────────────────────────── */}
                    <div className="inbox-tools-bar" onClick={e => e.stopPropagation()}>
                        <button onClick={handleGenerateReply} disabled={isGenerating || messages.length === 0}
                            className={`flex items-center gap-[6px] px-3 py-1.25 bg-[#e7f8f2] text-[#00a884] border border-[#00a884] rounded-xl text-xs font-semibold cursor-pointer font-inherit ${messages.length === 0 ? 'opacity-40' : 'opacity-100'}`}>
                            <Sparkles size={13} className={isGenerating ? 'animate-spin' : ''} />
                            {isGenerating ? 'Thinking...' : 'AI Reply'}
                        </button>

                        <div className="relative">
                            <button onClick={e => { e.stopPropagation(); setShowTemplates(p => !p); setShowEmoji(false); }}
                                className="flex items-center gap-1.5 p-[5px_12px] bg-[#2a3942] text-[#e9edef] border border-transparent rounded-xl text-xs font-semibold cursor-pointer font-inherit hover:bg-[#374248]">
                                Templates <ChevronDown size={12} />
                            </button>
                            {showTemplates && (
                                <div className="absolute bottom-[110%] left-0 bg-[#233138] border border-[#2a3942] rounded-xl p-2 min-w-[220px] shadow-[0_8px_24px_rgba(0,0,0,0.3)] z-50 overflow-hidden"
                                    onClick={e => e.stopPropagation()}>
                                    <p className="text-[#8696a0] text-[11px] font-bold uppercase tracking-wider p-[4px_8px_8px] m-0 border-b border-[#2a3942]">Templates</p>
                                    {[
                                        { label: 'Welcome', body: "Hi {{1}}, thanks for reaching out! How can we help you today?" },
                                        { label: 'Follow Up', body: "Hi {{1}}, just checking in — any questions about our services?" },
                                        { label: 'Confirm Meeting', body: "Hi {{1}}, your meeting is confirmed for tomorrow. See you then!" },
                                        { label: 'Pricing Info', body: "Hi {{1}}, I'd be happy to share our pricing details. Can I set up a quick call?" },
                                    ].map(t => (
                                        <button key={t.label} onClick={() => handleUseTemplate(t.body)}
                                            className="block w-full text-left p-[10px] bg-transparent border-none text-[#e9edef] text-[13px] cursor-pointer rounded-lg font-inherit hover:bg-[#111b21]">
                                            {t.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── Input Bar ─────────────────────────────────────── */}
                    <div className="inbox-input-bar" onClick={e => e.stopPropagation()}>
                        <input ref={fileInputRef} type="file" accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt,audio/*" className="hidden" onChange={handleFileSelect} aria-label="Attach file" title="Attach file" />

                        <button onClick={e => { e.stopPropagation(); setShowEmoji(p => !p); setShowTemplates(false); }}
                            title="Emoji" className={`emoji-picker-btn ${showEmoji ? 'text-[#00a884]' : 'text-[#54656f]'}`}>
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
                            className={`send-btn ${!isWaConnected ? 'opacity-50' : 'opacity-100'}`}>
                            {isSending ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                        </button>
                    </div>
                </div>
            ) : (
                /* Empty state */
                <div className="empty-state">
                    <div className="empty-state-icon-wrapper">
                        <MessageCircle size={80} className="text-[#aebac1] opacity-60" />
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
