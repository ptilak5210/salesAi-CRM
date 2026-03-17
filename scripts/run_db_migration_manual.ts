import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
    try {
        console.log('Running migration...');
        const migrationPath = path.join(__dirname, '../database/migrations/003_n8n_ai_replier.sql');
        const sql = fs.readFileSync(migrationPath, 'utf8');

        // Note: Supabase JS client doesn't have a direct sql() execute method for security reasons.
        // Usually migrations are run via Supabase CLI or Dashboard. 
        // We will execute a raw query via rpc if possible or output instructions.
        
        console.log(`\n=======================================================\n`);
        console.log(`Please run the following SQL script directly in your\nSupabase Dashboard -> SQL Editor:\n`);
        console.log(sql);
        console.log(`\n=======================================================\n`);
        
    } catch (e) {
        console.error('Migration error:', e);
    }
}

runMigration();
