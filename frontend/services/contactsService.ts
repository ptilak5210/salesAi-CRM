import { supabase } from '../lib/supabase';

const API_BASE = 'http://localhost:3001';

const getFreshToken = async () => {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token || '';
};

export interface Contact {
    id: string;
    name: string;
    phone: string;
    jid: string;
    isGroup: boolean;
    profilePictureUrl: string | null;
    createdAt: string;
    updatedAt: string;
}

export const getContacts = async (search?: string): Promise<Contact[]> => {
    try {
        const token = await getFreshToken();
        let url = `${API_BASE}/api/contacts`;
        if (search) url += `?search=${encodeURIComponent(search)}`;
        
        const res = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) return [];
        const { data } = await res.json();
        return data || [];
    } catch (e) {
        console.error('[ContactsService] getContacts error:', e);
        return [];
    }
};

export const createContact = async (name: string, phone: string): Promise<{ success: boolean; data?: Contact; error?: string }> => {
    try {
        const token = await getFreshToken();
        const res = await fetch(`${API_BASE}/api/contacts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ name, phone })
        });
        const json = await res.json();
        return { success: res.ok, data: json.data, error: json.error };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
};

export const updateContact = async (id: string, name: string, phone?: string): Promise<{ success: boolean; data?: Contact; error?: string }> => {
    try {
        const token = await getFreshToken();
        const res = await fetch(`${API_BASE}/api/contacts/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ name, phone })
        });
        const json = await res.json();
        return { success: res.ok, data: json.data, error: json.error };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
};

export const deleteContact = async (id: string): Promise<{ success: boolean; error?: string }> => {
    try {
        const token = await getFreshToken();
        const res = await fetch(`${API_BASE}/api/contacts/${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
        });
        const json = await res.json();
        return { success: res.ok, error: json.error };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
};
