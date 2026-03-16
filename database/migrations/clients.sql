-- Table: public.clients
-- Description: Stores overall business profiles for the agency users (the CRM owners).

CREATE TABLE IF NOT EXISTS public.clients (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    business_type TEXT,
    lead_source TEXT,
    business_name TEXT,
    whatsapp_number TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own client profile" ON public.clients;
CREATE POLICY "Users can view their own client profile"
ON public.clients FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own client profile" ON public.clients;
CREATE POLICY "Users can insert their own client profile"
ON public.clients FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own client profile" ON public.clients;
CREATE POLICY "Users can update their own client profile"
ON public.clients FOR UPDATE USING (auth.uid() = user_id);
