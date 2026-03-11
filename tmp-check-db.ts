import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL || 'https://bewnhdybsbpivteiixgq.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function checkMessages() {
    console.log("Checking DB for recent messages...");
    const { data, error } = await supabaseAdmin.from('whatsapp_messages').select('*').order('timestamp', { ascending: false }).limit(20);
    if (error) {
        console.error("DB Error:", error);
    } else {
        console.log(`Found ${data.length} messages:`);
        data.forEach(m => {
            console.log(`- ${m.sender} to ${m.lead_phone}: [${m.status}] ${m.content} (name: ${m.contact_name})`);
        });
    }
}
checkMessages();
