-- Store contact and group metadata (name, profile picture) for CRM display
CREATE TABLE IF NOT EXISTS public.whatsapp_contacts (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    lead_phone TEXT NOT NULL,
    contact_name TEXT,
    profile_picture_url TEXT,
    is_group BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, lead_phone)
);

-- Enable RLS
ALTER TABLE public.whatsapp_contacts ENABLE ROW LEVEL SECURITY;

-- Idempotent: drop first so re-running this script never fails
DROP POLICY IF EXISTS "Users can view their own contacts" ON public.whatsapp_contacts;
CREATE POLICY "Users can view their own contacts"
ON public.whatsapp_contacts FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own contacts" ON public.whatsapp_contacts;
CREATE POLICY "Users can insert their own contacts"
ON public.whatsapp_contacts FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own contacts" ON public.whatsapp_contacts;
CREATE POLICY "Users can update their own contacts"
ON public.whatsapp_contacts FOR UPDATE
USING (auth.uid() = user_id);
