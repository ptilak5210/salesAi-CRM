-- ============================================================
-- 001_whatsapp_dashboard.sql
-- WhatsApp Dashboard schema — run in Supabase SQL Editor
-- Safely uses CREATE TABLE IF NOT EXISTS for incremental runs.
-- ============================================================

-- ── 1. contacts (maps to whatsapp_contacts) ──────────────────
-- Stores one row per unique WhatsApp contact per user.
CREATE TABLE IF NOT EXISTS public.whatsapp_contacts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    lead_phone      TEXT NOT NULL,           -- digits only, e.g. 919876543210
    jid             TEXT NOT NULL,           -- full JID: 919876543210@s.whatsapp.net or group@g.us
    contact_name    TEXT,
    profile_picture_url TEXT,
    is_group        BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One row per (user, jid) — prevents duplicate contacts for the same chat
CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_contacts_user_jid
    ON public.whatsapp_contacts (user_id, jid);

-- Fast lookup by phone number (for name resolution)
CREATE INDEX IF NOT EXISTS idx_whatsapp_contacts_user_phone
    ON public.whatsapp_contacts (user_id, lead_phone);


-- ── 2. whatsapp_messages ─────────────────────────────────────
-- Stores every WhatsApp message (incoming & outgoing) per user.
CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    message_id      TEXT,                   -- Baileys key.id, used for dedup
    lead_phone      TEXT NOT NULL,           -- digits only
    jid             TEXT NOT NULL,           -- full JID of the conversation
    content         TEXT NOT NULL,
    sender          TEXT NOT NULL CHECK (sender IN ('user', 'lead', 'ai')),
    status          TEXT NOT NULL DEFAULT 'sent'
                        CHECK (status IN ('pending','sent','delivered','read','received','error','played')),
    contact_name    TEXT,
    is_group        BOOLEAN NOT NULL DEFAULT FALSE,
    timestamp       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Deduplication: one message per Baileys message_id (per user)
CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_messages_user_msgid
    ON public.whatsapp_messages (user_id, message_id)
    WHERE message_id IS NOT NULL;

-- Most common access pattern: all messages for a conversation, ordered by time
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_user_jid_ts
    ON public.whatsapp_messages (user_id, jid, timestamp DESC);

-- Chat list grouping: latest message per lead_phone
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_user_phone_ts
    ON public.whatsapp_messages (user_id, lead_phone, timestamp DESC);


-- ── 3. sessions (maps to whatsapp_credentials) ──────────────
-- Stores Baileys auth state + connection status per user.
CREATE TABLE IF NOT EXISTS public.whatsapp_credentials (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    phone_number_id     TEXT,               -- WhatsApp Business phone number ID (if available)
    access_token        TEXT,               -- Stored Baileys auth creds JSON (service-role only)
    is_connected        BOOLEAN NOT NULL DEFAULT FALSE,
    ai_enabled          BOOLEAN NOT NULL DEFAULT FALSE,
    auto_reply_enabled  BOOLEAN NOT NULL DEFAULT FALSE,
    auto_reply_text     TEXT DEFAULT '',
    session_name        TEXT DEFAULT 'default',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_credentials_user_id
    ON public.whatsapp_credentials (user_id);


-- ── 5. RLS Policies ─────────────────────────────────────────
ALTER TABLE public.whatsapp_contacts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_credentials ENABLE ROW LEVEL SECURITY;

-- whatsapp_contacts
DROP POLICY IF EXISTS "Users manage own contacts" ON public.whatsapp_contacts;
CREATE POLICY "Users manage own contacts" ON public.whatsapp_contacts
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- whatsapp_messages
DROP POLICY IF EXISTS "Users manage own messages" ON public.whatsapp_messages;
CREATE POLICY "Users manage own messages" ON public.whatsapp_messages
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- whatsapp_credentials (users can only read their own row)
DROP POLICY IF EXISTS "Users read own credentials" ON public.whatsapp_credentials;
CREATE POLICY "Users read own credentials" ON public.whatsapp_credentials
    FOR SELECT USING (auth.uid() = user_id);


-- ── 6. Optimised RPC: get_recent_whatsapp_chats ─────────────
-- Returns the latest message per JID for a user, enriched with contact metadata.
-- Used by GET /api/conversations and GET /api/whatsapp/chats.
DROP FUNCTION IF EXISTS public.get_recent_whatsapp_chats(UUID);
CREATE OR REPLACE FUNCTION public.get_recent_whatsapp_chats(p_user_id UUID)
RETURNS TABLE (
    jid                 TEXT,
    lead_phone          TEXT,
    contact_name        TEXT,
    profile_picture_url TEXT,
    is_group            BOOLEAN,
    last_message        TEXT,
    last_timestamp      TIMESTAMPTZ,
    last_sender         TEXT
)
LANGUAGE SQL STABLE SECURITY DEFINER AS $$
    SELECT DISTINCT ON (m.jid)
        m.jid,
        m.lead_phone,
        COALESCE(c.contact_name, m.contact_name)    AS contact_name,
        c.profile_picture_url,
        COALESCE(m.is_group, c.is_group, FALSE)     AS is_group,
        m.content                                   AS last_message,
        m.timestamp                                 AS last_timestamp,
        m.sender                                    AS last_sender
    FROM public.whatsapp_messages m
    LEFT JOIN public.whatsapp_contacts c
        ON c.user_id = m.user_id AND (c.jid = m.jid OR c.lead_phone = m.lead_phone)
    WHERE m.user_id = p_user_id
    ORDER BY m.jid, m.timestamp DESC, m.id DESC;
$$;
