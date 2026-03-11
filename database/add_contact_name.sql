-- Add contact_name column to whatsapp_messages to store WhatsApp display name / group name
ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS contact_name TEXT;

-- Add is_group column to know if it's a group chat
ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS is_group BOOLEAN DEFAULT FALSE;
