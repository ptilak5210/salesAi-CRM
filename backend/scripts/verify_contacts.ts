import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
    console.error("Missing supabase credentials");
    process.exit(1);
}
const supabaseAdmin = createClient(url, key);

async function run() {
  const { data, error } = await supabaseAdmin
    .from('whatsapp_contacts')
    .select('jid, lead_phone');
    
  let badCount = 0;
  for (const row of data || []) {
      if (row.lead_phone && (row.lead_phone.includes('@') || row.lead_phone.length > 15)) {
          console.log('STILL BAD:', row);
          badCount++;
      }
  }
  console.log(`Verification complete. Bad rows remaining: ${badCount}`);
}

run();
