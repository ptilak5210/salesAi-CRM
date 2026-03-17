import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { supabaseAdmin } from '../../database/supabase';

/**
 * Session Router — REST wrappers around the Baileys WhatsAppConnectionManager.
 *
 * The waManager instance is injected via closure when the router is created.
 * This avoids circular imports and keeps the router testable.
 *
 * Endpoints:
 *   POST /api/session/create  — initiate a Baileys connection / QR flow
 *   GET  /api/session/status  — return current session status
 *   POST /api/session/logout  — disconnect and clear session state
 */
export function createSessionRouter(waManager: any, io: any) {
    const router = Router();
    router.use(requireAuth);

    // ── POST /api/session/create ───────────────────────────────────────────────
    // Triggers the WhatsApp QR flow for the authenticated user.
    // If a session is already active, returns the current status immediately.
    // The QR code itself is delivered via Socket.IO ('whatsapp-qr' event).
    router.post('/create', async (req, res): Promise<any> => {
        const userId = req.user.id;

        // If already connected, inform caller and return early
        if (waManager.isConnected && waManager.isConnected(userId)) {
            return res.json({
                success: true,
                status: 'connected',
                message: 'WhatsApp session is already active. QR code not needed.',
            });
        }

        // If a Baileys socket is in-flight, report pending
        if (waManager.activeSockets && waManager.activeSockets.has(userId)) {
            return res.json({
                success: true,
                status: 'pending',
                message: 'Connection already in progress. Await QR code via Socket.IO.',
            });
        }

        // Kick off the Baileys connection asynchronously.
        // The QR code will be emitted to the user's socket room once available.
        waManager.connectToWhatsApp(userId).catch((err: any) => {
            console.error(`[SessionRouter] connectToWhatsApp failed for ${userId}:`, err);
        });

        return res.status(202).json({
            success: true,
            status: 'connecting',
            message: 'WhatsApp connection initiated. Listen for "whatsapp-qr" event on Socket.IO.',
        });
    });

    router.get('/status', async (req, res): Promise<any> => {
        if (!supabaseAdmin) return res.status(500).json({ error: 'Server not configured.' });

        const userId = req.user?.id;
        console.log(`[SessionRouter] GET /status implementation - UserID: ${userId}`);
        if (!userId) return res.status(401).json({ error: 'User not found in request context.' });

        // In-memory socket state
        const socketActive = waManager.activeSockets?.has(userId) ?? false;

        // DB state (source of truth for persistence across server restarts)
        console.log(`[SessionRouter] Querying DB for user: ${userId}`);
        const { data: creds, error } = await supabaseAdmin
            .from('whatsapp_credentials')
            .select('is_connected, phone_number_id, created_at, updated_at, ai_enabled, auto_reply_enabled')
            .eq('user_id', userId)
            .maybeSingle();

        if (error) return res.status(500).json({ error: error.message });

        const dbConnected = creds?.is_connected ?? false;

        return res.json({
            data: {
                status: socketActive ? 'connected' : dbConnected ? 'disconnected_stale' : 'disconnected',
                socketActive,
                dbConnected,
                phoneNumberId: creds?.phone_number_id || null,
                aiEnabled: creds?.ai_enabled ?? false,
                autoReplyEnabled: creds?.auto_reply_enabled ?? false,
                connectedSince: creds?.updated_at || null,
            }
        });
    });

    // ── POST /api/session/logout ───────────────────────────────────────────────
    // Disconnects the active Baileys session and marks the credential as disconnected.
    router.post('/logout', async (req, res): Promise<any> => {
        if (!supabaseAdmin) return res.status(500).json({ error: 'Server not configured.' });

        const userId = req.user.id;

        // Terminate the Baileys socket
        try {
            await waManager.disconnectWhatsApp(userId);
        } catch (err: any) {
            console.warn(`[SessionRouter] disconnectWhatsApp threw for ${userId}:`, err.message);
            // Continue to DB update regardless
        }

        // Persist disconnected state
        const { error } = await supabaseAdmin
            .from('whatsapp_credentials')
            .update({ is_connected: false, ai_enabled: false, updated_at: new Date().toISOString() })
            .eq('user_id', userId);

        if (error) return res.status(500).json({ error: error.message });

        // Notify all connected clients of this user
        io.to(userId).emit('whatsapp-disconnected');

        return res.json({ success: true, message: 'WhatsApp session logged out.' });
    });

    return router;
}
