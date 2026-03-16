import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

const userId = '30088e36-fe15-4543-85b9-6161c2316f7f';

async function checkMessages() {
    console.log(`Checking messages for user: ${userId}`);
    
    const { count, error } = await supabase
        .from('whatsapp_messages')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

    if (error) {
        console.error('Error fetching messages:', error);
        return;
    }

    console.log(`Total messages found: ${count}`);

    const { count: contactCount, error: contactError } = await supabase
        .from('whatsapp_contacts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

    if (contactError) {
        console.error('Error fetching contacts:', contactError);
    } else {
        console.log(`Total contacts found: ${contactCount}`);
    }

    const { data: credentials, error: credError } = await supabase
        .from('whatsapp_credentials')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

    if (credError) {
        console.error('Error fetching credentials:', credError);
    } else {
        console.log('Connection Status in DB:', credentials?.is_connected ? 'Connected' : 'Disconnected');
    }
}

checkMessages();
