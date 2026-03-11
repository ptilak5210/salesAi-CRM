-- Create whatsapp_sessions table to store Baileys auth state
CREATE TABLE IF NOT EXISTS public.whatsapp_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    key_id TEXT NOT NULL,
    key_data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, key_id)
);

-- Enable RLS
ALTER TABLE public.whatsapp_sessions ENABLE ROW LEVEL SECURITY;

-- Policies (Only Service Role should ideally access this, but we'll add user policies just in case)
CREATE POLICY "Users can view their own sessions" 
ON public.whatsapp_sessions FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sessions" 
ON public.whatsapp_sessions FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sessions" 
ON public.whatsapp_sessions FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sessions" 
ON public.whatsapp_sessions FOR DELETE 
USING (auth.uid() = user_id);

-- Index for faster lookups based on user_id and key_id
CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_user_key 
ON public.whatsapp_sessions (user_id, key_id);
