-- ============================================================
-- RECOVERY_FULL_SCHEMA.sql
-- Run this script in the Supabase SQL Editor to fully recreate 
-- your entire database schema and RLS policies.
-- ============================================================

-- ── 1. USERS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.users (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- ── 2. LEADS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT,
    display_name TEXT,
    email TEXT,
    mobile TEXT,
    status TEXT DEFAULT 'New',
    score TEXT DEFAULT 'Cold',
    source TEXT DEFAULT 'Manual',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 3. ACTIVITIES ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    attendee TEXT NOT NULL,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 4. CLIENTS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    business_name TEXT,
    business_type TEXT,
    onboarding_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 5. WHATSAPP CONTACTS ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.whatsapp_contacts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    lead_phone      TEXT NOT NULL,
    jid             TEXT NOT NULL,
    contact_name    TEXT,
    profile_picture_url TEXT,
    is_group        BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_contacts_user_jid
    ON public.whatsapp_contacts (user_id, jid);
CREATE INDEX IF NOT EXISTS idx_whatsapp_contacts_user_phone
    ON public.whatsapp_contacts (user_id, lead_phone);


-- ── 6. WHATSAPP MESSAGES ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    message_id      TEXT,
    lead_phone      TEXT NOT NULL,
    jid             TEXT NOT NULL,
    content         TEXT NOT NULL,
    sender          TEXT NOT NULL CHECK (sender IN ('user', 'lead', 'ai')),
    status          TEXT NOT NULL DEFAULT 'sent'
                        CHECK (status IN ('pending','sent','delivered','read','received','error','played')),
    contact_name    TEXT,
    is_group        BOOLEAN NOT NULL DEFAULT FALSE,
    timestamp       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_messages_user_msgid
    ON public.whatsapp_messages (user_id, message_id)
    WHERE message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_user_jid_ts
    ON public.whatsapp_messages (user_id, jid, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_user_phone_ts
    ON public.whatsapp_messages (user_id, lead_phone, timestamp DESC);


-- ── 7. WHATSAPP CREDENTIALS ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.whatsapp_credentials (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    phone_number_id     TEXT,
    access_token        TEXT,
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


-- ── 8. WHATSAPP SESSIONS (Replaced baileys_auth_state) ──────
CREATE TABLE IF NOT EXISTS public.whatsapp_sessions (
    id          BIGSERIAL PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    key_id      TEXT NOT NULL,
    key_data    JSONB NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_sessions_user_key
    ON public.whatsapp_sessions (user_id, key_id);


-- ============================================================
-- RLS POLICIES
-- ============================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_sessions ENABLE ROW LEVEL SECURITY;

-- USERS
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
CREATE POLICY "Users can view their own profile" ON public.users FOR SELECT USING (auth.uid() = id);
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
CREATE POLICY "Users can update their own profile" ON public.users FOR UPDATE USING (auth.uid() = id);

-- LEADS
DROP POLICY IF EXISTS "Users can view their own leads" ON public.leads;
CREATE POLICY "Users can view their own leads" ON public.leads FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert their own leads" ON public.leads;
CREATE POLICY "Users can insert their own leads" ON public.leads FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own leads" ON public.leads;
CREATE POLICY "Users can update their own leads" ON public.leads FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete their own leads" ON public.leads;
CREATE POLICY "Users can delete their own leads" ON public.leads FOR DELETE USING (auth.uid() = user_id);

-- ACTIVITIES
DROP POLICY IF EXISTS "Users can view their own activities" ON public.activities;
CREATE POLICY "Users can view their own activities" ON public.activities FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert their own activities" ON public.activities;
CREATE POLICY "Users can insert their own activities" ON public.activities FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own activities" ON public.activities;
CREATE POLICY "Users can update their own activities" ON public.activities FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete their own activities" ON public.activities;
CREATE POLICY "Users can delete their own activities" ON public.activities FOR DELETE USING (auth.uid() = user_id);

-- CLIENTS
DROP POLICY IF EXISTS "Users can view their own client profile" ON public.clients;
CREATE POLICY "Users can view their own client profile" ON public.clients FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own client profile" ON public.clients;
CREATE POLICY "Users can update their own client profile" ON public.clients FOR UPDATE USING (auth.uid() = user_id);

-- WHATSAPP CONTACTS
DROP POLICY IF EXISTS "Users manage own contacts" ON public.whatsapp_contacts;
CREATE POLICY "Users manage own contacts" ON public.whatsapp_contacts
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- WHATSAPP MESSAGES
DROP POLICY IF EXISTS "Users manage own messages" ON public.whatsapp_messages;
CREATE POLICY "Users manage own messages" ON public.whatsapp_messages
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- WHATSAPP CREDENTIALS
DROP POLICY IF EXISTS "Users read own credentials" ON public.whatsapp_credentials;
CREATE POLICY "Users read own credentials" ON public.whatsapp_credentials
    FOR SELECT USING (auth.uid() = user_id);

-- WHATSAPP SESSIONS (Service role only — not exposed to frontend)
DROP POLICY IF EXISTS "Service role manages auth state" ON public.whatsapp_sessions;
CREATE POLICY "Service role manages auth state" ON public.whatsapp_sessions
    USING (auth.uid() = user_id);


-- ============================================================
-- FUNCTIONS
-- ============================================================
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
