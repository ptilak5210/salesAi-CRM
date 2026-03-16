-- ============================================================
-- leads.sql — CRM customer profiles
-- Primary Key: id (UUID)
-- Foreign Key: user_id → auth.users(id)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.leads (
    id          UUID        NOT NULL DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL,                          -- FK → auth.users
    name        TEXT,                                          -- Real contact name (nullable for LIDs/anon)
    display_name TEXT,                                         -- Best label for UI (name || mobile || 'Unknown')
    email       TEXT,
    mobile      TEXT,                                          -- E.164 phone number e.g. +919876543210
    whatsapp    TEXT,                                          -- Full JID e.g. 919876543210@s.whatsapp.net
    company     TEXT,
    role        TEXT,
    source      TEXT,
    status      TEXT        NOT NULL DEFAULT 'uncontacted'
                            CHECK (status IN ('uncontacted','New','Contacted','Qualified','Proposal','Won','Lost')),
    score       TEXT        NOT NULL DEFAULT 'Cold'
                            CHECK (score IN ('Cold','Warm','Hot')),
    last_contact TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- PRIMARY KEY
    CONSTRAINT leads_pkey PRIMARY KEY (id),

    -- FOREIGN KEY
    CONSTRAINT leads_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_leads_user_id      ON public.leads (user_id);
CREATE INDEX IF NOT EXISTS idx_leads_user_whatsapp ON public.leads (user_id, whatsapp);
CREATE INDEX IF NOT EXISTS idx_leads_user_mobile   ON public.leads (user_id, mobile) WHERE mobile IS NOT NULL;

-- RLS
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "leads_select" ON public.leads;
CREATE POLICY "leads_select" ON public.leads FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "leads_insert" ON public.leads;
CREATE POLICY "leads_insert" ON public.leads FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "leads_update" ON public.leads;
CREATE POLICY "leads_update" ON public.leads FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "leads_delete" ON public.leads;
CREATE POLICY "leads_delete" ON public.leads FOR DELETE USING (auth.uid() = user_id);
