-- Add AI Agent configurations to whatsapp_credentials
ALTER TABLE "public"."whatsapp_credentials"
ADD COLUMN IF NOT EXISTS "ai_agent_enabled" boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS "n8n_webhook_url" text DEFAULT NULL;

-- Add human takeover flag to whatsapp_contacts
ALTER TABLE "public"."whatsapp_contacts"
ADD COLUMN IF NOT EXISTS "ai_paused" boolean DEFAULT false;

-- Add human takeover flag to leads table as well (in case they don't have a contact row yet)
ALTER TABLE "public"."leads"
ADD COLUMN IF NOT EXISTS "ai_paused" boolean DEFAULT false;

-- Create AI Activity Logs table
CREATE TABLE IF NOT EXISTS "public"."ai_activity_logs" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" uuid NOT NULL,
    "lead_phone" text NOT NULL,
    "action" text NOT NULL,
    "details" text,
    "created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    PRIMARY KEY ("id"),
    FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE
);

-- Note: Ensure uuid extension is enabled (usually already is in Supabase)
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Add RLS Policies for ai_activity_logs
ALTER TABLE "public"."ai_activity_logs" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own ai logs" 
ON "public"."ai_activity_logs" FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own ai logs" 
ON "public"."ai_activity_logs" FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);
