-- Store lead_phone as exact mobile number with + prefix (no extra digits, no guessing country).
-- Run in Supabase SQL Editor after MIGRATE_WHATSAPP and ADD_AUTO_REPLY.

-- Add + to digit-only values; leave group JIDs (@g.us) and already-prefixed values unchanged.
-- whatsapp_messages
UPDATE public.whatsapp_messages
SET lead_phone = '+' || lead_phone
WHERE lead_phone IS NOT NULL AND lead_phone <> ''
  AND lead_phone NOT LIKE '+%' AND lead_phone NOT LIKE '%@%'
  AND lead_phone ~ '^[0-9]+$';

-- whatsapp_contacts
UPDATE public.whatsapp_contacts
SET lead_phone = '+' || lead_phone
WHERE lead_phone IS NOT NULL AND lead_phone <> ''
  AND lead_phone NOT LIKE '+%' AND lead_phone NOT LIKE '%@%'
  AND lead_phone ~ '^[0-9]+$';
