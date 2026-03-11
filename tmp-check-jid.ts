import dotenv from 'dotenv';
import { supabase } from './frontend/src/lib/supabase.ts'; // We actually need to fetch real token OR use admin key
dotenv.config();

// Let's test the endpoint using the exact logic the frontend uses, but we'd need a real auth session.
// Instead of auth hacking, let's just make a script that imports waManager directly and sends the message.
import { createServer } from 'http';
import { Server } from 'socket.io';
import { WhatsAppConnectionManager } from './backend/whatsapp/connection';

async function testDirectSend() {
    const io = new Server();
    const waManager = new WhatsAppConnectionManager(io);
    const userId = 'af109a24-b27b-446e-ac86-ca4cb723223e'; // Copied from debug logs
    const leadPhone = '+146200720343263';
    
    console.log("Connecting WhatsApp manager dummy...");
    // We can't easily start the connection here as it takes time.
    // The issue might be the `jid` formatting again. Let me just print what JID it's creating.
    const jid = leadPhone.replace("+", "") + "@s.whatsapp.net";
    console.log("Calculated JID:", jid);
}
testDirectSend();
