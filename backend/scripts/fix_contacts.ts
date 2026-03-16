import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('Running whatsapp_contacts lead_phone cleanup...');
  // Since there is no rpc for raw sql by default, we just fetch the bad rows and update them.
  const { data: badRows, error: fetchErr } = await supabaseAdmin
    .from('whatsapp_contacts')
    .select('user_id, jid, lead_phone');
    
  if (fetchErr) {
    console.error('Error fetching rows:', fetchErr);
    process.exit(1);
  }

  let updated = 0;
  for (const row of badRows || []) {
      if (row.lead_phone && (row.lead_phone.includes('@') || row.lead_phone.length > 15)) {
          const { error: updateErr } = await supabaseAdmin
            .from('whatsapp_contacts')
            .update({ lead_phone: null })
            .eq('user_id', row.user_id)
            .eq('jid', row.jid);
          
          if (updateErr) {
              console.error('Failed to update', row.jid, updateErr);
          } else {
              updated++;
          }
      }
  }
  
  console.log(`Cleanup complete. Updated ${updated} rows.`);
}

run();
