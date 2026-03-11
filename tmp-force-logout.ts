import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL || 'https://bewnhdybsbpivteiixgq.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function forceDisconnect() {
    const userId = 'af109a24-b27b-446e-ac86-ca4cb723223e';
    console.log(`Force clearing Baileys session for user: ${userId}`);

    const res1 = await supabaseAdmin.from('whatsapp_sessions').delete().eq('user_id', userId);
    console.log("Cleared whatsapp_sessions", res1.error || "Success");

    const res2 = await supabaseAdmin.from('whatsapp_credentials').update({ is_connected: false }).eq('user_id', userId);
    console.log("Updated whatsapp_credentials", res2.error || "Success");
}
forceDisconnect();
