import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import multer from 'multer';
import { requireAuth } from './middleware/auth';
import { supabaseAdmin } from '../database/supabase';
import { WhatsAppConnectionManager } from './whatsapp/connection';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 64 * 1024 * 1024 } });

const app = express();

// Prevent the server from crashing on unhandled promise rejections or exceptions
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

const port = process.env.PORT || 3001;

// Create HTTP server
const httpServer = createServer(app);

// Enable CORS for frontend at port 3000 and 5173
const allowedOrigins = ['http://localhost:3000', 'http://localhost:5173'];
app.use(cors({
    origin: allowedOrigins,
    credentials: true
}));

// Setup Socket.IO
const io = new Server(httpServer, {
    cors: {
        origin: allowedOrigins,
        methods: ['GET', 'POST'],
        credentials: true
    }
});

app.use(express.json());

// Simple request logger
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

// Initialize WhatsApp Connection Manager
const waManager = new WhatsAppConnectionManager(io);

// Basic Socket.IO connection handler
io.on('connection', (socket) => {
    console.log('Client connected to WebSocket:', socket.id);

    // Allow InboxView to join its user room for real-time messages without starting QR auth flow
    socket.on('join-inbox', async (data: { userId: string }) => {
        if (data?.userId) {
            socket.join(data.userId);
            console.log(`[Socket.IO] User ${data.userId} joined inbox room`);

            // Auto-restore Baileys session if they are connected in DB but socket isn't running
            if (supabaseAdmin) {
                try {
                    const { data: creds } = await supabaseAdmin
                        .from('whatsapp_credentials')
                        .select('is_connected')
                        .eq('user_id', data.userId)
                        .maybeSingle();

                    // @ts-ignore - access to activeSockets
                    if (creds?.is_connected && !waManager.activeSockets.has(data.userId)) {
                        console.log(`[Socket.IO] Auto-restoring WhatsApp session for user ${data.userId}`);
                        // Pass current socket.id so connectToWhatsApp can emit to it if needed
                        waManager.connectToWhatsApp(data.userId, socket.id).catch(err => {
                            console.error(`[Socket.IO] Failed to auto-restore session for ${data.userId}:`, err);
                        });
                    }
                } catch (e) {
                    console.error('[Socket.IO] Failed to check credential for auto-restore:', e);
                }
            }
        }
    });

    // Listen for frontend requesting to start WhatsApp auth flow (QR scan)
    socket.on('start-whatsapp-auth', async (data) => {
        const { userId } = data;
        if (!userId) return;

        console.log(`Starting WhatsApp auth flow for user ${userId} on socket ${socket.id}`);
        socket.join(userId);

        try {
            await waManager.connectToWhatsApp(userId, socket.id);
        } catch (error) {
            console.error('Failed to start WhatsApp auth flow:', error);
            socket.emit('whatsapp-error', { message: 'Failed to start WhatsApp connection' });
        }
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Backend is running smoothly' });
});

// A protected route to verify our Supabase Auth middleware
app.get('/api/protected', requireAuth, (req, res) => {
    res.json({
        message: 'You have accessed a protected route!',
        user: req.user
    });
});

// ── WhatsApp Credentials ──────────────────────────────────────────────────────
// GET /api/whatsapp/credentials — fetch credentials for the authenticated user
app.get('/api/whatsapp/credentials', requireAuth, async (req, res): Promise<any> => {
    if (!supabaseAdmin) return res.status(500).json({ error: 'Server not configured.' });

    const userId = req.user.id;
    const { data, error } = await supabaseAdmin
        .from('whatsapp_credentials')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ data });
});

// GET /api/whatsapp/debug — connection status for debugging
app.get('/api/whatsapp/debug', requireAuth, async (req, res): Promise<any> => {
    const userId = req.user.id;
    const status = waManager.getConnectionStatus(userId);
    const room = (io as any).sockets?.adapter?.rooms?.get(userId);
    return res.json({
        userId,
        ...status,
        socketRoomSize: room?.size ?? 0,
    });
});

// PATCH /api/whatsapp/credentials/disconnect — mark as disconnected
app.patch('/api/whatsapp/credentials/disconnect', requireAuth, async (req, res): Promise<any> => {
    if (!supabaseAdmin) return res.status(500).json({ error: 'Server not configured.' });

    const userId = req.user.id;

    try {
        await waManager.disconnectWhatsApp(userId);
    } catch (error) {
        console.error('Error disconnecting Baileys session:', error);
    }

    const { error } = await supabaseAdmin
        .from('whatsapp_credentials')
        .update({ is_connected: false, ai_enabled: false })
        .eq('user_id', userId);

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true });
});

// PATCH /api/whatsapp/ai-toggle — enable/disable AI auto-replies
app.patch('/api/whatsapp/ai-toggle', requireAuth, async (req, res): Promise<any> => {
    if (!supabaseAdmin) return res.status(500).json({ error: 'Server not configured.' });

    const userId = req.user.id;
    const { enabled } = req.body;

    const { error } = await supabaseAdmin
        .from('whatsapp_credentials')
        .update({ ai_enabled: enabled })
        .eq('user_id', userId);

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true, ai_enabled: enabled });
});

// PATCH /api/whatsapp/auto-reply-config — configure automated basic replies
app.patch('/api/whatsapp/auto-reply-config', requireAuth, async (req, res): Promise<any> => {
    if (!supabaseAdmin) return res.status(500).json({ error: 'Server not configured.' });

    const userId = req.user.id;
    const { enabled, text } = req.body;

    const { error } = await supabaseAdmin
        .from('whatsapp_credentials')
        .update({ auto_reply_enabled: enabled, auto_reply_text: text })
        .eq('user_id', userId);

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true, auto_reply_enabled: enabled, auto_reply_text: text });
});

// POST /api/whatsapp/send — send a text message via active Baileys session
app.post('/api/whatsapp/send', requireAuth, async (req, res): Promise<any> => {
    console.log("==> Hit /api/whatsapp/send");
    try {
        const userId = req.user.id;
        const { to, message, quotedMsgId } = req.body;
        console.log(`Sending message to ${to} from ${userId}...`);

        if (!to || !message) return res.status(400).json({ error: 'Missing `to` or `message`.' });

        const result = await waManager.sendMessage(userId, to, message, quotedMsgId);
        console.log("waManager.sendMessage result:", result);

        if (!result.success) {
            console.error("waManager returned failure:", result.error);
            return res.status(500).json({ error: result.error });
        }

        // Message is saved to DB and emitted via Socket by connection.ts
        return res.json({ success: true, messageId: result.messageId });
    } catch (e: any) {
        console.error("CRITICAL EXCEPTION IN /api/whatsapp/send:", e);
        return res.status(500).json({ error: e.message || 'Internal Server Error' });
    }
});

// POST /api/whatsapp/send-media — send an image or document
app.post('/api/whatsapp/send-media', requireAuth, upload.single('file'), async (req, res): Promise<any> => {
    const userId = req.user.id;
    const { to, caption } = req.body;
    const file = (req as any).file;

    if (!to || !file) return res.status(400).json({ error: 'Missing `to` or file.' });

    const result = await waManager.sendMedia(userId, to, file.buffer, file.mimetype, caption, file.originalname);
    if (!result.success) return res.status(500).json({ error: result.error });

    // Message saved to DB and emitted via Socket by connection.ts
    return res.json({ success: true, messageId: result.messageId });
});

// ── Activities / Meetings ────────────────────────────────────────────────────
// Fetch activities for the user
app.get('/api/activities', requireAuth, async (req, res): Promise<any> => {
    if (!supabaseAdmin) return res.status(500).json({ error: 'Server not configured.' });

    const userId = req.user.id;
    const { data, error } = await supabaseAdmin
        .from('activities')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ data });
});

// Create a new activity
app.post('/api/activities', requireAuth, async (req, res): Promise<any> => {
    if (!supabaseAdmin) return res.status(500).json({ error: 'Server not configured.' });

    const userId = req.user.id;
    const { title, attendee, date, time, type, status } = req.body;

    if (!title || !attendee || !date || !time || !type) {
        return res.status(400).json({ error: 'Missing required fields for activity.' });
    }

    const { data, error } = await supabaseAdmin
        .from('activities')
        .insert({
            user_id: userId,
            title,
            attendee,
            date,
            time,
            type,
            status: status || 'confirmed'
        })
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ data });
});

// Update an existing activity
app.put('/api/activities/:id', requireAuth, async (req, res): Promise<any> => {
    if (!supabaseAdmin) return res.status(500).json({ error: 'Server not configured.' });

    const userId = req.user.id;
    const { id } = req.params;
    const { title, attendee, date, time, type } = req.body;

    const { data, error } = await supabaseAdmin
        .from('activities')
        .update({
            title,
            attendee,
            date,
            time,
            type,
            updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ data });
});

// Delete an existing activity
app.delete('/api/activities/:id', requireAuth, async (req, res): Promise<any> => {
    if (!supabaseAdmin) return res.status(500).json({ error: 'Server not configured.' });

    const userId = req.user.id;
    const { id } = req.params;

    const { error } = await supabaseAdmin
        .from('activities')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true });
});

// Approve a pending activity
app.put('/api/activities/:id/approve', requireAuth, async (req, res): Promise<any> => {
    if (!supabaseAdmin) return res.status(500).json({ error: 'Server not configured.' });

    const userId = req.user.id;
    const { id } = req.params;

    const { data: activity, error } = await supabaseAdmin
        .from('activities')
        .update({
            status: 'confirmed',
            updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.json({
        success: true,
        data: activity,
        message: 'Activity confirmed.' // Note: WhatsApp auto-reply logic can be integrated here later via waManager
    });
});

// Decline a pending activity
app.put('/api/activities/:id/decline', requireAuth, async (req, res): Promise<any> => {
    if (!supabaseAdmin) return res.status(500).json({ error: 'Server not configured.' });

    const userId = req.user.id;
    const { id } = req.params;

    const { data: activity, error } = await supabaseAdmin
        .from('activities')
        .update({
            status: 'cancelled',
            updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true, data: activity });
});

// Fetch chats list with contact metadata (for Inbox)
app.get('/api/whatsapp/chats', requireAuth, async (req, res): Promise<any> => {
    if (!supabaseAdmin) return res.status(500).json({ error: 'Server not configured.' });

    const userId = req.user.id;

    const { data: messages, error: msgError } = await supabaseAdmin
        .from('whatsapp_messages')
        .select('lead_phone, content, timestamp, sender, contact_name, is_group')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false });

    if (msgError) return res.status(500).json({ error: msgError.message });

    const { data: contacts } = await supabaseAdmin
        ?.from('whatsapp_contacts')
        .select('lead_phone, contact_name, profile_picture_url, is_group')
        .eq('user_id', userId) || { data: [] };

    const contactMap = new Map((contacts || []).map((c: any) => [c.lead_phone, c]));

    const seen = new Set<string>();
    const chats: any[] = [];
    for (const m of messages || []) {
        if (seen.has(m.lead_phone)) continue;
        seen.add(m.lead_phone);
        const meta = contactMap.get(m.lead_phone);
        chats.push({
            lead_phone: m.lead_phone,
            contact_name: meta?.contact_name || m.contact_name,
            profile_picture_url: meta?.profile_picture_url,
            is_group: m.is_group ?? meta?.is_group ?? false,
            last_message: m.content,
            last_timestamp: m.timestamp,
            last_sender: m.sender,
        });
    }
    return res.json({ data: chats });
});

// 3. Fetch Message History (latest messages from DB, ordered by timestamp)
app.get('/api/whatsapp/messages/:leadPhone', requireAuth, async (req, res): Promise<any> => {
    if (!supabaseAdmin) return res.status(500).json({ error: 'Server not configured.' });

    const userId = req.user.id;
    const leadPhone = decodeURIComponent(req.params.leadPhone);

    const { data, error } = await supabaseAdmin
        .from('whatsapp_messages')
        .select('*')
        .eq('user_id', userId)
        .eq('lead_phone', leadPhone)
        .order('timestamp', { ascending: true });

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ data });
});

// ─────────────────────────────────────────────────────────────────────────────

export const startServer = () => {
    httpServer.listen(port, () => {
        console.log(`Server listening on port ${port} with WebSockets enabled`);
    });
};

// Always start the server when loaded directly via tsx
startServer();
