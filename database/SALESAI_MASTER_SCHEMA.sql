-- ============================================================
-- SALESAI_MASTER_SCHEMA.sql
-- SalesAI CRM — Complete Production Database Schema
-- Version: 2.0 (All migrations included — 000 through 011)
-- Last Updated: 2026-05-20
--
-- HOW TO USE:
-- 1. Go to your Supabase project → SQL Editor
-- 2. Paste this entire file and click "Run"
-- 3. This is idempotent — safe to run on existing databases
--    (uses CREATE IF NOT EXISTS, ADD COLUMN IF NOT EXISTS, DROP POLICY IF EXISTS)
-- ============================================================

-- ─── EXTENSIONS ──────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLE 1: clients
-- One row per registered SalesAI business owner account
-- ============================================================
CREATE TABLE IF NOT EXISTS public.clients (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    business_name        TEXT,
    business_type        TEXT,
    onboarding_completed BOOLEAN DEFAULT FALSE,
    created_at           TIMESTAMPTZ DEFAULT NOW(),
    updated_at           TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own client profile" ON public.clients;
CREATE POLICY "Users can view their own client profile"   ON public.clients FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert their own client profile" ON public.clients;
CREATE POLICY "Users can insert their own client profile" ON public.clients FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own client profile" ON public.clients;
CREATE POLICY "Users can update their own client profile" ON public.clients FOR UPDATE USING (auth.uid() = user_id);

-- ============================================================
-- TABLE 2: team_members
-- Sales team roster managed by the Owner (Super Admin).
-- ============================================================
CREATE TABLE IF NOT EXISTS public.team_members (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    name         TEXT NOT NULL,
    email        TEXT,
    phone        TEXT,
    role         TEXT DEFAULT 'Sales Executive',
    pipeline_ids UUID[] DEFAULT '{}',
    is_active    BOOLEAN DEFAULT TRUE,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_team_members_owner_id     ON public.team_members(owner_id);
CREATE INDEX IF NOT EXISTS idx_team_members_auth_user_id ON public.team_members(auth_user_id);
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner can manage team members" ON public.team_members;
CREATE POLICY "Owner can manage team members" ON public.team_members
    USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
DROP POLICY IF EXISTS "Team members can view own record" ON public.team_members;
CREATE POLICY "Team members can view own record" ON public.team_members
    FOR SELECT USING (auth.uid() = auth_user_id);

-- ============================================================
-- TABLE 3: leads
-- CRM customer / prospect profiles
-- ============================================================
CREATE TABLE IF NOT EXISTS public.leads (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name           TEXT,
    display_name   TEXT,
    email          TEXT,
    mobile         TEXT,
    whatsapp       TEXT,
    company        TEXT,
    role           TEXT,
    address        TEXT,
    source         TEXT DEFAULT 'Manual',
    status         TEXT NOT NULL DEFAULT 'New'
                   CHECK (status IN ('uncontacted','New','Contacted','Qualified','Proposal','Won','Lost','Follow Up','Replied')),
    score          TEXT NOT NULL DEFAULT 'Cold'
                   CHECK (score IN ('Cold','Warm','Hot')),
    deal_value     NUMERIC DEFAULT 0,
    ai_paused      BOOLEAN DEFAULT FALSE,
    pipeline_id    UUID,
    stage_id       UUID,
    assigned_to_id UUID REFERENCES public.team_members(id) ON DELETE SET NULL,
    last_contact   TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_leads_user_id      ON public.leads(user_id);
CREATE INDEX IF NOT EXISTS idx_leads_user_whatsapp ON public.leads(user_id, whatsapp);
CREATE INDEX IF NOT EXISTS idx_leads_user_mobile   ON public.leads(user_id, mobile) WHERE mobile IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to   ON public.leads(assigned_to_id);
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "leads_select" ON public.leads;
CREATE POLICY "leads_select" ON public.leads FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "leads_insert" ON public.leads;
CREATE POLICY "leads_insert" ON public.leads FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "leads_update" ON public.leads;
CREATE POLICY "leads_update" ON public.leads FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "leads_delete" ON public.leads;
CREATE POLICY "leads_delete" ON public.leads FOR DELETE USING (auth.uid() = user_id);

-- Supabase Realtime for leads
ALTER TABLE public.leads REPLICA IDENTITY FULL;

-- ============================================================
-- TABLE 4: whatsapp_contacts
-- WhatsApp contact metadata synced from Baileys
-- ============================================================
CREATE TABLE IF NOT EXISTS public.whatsapp_contacts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    lead_phone          TEXT NOT NULL,
    jid                 TEXT NOT NULL,
    contact_name        TEXT,
    profile_picture_url TEXT,
    is_group            BOOLEAN NOT NULL DEFAULT FALSE,
    ai_paused           BOOLEAN DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_contacts_user_jid   ON public.whatsapp_contacts(user_id, jid);
CREATE        INDEX IF NOT EXISTS idx_whatsapp_contacts_user_phone ON public.whatsapp_contacts(user_id, lead_phone);
ALTER TABLE public.whatsapp_contacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own contacts" ON public.whatsapp_contacts;
CREATE POLICY "Users manage own contacts" ON public.whatsapp_contacts
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- TABLE 5: whatsapp_messages
-- Full message history for the Inbox
-- ============================================================
CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    message_id   TEXT,
    lead_phone   TEXT NOT NULL,
    jid          TEXT NOT NULL,
    content      TEXT NOT NULL,
    sender       TEXT NOT NULL CHECK (sender IN ('user','lead','ai')),
    status       TEXT NOT NULL DEFAULT 'sent'
                 CHECK (status IN ('pending','sent','delivered','read','received','error','played')),
    contact_name TEXT,
    is_group     BOOLEAN NOT NULL DEFAULT FALSE,
    timestamp    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_messages_user_msgid
    ON public.whatsapp_messages(user_id, message_id) WHERE message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_user_jid_ts
    ON public.whatsapp_messages(user_id, jid, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_user_phone_ts
    ON public.whatsapp_messages(user_id, lead_phone, timestamp DESC);
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own messages" ON public.whatsapp_messages;
CREATE POLICY "Users manage own messages" ON public.whatsapp_messages
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- TABLE 6: whatsapp_credentials
-- WhatsApp connection config + n8n AI Agent settings
-- ============================================================
CREATE TABLE IF NOT EXISTS public.whatsapp_credentials (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    phone_number_id    TEXT,
    access_token       TEXT,
    is_connected       BOOLEAN NOT NULL DEFAULT FALSE,
    ai_enabled         BOOLEAN NOT NULL DEFAULT FALSE,
    auto_reply_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    auto_reply_text    TEXT DEFAULT '',
    session_name       TEXT DEFAULT 'default',
    -- n8n AI Agent integration
    ai_agent_enabled   BOOLEAN DEFAULT FALSE,
    n8n_webhook_url    TEXT DEFAULT NULL,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_whatsapp_credentials_user_id ON public.whatsapp_credentials(user_id);
ALTER TABLE public.whatsapp_credentials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own credentials" ON public.whatsapp_credentials;
CREATE POLICY "Users read own credentials" ON public.whatsapp_credentials
    FOR SELECT USING (auth.uid() = user_id);

-- ============================================================
-- TABLE 7: ai_activity_logs
-- Log of every AI action for audit trail
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ai_activity_logs (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    lead_phone TEXT NOT NULL,
    action     TEXT NOT NULL,
    details    TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
ALTER TABLE public.ai_activity_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can insert their own ai logs" ON public.ai_activity_logs;
CREATE POLICY "Users can insert their own ai logs" ON public.ai_activity_logs
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can view their own ai logs" ON public.ai_activity_logs;
CREATE POLICY "Users can view their own ai logs" ON public.ai_activity_logs
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- TABLE 8: data_activity_history
-- Tracks CSV import / export events
-- ============================================================
CREATE TABLE IF NOT EXISTS public.data_activity_history (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    action_type   TEXT NOT NULL CHECK (action_type IN ('IMPORT','EXPORT')),
    record_count  INTEGER NOT NULL DEFAULT 0,
    skipped_count INTEGER DEFAULT 0,
    filter_type   TEXT,
    created_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_data_activity_history_user_id    ON public.data_activity_history(user_id);
CREATE INDEX IF NOT EXISTS idx_data_activity_history_created_at ON public.data_activity_history(created_at DESC);
ALTER TABLE public.data_activity_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own activity history" ON public.data_activity_history;
CREATE POLICY "Users can view their own activity history"
    ON public.data_activity_history FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert their own activity history" ON public.data_activity_history;
CREATE POLICY "Users can insert their own activity history"
    ON public.data_activity_history FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- TABLE 9: activities
-- Meetings / Calls / Notes / Tasks
-- ============================================================
CREATE TABLE IF NOT EXISTS public.activities (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title      TEXT NOT NULL,
    attendee   TEXT NOT NULL,
    date       TEXT NOT NULL,
    time       TEXT NOT NULL,
    type       TEXT NOT NULL,
    status     TEXT NOT NULL DEFAULT 'confirmed'
               CHECK (status IN ('pending','confirmed','cancelled')),
    agenda     TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own activities" ON public.activities;
CREATE POLICY "Users can view their own activities"   ON public.activities FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert their own activities" ON public.activities;
CREATE POLICY "Users can insert their own activities" ON public.activities FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own activities" ON public.activities;
CREATE POLICY "Users can update their own activities" ON public.activities FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete their own activities" ON public.activities;
CREATE POLICY "Users can delete their own activities" ON public.activities FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- TABLE 10: pipelines
-- Sales pipeline containers (each user can have multiple)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.pipelines (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name           TEXT NOT NULL,
    team_member_id UUID REFERENCES public.team_members(id) ON DELETE SET NULL,
    created_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pipelines_user_id ON public.pipelines(user_id);
ALTER TABLE public.pipelines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own pipelines" ON public.pipelines;
CREATE POLICY "Users can view their own pipelines"   ON public.pipelines FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert their own pipelines" ON public.pipelines;
CREATE POLICY "Users can insert their own pipelines" ON public.pipelines FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own pipelines" ON public.pipelines;
CREATE POLICY "Users can update their own pipelines" ON public.pipelines FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete their own pipelines" ON public.pipelines;
CREATE POLICY "Users can delete their own pipelines" ON public.pipelines FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- TABLE 11: pipeline_stages
-- Kanban columns within each pipeline
-- ============================================================
CREATE TABLE IF NOT EXISTS public.pipeline_stages (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_id  UUID NOT NULL REFERENCES public.pipelines(id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    color        TEXT DEFAULT 'text-slate-600',
    bg_color     TEXT DEFAULT 'bg-slate-50',
    border_color TEXT DEFAULT 'border-slate-200',
    order_index  INTEGER NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_pipeline_id ON public.pipeline_stages(pipeline_id);
ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view stages of their pipelines" ON public.pipeline_stages;
CREATE POLICY "Users can view stages of their pipelines" ON public.pipeline_stages
    FOR SELECT USING (EXISTS (SELECT 1 FROM public.pipelines p WHERE p.id = pipeline_id AND p.user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can insert stages to their pipelines" ON public.pipeline_stages;
CREATE POLICY "Users can insert stages to their pipelines" ON public.pipeline_stages
    FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.pipelines p WHERE p.id = pipeline_id AND p.user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can update their pipeline stages" ON public.pipeline_stages;
CREATE POLICY "Users can update their pipeline stages" ON public.pipeline_stages
    FOR UPDATE USING (EXISTS (SELECT 1 FROM public.pipelines p WHERE p.id = pipeline_id AND p.user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can delete their pipeline stages" ON public.pipeline_stages;
CREATE POLICY "Users can delete their pipeline stages" ON public.pipeline_stages
    FOR DELETE USING (EXISTS (SELECT 1 FROM public.pipelines p WHERE p.id = pipeline_id AND p.user_id = auth.uid()));

-- ============================================================
-- TABLE 12: deals
-- Deals / Opportunities linked to leads and pipeline stages
-- ============================================================
CREATE TABLE IF NOT EXISTS public.deals (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    pipeline_id         UUID NOT NULL REFERENCES public.pipelines(id) ON DELETE CASCADE,
    lead_id             UUID REFERENCES public.leads(id) ON DELETE SET NULL,
    lead_name           TEXT NOT NULL,
    company             TEXT,
    phone               TEXT,
    title               TEXT NOT NULL,
    value               NUMERIC DEFAULT 0,
    stage_id            UUID REFERENCES public.pipeline_stages(id) ON DELETE SET NULL,
    score               TEXT DEFAULT 'Cold' CHECK (score IN ('Hot','Warm','Cold')),
    product             TEXT,
    assigned_to_id      UUID REFERENCES public.team_members(id) ON DELETE SET NULL,
    expected_close_date DATE,
    closed_at           TIMESTAMPTZ,
    loss_reason         TEXT,
    notes               TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_deals_user_id     ON public.deals(user_id);
CREATE INDEX IF NOT EXISTS idx_deals_pipeline_id ON public.deals(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_deals_stage_id    ON public.deals(stage_id);
CREATE INDEX IF NOT EXISTS idx_deals_assigned_to ON public.deals(assigned_to_id);
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own deals" ON public.deals;
CREATE POLICY "Users can view their own deals"   ON public.deals FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert their own deals" ON public.deals;
CREATE POLICY "Users can insert their own deals" ON public.deals FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own deals" ON public.deals;
CREATE POLICY "Users can update their own deals" ON public.deals FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete their own deals" ON public.deals;
CREATE POLICY "Users can delete their own deals" ON public.deals FOR DELETE USING (auth.uid() = user_id);

-- Supabase Realtime for deals
ALTER TABLE public.deals REPLICA IDENTITY FULL;

-- ============================================================
-- TABLE 13: deal_stage_history
-- Tracks every time a deal is moved between stages
-- ============================================================
CREATE TABLE IF NOT EXISTS public.deal_stage_history (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id       UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
    from_stage_id UUID REFERENCES public.pipeline_stages(id) ON DELETE SET NULL,
    to_stage_id   UUID NOT NULL REFERENCES public.pipeline_stages(id) ON DELETE CASCADE,
    changed_at    TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.deal_stage_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their deal history" ON public.deal_stage_history;
CREATE POLICY "Users can view their deal history" ON public.deal_stage_history
    FOR SELECT USING (EXISTS (SELECT 1 FROM public.deals d WHERE d.id = deal_id AND d.user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can insert deal history" ON public.deal_stage_history;
CREATE POLICY "Users can insert deal history" ON public.deal_stage_history
    FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.deals d WHERE d.id = deal_id AND d.user_id = auth.uid()));

-- ============================================================
-- SUPABASE REALTIME PUBLICATION
-- Enable real-time updates for leads and deals tables
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
END
$$;

-- Add tables to Realtime (safe to run even if already added)
ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;
ALTER PUBLICATION supabase_realtime ADD TABLE public.deals;

-- ============================================================
-- FUNCTION: get_recent_whatsapp_chats
-- Returns the latest message per conversation for the Inbox
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
        COALESCE(c.contact_name, m.contact_name) AS contact_name,
        c.profile_picture_url,
        COALESCE(m.is_group, c.is_group, FALSE) AS is_group,
        m.content AS last_message,
        m.timestamp AS last_timestamp,
        m.sender AS last_sender
    FROM public.whatsapp_messages m
    LEFT JOIN public.whatsapp_contacts c
        ON c.user_id = m.user_id AND (c.jid = m.jid OR c.lead_phone = m.lead_phone)
    WHERE m.user_id = p_user_id
    ORDER BY m.jid, m.timestamp DESC, m.id DESC;
$$;

-- ============================================================
-- TRIGGER: create_default_pipeline
-- Automatically creates a default pipeline when a new user
-- signs up (fires on auth.users insert)
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_default_pipeline()
RETURNS trigger AS $$
DECLARE
    new_pipeline_id UUID;
BEGIN
    INSERT INTO public.pipelines (user_id, name)
    VALUES (NEW.id, 'Default Sales Pipeline')
    RETURNING id INTO new_pipeline_id;

    INSERT INTO public.pipeline_stages (pipeline_id, name, color, bg_color, border_color, order_index)
    VALUES
        (new_pipeline_id, 'New Lead',       'text-slate-600',   'bg-slate-50',   'border-slate-200',   1),
        (new_pipeline_id, 'Contacted',      'text-blue-600',    'bg-blue-50',    'border-blue-200',    2),
        (new_pipeline_id, 'Qualified',      'text-indigo-600',  'bg-indigo-50',  'border-indigo-200',  3),
        (new_pipeline_id, 'Proposal Sent',  'text-amber-600',   'bg-amber-50',   'border-amber-200',   4),
        (new_pipeline_id, 'Negotiation',    'text-orange-600',  'bg-orange-50',  'border-orange-200',  5),
        (new_pipeline_id, 'Won',            'text-emerald-600', 'bg-emerald-50', 'border-emerald-200', 6),
        (new_pipeline_id, 'Lost',           'text-rose-600',    'bg-rose-50',    'border-rose-200',    7);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop and recreate the trigger (safe)
DROP TRIGGER IF EXISTS on_auth_user_created_pipeline ON auth.users;
CREATE TRIGGER on_auth_user_created_pipeline
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.create_default_pipeline();

-- ============================================================
-- FORCE SCHEMA RELOAD
-- Tell Supabase PostgREST to reload its API schema cache
-- ============================================================
NOTIFY pgrst, 'reload schema';

-- ============================================================
-- ✅ DONE! SalesAI CRM database is fully configured.
-- Tables: clients, team_members, leads, whatsapp_contacts,
--         whatsapp_messages, whatsapp_credentials,
--         ai_activity_logs, data_activity_history, activities,
--         pipelines, pipeline_stages, deals, deal_stage_history
-- Functions: get_recent_whatsapp_chats, create_default_pipeline
-- Realtime: leads, deals
-- ============================================================
