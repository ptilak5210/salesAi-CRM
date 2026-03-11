-- RUN THIS ENTIRE SCRIPT IN YOUR SUPABASE SQL EDITOR

-- 1. Create whatsapp_contacts table to fix the 404 error
CREATE TABLE IF NOT EXISTS public.whatsapp_contacts (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    lead_phone TEXT NOT NULL,
    contact_name TEXT,
    profile_picture_url TEXT,
    is_group BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, lead_phone)
);

ALTER TABLE public.whatsapp_contacts ENABLE ROW LEVEL SECURITY;

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

-- 2. Add missing columns to whatsapp_messages to fix the "No messages yet" error
ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'received',
  ADD COLUMN IF NOT EXISTS contact_name TEXT,
  ADD COLUMN IF NOT EXISTS is_group BOOLEAN DEFAULT FALSE;

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_message_id
ON public.whatsapp_messages (user_id, message_id)
WHERE message_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_messages_unique_msg
ON public.whatsapp_messages (user_id, message_id)
WHERE message_id IS NOT NULL;
