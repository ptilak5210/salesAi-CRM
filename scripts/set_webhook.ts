import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

// Load variables from backend/.env
const envPath = path.resolve(process.cwd(), '../backend/.env');
dotenv.config({ path: envPath });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase credentials in backend/.env!");
  console.log("VITE_SUPABASE_URL:", supabaseUrl ? "Exists" : "Missing");
  console.log("SUPABASE_SERVICE_ROLE_KEY:", supabaseServiceKey ? "Exists" : "Missing");
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

const webhookUrl = "https://tilakpatel5210.app.n8n.cloud/webhook/lead-intake";

async function run() {
  console.log('Fetching users to update n8n webhook...');
  
  const { data, error } = await supabaseAdmin
    .from('whatsapp_credentials')
    .update({ 
      n8n_webhook_url: webhookUrl,
      ai_agent_enabled: true,
      ai_enabled: false
    })
    .not('user_id', 'is', null) // Match all valid rows
    .select();

  if (error) {
    console.error('Failed to update webhook URL in database:', error.message);
  } else {
    console.log(`Successfully updated webhook URL for ${data?.length || 0} user(s).`);
    console.log('n8n webhooks are now LIVE! URL set to:', webhookUrl);
  }
}

run();
