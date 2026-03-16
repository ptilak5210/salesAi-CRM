import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from the root .env file
dotenv.config({ path: resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Determine file extension from mimetype
function getExtensionFromMime(mime: string): string {
    const extMap: Record<string, string> = {
        'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 
        'image/gif': 'gif', 'video/mp4': 'mp4', 'audio/ogg; codecs=opus': 'ogg', 
        'audio/mpeg': 'mp3', 'application/pdf': 'pdf'
    };
    return extMap[mime] || mime.split('/')[1] || 'bin';
}

async function runMigration() {
  console.log('Starting Base64 to Supabase Storage Migration...');

  // 1. Fetch messages containing base64 data
  const { data: messages, error: fetchError } = await supabase
    .from('whatsapp_messages')
    .select('*')
    .or('content.like.%[IMAGE:data:image/%,content.like.%[VIDEO:data:video/%');

  if (fetchError) {
    console.error("Error fetching messages:", fetchError);
    return;
  }

  if (!messages || messages.length === 0) {
    console.log("No messages with Base64 content found. Migration complete.");
    return;
  }

  console.log(`Found ${messages.length} messages with Base64 content.`);

  let successCount = 0;
  let failureCount = 0;

  for (const msg of messages) {
    try {
      const content = msg.content as string;
      const typeStr = content.startsWith('[IMAGE:data:') ? 'IMAGE' : content.startsWith('[VIDEO:data:') ? 'VIDEO' : null;

      if (!typeStr) {
          console.warn(`Skipping message ${msg.id}: content format not recognized.`);
          failureCount++;
          continue;
      }

      // Format is e.g. [IMAGE:data:image/jpeg;base64,/9j/4AAQ...] Caption Optional
      const regex = /\[(?:IMAGE|VIDEO):data:([^;]+);base64,([^\]]+)\](.*)/;
      const match = content.match(regex);

      if (!match) {
        console.warn(`Skipping message ${msg.id}: regex match failed.`);
        failureCount++;
        continue;
      }

      const mimeType = match[1];
      const base64Data = match[2];
      const captionOrRest = match[3] || '';

      // Validate base64 length to avoid processing tiny broken snippets
      if (base64Data.length < 100) {
           console.warn(`Skipping message ${msg.id}: base64 data too short.`);
           failureCount++;
           continue;
      }

      // Decode base64 to buffer
      const buffer = Buffer.from(base64Data, 'base64');
      const ext = getExtensionFromMime(mimeType);

      // Construct safe filename
      const safeJid = (msg.jid || msg.lead_phone || 'unknown').replace(/[^a-zA-Z0-9]/g, '_');
      const timestamp = new Date(msg.timestamp).getTime() || Date.now();
      const fileName = `${msg.user_id}/${safeJid}_migrated_${timestamp}_${msg.id.substring(0,6)}.${ext}`;

      // 2. Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase
        .storage
        .from('whatsapp-media')
        .upload(fileName, buffer, {
          contentType: mimeType,
          upsert: true
        });

      if (uploadError) {
        console.error(`Failed to upload media for message ${msg.id}:`, uploadError);
        failureCount++;
        continue;
      }

      // 3. Get Public URL
      const { data: { publicUrl } } = supabase
        .storage
        .from('whatsapp-media')
        .getPublicUrl(fileName);

      // 4. Update Database
      const newContent = `[${typeStr}:${publicUrl}]${captionOrRest}`;

      const { error: updateError } = await supabase
        .from('whatsapp_messages')
        .update({ content: newContent })
        .eq('id', msg.id);

      if (updateError) {
         console.error(`Failed to update DB for message ${msg.id}:`, updateError);
         failureCount++;
      } else {
         console.log(`Successfully migrated message ${msg.id}`);
         successCount++;
      }
    } catch (err) {
      console.error(`Unexpected error processing message ${msg.id}:`, err);
      failureCount++;
    }
  }

  console.log('\n--- Migration Summary ---');
  console.log(`Total Found: ${messages.length}`);
  console.log(`Successfully Migrated: ${successCount}`);
  console.log(`Failed/Skipped: ${failureCount}`);
  if (successCount > 0) {
      console.log('Consider running a VACUUM on your database to clear up the space previously used by the giant text blobs.');
  }
}

runMigration();
