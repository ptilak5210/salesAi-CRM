-- Run this migration to enable WhatsApp inbox improvements
-- Execute in Supabase SQL Editor or via psql

-- 1. Status column for message delivery tracking
ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'received';

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_message_id
ON public.whatsapp_messages (user_id, message_id)
WHERE message_id IS NOT NULL;

-- Prevent duplicate messages when same message_id arrives from history sync chunks
CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_messages_unique_msg
ON public.whatsapp_messages (user_id, message_id)
WHERE message_id IS NOT NULL;

-- 2. whatsapp_contacts for names and profile pictures
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
