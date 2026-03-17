import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { validateBody, sanitizePhone, isValidPhone } from '../middleware/validate';
import { supabaseAdmin } from '../../database/supabase';

const router = Router();

// All routes require authentication
router.use(requireAuth);

// ── GET /api/contacts ──────────────────────────────────────────────────────────
// Returns all contacts for the authenticated user, ordered by name.
router.get('/', async (req, res): Promise<any> => {
    if (!supabaseAdmin) return res.status(500).json({ error: 'Server not configured.' });

    const userId = req.user.id;
    const { search } = req.query;

    let query = supabaseAdmin
        .from('whatsapp_contacts')
        .select('id, user_id, contact_name, lead_phone, jid, is_group, profile_picture_url, created_at, updated_at')
        .eq('user_id', userId)
        .order('contact_name', { ascending: true });

    if (search && typeof search === 'string' && search.trim()) {
        // Use ilike for case-insensitive name/phone search
        query = query.or(`contact_name.ilike.%${search.trim()}%,lead_phone.ilike.%${search.trim()}%`);
    }

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    // Normalize shape for frontend
    const contacts = (data || []).map((c: any) => ({
        id: c.id,
        name: c.contact_name || '',
        phone: c.lead_phone || '',
        jid: c.jid || '',
        isGroup: c.is_group ?? false,
        profilePictureUrl: c.profile_picture_url || null,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
    }));

    return res.json({ data: contacts });
});

// ── POST /api/contacts ─────────────────────────────────────────────────────────
// Create a new contact. Phone must be unique per user.
router.post('/', validateBody(['phone']), async (req, res): Promise<any> => {
    if (!supabaseAdmin) return res.status(500).json({ error: 'Server not configured.' });

    const userId = req.user.id;
    const { name, phone } = req.body;

    const cleanPhone = sanitizePhone(phone);
    if (!isValidPhone(cleanPhone)) {
        return res.status(400).json({ error: 'Invalid phone number. Must be 7–15 digits.' });
    }

    // Check for duplicate
    const { data: existing } = await supabaseAdmin
        .from('whatsapp_contacts')
        .select('id')
        .eq('user_id', userId)
        .eq('lead_phone', cleanPhone)
        .maybeSingle();

    if (existing) {
        return res.status(409).json({ error: 'A contact with this phone number already exists.' });
    }

    const jid = `${cleanPhone}@s.whatsapp.net`;

    const { data, error } = await supabaseAdmin
        .from('whatsapp_contacts')
        .insert({
            user_id: userId,
            contact_name: (name || '').trim() || null,
            lead_phone: cleanPhone,
            jid,
            is_group: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });

    return res.status(201).json({
        data: {
            id: data.id,
            name: data.contact_name || '',
            phone: data.lead_phone,
            jid: data.jid,
            isGroup: data.is_group ?? false,
            profilePictureUrl: data.profile_picture_url || null,
            createdAt: data.created_at,
            updatedAt: data.updated_at,
        }
    });
});

// ── PUT /api/contacts/:id ──────────────────────────────────────────────────────
// Update contact name (and optionally phone).
router.put('/:id', async (req, res): Promise<any> => {
    if (!supabaseAdmin) return res.status(500).json({ error: 'Server not configured.' });

    const userId = req.user.id;
    const { id } = req.params;
    const { name, phone } = req.body;

    if (!name && !phone) {
        return res.status(400).json({ error: 'Provide at least one field to update: name or phone.' });
    }

    const updates: Record<string, any> = { updated_at: new Date().toISOString() };

    if (name !== undefined) {
        updates.contact_name = (name || '').trim() || null;
    }
    if (phone !== undefined) {
        const cleanPhone = sanitizePhone(phone);
        if (!isValidPhone(cleanPhone)) {
            return res.status(400).json({ error: 'Invalid phone number.' });
        }
        updates.lead_phone = cleanPhone;
        updates.jid = `${cleanPhone}@s.whatsapp.net`;
    }

    const { data, error } = await supabaseAdmin
        .from('whatsapp_contacts')
        .update(updates)
        .eq('id', id)
        .eq('user_id', userId)   // Ownership check
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'Contact not found.' });

    return res.json({
        data: {
            id: data.id,
            name: data.contact_name || '',
            phone: data.lead_phone,
            jid: data.jid,
            isGroup: data.is_group ?? false,
            profilePictureUrl: data.profile_picture_url || null,
            createdAt: data.created_at,
            updatedAt: data.updated_at,
        }
    });
});

// ── DELETE /api/contacts/:id ───────────────────────────────────────────────────
// Hard-delete a contact (messages are preserved in whatsapp_messages).
router.delete('/:id', async (req, res): Promise<any> => {
    if (!supabaseAdmin) return res.status(500).json({ error: 'Server not configured.' });

    const userId = req.user.id;
    const { id } = req.params;

    const { error } = await supabaseAdmin
        .from('whatsapp_contacts')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);   // Ownership check

    if (error) return res.status(500).json({ error: error.message });

    return res.json({ success: true });
});

export default router;
