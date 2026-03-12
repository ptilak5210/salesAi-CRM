-- Migration: Make JID the primary identifier for WhatsApp integration

-- 1. Drop the existing primary key constraint (and any unique constraints)
ALTER TABLE whatsapp_contacts DROP CONSTRAINT IF EXISTS whatsapp_contacts_pkey CASCADE;
ALTER TABLE whatsapp_contacts DROP CONSTRAINT IF EXISTS whatsapp_contacts_user_id_lead_phone_key;

-- 2. Add an 'id' column as the new primary key to satisfy Supabase requirements (Realtime works best with a PK)
ALTER TABLE whatsapp_contacts ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid() PRIMARY KEY;

-- 3. Ensure JID is present where possible
UPDATE whatsapp_contacts 
SET jid = lead_phone || '@s.whatsapp.net' 
WHERE jid IS NULL AND lead_phone NOT LIKE '%@%' AND lead_phone NOT LIKE '%_group%';

-- 4. Add the unique constraint on user_id and jid to prevent duplicates
ALTER TABLE whatsapp_contacts ADD CONSTRAINT whatsapp_contacts_user_id_jid_key UNIQUE (user_id, jid);

-- 5. Alter columns to allow nulls for lead_phone
ALTER TABLE whatsapp_contacts ALTER COLUMN lead_phone DROP NOT NULL;
ALTER TABLE whatsapp_messages ALTER COLUMN lead_phone DROP NOT NULL;

-- 6. Create logical indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_wa_messages_user_jid ON whatsapp_messages (user_id, jid);
CREATE INDEX IF NOT EXISTS idx_wa_messages_timestamp ON whatsapp_messages (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_wa_messages_status ON whatsapp_messages (status);
