-- RUN THIS ENTIRE SCRIPT IN YOUR SUPABASE SQL EDITOR TO ADD AUTO-REPLY SUPPORT

-- 1. Add missing auto-reply columns to whatsapp_credentials
ALTER TABLE public.whatsapp_credentials
  ADD COLUMN IF NOT EXISTS auto_reply_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS auto_reply_text TEXT DEFAULT 'Thank you for your message! Our team will get back to you shortly.';
