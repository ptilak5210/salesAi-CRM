import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string) || 'https://bewnhdybsbpivteiixgq.supabase.co';
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || '';

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('[Supabase] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is not set. Authentication will not work. Check your .env file and restart the dev server.');
}

// Use placeholders so createClient doesn't throw — auth calls will gracefully fail
export const supabase = createClient(
    supabaseUrl || 'https://bewnhdybsbpivteiixgq.supabase.co',
    supabaseAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJld25oZHlic2JwaXZ0ZWlpeGdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2OTE0OTcsImV4cCI6MjA4ODI2NzQ5N30.0vPaWMwMRg_gbgXwI9-ZsD4AtvAYld9p-TPsMT_BOao'
);
