const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://bewnhdybsbpivteiixgq.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJld25oZHlic2JwaXZ0ZWlpeGdxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjY5MTQ5NywiZXhwIjoyMDg4MjY3NDk3fQ.bm4C-vbX0GBBNpq3Qo7J03Mt1VBQ7-sL7yYcPEcncYk';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
const webhookUrl = "https://tilakpatel5210.app.n8n.cloud/webhook/lead-intake";

async function run() {
  const { data, error } = await supabaseAdmin
    .from('whatsapp_credentials')
    .update({ 
      n8n_webhook_url: webhookUrl,
      ai_agent_enabled: true,
      ai_enabled: false
    })
    .not('user_id', 'is', null)
    .select();

  if (error) {
    console.error('Failed:', error.message);
  } else {
    console.log(`Success! Updated ${data?.length || 0} user(s). n8n Webhook is now LIVE and active!`);
  }
}

run();
