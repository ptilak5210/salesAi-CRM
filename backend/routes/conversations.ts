import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { supabaseAdmin } from '../../database/supabase';

const router = Router();

router.use(requireAuth);

// Normalize a JID-like identifier so lookups work for both
// full JIDs (919876543210@s.whatsapp.net) and bare phone numbers.
function normalizeJid(jid: string): string {
    if (!jid) return jid;
    if (jid.includes('@g.us') || jid.includes('@s.whatsapp.net') || jid.includes('@lid')) return jid;
    const digits = jid.replace(/\D/g, '');
    return digits ? `${digits}@s.whatsapp.net` : jid;
}

// ── GET /api/conversations ─────────────────────────────────────────────────────
// Returns one row per conversation (latest message per JID), enriched with contact metadata.
// Delegates to the same logic as /api/whatsapp/chats for consistency.
router.get('/', async (req, res): Promise<any> => {
    if (!supabaseAdmin) return res.status(500).json({ error: 'Server not configured.' });

    const userId = req.user.id;

    try {
        // Try the optimised RPC first; fall back to in-process grouping
        const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc(
            'get_recent_whatsapp_chats',
            { p_user_id: userId }
        );

        if (!rpcError && rpcData) {
            return res.json({ data: rpcData });
        }

        // Fallback: fetch all messages and group manually
        const { data: messages, error: msgError } = await supabaseAdmin
            .from('whatsapp_messages')
            .select('lead_phone, jid, content, timestamp, sender, contact_name, is_group')
            .eq('user_id', userId)
            .order('timestamp', { ascending: false })
            .order('id', { ascending: false })
            .limit(1000);

        if (msgError) throw msgError;

        const { data: contacts } = await supabaseAdmin
            .from('whatsapp_contacts')
            .select('lead_phone, jid, contact_name, profile_picture_url, is_group')
            .eq('user_id', userId) || { data: [] };

        const contactMap = new Map((contacts || []).map((c: any) => [c.lead_phone, c]));
        const seen = new Set<string>();
        const conversations: any[] = [];

        for (const m of messages || []) {
            const rowJid = m.jid || m.lead_phone;
            if (seen.has(rowJid)) continue;
            seen.add(rowJid);
            const meta = contactMap.get(m.lead_phone);
            conversations.push({
                jid: rowJid,
                lead_phone: m.lead_phone,
                contact_name: meta?.contact_name || m.contact_name,
                profile_picture_url: meta?.profile_picture_url,
                is_group: m.is_group ?? meta?.is_group ?? false,
                last_message: m.content,
                last_timestamp: m.timestamp,
                last_sender: m.sender,
            });
        }

        return res.json({ data: conversations });
    } catch (err: any) {
        console.error('[API] Error fetching conversations:', err);
        return res.status(500).json({ error: err.message });
    }
});

// ── GET /api/conversations/:jid/messages ──────────────────────────────────────
// Returns paginated message history for a specific conversation JID.
// Supports cursor-based pagination via ?cursor=<ISO timestamp>&limit=<n>
router.get('/:jid/messages', async (req, res): Promise<any> => {
    if (!supabaseAdmin) return res.status(500).json({ error: 'Server not configured.' });

    const userId = req.user.id;
    const rawJid = decodeURIComponent(String(req.params.jid ?? ''));
    const normalizedJid = rawJid.includes('@') ? rawJid : normalizeJid(rawJid);

    const cursor = req.query.cursor ? String(req.query.cursor) : null;
    const limitParam = req.query.limit ? parseInt(String(req.query.limit)) : 20;
    const limit = isNaN(limitParam) || limitParam < 1 || limitParam > 100 ? 20 : limitParam;

    let query = supabaseAdmin
        .from('whatsapp_messages')
        .select('id, message_id, user_id, lead_phone, jid, content, sender, timestamp, status, contact_name, is_group')
        .eq('user_id', userId)
        .or(`jid.eq.${normalizedJid},lead_phone.eq.${rawJid},jid.eq.${rawJid}`);

    if (cursor) {
        query = query.lt('timestamp', cursor);
    }

    try {
        const { data, error } = await query
            .order('timestamp', { ascending: false })
            .order('id', { ascending: false })
            .limit(limit);

        if (error) throw error;

        // Return in ascending chronological order so UI can render top→bottom
        const sorted = (data || []).reverse();

        return res.json({
            data: sorted,
            meta: {
                jid: rawJid,
                count: sorted.length,
                hasMore: sorted.length >= limit,
                cursor: sorted[0]?.timestamp ?? null,
            }
        });
    } catch (err: any) {
        console.error(`[API] Error fetching messages for ${rawJid}:`, err);
        return res.status(500).json({ error: err.message });
    }
});

export default router;
