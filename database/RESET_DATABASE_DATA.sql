-- RESET_DATABASE_DATA.sql
-- Run this in your Supabase SQL Editor to clear all test records and start fresh.

-- 1. Clear WhatsApp Data
TRUNCATE TABLE public.whatsapp_messages CASCADE;
TRUNCATE TABLE public.whatsapp_contacts CASCADE;
TRUNCATE TABLE public.whatsapp_sessions CASCADE;
TRUNCATE TABLE public.whatsapp_credentials CASCADE;

-- 2. Clear CRM Data
TRUNCATE TABLE public.leads CASCADE;
TRUNCATE TABLE public.activities CASCADE;
TRUNCATE TABLE public.clients CASCADE;

-- Optional: If you want to delete Storage files as well, 
-- you would usually do that via the Supabase Dashboard UI.
