import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bewnhdybsbpivteiixgq.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJld25oZHlic2JwaXZ0ZWlpeGdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2OTE0OTcsImV4cCI6MjA4ODI2NzQ5N30.0vPaWMwMRg_gbgXwI9-ZsD4AtvAYld9p-TPsMT_BOao';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testConnection() {
    console.log("Testing connection with valid UUID...");

    // Generate a valid UUID for testing
    const validUuid = '123e4567-e89b-12d3-a456-426614174000';

    try {
        console.log(`Executing UPSERT with uuid: ${validUuid}...`);

        // Add a timeout just in case it hangs here too
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Node script timed out after 5 seconds')), 5000)
        );

        const supabaseRequest = supabase
            .from('whatsapp_credentials')
            .upsert({
                user_id: validUuid,
                phone_number_id: '123',
                access_token: 'abc',
                is_connected: false,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'user_id'
            })
            .select();

        const result = await Promise.race([supabaseRequest, timeoutPromise]);
        console.log("UPSERT returned:", result);
    } catch (e) {
        console.error("UPSERT threw:", e);
    }

    console.log("Finished testing");
    process.exit(0);
}

testConnection();
