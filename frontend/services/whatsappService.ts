import { io, Socket } from 'socket.io-client';
import { WhatsAppCredential } from '../../utils/types';
import { supabase } from '../lib/supabase';

const API_BASE = 'http://localhost:3001';

// Singleton socket instance
let socket: Socket | null = null;

// Helper to ALWAYS get the freshest token to avoid 401s from stale React state closures
const getFreshToken = async (fallbackToken?: string) => {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token || fallbackToken || '';
};

// ── Socket for QR auth (ConnectWhatsAppModal) ─────────────────────────────────
export const initWhatsAppSocket = (userId: string, callbacks: {
    onQr: (qrCode: string) => void;
    onConnected: () => void;
    onDisconnected: () => void;
    onError: (msg: string) => void;
    onMessage: (msg: any) => void;
}) => {
    if (socket) socket.disconnect();

    socket = io(API_BASE, { withCredentials: true });

    socket.on('connect', () => {
        console.log('[WhatsApp Socket] Connected to backend');
        socket?.emit('start-whatsapp-auth', { userId });
    });

    socket.on('whatsapp-qr', (data: { qrCode: string }) => {
        console.log('[WhatsApp Socket] Received QR Code');
        callbacks.onQr(data.qrCode);
    });

    socket.on('whatsapp-connected', () => {
        console.log('[WhatsApp Socket] Successfully connected Baileys session');
        callbacks.onConnected();
    });

    socket.on('whatsapp-disconnected', () => {
        console.log('[WhatsApp Socket] WhatsApp Disconnected');
        callbacks.onDisconnected();
    });

    socket.on('whatsapp-error', (data: { message: string }) => {
        console.error('[WhatsApp Socket] Error:', data.message);
        callbacks.onError(data.message);
    });

    socket.on('whatsapp-message', (data: any) => {
        console.log('[WhatsApp Socket] Received new message:', data);
        callbacks.onMessage(data);
    });

    return () => {
        if (socket) { socket.disconnect(); socket = null; }
    };
};

// ── Socket for InboxView real-time (separate, non-QR) ────────────────────────
let inboxSocket: Socket | null = null;

export const initInboxSocket = (userId: string, callbacks: {
    onMessage: (msg: any) => void;
    onTyping: (data: { leadPhone: string; jid?: string; isTyping: boolean }) => void;
    onStatus: (data: { messageId: string; leadPhone: string; status: string }) => void;
    onConnected: () => void;
    onDisconnected: () => void;
    onHistorySynced?: () => void;
    onChatUpdate?: (data: { lead_phone: string; contact_name?: string; jid?: string; resolved_from_lid?: boolean }) => void;
}) => {
    if (inboxSocket) inboxSocket.disconnect();

    inboxSocket = io(API_BASE, { withCredentials: true });

    inboxSocket.on('connect', () => {
        console.log('[InboxSocket] Connected to backend');
        inboxSocket?.emit('join-inbox', { userId });
    });

    inboxSocket.on('whatsapp-message', (data: any) => {
        console.log('[InboxSocket] whatsapp-message received:', data?.content?.substring?.(0, 50));
        callbacks.onMessage(data);
    });

    inboxSocket.on('whatsapp-typing', (data: any) => {
        callbacks.onTyping(data);
    });

    inboxSocket.on('whatsapp-status', (data: any) => {
        callbacks.onStatus(data);
    });

    inboxSocket.on('whatsapp-connected', () => {
        callbacks.onConnected();
    });

    inboxSocket.on('whatsapp-disconnected', () => {
        callbacks.onDisconnected();
    });

    inboxSocket.on('whatsapp-history-synced', () => {
        if (callbacks.onHistorySynced) callbacks.onHistorySynced();
    });

    inboxSocket.on('whatsapp-chat-update', (data: any) => {
        if (callbacks.onChatUpdate) callbacks.onChatUpdate(data);
    });

    return () => {
        if (inboxSocket) { inboxSocket.disconnect(); inboxSocket = null; }
    };
};

// ── Debug: connection status (for troubleshooting) ────────────────────────────
export const getWhatsAppDebugStatus = async (token: string): Promise<any> => {
    try {
        const freshToken = await getFreshToken(token);
        const res = await fetch(`${API_BASE}/api/whatsapp/debug`, {
            headers: { Authorization: `Bearer ${freshToken}` }
        });
        return res.ok ? res.json() : null;
    } catch {
        return null;
    }
};

// ── Read WA Connection status from DB ─────────────────────────────────────────
export const getWhatsAppCredentials = async (token: string): Promise<WhatsAppCredential | null> => {
    try {
        const freshToken = await getFreshToken(token);
        const res = await fetch(`${API_BASE}/api/whatsapp/credentials`, {
            headers: { Authorization: `Bearer ${freshToken}` }
        });
        if (!res.ok) return null;
        const json = await res.json();
        return json.data || null;
    } catch (e: any) {
        console.error('[WhatsAppService] Error fetching WhatsApp credentials:', e);
        return null;
    }
};

// ── AI Config ────────────────────────────────────────────────────────────────
export const toggleAiReply = async (token: string, enabled: boolean): Promise<{ success: boolean; error?: string }> => {
    try {
        const freshToken = await getFreshToken(token);
        const res = await fetch(`${API_BASE}/api/whatsapp/ai-toggle`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${freshToken}` },
            body: JSON.stringify({ enabled })
        });
        const data = await res.json();
        return { success: res.ok, error: data.error };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
};

// ── Update auto-reply config (fixed message sent when client messages) ────────
export const updateAutoReplyConfig = async (
    token: string,
    enabled: boolean,
    text: string
): Promise<{ success: boolean; error?: string }> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000); // 10 s timeout
    try {
        const freshToken = await getFreshToken(token);
        const res = await fetch(`${API_BASE}/api/whatsapp/auto-reply-config`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${freshToken}` },
            body: JSON.stringify({ enabled, text }),
            signal: controller.signal,
        });
        clearTimeout(timeout);
        const data = await res.json();
        return { success: res.ok, error: data.error };
    } catch (e: any) {
        clearTimeout(timeout);
        if (e.name === 'AbortError') return { success: false, error: 'Request timed out. Please try again.' };
        return { success: false, error: e.message };
    }
};

// ── Disconnect WhatsApp via backend ──────────────────────────────────────────
export const disconnectWhatsApp = async (token: string): Promise<void> => {
    const freshToken = await getFreshToken(token);
    const res = await fetch(`${API_BASE}/api/whatsapp/credentials/disconnect`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${freshToken}` }
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to disconnect.');
    if (socket) { socket.disconnect(); socket = null; }
    if (inboxSocket) { inboxSocket.disconnect(); inboxSocket = null; }
};

// ── Read grouped chats (conversations) ──────────────────────────────────────
export const getWhatsAppChats = async (token: string): Promise<any[]> => {
    try {
        const freshToken = await getFreshToken(token);
        const res = await fetch(`${API_BASE}/api/whatsapp/chats`, {
            headers: { Authorization: `Bearer ${freshToken}` }
        });
        if (!res.ok) return [];
        const { data } = await res.json();
        return data || [];
    } catch (e) {
        console.error('[WhatsAppService] Error fetching grouped chats:', e);
        return [];
    }
};

// ── Read message history (always fresh from DB, ordered by timestamp) ─────────
export const getWhatsAppMessageHistory = async (token: string, leadPhone: string, cursor?: string): Promise<any[]> => {
    try {
        const freshToken = await getFreshToken(token);
        let url = `${API_BASE}/api/whatsapp/messages/${encodeURIComponent(leadPhone)}`;
        if (cursor) {
            url += `?cursor=${encodeURIComponent(cursor)}`;
        }
        const res = await fetch(url, {
            headers: { Authorization: `Bearer ${freshToken}` }
        });
        if (!res.ok) return [];
        const { data } = await res.json();
        return data || [];
    } catch (e) {
        console.error('[WhatsAppService] Error fetching message history:', e);
        return [];
    }
};

// ── Send text message ─────────────────────────────────────────────────────────
export const sendWhatsAppTextMessage = async (token: string, to: string, message: string, quotedMsgId?: string, contactName?: string): Promise<{ success: boolean; message?: string; messageId?: string }> => {
    try {
        const freshToken = await getFreshToken(token);
        const res = await fetch(`${API_BASE}/api/whatsapp/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${freshToken}` },
            body: JSON.stringify({ to, message, quotedMsgId, contact_name: contactName })
        });
        let data: { error?: string; messageId?: string } = {};
        try {
            data = await res.json();
        } catch {
            data = { error: res.statusText || `Server error (${res.status})` };
        }
        const errMsg = data.error || (res.ok ? undefined : res.statusText || 'Send failed');
        return { success: res.ok, message: errMsg, messageId: data.messageId };
    } catch (e: any) {
        return { success: false, message: e.message || 'Network error' };
    }
};

// ── Send media (image / document / audio) ────────────────────────────────────
export const sendWhatsAppMedia = async (token: string, to: string, file: File, caption?: string, contactName?: string): Promise<{ success: boolean; error?: string }> => {
    const formData = new FormData();
    formData.append('to', to);
    formData.append('file', file);
    if (caption) formData.append('caption', caption);
    if (contactName) formData.append('contact_name', contactName);

    try {
        const freshToken = await getFreshToken(token);
        const res = await fetch(`${API_BASE}/api/whatsapp/send-media`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${freshToken}` },
            body: formData
        });
        const data = await res.json();
        return { success: res.ok, error: data.error };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
};

export const saveWhatsAppMessageToDB = async (_token: string, _phone: string, _content: string, _sender: string) => {
    return { success: true };
};
