-- ============================================================
-- 002_migrate_sessions.sql
-- WhatsApp Dashboard auth migration
-- Run sequentially after 001_whatsapp_dashboard.sql if needed
-- ============================================================

-- 1. Ensure whatsapp_sessions has the necessary composite unique index for upserts
CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_sessions_user_key
    ON public.whatsapp_sessions (user_id, key_id);

-- 2. Migrate existing records from baileys_auth_state to whatsapp_sessions
--    Since 'value' is JSONB in baileys_auth_state and 'key_data' is JSONB in whatsapp_sessions, cast isn't needed
INSERT INTO public.whatsapp_sessions (user_id, key_id, key_data, created_at)
SELECT
    user_id,
    key_type || '-' || key_id AS key_id,
    value AS key_data,
    created_at
FROM public.baileys_auth_state
ON CONFLICT (user_id, key_id) DO UPDATE SET
    key_data = EXCLUDED.key_data;

-- 3. Drop old table and its associated policies/indexes
DROP TABLE IF EXISTS public.baileys_auth_state CASCADE;
