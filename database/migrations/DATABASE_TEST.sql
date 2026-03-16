-- ============================================================
-- DATABASE_TEST.sql
-- Run this in Supabase SQL Editor to validate production schema
-- All queries are READ-ONLY — safe to run anytime
-- ============================================================

-- ════════════════════════════════════════════════════════════
-- TEST 1: Check all tables exist
-- ════════════════════════════════════════════════════════════
SELECT 'TEST 1: Tables' AS test, table_name, 'EXISTS ✅' AS result
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'leads','whatsapp_contacts','whatsapp_messages',
    'whatsapp_credentials','whatsapp_sessions',
    'activities','clients','users'
  )
ORDER BY table_name;

-- ════════════════════════════════════════════════════════════
-- TEST 2: Check all PRIMARY KEY constraints exist
-- ════════════════════════════════════════════════════════════
SELECT 'TEST 2: PKs' AS test, tc.table_name, tc.constraint_name, '✅' AS ok
FROM information_schema.table_constraints tc
WHERE tc.table_schema = 'public'
  AND tc.constraint_type = 'PRIMARY KEY'
  AND tc.table_name IN (
    'leads','whatsapp_contacts','whatsapp_messages',
    'whatsapp_credentials','whatsapp_sessions',
    'activities','clients'
  )
ORDER BY tc.table_name;

-- ════════════════════════════════════════════════════════════
-- TEST 3: Check FOREIGN KEY constraints exist
-- ════════════════════════════════════════════════════════════
SELECT 'TEST 3: FKs' AS test, tc.table_name, tc.constraint_name, '✅' AS ok
FROM information_schema.table_constraints tc
WHERE tc.table_schema = 'public'
  AND tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name IN (
    'leads','whatsapp_contacts','whatsapp_messages',
    'whatsapp_credentials','whatsapp_sessions',
    'activities','clients'
  )
ORDER BY tc.table_name;

-- ════════════════════════════════════════════════════════════
-- TEST 4: Check UNIQUE constraints (critical deduplication)
-- ════════════════════════════════════════════════════════════
SELECT 'TEST 4: UNIQUE Constraints' AS test, tc.table_name, tc.constraint_name, '✅' AS ok
FROM information_schema.table_constraints tc
WHERE tc.table_schema = 'public'
  AND tc.constraint_type = 'UNIQUE'
ORDER BY tc.table_name;

-- ════════════════════════════════════════════════════════════
-- TEST 5: Check RLS is ENABLED on all tables
-- ════════════════════════════════════════════════════════════
SELECT 
  'TEST 5: RLS Enabled' AS test,
  tablename,
  CASE WHEN rowsecurity THEN 'ENABLED ✅' ELSE 'DISABLED ❌' END AS rls_status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'leads','whatsapp_contacts','whatsapp_messages',
    'whatsapp_credentials','whatsapp_sessions',
    'activities','clients','users'
  )
ORDER BY tablename;

-- ════════════════════════════════════════════════════════════
-- TEST 6: Check RLS POLICIES count per table
-- ════════════════════════════════════════════════════════════
SELECT 
  'TEST 6: RLS Policies' AS test,
  tablename,
  COUNT(*) AS policy_count,
  CASE WHEN COUNT(*) > 0 THEN 'HAS POLICIES ✅' ELSE 'NO POLICIES ❌' END AS status
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- ════════════════════════════════════════════════════════════
-- TEST 7: Check all indexes exist for key tables
-- ════════════════════════════════════════════════════════════
SELECT 
  'TEST 7: Indexes' AS test,
  tablename,
  indexname,
  '✅' AS ok
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('whatsapp_messages', 'whatsapp_contacts', 'leads', 'whatsapp_sessions')
ORDER BY tablename, indexname;

-- ════════════════════════════════════════════════════════════
-- TEST 8: Check dead columns are REMOVED
-- ════════════════════════════════════════════════════════════
SELECT 
  'TEST 8: Dead Columns' AS test,
  column_name,
  table_name,
  'STILL EXISTS ❌ — run MASTER_PRODUCTION_MIGRATION.sql' AS status
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    (table_name = 'whatsapp_credentials' AND column_name IN ('phone_number_id','access_token','waba_id'))
    OR
    (table_name = 'whatsapp_messages' AND column_name = 'channel')
  );
-- If this returns 0 rows: all dead columns removed ✅

-- ════════════════════════════════════════════════════════════
-- TEST 9: Data integrity — no messages without a JID
-- ════════════════════════════════════════════════════════════
SELECT 'TEST 9: Orphan Messages (no jid)' AS test, COUNT(*) AS bad_rows,
  CASE WHEN COUNT(*) = 0 THEN '✅ Clean' ELSE '❌ Fix needed!' END AS status
FROM public.whatsapp_messages WHERE jid IS NULL OR jid = '';

-- ════════════════════════════════════════════════════════════
-- TEST 10: Summary — row counts per table
-- ════════════════════════════════════════════════════════════
SELECT 'TEST 10: Row Counts' AS test, 'leads' AS table_name, COUNT(*) AS rows FROM public.leads
UNION ALL SELECT 'TEST 10: Row Counts', 'whatsapp_contacts',  COUNT(*) FROM public.whatsapp_contacts
UNION ALL SELECT 'TEST 10: Row Counts', 'whatsapp_messages',  COUNT(*) FROM public.whatsapp_messages
UNION ALL SELECT 'TEST 10: Row Counts', 'whatsapp_credentials', COUNT(*) FROM public.whatsapp_credentials
UNION ALL SELECT 'TEST 10: Row Counts', 'whatsapp_sessions',  COUNT(*) FROM public.whatsapp_sessions
UNION ALL SELECT 'TEST 10: Row Counts', 'activities',         COUNT(*) FROM public.activities
UNION ALL SELECT 'TEST 10: Row Counts', 'clients',            COUNT(*) FROM public.clients
ORDER BY table_name;

-- ════════════════════════════════════════════════════════════
-- ALL TESTS DONE
-- Every result showing ❌ means MASTER_PRODUCTION_MIGRATION.sql
-- has not been run yet for that part.
-- ════════════════════════════════════════════════════════════
