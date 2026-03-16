-- ============================================================
-- DATABASE_TEST_SINGLE.sql
-- Single query — shows ALL test results at once in one table
-- Run this in Supabase SQL Editor
-- ============================================================

SELECT * FROM (

  -- TABLES
  SELECT 
    '1. Tables' AS category,
    table_name AS item,
    'EXISTS ✅' AS status
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN ('leads','whatsapp_contacts','whatsapp_messages',
      'whatsapp_credentials','whatsapp_sessions','activities','clients','users')

  UNION ALL

  -- PRIMARY KEYS
  SELECT 
    '2. Primary Keys',
    table_name || ' → ' || constraint_name,
    '✅ OK'
  FROM information_schema.table_constraints
  WHERE table_schema = 'public' AND constraint_type = 'PRIMARY KEY'
    AND table_name IN ('leads','whatsapp_contacts','whatsapp_messages',
      'whatsapp_credentials','whatsapp_sessions','activities','clients')

  UNION ALL

  -- FOREIGN KEYS
  SELECT 
    '3. Foreign Keys',
    table_name || ' → ' || constraint_name,
    '✅ OK'
  FROM information_schema.table_constraints
  WHERE table_schema = 'public' AND constraint_type = 'FOREIGN KEY'
    AND table_name IN ('leads','whatsapp_contacts','whatsapp_messages',
      'whatsapp_credentials','whatsapp_sessions','activities','clients')

  UNION ALL

  -- UNIQUE CONSTRAINTS
  SELECT 
    '4. UNIQUE Constraints',
    table_name || ' → ' || constraint_name,
    '✅ OK'
  FROM information_schema.table_constraints
  WHERE table_schema = 'public' AND constraint_type = 'UNIQUE'
    AND table_name IN ('leads','whatsapp_contacts','whatsapp_messages',
      'whatsapp_credentials','whatsapp_sessions')

  UNION ALL

  -- RLS STATUS
  SELECT 
    '5. RLS Enabled',
    tablename,
    CASE WHEN rowsecurity THEN 'ENABLED ✅' ELSE 'DISABLED ❌ — RUN MIGRATION!' END
  FROM pg_tables
  WHERE schemaname = 'public'
    AND tablename IN ('leads','whatsapp_contacts','whatsapp_messages',
      'whatsapp_credentials','whatsapp_sessions','activities','clients','users')

  UNION ALL

  -- DEAD COLUMNS CHECK
  SELECT 
    '6. Dead Columns',
    table_name || '.' || column_name,
    'STILL EXISTS ❌ — RUN MASTER_PRODUCTION_MIGRATION.sql!'
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND (
      (table_name = 'whatsapp_credentials' AND column_name IN ('phone_number_id','access_token','waba_id'))
      OR (table_name = 'whatsapp_messages' AND column_name = 'channel')
    )

  UNION ALL

  -- ORPHAN MESSAGES (no JID)
  SELECT 
    '7. Orphan Messages',
    'whatsapp_messages without jid: ' || COUNT(*)::TEXT,
    CASE WHEN COUNT(*) = 0 THEN '✅ Clean' ELSE '❌ ' || COUNT(*) || ' bad rows!' END
  FROM public.whatsapp_messages WHERE jid IS NULL OR jid = ''

  UNION ALL

  -- ROW COUNTS
  SELECT '8. Row Counts', 'leads',                COUNT(*)::TEXT FROM public.leads
  UNION ALL SELECT '8. Row Counts', 'whatsapp_contacts',  COUNT(*)::TEXT FROM public.whatsapp_contacts
  UNION ALL SELECT '8. Row Counts', 'whatsapp_messages',  COUNT(*)::TEXT FROM public.whatsapp_messages
  UNION ALL SELECT '8. Row Counts', 'whatsapp_credentials', COUNT(*)::TEXT FROM public.whatsapp_credentials
  UNION ALL SELECT '8. Row Counts', 'whatsapp_sessions',  COUNT(*)::TEXT FROM public.whatsapp_sessions
  UNION ALL SELECT '8. Row Counts', 'activities',         COUNT(*)::TEXT FROM public.activities
  UNION ALL SELECT '8. Row Counts', 'clients',            COUNT(*)::TEXT FROM public.clients

) AS all_tests
ORDER BY category, item;
