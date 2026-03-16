-- ============================================================
-- MASTER_PRODUCTION_MIGRATION.sql (CLEAN CRM CORE)
-- Run this to harden production schema without WhatsApp
-- ============================================================

-- 1. Hardening Leads Table
ALTER TABLE public.leads ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_status_check;
ALTER TABLE public.leads ADD CONSTRAINT leads_status_check
  CHECK (status IN ('uncontacted','New','Contacted','Qualified','Proposal','Won','Lost'));
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_score_check;
ALTER TABLE public.leads ADD CONSTRAINT leads_score_check
  CHECK (score IN ('Cold','Warm','Hot'));

CREATE INDEX IF NOT EXISTS idx_leads_user_id ON public.leads (user_id);
CREATE INDEX IF NOT EXISTS idx_leads_user_mobile ON public.leads (user_id, mobile) WHERE mobile IS NOT NULL;

-- 2. Hardening Activities Table
ALTER TABLE public.activities ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.activities ALTER COLUMN status SET NOT NULL;
ALTER TABLE public.activities ALTER COLUMN status SET DEFAULT 'confirmed';

-- 3. Enabling RLS
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- 4. Re-applying Core Policies (Safety)
DROP POLICY IF EXISTS "leads_select" ON public.leads;
CREATE POLICY "leads_select" ON public.leads FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "leads_insert" ON public.leads;
CREATE POLICY "leads_insert" ON public.leads FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "leads_update" ON public.leads;
CREATE POLICY "leads_update" ON public.leads FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "activities_select" ON public.activities;
CREATE POLICY "activities_select" ON public.activities FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "activities_insert" ON public.activities;
CREATE POLICY "activities_insert" ON public.activities FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "activities_update" ON public.activities;
CREATE POLICY "activities_update" ON public.activities FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "clients_select" ON public.clients;
CREATE POLICY "clients_select" ON public.clients FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "clients_update" ON public.clients;
CREATE POLICY "clients_update" ON public.clients FOR UPDATE USING (auth.uid() = user_id);
