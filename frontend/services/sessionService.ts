import { supabase } from '../lib/supabase';

const API_BASE = 'http://localhost:3001';

const getFreshToken = async () => {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token || '';
};

export interface SessionStatus {
    status: 'connected' | 'disconnected' | 'connecting' | 'pending' | 'disconnected_stale';
    socketActive: boolean;
    dbConnected: boolean;
    phoneNumberId: string | null;
    aiEnabled: boolean;
    autoReplyEnabled: boolean;
    connectedSince: string | null;
}

export const getSessionStatus = async (): Promise<SessionStatus | null> => {
    try {
        const token = await getFreshToken();
        const res = await fetch(`${API_BASE}/api/session/status`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) return null;
        const { data } = await res.json();
        return data;
    } catch (e) {
        console.error('[SessionService] getSessionStatus error:', e);
        return null;
    }
};

export const createSession = async (): Promise<{ success: boolean; status?: string; message?: string; error?: string }> => {
    try {
        const token = await getFreshToken();
        const res = await fetch(`${API_BASE}/api/session/create`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` }
        });
        const json = await res.json();
        return { success: res.ok, status: json.status, message: json.message, error: json.error };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
};

export const logoutSession = async (): Promise<{ success: boolean; message?: string; error?: string }> => {
    try {
        const token = await getFreshToken();
        const res = await fetch(`${API_BASE}/api/session/logout`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` }
        });
        const json = await res.json();
        return { success: res.ok, message: json.message, error: json.error };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
};
