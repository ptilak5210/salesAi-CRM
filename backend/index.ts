import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import multer from 'multer';
import { requireAuth } from './middleware/auth';
import { supabaseAdmin } from '../database/supabase';
import { WhatsAppConnectionManager } from './whatsapp/connection';
import { initWorker, messageQueue } from './queue/messageQueue';

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

// Setup Socket.IO — use origin function so response gets Access-Control-Allow-Credentials: true
const io = new Server(httpServer, {
    cors: {
        origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean | string) => void) => {
            if (!origin || allowedOrigins.includes(origin)) {
                callback(null, origin || true);
            } else {
                callback(new Error('Not allowed by CORS'));
            }
        },
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

// Initialize Message Queue Worker
initWorker(waManager);

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

        // Guard: if a Baileys socket is already active, skip starting a new one.
        // This prevents the frontend from killing a healthy connection by re-emitting
        // this event on component re-mount or socket reconnect (the 428 loop root cause).
        if (waManager.activeSockets.has(userId)) {
            console.log(`[Socket.IO] start-whatsapp-auth: session already active for ${userId} — skipping new connect, notifying frontend.`);
            socket.emit('whatsapp-connected');
            return;
        }

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

// ── RBAC Permission Helper ──────────────────────────────────────────────────────
const checkPermission = async (userId: string, permissionKey: string): Promise<boolean> => {
    if (!supabaseAdmin) return false;
    try {
        const { data: member } = await supabaseAdmin.from('team_members')
            .select('permissions')
            .eq('auth_user_id', userId)
            .maybeSingle();
            
        // If not a team member, they are a Super Admin (full access)
        if (!member) return true;
        
        // Return boolean based on the requested permission
        return member.permissions && member.permissions[permissionKey] === true;
    } catch (e) {
        console.error('Error checking permissions:', e);
        return false;
    }
};

// ── Team & Roles (Admin Panel) ────────────────────────────────────────────────
// GET /api/me/role — Determine if logged in user is Super Admin or Team Member
// Returns: role, team_member_id, title, pipeline_ids, permissions
app.get('/api/me/role', requireAuth, async (req, res): Promise<any> => {
    if (!supabaseAdmin) return res.status(500).json({ error: 'Server not configured.' });
    try {
        const userId = req.user.id;
        const { data } = await supabaseAdmin.from('team_members')
            .select('id, role, pipeline_ids, is_active, permissions, owner_id')
            .eq('auth_user_id', userId)
            .maybeSingle();

        if (data) {
            if (!data.is_active) return res.status(403).json({ error: 'Account deactivated' });
            
            // Default permissions fallback (in case DB column not yet migrated)
            const defaultPerms = {
                can_export: false,
                can_import: false,
                can_delete: false,
                can_edit: true,
                can_view_analytics: false
            };

            return res.json({ 
                role: 'team_member', 
                team_member_id: data.id, 
                owner_id: data.owner_id,
                title: data.role,            // Display role: Manager / Sales Executive / Admin
                pipeline_ids: data.pipeline_ids || [],
                permissions: data.permissions || defaultPerms
            });
        }
        return res.json({ role: 'super_admin', owner_id: userId });
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
});

// GET /api/team-members — List all members for the owner
app.get('/api/team-members', requireAuth, async (req, res): Promise<any> => {
    if (!supabaseAdmin) return res.status(500).json({ error: 'Server not configured.' });
    try {
        const { data, error } = await supabaseAdmin.from('team_members')
            .select('*')
            .eq('owner_id', req.user.id)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return res.json({ success: true, data });
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
});

// POST /api/team-members — Create new team member & Auth user
app.post('/api/team-members', requireAuth, async (req, res): Promise<any> => {
    if (!supabaseAdmin) return res.status(500).json({ error: 'Server not configured.' });
    try {
        const { name, email, phone, role, pipeline_ids, password: customPassword, permissions } = req.body;
        if (!name || !email) return res.status(400).json({ error: 'Name and email are required.' });

        // 1. Create Auth user via Admin API
        const password = customPassword || ('SalesAI@' + Math.floor(1000 + Math.random() * 9000));
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { role: 'team_member', name, owner_id: req.user.id }
        });

        if (authError) return res.status(400).json({ error: authError.message });
        const auth_user_id = authData.user.id;

        // 2. Insert into team_members table — with smart defaults per role
        const roleBasedPermissions = {
            'Admin':           { can_export: true,  can_import: true,  can_delete: true,  can_edit: true, can_view_analytics: true  },
            'Manager':         { can_export: true,  can_import: true,  can_delete: false, can_edit: true, can_view_analytics: true  },
            'Sales Executive': { can_export: false, can_import: false, can_delete: false, can_edit: true, can_view_analytics: false },
        };
        const defaultPerms = roleBasedPermissions[role as keyof typeof roleBasedPermissions] 
            || roleBasedPermissions['Sales Executive'];
        
        const { data: tmData, error: tmError } = await supabaseAdmin.from('team_members')
            .insert([{
                owner_id: req.user.id,
                auth_user_id,
                name, email, phone, role, pipeline_ids,
                permissions: permissions || defaultPerms   // Use admin-set permissions or role-based defaults
            }])
            .select()
            .single();

        if (tmError) return res.status(500).json({ error: tmError.message });

        return res.json({ success: true, data: tmData, generated_password: password });
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
});

// PUT /api/team-members/:id — Update team member
app.put('/api/team-members/:id', requireAuth, async (req, res): Promise<any> => {
    if (!supabaseAdmin) return res.status(500).json({ error: 'Server not configured.' });
    try {
        const { name, email, phone, role, pipeline_ids, is_active, permissions } = req.body;
        const { error } = await supabaseAdmin.from('team_members')
            .update({ name, email, phone, role, pipeline_ids, is_active, permissions, updated_at: new Date().toISOString() })
            .eq('id', req.params.id)
            .eq('owner_id', req.user.id);
        
        if (error) throw error;
        return res.json({ success: true });
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
});

// DELETE /api/team-members/:id — Remove team member
app.delete('/api/team-members/:id', requireAuth, async (req, res): Promise<any> => {
    if (!supabaseAdmin) return res.status(500).json({ error: 'Server not configured.' });
    try {
        // Delete the auth user first
        const { data } = await supabaseAdmin.from('team_members').select('auth_user_id').eq('id', req.params.id).single();
        if (data?.auth_user_id) {
            await supabaseAdmin.auth.admin.deleteUser(data.auth_user_id);
        }

        const { error } = await supabaseAdmin.from('team_members')
            .delete()
            .eq('id', req.params.id)
            .eq('owner_id', req.user.id);
        
        if (error) throw error;
        return res.json({ success: true });
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
});

// ── Dashboard Metrics ─────────────────────────────────────────────────────────
app.get('/api/dashboard/metrics', requireAuth, async (req, res): Promise<any> => {
    if (!supabaseAdmin) return res.status(500).json({ error: 'Server not configured.' });
    
    const userId = req.user.id;
    const timeFilter = req.query.timeFilter as string || 'All Time';
    
    try {
        let leadsQuery = supabaseAdmin.from('leads').select('*').eq('user_id', userId);
        let activitiesQuery = supabaseAdmin.from('activities').select('*').eq('user_id', userId);
        
        // Time filtering logic
        if (timeFilter === 'Today') {
            const today = new Date();
            today.setHours(0,0,0,0);
            leadsQuery = leadsQuery.gte('created_at', today.toISOString());
            activitiesQuery = activitiesQuery.gte('created_at', today.toISOString());
        } else if (timeFilter === 'This Week') {
            const today = new Date();
            const day = today.getDay();
            const diff = today.getDate() - day; // Start of week (Sunday)
            today.setDate(diff);
            today.setHours(0,0,0,0);
            leadsQuery = leadsQuery.gte('created_at', today.toISOString());
            activitiesQuery = activitiesQuery.gte('created_at', today.toISOString());
        } else if (timeFilter === 'This Month') {
            const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
            leadsQuery = leadsQuery.gte('created_at', firstDay.toISOString());
            activitiesQuery = activitiesQuery.gte('created_at', firstDay.toISOString());
        } else if (timeFilter === 'This Year') {
            const firstDay = new Date(new Date().getFullYear(), 0, 1);
            leadsQuery = leadsQuery.gte('created_at', firstDay.toISOString());
            activitiesQuery = activitiesQuery.gte('created_at', firstDay.toISOString());
        }
        
        const [leadsRes, activitiesRes] = await Promise.all([leadsQuery, activitiesQuery]);
        
        if (leadsRes.error) throw leadsRes.error;
        if (activitiesRes.error) throw activitiesRes.error;
        
        const leads = leadsRes.data || [];
        const activities = activitiesRes.data || [];
        
        // Calculate Active Deals (status = Qualified or Proposal)
        const activeDeals = leads.filter(l => l.status === 'Qualified' || l.status === 'Proposal').length;
        
        // Calculate Revenue (sum of deal_value where status = Won)
        const revenue = leads.reduce((sum, l) => {
            if (l.status === 'Won') return sum + Number(l.deal_value || 0);
            return sum;
        }, 0);
        
        // Calculate Lead Sources Breakdown
        const leadSources: Record<string, number> = {};
        let sourceTotal = 0;
        leads.forEach(l => {
            const src = l.source || 'Manual';
            leadSources[src] = (leadSources[src] || 0) + 1;
            sourceTotal++;
        });
        
        const sourcesPercentage = Object.keys(leadSources).map(src => ({
            name: src,
            percentage: sourceTotal > 0 ? Math.round((leadSources[src] / sourceTotal) * 100) : 0
        })).sort((a,b) => b.percentage - a.percentage);

        return res.json({
            data: {
                totalLeads: leads.length,
                activeDeals,
                revenue,
                totalMeetings: activities.length,
                leadSources: sourcesPercentage
            }
        });
    } catch (e: any) {
        console.error("Failed to fetch dashboard metrics:", e);
        return res.status(500).json({ error: e.message });
    }
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

// ── n8n AI Agent Replier Config ────────────────────────────────────────────────
// PATCH /api/whatsapp/ai-agent-toggle
app.patch('/api/whatsapp/ai-agent-toggle', requireAuth, async (req, res): Promise<any> => {
    if (!supabaseAdmin) return res.status(500).json({ error: 'Server not configured.' });
    const userId = req.user.id;
    const { enabled } = req.body;

    // Auto-disable regular ai_enabled if ai_agent_enabled is turned on to avoid conflicts
    const updates: any = { ai_agent_enabled: enabled };
    if (enabled) updates.ai_enabled = false;

    const { error } = await supabaseAdmin
        .from('whatsapp_credentials')
        .update(updates)
        .eq('user_id', userId);

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true, ai_agent_enabled: enabled });
});

// PATCH /api/whatsapp/ai-agent-config
app.patch('/api/whatsapp/ai-agent-config', requireAuth, async (req, res): Promise<any> => {
    if (!supabaseAdmin) return res.status(500).json({ error: 'Server not configured.' });
    const userId = req.user.id;
    const { webhookUrl } = req.body;

    const { error } = await supabaseAdmin
        .from('whatsapp_credentials')
        .update({ n8n_webhook_url: webhookUrl })
        .eq('user_id', userId);

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true });
});

// POST /api/whatsapp/ai-agent-test
app.post('/api/whatsapp/ai-agent-test', requireAuth, async (req, res): Promise<any> => {
    if (!supabaseAdmin) return res.status(500).json({ error: 'Server not configured.' });
    const userId = req.user.id;

    const { data, error } = await supabaseAdmin
        .from('whatsapp_credentials')
        .select('n8n_webhook_url')
        .eq('user_id', userId)
        .single();

    if (error || !data?.n8n_webhook_url) {
        return res.status(400).json({ error: 'No webhook URL configured.' });
    }

    try {
        const payload = {
            test: true,
            userId,
            message: 'This is a test message from SalesAI Dashboard',
            timestamp: new Date().toISOString()
        };

        const response = await fetch(data.n8n_webhook_url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            return res.status(502).json({ error: `Webhook returned status ${response.status}` });
        }

        return res.json({ success: true, message: 'Webhook test successful!' });
    } catch (e: any) {
        return res.status(500).json({ error: `Failed to reach webhook: ${e.message}` });
    }
});

// GET /api/whatsapp/ai-agent-logs
app.get('/api/whatsapp/ai-agent-logs', requireAuth, async (req, res): Promise<any> => {
    if (!supabaseAdmin) return res.status(500).json({ error: 'Server not configured.' });
    const userId = req.user.id;

    const { data, error } = await supabaseAdmin
        .from('ai_activity_logs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ data });
});

// GET /api/leads/:phone/logs — fetch AI chat history for a specific lead
app.get('/api/leads/:phone/logs', requireAuth, async (req, res): Promise<any> => {
    if (!supabaseAdmin) return res.status(500).json({ error: 'Server not configured.' });
    
    const userId = req.user.id;
    const phone = req.params.phone;

    try {
        const { data, error } = await supabaseAdmin
            .from('ai_activity_logs')
            .select('*')
            .eq('user_id', userId)
            .eq('lead_phone', phone)
            .order('created_at', { ascending: false })
            .limit(100);

        if (error) throw error;
        
        return res.json({ data });
    } catch (e: any) {
        console.error("Failed to fetch lead logs:", e);
        return res.status(500).json({ error: e.message });
    }
});

// PATCH /api/whatsapp/human-takeover
app.patch('/api/whatsapp/human-takeover', requireAuth, async (req, res): Promise<any> => {
    if (!supabaseAdmin) return res.status(500).json({ error: 'Server not configured.' });
    const userId = req.user.id;
    const { lead_phone, paused } = req.body;

    if (!lead_phone) return res.status(400).json({ error: 'Missing lead_phone' });

    // Update both whatsapp_contacts and leads table
    await supabaseAdmin
        .from('whatsapp_contacts')
        .update({ ai_paused: paused })
        .eq('user_id', userId)
        .eq('lead_phone', lead_phone);

    const { error } = await supabaseAdmin
        .from('leads')
        .update({ ai_paused: paused })
        .eq('user_id', userId)
        .eq('whatsapp', lead_phone);

    return res.json({ success: true, ai_paused: paused });
});

// PATCH /api/whatsapp/auto-reply-config — configure automated basic replies (upsert so first save works)
app.patch('/api/whatsapp/auto-reply-config', requireAuth, async (req, res): Promise<any> => {
    if (!supabaseAdmin) return res.status(500).json({ error: 'Server not configured.' });

    const userId = req.user.id;
    const { enabled, text } = req.body;

    const { error } = await supabaseAdmin
        .from('whatsapp_credentials')
        .upsert(
            { user_id: userId, auto_reply_enabled: enabled, auto_reply_text: text ?? '', updated_at: new Date().toISOString() },
            { onConflict: 'user_id' }
        );

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true, auto_reply_enabled: enabled, auto_reply_text: text });
});

// POST /api/n8n/send — n8n-specific endpoint using API key auth (no JWT required)
app.post('/api/n8n/send', async (req, res): Promise<any> => {
    console.log("==> Hit /api/n8n/send");
    try {
        const apiKey = req.headers['x-api-key'] || req.body.apiKey;
        const expectedKey = process.env.N8N_API_KEY || 'salesai_n8n_secret_key_2024';

        if (!apiKey || apiKey !== expectedKey) {
            console.warn("[n8n Send] Unauthorized request — invalid or missing API key");
            return res.status(401).json({ error: 'Unauthorized: invalid API key' });
        }

        let { userId, to, message, contact_name } = req.body;

        // If n8n sends the message as an object (e.g. structured AI output), extract the actual text
        if (typeof message === 'object' && message !== null) {
            console.log(`[n8n Send] Message is an object. Attempting to extract text from keys: ${Object.keys(message).join(', ')}`);
            message = message.reply || message.text || message.response || message.output || JSON.stringify(message);
        }

        // Detailed logging to debug delivery issues
        console.log(`[n8n Send] ============ INCOMING REQUEST ============`);
        console.log(`[n8n Send] userId: ${userId}`);
        console.log(`[n8n Send] to: ${to}`);
        console.log(`[n8n Send] message: ${typeof message === 'string' ? message.substring(0, 100) : JSON.stringify(message).substring(0, 100)}`);
        console.log(`[n8n Send] contact_name: ${contact_name}`);

        if (!userId) return res.status(400).json({ error: 'Missing `userId` in body.' });
        if (!to || !message) return res.status(400).json({ error: 'Missing `to` or `message`.' });

        // Check if WhatsApp socket is active for this user
        const isConnected = waManager.activeSockets.has(userId);
        console.log(`[n8n Send] WhatsApp connected for userId ${userId}: ${isConnected}`);

        const result = await waManager.sendMessage(userId, to, message, undefined, contact_name, 'ai');
        console.log("[n8n Send] Result:", JSON.stringify(result));

        if (!result.success) {
            console.error(`[n8n Send] FAILED: ${result.error}`);
            return res.status(500).json({ error: result.error });
        }

        console.log(`[n8n Send] SUCCESS: messageId=${result.messageId}`);
        return res.json({ success: true, messageId: result.messageId });
    } catch (e: any) {
        console.error("CRITICAL EXCEPTION IN /api/n8n/send:", e);
        return res.status(500).json({ error: e.message || 'Internal Server Error' });
    }
});

// POST /api/n8n/send-buttons — send a button/interactive message via API key (for n8n)
app.post('/api/n8n/send-buttons', async (req, res): Promise<any> => {
    console.log("==> Hit /api/n8n/send-buttons");
    try {
        const apiKey = req.headers['x-api-key'] || req.body.apiKey;
        const expectedKey = process.env.N8N_API_KEY || 'salesai_n8n_secret_key_2024';

        if (!apiKey || apiKey !== expectedKey) {
            console.warn("[n8n Send Buttons] Unauthorized request — invalid or missing API key");
            return res.status(401).json({ error: 'Unauthorized: invalid API key' });
        }

        const { userId, to, bodyText, buttons, contact_name } = req.body;

        if (!userId) return res.status(400).json({ error: 'Missing `userId` in body.' });
        if (!to || !bodyText || !Array.isArray(buttons)) return res.status(400).json({ error: 'Missing `to`, `bodyText`, or `buttons` array.' });

        const result = await waManager.sendButtonMessage(userId, to, bodyText, buttons, contact_name, 'ai');
        if (!result.success) {
            return res.status(500).json({ error: result.error });
        }
        return res.json({ success: true, messageId: result.messageId });
    } catch (e: any) {
        console.error("CRITICAL EXCEPTION IN /api/n8n/send-buttons:", e);
        return res.status(500).json({ error: e.message || 'Internal Server Error' });
    }
});


// POST /api/whatsapp/send — send a text message via active Baileys session
app.post('/api/whatsapp/send', requireAuth, async (req, res): Promise<any> => {
    console.log("==> Hit /api/whatsapp/send");
    try {
        // userId can come from token (req.user.id) or body (for n8n API key auth)
        const userId = req.user?.id || req.body.userId;
        const { to, message, quotedMsgId, contact_name } = req.body;

        if (!userId) return res.status(400).json({ error: 'Missing `userId`. Provide it in body if using API key.' });

        console.log(`Sending message to ${to} from ${userId}...`);

        if (!to || !message) return res.status(400).json({ error: 'Missing `to` or `message`.' });

        const result = await waManager.sendMessage(userId, to, message, quotedMsgId, contact_name);
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

// POST /api/whatsapp/send-buttons — send a button message from Inbox Composer (JWT protected)
app.post('/api/whatsapp/send-buttons', requireAuth, async (req, res): Promise<any> => {
    console.log("==> Hit /api/whatsapp/send-buttons");
    try {
        const userId = req.user?.id || req.body.userId;
        const { to, bodyText, buttons, contact_name } = req.body;

        if (!userId) return res.status(400).json({ error: 'Missing `userId`.' });
        if (!to || !bodyText || !Array.isArray(buttons)) return res.status(400).json({ error: 'Missing `to`, `bodyText`, or `buttons`.' });

        const result = await waManager.sendButtonMessage(userId, to, bodyText, buttons, contact_name, 'user');
        if (!result.success) {
            return res.status(500).json({ error: result.error });
        }
        return res.json({ success: true, messageId: result.messageId });
    } catch (e: any) {
        console.error("CRITICAL EXCEPTION IN /api/whatsapp/send-buttons:", e);
        return res.status(500).json({ error: e.message || 'Internal Server Error' });
    }
});

// POST /api/whatsapp/send-media — send an image or document
app.post('/api/whatsapp/send-media', requireAuth, upload.single('file'), async (req, res): Promise<any> => {
    const userId = req.user.id;
    const { to, caption, contact_name } = req.body;
    const file = (req as any).file;

    if (!to || !file) return res.status(400).json({ error: 'Missing `to` or file.' });

    const result = await waManager.sendMedia(userId, to, file.buffer, file.mimetype, caption, file.originalname, contact_name);
    if (!result.success) return res.status(500).json({ error: result.error });

    return res.json({ success: true, messageId: result.messageId });
});

/**
 * GET /api/whatsapp/chats
 * Returns a list of the user's whatsapp_contacts, optionally attaching the latest message for each.
 * This fulfills the requirement to only show items from whatsapp_contacts in the inbox.
 */
app.get('/api/whatsapp/chats', requireAuth, async (req, res): Promise<any> => {
    if (!supabaseAdmin) return res.status(500).json({ error: 'Server not configured.' });

    const userId = req.user.id;

    try {
        // 1. Fetch all contacts from whatsapp_contacts
        const { data: contacts, error: contactsError } = await supabaseAdmin
            .from('whatsapp_contacts')
            .select('*')
            .eq('user_id', userId);

        if (contactsError) throw contactsError;

        // 2. Fetch messages to get the latest message for each contact
        const { data: messages, error: msgError } = await supabaseAdmin
            .from('whatsapp_messages')
            .select('lead_phone, jid, content, timestamp, sender')
            .eq('user_id', userId)
            .order('timestamp', { ascending: false })
            .order('id', { ascending: false })
            .limit(2000); // Fetch enough recent messages to cover most chats

        if (msgError) throw msgError;

        const latestMessages = new Map();
        (messages || []).forEach(msg => {
            const jid = msg.jid || msg.lead_phone;
            if (jid && !latestMessages.has(jid)) {
                latestMessages.set(jid, msg);
            }
            if (msg.lead_phone && !latestMessages.has(msg.lead_phone)) {
                latestMessages.set(msg.lead_phone, msg);
            }
        });

        // 3. Map contacts to the inbox format
        const chats = (contacts || []).map(contact => {
            const jid = contact.jid || contact.lead_phone;
            const msg = latestMessages.get(jid) || latestMessages.get(contact.lead_phone);
            
            return {
                jid: jid,
                lead_phone: contact.lead_phone,
                contact_name: contact.contact_name,
                profile_picture_url: contact.profile_picture_url,
                is_group: contact.is_group ?? false,
                last_message: msg ? msg.content : '',
                last_timestamp: msg ? msg.timestamp : contact.created_at,
                last_sender: msg ? msg.sender : '',
            };
        });

        // Sort by last_timestamp descending
        chats.sort((a, b) => new Date(b.last_timestamp).getTime() - new Date(a.last_timestamp).getTime());

        return res.json({ data: chats });
    } catch (err: any) {
        console.error('[API] Error fetching chats:', err);
        return res.status(500).json({ error: err.message });
    }
});
// ── Dashboard Metrics ────────────────────────────────────────────────────────
app.get('/api/dashboard/metrics', requireAuth, async (req, res): Promise<any> => {
    if (!supabaseAdmin) return res.status(500).json({ error: 'Server not configured.' });
    try {
        const userId = req.user.id;

        // Fetch leads count
        const { count: totalLeads } = await supabaseAdmin.from('leads').select('*', { count: 'exact', head: true }).eq('user_id', userId);

        // Fetch activities count
        const { count: totalMeetings } = await supabaseAdmin.from('activities').select('*', { count: 'exact', head: true }).eq('user_id', userId);

        // Fetch deals for revenue and active deals
        const { data: deals } = await supabaseAdmin.from('deals')
            .select(`
                value,
                pipeline_stages!inner(name)
            `)
            .eq('user_id', userId);
        
        let activeDeals = 0;
        let revenue = 0;
        
        if (deals) {
            activeDeals = deals.filter((d: any) => d.pipeline_stages?.name !== 'Won' && d.pipeline_stages?.name !== 'Lost').length;
            revenue = deals.filter((d: any) => d.pipeline_stages?.name === 'Won').reduce((sum: number, d: any) => sum + Number(d.value || 0), 0);
        }

        return res.json({
            data: {
                totalLeads: totalLeads || 0,
                activeDeals,
                revenue,
                totalMeetings: totalMeetings || 0,
                leadSources: [] // Can be calculated from leads if needed
            }
        });
    } catch (err: any) {
        console.error('[API] Error fetching dashboard metrics:', err);
        return res.status(500).json({ error: err.message });
    }
});

// ── Analytics & Reports ──────────────────────────────────────────────────────
app.get('/api/analytics/summary', requireAuth, async (req, res): Promise<any> => {
    if (!supabaseAdmin) return res.status(500).json({ error: 'Server not configured.' });
    
    // RBAC check: can_view_analytics
    if (!await checkPermission(req.user.id, 'can_view_analytics')) {
        return res.status(403).json({ error: 'Permission denied: You do not have permission to view analytics.' });
    }

    try {
        const userId = req.user.id;
        const dateRange = req.query.dateRange as string || 'all';

        // Base queries
        let leadsQuery = supabaseAdmin.from('leads').select('*, team_members(name)').eq('user_id', userId);
        let dealsQuery = supabaseAdmin.from('deals').select('*, pipeline_stages(name), pipelines(name)').eq('user_id', userId);

        // Date filtering
        if (dateRange !== 'all') {
            const fromDate = new Date();
            if (dateRange === 'today') {
                fromDate.setHours(0, 0, 0, 0);
            } else if (dateRange === 'this_week') {
                const day = fromDate.getDay();
                // Get Sunday of current week
                const diff = fromDate.getDate() - day;
                fromDate.setDate(diff);
                fromDate.setHours(0, 0, 0, 0);
            } else if (dateRange === 'this_month') {
                fromDate.setDate(1);
                fromDate.setHours(0, 0, 0, 0);
            } else if (dateRange === 'this_year') {
                fromDate.setMonth(0, 1); // Jan 1st
                fromDate.setHours(0, 0, 0, 0);
            } else {
                // Fallback for old values if any
                const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
                fromDate.setDate(fromDate.getDate() - days);
            }
            leadsQuery = leadsQuery.gte('created_at', fromDate.toISOString());
            dealsQuery = dealsQuery.gte('created_at', fromDate.toISOString());
        }

        const [leadsRes, dealsRes, teamMembersRes, pipelinesRes] = await Promise.all([
            leadsQuery,
            dealsQuery,
            supabaseAdmin.from('team_members').select('name').eq('owner_id', userId).eq('is_active', true),
            supabaseAdmin.from('pipelines').select('name').eq('user_id', userId)
        ]);

        if (leadsRes.error) throw leadsRes.error;
        if (dealsRes.error) throw dealsRes.error;
        if (teamMembersRes.error) throw teamMembersRes.error;
        if (pipelinesRes.error) throw pipelinesRes.error;

        const leads = leadsRes.data || [];
        const deals = dealsRes.data || [];
        const activeMembers = teamMembersRes.data || [];
        const allPipelines = pipelinesRes.data || [];

        // 1. KPIs
        const totalLeads = leads.length;
        const openLeads = leads.filter(l => l.status !== 'Won' && l.status !== 'Lost').length;
        const wonLeads = leads.filter(l => l.status === 'Won').length;
        const lostLeads = leads.filter(l => l.status === 'Lost').length;
        const wonPercent = totalLeads > 0 ? Number(((wonLeads / totalLeads) * 100).toFixed(2)) : 0;
        const lostPercent = totalLeads > 0 ? Number(((lostLeads / totalLeads) * 100).toFixed(2)) : 0;

        // 2. By Team Member
        const teamMap = new Map<string, any>();
        
        // Pre-populate with all active team members (so they show up even with 0 leads)
        activeMembers.forEach((m: any) => {
            if (m.name) {
                teamMap.set(m.name, { name: m.name, total: 0, open: 0, won: 0, lost: 0, wonAmount: 0 });
            }
        });

        leads.forEach(l => {
            const name = (l.team_members as any)?.name || l.assigned_to || 'Unassigned';
            if (!teamMap.has(name)) {
                teamMap.set(name, { name, total: 0, open: 0, won: 0, lost: 0, wonAmount: 0 });
            }
            const stat = teamMap.get(name)!;
            stat.total++;
            if (l.status === 'Won') {
                stat.won++;
                stat.wonAmount += Number(l.deal_value || 0); // Deal value from lead if any
            } else if (l.status === 'Lost') {
                stat.lost++;
            } else {
                stat.open++;
            }
        });

        // 3. By Pipeline (Product)
        const productMap = new Map<string, any>();

        // Pre-populate with all pipelines (so they show up even with 0 deals)
        allPipelines.forEach((p: any) => {
            if (p.name) {
                productMap.set(p.name, { product: p.name, total: 0, open: 0, won: 0, lost: 0 });
            }
        });

        deals.forEach(d => {
            // Use the joined pipeline name — not d.product which is always null
            const pipelineName = (d.pipelines as any)?.name || d.product || 'No Pipeline';
            if (!productMap.has(pipelineName)) {
                productMap.set(pipelineName, { product: pipelineName, total: 0, open: 0, won: 0, lost: 0 });
            }
            const stat = productMap.get(pipelineName)!;
            stat.total++;
            // The related stages might be an object or array depending on Supabase version
            const stageName = Array.isArray(d.pipeline_stages) ? d.pipeline_stages[0]?.name : d.pipeline_stages?.name;
            if (stageName === 'Won') stat.won++;
            else if (stageName === 'Lost') stat.lost++;
            else stat.open++;
        });

        const byTeamMember = Array.from(teamMap.values()).map(stat => ({
            ...stat,
            wonPercent: stat.total > 0 ? Number(((stat.won / stat.total) * 100).toFixed(2)) : 0,
            lostPercent: stat.total > 0 ? Number(((stat.lost / stat.total) * 100).toFixed(2)) : 0
        })).sort((a, b) => b.total - a.total);

        const byPipeline = Array.from(productMap.values()).map(stat => ({
            ...stat,
            wonPercent: stat.total > 0 ? Number(((stat.won / stat.total) * 100).toFixed(2)) : 0,
            lostPercent: stat.total > 0 ? Number(((stat.lost / stat.total) * 100).toFixed(2)) : 0
        })).sort((a, b) => b.total - a.total);

        return res.json({
            success: true,
            data: {
                kpis: {
                    totalLeads, openLeads, wonLeads, lostLeads, wonPercent, lostPercent
                },
                byTeamMember,
                byPipeline
            }
        });
    } catch (err: any) {
        console.error('[API] Error fetching analytics summary:', err);
        return res.status(500).json({ error: err.message });
    }
});

// ── Pipelines & Deals ──────────────────────────────────────────────────────────

// GET /api/pipelines — Fetch all pipelines with their stages
app.get('/api/pipelines', requireAuth, async (req, res): Promise<any> => {
    if (!supabaseAdmin) return res.status(500).json({ error: 'Server not configured.' });
    try {
        const { data: pipelines, error: pError } = await supabaseAdmin
            .from('pipelines')
            .select('*')
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: true });

        if (pError) {
            if (pError.code === '42P01') return res.json({ success: true, data: [] });
            throw pError;
        }

        // Fetch stages for these pipelines
        if (pipelines && pipelines.length > 0) {
            const pipelineIds = pipelines.map(p => p.id);
            const { data: stages } = await supabaseAdmin
                .from('pipeline_stages')
                .select('*')
                .in('pipeline_id', pipelineIds)
                .order('order_index', { ascending: true });

            // Attach stages to pipelines
            const pipelinesWithStages = pipelines.map(p => ({
                ...p,
                stages: stages ? stages.filter(s => s.pipeline_id === p.id) : []
            }));
            
            return res.json({ success: true, data: pipelinesWithStages });
        }

        return res.json({ success: true, data: [] });
    } catch (e: any) {
        console.error('[Pipelines] GET failed:', e);
        return res.status(500).json({ error: e.message });
    }
});

// POST /api/pipelines — Create a new pipeline with default stages
app.post('/api/pipelines', requireAuth, async (req, res): Promise<any> => {
    if (!supabaseAdmin) return res.status(500).json({ error: 'Server not configured.' });
    const { name, stages } = req.body;
    if (!name) return res.status(400).json({ error: 'Pipeline name is required' });

    try {
        const { data: pipeline, error } = await supabaseAdmin
            .from('pipelines')
            .insert({ user_id: req.user.id, name })
            .select()
            .single();

        if (error) throw error;

        // Insert stages
        const stagesToInsert = stages && stages.length > 0 ? stages.map((s: any, idx: number) => ({
            pipeline_id: pipeline.id,
            name: s.name,
            color: s.color || 'text-slate-600',
            bg_color: s.bg_color || 'bg-slate-50',
            border_color: s.border_color || 'border-slate-200',
            order_index: idx
        })) : [
            { pipeline_id: pipeline.id, name: 'New', order_index: 1 },
            { pipeline_id: pipeline.id, name: 'In Progress', order_index: 2 },
            { pipeline_id: pipeline.id, name: 'Done', order_index: 3 }
        ];

        await supabaseAdmin.from('pipeline_stages').insert(stagesToInsert);

        return res.json({ success: true, data: pipeline });
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
});

// PUT /api/pipelines/:id — Update pipeline name AND stages
app.put('/api/pipelines/:id', requireAuth, async (req, res): Promise<any> => {
    if (!supabaseAdmin) return res.status(500).json({ error: 'Server not configured.' });
    const { name, stages } = req.body;
    if (!name) return res.status(400).json({ error: 'Pipeline name is required' });

    try {
        // 1. Update the pipeline name
        const { data, error } = await supabaseAdmin
            .from('pipelines')
            .update({ name })
            .eq('id', req.params.id)
            .eq('user_id', req.user.id)
            .select()
            .single();

        if (error) throw error;

        // 2. If stages are provided, do a full replace (delete all + re-insert)
        if (stages && Array.isArray(stages)) {
            // Delete all existing stages for this pipeline
            await supabaseAdmin
                .from('pipeline_stages')
                .delete()
                .eq('pipeline_id', req.params.id);

            // Re-insert the new stages
            const stagesToInsert = stages.map((s: any, idx: number) => ({
                pipeline_id: req.params.id,
                name: s.name,
                color: s.color || 'text-slate-600',
                bg_color: s.bg_color || 'bg-slate-50',
                border_color: s.border_color || 'border-slate-200',
                order_index: idx
            }));

            if (stagesToInsert.length > 0) {
                const { error: stageError } = await supabaseAdmin
                    .from('pipeline_stages')
                    .insert(stagesToInsert);
                if (stageError) throw stageError;
            }
        }

        return res.json({ success: true, data });
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
});

// DELETE /api/pipelines/:id — Delete a pipeline (cascade deletes stages and deals)
app.delete('/api/pipelines/:id', requireAuth, async (req, res): Promise<any> => {
    if (!supabaseAdmin) return res.status(500).json({ error: 'Server not configured.' });
    try {
        const { error } = await supabaseAdmin
            .from('pipelines')
            .delete()
            .eq('id', req.params.id)
            .eq('user_id', req.user.id);

        if (error) throw error;
        return res.json({ success: true });
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
});

// POST /api/pipelines/:id/transfer — Transfer deals and delete pipeline
app.post('/api/pipelines/:id/transfer', requireAuth, async (req, res): Promise<any> => {
    if (!supabaseAdmin) return res.status(500).json({ error: 'Server not configured.' });
    const { target_pipeline_id } = req.body;
    if (!target_pipeline_id) return res.status(400).json({ error: 'Target pipeline ID is required.' });

    try {
        // 1. Get the first stage of the target pipeline
        const { data: targetStages, error: stagesError } = await supabaseAdmin
            .from('pipeline_stages')
            .select('id')
            .eq('pipeline_id', target_pipeline_id)
            .order('order_index', { ascending: true })
            .limit(1);

        if (stagesError) throw stagesError;
        if (!targetStages || targetStages.length === 0) return res.status(400).json({ error: 'Target pipeline has no stages.' });

        const firstStageId = targetStages[0].id;

        // 2. Move all deals to the target pipeline's first stage
        const { error: updateError } = await supabaseAdmin
            .from('deals')
            .update({ pipeline_id: target_pipeline_id, stage_id: firstStageId })
            .eq('pipeline_id', req.params.id)
            .eq('user_id', req.user.id);

        if (updateError) throw updateError;

        // 3. Delete the old pipeline
        const { error: deleteError } = await supabaseAdmin
            .from('pipelines')
            .delete()
            .eq('id', req.params.id)
            .eq('user_id', req.user.id);

        if (deleteError) throw deleteError;

        return res.json({ success: true, message: 'Deals transferred and pipeline deleted.' });
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
});


// GET /api/deals — Fetch deals (optionally filtered by pipeline_id)
app.get('/api/deals', requireAuth, async (req, res): Promise<any> => {
    if (!supabaseAdmin) return res.status(500).json({ error: 'Server not configured.' });
    try {
        let query = supabaseAdmin
            .from('deals')
            .select('*')
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: false });
            
        if (req.query.pipeline_id) {
            query = query.eq('pipeline_id', req.query.pipeline_id);
        }

        const { data, error } = await query;

        if (error) {
            if (error.code === '42P01') return res.json({ success: true, data: [] });
            throw error;
        }
        return res.json({ success: true, data: data || [] });
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
});

// POST /api/deals — Create a new deal
app.post('/api/deals', requireAuth, async (req, res): Promise<any> => {
    if (!supabaseAdmin) return res.status(500).json({ error: 'Server not configured.' });
    const { pipeline_id, lead_id, lead_name, company, phone, title, value, stage_id, score, expected_close_date, notes } = req.body;

    if (!lead_name || !title || !pipeline_id || !stage_id) {
        return res.status(400).json({ error: 'lead_name, title, pipeline_id, and stage_id are required.' });
    }

    try {
        const { data, error } = await supabaseAdmin
            .from('deals')
            .insert({
                user_id: req.user.id,
                pipeline_id,
                lead_id: lead_id || null,
                lead_name,
                company: company || null,
                phone: phone || null,
                title,
                value: Number(value) || 0,
                stage_id,
                score: score || 'Cold',
                expected_close_date: expected_close_date || null,
                notes: notes || null,
            })
            .select()
            .single();

        if (error) throw error;

        try {
            await supabaseAdmin.from('deal_stage_history').insert({
                deal_id: data.id,
                from_stage_id: null,
                to_stage_id: stage_id,
            });
        } catch (err) {}

        return res.json({ success: true, data });
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
});

// PUT /api/deals/:id — Update deal details
app.put('/api/deals/:id', requireAuth, async (req, res): Promise<any> => {
    if (!supabaseAdmin) return res.status(500).json({ error: 'Server not configured.' });
    
    // RBAC check: can_edit
    if (!await checkPermission(req.user.id, 'can_edit')) {
        return res.status(403).json({ error: 'Permission denied: You do not have permission to edit deals.' });
    }

    const { title, value, score, expected_close_date, notes } = req.body;
    try {
        const { data, error } = await supabaseAdmin
            .from('deals')
            .update({
                title,
                value: Number(value) || 0,
                score,
                expected_close_date: expected_close_date || null,
                notes,
                updated_at: new Date().toISOString(),
            })
            .eq('id', req.params.id)
            .eq('user_id', req.user.id)
            .select()
            .single();

        if (error) throw error;
        
        // Auto-sync the new score to the associated lead if it exists
        if (data && data.lead_id && score) {
            await supabaseAdmin.from('leads').update({ score }).eq('id', data.lead_id);
        }

        return res.json({ success: true, data });
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
});

// PUT /api/deals/:id/stage — Move deal to a new stage
app.put('/api/deals/:id/stage', requireAuth, async (req, res): Promise<any> => {
    if (!supabaseAdmin) return res.status(500).json({ error: 'Server not configured.' });
    
    // RBAC check: can_edit
    if (!await checkPermission(req.user.id, 'can_edit')) {
        return res.status(403).json({ error: 'Permission denied: You do not have permission to edit deals.' });
    }

    const { stage_id, is_won, is_lost, loss_reason } = req.body;
    const dealId = req.params.id;

    if (!stage_id) return res.status(400).json({ error: 'stage_id is required.' });

    try {
        const { data: current } = await supabaseAdmin
            .from('deals').select('stage_id').eq('id', dealId).eq('user_id', req.user.id).single();

        const updates: any = {
            stage_id,
            updated_at: new Date().toISOString(),
        };
        if (is_won || is_lost) updates.closed_at = new Date().toISOString();
        if (is_lost && loss_reason) updates.loss_reason = loss_reason;

        const { data, error } = await supabaseAdmin
            .from('deals').update(updates).eq('id', dealId).eq('user_id', req.user.id).select().single();

        if (error) throw error;

        try {
            await supabaseAdmin.from('deal_stage_history').insert({
                deal_id: dealId,
                from_stage_id: current?.stage_id || null,
                to_stage_id: stage_id,
            });
        } catch (err) {}

        return res.json({ success: true, data });
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
});

// DELETE /api/deals/:id — Delete a deal
app.delete('/api/deals/:id', requireAuth, async (req, res): Promise<any> => {
    if (!supabaseAdmin) return res.status(500).json({ error: 'Server not configured.' });

    // RBAC check: can_delete
    if (!await checkPermission(req.user.id, 'can_delete')) {
        return res.status(403).json({ error: 'Permission denied: You do not have permission to delete deals.' });
    }

    try {
        const { error } = await supabaseAdmin.from('deals').delete().eq('id', req.params.id).eq('user_id', req.user.id);
        if (error) throw error;
        return res.json({ success: true });
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
});

// GET /api/deals/:id/history — Fetch stage history for a deal
app.get('/api/deals/:id/history', requireAuth, async (req, res): Promise<any> => {
    if (!supabaseAdmin) return res.status(500).json({ error: 'Server not configured.' });
    try {
        const { data, error } = await supabaseAdmin
            .from('deal_stage_history')
            .select('*, from_stage:pipeline_stages!from_stage_id(name), to_stage:pipeline_stages!to_stage_id(name)')
            .eq('deal_id', req.params.id)
            .order('changed_at', { ascending: true });
        if (error) {
            if (error.code === '42P01') return res.json({ success: true, data: [] });
            throw error;
        }
        return res.json({ success: true, data: data || [] });
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
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
    const { title, attendee, date, time, type, status, agenda } = req.body;

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
            agenda,
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
    const { title, attendee, date, time, type, agenda } = req.body;

    const { data, error } = await supabaseAdmin
        .from('activities')
        .update({
            title,
            attendee,
            date,
            time,
            type,
            agenda,
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



// Normalize JID for message-history lookups.
// @g.us → keep. @s.whatsapp.net → keep. @lid → keep (never blindly convert).
// Bare phone digits → phone@s.whatsapp.net.
function normalizeJid(jid: string) {
    if (!jid) return jid;
    if (jid.includes('@g.us')) return jid;
    if (jid.includes('@s.whatsapp.net')) return jid;
    if (jid.includes('@lid')) return jid; // @lid stays @lid — cannot be converted
    // bare phone number
    const digits = jid.replace(/\D/g, '');
    return digits ? digits + '@s.whatsapp.net' : jid;
}

// 3. Fetch Message History (latest messages from DB, ordered by timestamp)
app.get('/api/whatsapp/messages/:identifier', requireAuth, async (req, res): Promise<any> => {
    if (!supabaseAdmin) return res.status(500).json({ error: 'Server not configured.' });

    const userId = req.user.id;
    const identifier = decodeURIComponent(String(req.params.identifier ?? ''));
    const rawPhone = identifier.replace(/@.*$/, ''); // Extract bare phone number

    // Attempt to normalize if it looks like a phone number but doesn't have suffix
    const normalizedIdentifier = identifier.includes('@') ? identifier : normalizeJid(identifier);

    const cursor = req.query.cursor ? String(req.query.cursor) : null;
    const limitParams = req.query.limit ? parseInt(String(req.query.limit)) : 20;
    const limit = isNaN(limitParams) ? 20 : limitParams;

    let query = supabaseAdmin
        .from('whatsapp_messages')
        .select('*')
        .eq('user_id', userId)
        .or(`jid.eq.${normalizedIdentifier},lead_phone.eq.${rawPhone},jid.eq.${identifier}`);

    if (cursor) {
        query = query.lt('timestamp', cursor);
    }

    try {
        const { data, error } = await query
            .order('timestamp', { ascending: false })
            .order('id', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return res.json({ data: (data || []).reverse() });
    } catch (err: any) {
        console.error(`[API] Error fetching messages for ${identifier}:`, err);
        return res.status(500).json({ error: err.message });
    }
});

// ── Leads Bulk Import & Export ────────────────────────────────────────────────

/**
 * GET /api/leads/export
 * Returns ALL leads for the authenticated user as a CSV file download.
 * This is a proper backend export — data comes directly from Supabase.
 */
app.get('/api/leads/export', requireAuth, async (req, res): Promise<any> => {
    if (!supabaseAdmin) return res.status(500).json({ error: 'Server not configured.' });

    // RBAC check: can_export
    if (!await checkPermission(req.user.id, 'can_export')) {
        return res.status(403).json({ error: 'Permission denied: You do not have permission to export leads.' });
    }

    const userId = req.user.id;
    const timeRange = (req.query.timeRange as string) || 'all';

    try {
        let query = supabaseAdmin
            .from('leads')
            .select('name, display_name, mobile, email, company, role, source, status, score, deal_value, created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (timeRange !== 'all') {
            const now = new Date();
            let startDate = new Date();
            if (timeRange === 'week') {
                startDate.setDate(now.getDate() - 7);
            } else if (timeRange === 'month') {
                startDate.setMonth(now.getMonth() - 1);
            } else if (timeRange === 'year') {
                startDate.setFullYear(now.getFullYear() - 1);
            }
            query = query.gte('created_at', startDate.toISOString());
        }

        const { data: leads, error } = await query;

        if (error) throw error;

        // Build CSV string
        const CSV_HEADERS = ['Name', 'Phone', 'Email', 'Company', 'Role', 'Source', 'Status', 'Score', 'Deal Value', 'Created At'];
        const rows = (leads || []).map(l => [
            l.name || '',
            l.mobile || '',
            l.email || '',
            l.company || '',
            l.role || '',
            l.source || '',
            l.status || '',
            l.score || '',
            l.deal_value || '0',
            l.created_at ? new Date(l.created_at).toLocaleDateString('en-IN') : ''
        ]);

        const csvContent = [CSV_HEADERS, ...rows]
            .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
            .join('\r\n');

        const filename = `leads_${new Date().toISOString().split('T')[0]}.csv`;

        // Log export activity
        try {
            await supabaseAdmin.from('data_activity_history').insert({
                user_id: userId,
                action_type: 'EXPORT',
                record_count: leads?.length || 0,
                filter_type: timeRange
            });
        } catch (err) {
            console.error("Failed to log export history:", err);
        }

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        // Add BOM for Excel UTF-8 compatibility
        return res.send('\uFEFF' + csvContent);

    } catch (e: any) {
        console.error('[Export] Failed to export leads:', e);
        return res.status(500).json({ error: e.message });
    }
});

// GET /api/deals/export — Export all deals as CSV
app.get('/api/deals/export', requireAuth, async (req, res): Promise<any> => {
    if (!supabaseAdmin) return res.status(500).json({ error: 'Server not configured.' });

    // RBAC check: can_export
    if (!await checkPermission(req.user.id, 'can_export')) {
        return res.status(403).json({ error: 'Permission denied: You do not have permission to export deals.' });
    }

    const userId = req.user.id;

    try {
        const { data: deals, error } = await supabaseAdmin
            .from('deals')
            .select('title, value, score, lead_name, company, phone, product, expected_close_date, closed_at, created_at, pipeline_id')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Build CSV string
        const CSV_HEADERS = ['Deal Title', 'Value', 'Score', 'Lead Name', 'Company', 'Phone', 'Product', 'Pipeline ID', 'Expected Close', 'Created At'];
        const rows = (deals || []).map(d => [
            d.title || '',
            d.value || '0',
            d.score || '',
            d.lead_name || '',
            d.company || '',
            d.phone || '',
            d.product || '',
            d.pipeline_id || '',
            d.expected_close_date ? new Date(d.expected_close_date).toLocaleDateString('en-IN') : '',
            d.created_at ? new Date(d.created_at).toLocaleDateString('en-IN') : ''
        ]);

        const csvContent = [CSV_HEADERS, ...rows]
            .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
            .join('\r\n');

        const filename = `deals_${new Date().toISOString().split('T')[0]}.csv`;

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        return res.send('\uFEFF' + csvContent);

    } catch (e: any) {
        console.error('[Export] Failed to export deals:', e);
        return res.status(500).json({ error: e.message });
    }
});

/**
 * GET /api/leads/history
 * Fetch the data activity history (Imports and Exports)
 */
app.get('/api/leads/history', requireAuth, async (req, res): Promise<any> => {
    if (!supabaseAdmin) return res.status(500).json({ error: 'Server not configured.' });
    try {
        const { data, error } = await supabaseAdmin
            .from('data_activity_history')
            .select('*')
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: false })
            .limit(50);
            
        if (error) {
            // Table not found — migration not run yet
            if (error.code === '42P01' || error.message?.includes('does not exist')) {
                return res.json({ success: true, history: [] });
            }
            throw error;
        }
        return res.json({ success: true, history: data || [] });
    } catch (e: any) {
        console.error('[History] Failed to fetch history:', e);
        return res.status(500).json({ error: e.message });
    }
});

/**
 * POST /api/leads/import
 * Accepts an array of lead rows (parsed from CSV on frontend),
 * validates them server-side, generates WhatsApp JIDs, and bulk inserts.
 * Returns { inserted, skipped, errors[] } for detailed feedback.
 */
app.post('/api/leads/import', requireAuth, async (req, res): Promise<any> => {
    if (!supabaseAdmin) return res.status(500).json({ error: 'Server not configured.' });

    // RBAC check: can_import
    if (!await checkPermission(req.user.id, 'can_import')) {
        return res.status(403).json({ error: 'Permission denied: You do not have permission to import leads.' });
    }

    const userId = req.user.id;
    const { rows } = req.body;

    if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ error: 'No rows provided. Send { rows: [...] } in body.' });
    }

    const VALID_STATUSES = ['uncontacted', 'New', 'Contacted', 'Qualified', 'Proposal', 'Won', 'Lost'];
    const VALID_SCORES   = ['Cold', 'Warm', 'Hot'];
    const VALID_SOURCES  = ['Manual', 'WhatsApp', 'Meta Ads', 'Referrals', 'Import', 'LinkedIn', 'Website', 'Referral'];

    const records: any[] = [];
    const skipped: number[] = [];
    const validationErrors: string[] = [];

    rows.forEach((row: any, idx: number) => {
        const name = (row.name || row.Name || '').toString().trim();
        const phone = (row.phone || row.Phone || row.mobile || row.Mobile || '').toString().replace(/\s|-/g, '');

        // At least name or phone must be present
        if (!name && !phone) {
            skipped.push(idx + 1);
            validationErrors.push(`Row ${idx + 1}: Name aur Phone dono missing hain — skip kiya.`);
            return;
        }

        const cleanPhone = phone.replace(/[^0-9]/g, '');
        const companyRaw = (row.company || row.Company || '').toString().trim();
        const nameOrFallback = name || `Lead_${cleanPhone}`;
        const displayName = companyRaw ? `${nameOrFallback} (${companyRaw})` : nameOrFallback;

        const rawStatus = (row.status || row.Status || '').toString().trim();
        const rawScore  = (row.score  || row.Score  || '').toString().trim();
        const rawSource = (row.source || row.Source || '').toString().trim();

        records.push({
            user_id:      userId,
            name:         nameOrFallback,
            display_name: displayName,
            mobile:       cleanPhone ? `+${cleanPhone}` : null,
            whatsapp:     cleanPhone ? `${cleanPhone}@s.whatsapp.net` : null,
            email:        (row.email || row.Email || '').toString().trim() || null,
            company:      companyRaw || null,
            role:         (row.role || row.Role || '').toString().trim() || null,
            source:       VALID_SOURCES.includes(rawSource) ? rawSource : 'Import',
            status:       VALID_STATUSES.includes(rawStatus) ? rawStatus : 'New',
            score:        VALID_SCORES.includes(rawScore)   ? rawScore  : 'Cold',
            deal_value:   Number(row.deal_value || row['Deal Value'] || row.value || 0) || 0,
        });
    });

    if (records.length === 0) {
        return res.status(400).json({
            error: 'Koi valid lead nahi mili.',
            skipped: skipped.length,
            validationErrors
        });
    }

    // Batch insert in groups of 100
    const BATCH_SIZE = 100;
    let totalInserted = 0;

    try {
        for (let i = 0; i < records.length; i += BATCH_SIZE) {
            const batch = records.slice(i, i + BATCH_SIZE);
            const { error: dbErr } = await supabaseAdmin.from('leads').insert(batch);
            if (dbErr) throw new Error(`Batch ${Math.floor(i / BATCH_SIZE) + 1} failed: ${dbErr.message}`);
            totalInserted += batch.length;
        }

        console.log(`[Import] userId=${userId} imported ${totalInserted} leads (${skipped.length} skipped)`);

            // Log history
            try {
                await supabaseAdmin.from('data_activity_history').insert({
                    user_id: userId,
                    action_type: 'IMPORT',
                    record_count: records.length,
                    skipped_count: skipped.length
                });
            } catch (err) {
                console.error("Failed to log import history:", err);
            }

        // --- AI Bulk Outreach Logic ---
        try {
            const { data: credentials } = await supabaseAdmin
                .from('whatsapp_credentials')
                .select('ai_enabled, auto_reply_enabled, auto_reply_text, ai_agent_enabled, n8n_webhook_url')
                .eq('user_id', userId)
                .maybeSingle();

            if (credentials && (credentials.ai_agent_enabled || credentials.auto_reply_enabled)) {
                let defaultMsg = credentials.auto_reply_text || "Hi {Name}, I'm reaching out to see if we can help you with your requirements today.";
                
                let delayMs = 15000; // Start with 15 sec delay for the first message
                let queuedCount = 0;
                
                for (const record of records) {
                    if (!record.whatsapp) continue; // Skip leads without phone numbers
                    
                    let message = defaultMsg
                        .replace(/{Name}/ig, record.name || '')
                        .replace(/{Company}/ig, record.company || '');
                    
                    // Queue the initial outreach message
                    await messageQueue.add('send-message', {
                        userId,
                        to: record.whatsapp,
                        message: message,
                        contact_name: record.name,
                        type: 'text'
                    }, { delay: delayMs });
                    
                    delayMs += 30000; // +30 seconds stagger per lead to prevent WhatsApp ban
                    queuedCount++;
                }
                console.log(`[Import] Queued ${queuedCount} automated AI outreach messages with staggering.`);
            }
        } catch (queueErr) {
            console.error('[Import] Error queuing outreach messages:', queueErr);
        }

        return res.json({
            success: true,
            inserted: totalInserted,
            skipped:  skipped.length,
            validationErrors: validationErrors.length > 0 ? validationErrors : undefined
        });

    } catch (e: any) {
        console.error('[Import] Bulk insert failed:', e);
        return res.status(500).json({ error: e.message });
    }
});

// ── Settings & Danger Zone ──────────────────────────────────────────────────

// PATCH /api/settings/profile
app.patch('/api/settings/profile', requireAuth, async (req, res): Promise<any> => {
    if (!supabaseAdmin) return res.status(500).json({ error: 'Server not configured.' });
    const userId = req.user.id;
    const { business_name, business_type } = req.body;

    try {
        const { error } = await supabaseAdmin
            .from('clients')
            .update({ business_name, business_type, updated_at: new Date().toISOString() })
            .eq('user_id', userId);

        if (error) throw error;
        return res.json({ success: true });
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
});

// DELETE /api/leads/all
app.delete('/api/leads/all', requireAuth, async (req, res): Promise<any> => {
    if (!supabaseAdmin) return res.status(500).json({ error: 'Server not configured.' });
    
    // We get role from auth middleware, but fallback if needed. In requireAuth, req.user is set.
    // However, requireAuth uses supabase.auth.getUser() and we might need to check role manually if not present
    // Let's rely on RLS as well (auth.uid() = user_id), but since we use supabaseAdmin here, we must enforce it:
    
    try {
        // Enforce owner check
        const { data: member } = await supabaseAdmin.from('team_members').select('id').eq('auth_user_id', req.user.id).maybeSingle();
        if (member) return res.status(403).json({ error: 'Only Owner can perform this action' });

        const { error } = await supabaseAdmin.from('leads').delete().eq('user_id', req.user.id);
        if (error) throw error;
        return res.json({ success: true });
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
});

// DELETE /api/deals/all
app.delete('/api/deals/all', requireAuth, async (req, res): Promise<any> => {
    if (!supabaseAdmin) return res.status(500).json({ error: 'Server not configured.' });
    
    try {
        const { data: member } = await supabaseAdmin.from('team_members').select('id').eq('auth_user_id', req.user.id).maybeSingle();
        if (member) return res.status(403).json({ error: 'Only Owner can perform this action' });

        const { error } = await supabaseAdmin.from('deals').delete().eq('user_id', req.user.id);
        if (error) throw error;
        return res.json({ success: true });
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
});


// Ensure API always returns JSON on errors (e.g. 500)
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Unhandled API error:', err);
    if (!res.headersSent) res.status(500).json({ error: err?.message || 'Internal Server Error' });
});

// ─────────────────────────────────────────────────────────────────────────────

export const startServer = () => {
    httpServer.listen(port, () => {
        console.log(`Server listening on port ${port} with WebSockets enabled`);
    });
};

// Always start the server when loaded directly via tsx
startServer();
