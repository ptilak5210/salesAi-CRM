import { supabaseAdmin } from './database/supabase';

async function run() {
    console.log("Checking last 10 sent messages...");
    try {
        const { data, error } = await supabaseAdmin
            .from('whatsapp_messages')
            .select('jid, lead_phone, content, status, sender, timestamp')
            .eq('sender', 'user')
            .order('timestamp', { ascending: false })
            .limit(10);
            
        if (error) {
            console.error("Supabase error:", error);
            return;
        }
        console.log("Last sent messages details:");
        console.table(data);
        
        // Also check if any of these JIDs exist in whatsapp_contacts and what their format is
        const jids = [...new Set(data.map(m => m.jid))];
        const { data: contacts } = await supabaseAdmin
            .from('whatsapp_contacts')
            .select('jid, lead_phone, contact_name')
            .in('jid', jids);
            
        console.log("\nAssociated contacts:");
        console.table(contacts);
        
    } catch (e) {
        console.error("Node error:", e);
    }
}

run();
