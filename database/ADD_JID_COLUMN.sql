-- Add jid column to whatsapp_contacts and whatsapp_messages
ALTER TABLE public.whatsapp_contacts ADD COLUMN IF NOT EXISTS jid TEXT;
ALTER TABLE public.whatsapp_messages ADD COLUMN IF NOT EXISTS jid TEXT;

-- Update existing records if possible (best effort)
-- For contacts, if lead_phone looks like a number, we can guess the JID
UPDATE public.whatsapp_contacts 
SET jid = CASE 
    WHEN is_group = true THEN lead_phone
    WHEN lead_phone ~ '^[0-9]+$' THEN lead_phone || '@s.whatsapp.net'
    ELSE lead_phone
END
WHERE jid IS NULL;

-- For messages, same logic
UPDATE public.whatsapp_messages
SET jid = CASE 
    WHEN lead_phone ~ '@g.us$' THEN lead_phone
    WHEN lead_phone ~ '^[0-9]+$' THEN lead_phone || '@s.whatsapp.net'
    ELSE lead_phone
END
WHERE jid IS NULL;
