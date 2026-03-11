import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL || 'https://bewnhdybsbpivteiixgq.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function deleteFakeChats() {
    console.log("Deleting fake test messages...");
    const { error } = await supabaseAdmin.from('whatsapp_messages').delete().in('lead_phone', ['146200720343263', '124589032128757']);
    if (error) {
        console.error("DB Error:", error);
    } else {
        console.log("Deleted fake messages successfully.");
    }
}
deleteFakeChats();
