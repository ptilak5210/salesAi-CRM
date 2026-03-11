import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env';

if (!env.supabaseUrl || !env.supabaseKey) {
    console.error('[Supabase Backend] SUPABASE_URL or SUPABASE_ANON_KEY is not set. Check your .env file.');
}

// Standard client — uses anon key, respects Row Level Security (RLS)
export const supabase = createClient(env.supabaseUrl, env.supabaseKey);

// Admin client — uses service role key, BYPASSES RLS (use for backend-only admin tasks)
// NEVER expose this client or its key to the frontend
export const supabaseAdmin = env.supabaseServiceRoleKey
    ? createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    })
    : null;
