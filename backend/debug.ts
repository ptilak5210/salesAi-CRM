import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function check() {
    let out: any = {};
    const { data: users, error: uErr } = await supabaseAdmin.from('users').select('*').limit(5);
    out.users = users?.map(u => ({ id: u.id, email: u.email }));

    if (users && users.length > 0) {
        const userId = users[0].id; // Assuming the first user is the one testing
        const { data: creds } = await supabaseAdmin
            .from('whatsapp_credentials')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();

        out.creds = creds;

        const { data: sessions } = await supabaseAdmin
            .from('whatsapp_sessions')
            .select('key_id, created_at')
            .eq('user_id', userId);

        out.sessionsCount = sessions?.length;
        if (sessions?.length) {
            out.sampleKeys = sessions.slice(0, 5).map(s => s.key_id);
        }
    }
    fs.writeFileSync('debug-db.json', JSON.stringify(out, null, 2));

    // TEST UPSERT
    const { data: credsUp, error: errUp } = await supabaseAdmin
        .from('whatsapp_credentials')
        .upsert(
            { user_id: out.users[0].id, is_connected: true, updated_at: new Date().toISOString() },
            { onConflict: 'user_id' }
        )
        .select('*');
    out.upsert = { credsUp, errUp };

    // TEST MESSAGES
    const { data: msgs } = await supabaseAdmin
        .from('whatsapp_messages')
        .select('id, lead_phone, content, sender, timestamp')
        .eq('user_id', out.users[0].id)
        .order('timestamp', { ascending: false })
        .limit(10);
    out.msgs = msgs;

    fs.writeFileSync('debug-db.json', JSON.stringify(out, null, 2));
}
check();
