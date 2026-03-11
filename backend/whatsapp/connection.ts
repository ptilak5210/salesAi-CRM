import makeWASocket, { DisconnectReason, fetchLatestBaileysVersion, WAMessage, downloadMediaMessage, jidNormalizedUser } from '@whiskeysockets/baileys';
import type { Contact, Chat } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import { useSupabaseAuthState } from './supabaseAuthState';
import { supabaseAdmin } from '../../database/supabase';
import { Server } from 'socket.io';
import QRCode from 'qrcode';
import pino from 'pino';
import { generateAIReply } from '../services/aiService';

// A generic logger for Baileys
const logger = pino({ level: 'silent' }) as any;

// ── JID to phone mapping: 919876543210@s.whatsapp.net → 919876543210, 120363xxx@g.us → keep full JID ──
export function jidToLeadPhone(jid: string): string {
    if (!jid) return '';
    if (jid.includes('@g.us')) return jid; // Groups: use full JID as key
    const match = jid.match(/^(\d+)@/);
    return match ? match[1] : jid.replace(/@.*/, '');
}

// Extract text/content from WAMessage for storage (sync - for history)
function extractMessageContentSync(msg: WAMessage): string {
    const m = msg.message;
    if (!m) return '[Unsupported Message Type]';
    return m.conversation ||
        m.extendedTextMessage?.text ||
        (m.documentMessage ? `[File: ${m.documentMessage.fileName || 'document'}]` : null) ||
        (m.audioMessage ? '[Audio]' : null) ||
        (m.videoMessage ? '[Video]' : null) ||
        (m.stickerMessage ? '[Sticker]' : null) ||
        (m.locationMessage ? `[Location: ${m.locationMessage.name || 'Shared Location'}]` : null) ||
        (m.liveLocationMessage ? '[Live Location]' : null) ||
        (m.contactMessage ? `[Contact: ${m.contactMessage.displayName}]` : null) ||
        (m.contactsArrayMessage ? `[${m.contactsArrayMessage.contacts?.length} Contacts]` : null) ||
        (m.pollCreationMessage ? `[Poll: ${m.pollCreationMessage.name}]` : null) ||
        (m.pollUpdateMessage ? '[Poll Vote]' : null) ||
        '[Unsupported Message Type]';
}

export class WhatsAppConnectionManager {
    private io: Server;
    public activeSockets: Map<string, any> = new Map();
    private retryCount: Map<string, number> = new Map();

    constructor(io: Server) {
        this.io = io;
    }

    public async connectToWhatsApp(userId: string, webSocketId?: string) {
        console.log(`[WhatsAppConnectionManager] Connecting for user: ${userId}`);

        const currentRetries = this.retryCount.get(userId) || 0;
        if (currentRetries > 3) {
            console.error(`[WhatsAppConnectionManager] Too many retries for user ${userId}. Stopping.`);
            if (webSocketId) this.io.to(webSocketId).emit('whatsapp-error', { message: 'Too many connection attempts. Please refresh and try again.' });
            this.retryCount.set(userId, 0);
            return;
        }

        const existingSock = this.activeSockets.get(userId);
        if (existingSock) {
            console.log(`[WhatsAppConnectionManager] Cleaning up existing socket for user ${userId}`);
            try { existingSock.ws.close(); } catch (e) { }
            this.activeSockets.delete(userId);
        }

        const { state, saveCreds, clearAll } = await useSupabaseAuthState(userId);

        let version: any;
        try {
            const v = await fetchLatestBaileysVersion();
            version = v.version;
            console.log(`[WhatsAppConnectionManager] Baileys Version: ${version.join('.')}`);
        } catch (e) {
            console.warn('[WhatsAppConnectionManager] Failed to fetch latest Baileys version, using default.', e);
            version = [2, 3000, 1015901307];
        }

        const sock = makeWASocket({
            version,
            logger,
            printQRInTerminal: false,
            auth: state,
            generateHighQualityLinkPreview: true,
            browser: ['Windows', 'Chrome', '120.0.6099.129'],
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 30000,
            keepAliveIntervalMs: 15000,
            retryRequestDelayMs: 2000,
            qrTimeout: 60000,
            syncFullHistory: true, // Enable full WhatsApp history sync
        });

        this.activeSockets.set(userId, sock);
        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', async (update) => {
            console.log("WhatsApp connection:", update);
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                console.log(`[WhatsAppConnectionManager] Got QR for user ${userId}`);
                if (webSocketId) {
                    try {
                        const qrCodeBase64 = await QRCode.toDataURL(qr);
                        this.io.to(webSocketId).emit('whatsapp-qr', { qrCode: qrCodeBase64 });
                    } catch (err) { }
                }
            }

            if (connection === 'close') {
                const errorCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
                const shouldReconnect = errorCode !== DisconnectReason.loggedOut;
                console.error(`[WhatsAppConnectionManager] Connection closed for user ${userId}. Reason: ${errorCode}. Reconnecting: ${shouldReconnect}`);

                if (errorCode === DisconnectReason.loggedOut || errorCode === 428) {
                    console.warn(`[WhatsAppConnectionManager] Session invalidated (Error ${errorCode}) for user ${userId}. Clearing state...`);
                    this.retryCount.set(userId, currentRetries + 1);
                    await clearAll();
                    setTimeout(() => this.connectToWhatsApp(userId, webSocketId), 5000);
                    return;
                }

                if (!shouldReconnect) {
                    this.activeSockets.delete(userId);
                    await clearAll();
                    this.retryCount.set(userId, 0);
                    await supabaseAdmin?.from('whatsapp_credentials').update({ is_connected: false }).eq('user_id', userId);
                    if (webSocketId) this.io.to(webSocketId).emit('whatsapp-disconnected');
                } else {
                    setTimeout(() => this.connectToWhatsApp(userId, webSocketId), 3000);
                }
            } else if (connection === 'open') {
                this.retryCount.set(userId, 0);
                console.log(`[WhatsAppConnectionManager] Connection opened for user ${userId}`);
                await supabaseAdmin?.from('whatsapp_credentials').upsert(
                    { user_id: userId, is_connected: true, updated_at: new Date().toISOString() },
                    { onConflict: 'user_id' }
                );
                if (supabaseAdmin) {
                    try {
                        await supabaseAdmin.from('whatsapp_messages').delete().eq('user_id', userId);
                        console.log(`[WhatsAppConnectionManager] Cleared old cached messages - fresh sync will repopulate`);
                    } catch (e) {
                        console.warn('[WhatsAppConnectionManager] Could not clear old messages:', e);
                    }
                }
                if (webSocketId) this.io.to(webSocketId).emit('whatsapp-connected');
                this.io.to(userId).emit('whatsapp-connected');
            }
        });

        // ── 1. WhatsApp History Sync (messaging-history.set) ─────────────────
        sock.ev.on('messaging-history.set', async (data: { chats: Chat[]; contacts: Contact[]; messages: WAMessage[]; isLatest?: boolean; progress?: number | null }) => {
            const { chats = [], contacts = [], messages = [], isLatest } = data;
            console.log(`[WhatsAppConnectionManager] History sync triggered: ${chats.length} chats, ${contacts.length} contacts, ${messages.length} messages. isLatest=${isLatest}`);

            // No delete here - we clear on connection open. Each chunk only inserts (avoids wiping recent messages)

            // Store contacts for names and profile pictures
            const contactMap = new Map<string, { name?: string; imgUrl?: string }>();
            for (const c of contacts) {
                const jid = c.id || c.phoneNumber;
                if (jid) {
                    const leadPhone = jidToLeadPhone(jid);
                    contactMap.set(leadPhone, { name: c.notify || c.name, imgUrl: c.imgUrl || undefined });
                }
            }

            // Store chat names (groups especially)
            for (const chat of chats) {
                const jid = chat.id;
                if (!jid) continue;
                const leadPhone = jidToLeadPhone(jid);
                const isGroup = jid.includes('@g.us');
                const name = chat.name || contactMap.get(leadPhone)?.name;
                if (name) contactMap.set(leadPhone, { ...contactMap.get(leadPhone), name });
                try {
                    await supabaseAdmin?.from('whatsapp_contacts').upsert({
                        user_id: userId,
                        lead_phone: leadPhone,
                        contact_name: name || null,
                        profile_picture_url: contactMap.get(leadPhone)?.imgUrl || null,
                        is_group: isGroup,
                        updated_at: new Date().toISOString(),
                    }, { onConflict: 'user_id,lead_phone' });
                } catch (_) { /* ignore if table missing */ }
            }

            // Store messages from history
            const seenIds = new Set<string>();
            for (const msg of messages) {
                const remoteJid = msg.key.remoteJid;
                if (!remoteJid || remoteJid === 'status@broadcast') continue;

                const leadPhone = jidToLeadPhone(remoteJid);
                const isGroup = remoteJid.includes('@g.us');
                const fromMe = msg.key.fromMe || false;
                const sender = fromMe ? (msg.key.participant ? 'lead' : 'user') : 'lead';
                const actualSender = fromMe ? 'user' : 'lead';

                let contactName = msg.pushName || contactMap.get(leadPhone)?.name || '';
                if (isGroup && msg.key.participant) {
                    contactName = msg.pushName || contactMap.get(jidToLeadPhone(msg.key.participant))?.name || contactName;
                }

                const msgId = msg.key.id;
                if (!msgId || seenIds.has(msgId)) continue;
                seenIds.add(msgId);

                const content = extractMessageContentSync(msg);
                const ts = msg.messageTimestamp ? (typeof msg.messageTimestamp === 'number' ? msg.messageTimestamp : Number(msg.messageTimestamp)) : Date.now() / 1000;
                const timestamp = new Date(ts * 1000).toISOString();

                try {
                    await supabaseAdmin?.from('whatsapp_messages').insert({
                        user_id: userId,
                        lead_phone: leadPhone,
                        content,
                        sender: actualSender,
                        message_id: msgId,
                        timestamp,
                        status: fromMe ? 'sent' : 'received',
                        contact_name: contactName || null,
                        is_group: isGroup,
                    });
                } catch (e: any) {
                    if (e?.code === '23505') { /* duplicate - ignore */ }
                    else console.warn('[WhatsAppConnectionManager] History insert error:', e);
                }
            }

            if (isLatest) {
                this.io.to(userId).emit('whatsapp-history-synced');
                console.log(`[WhatsAppConnectionManager] History sync complete for user ${userId}`);
            }
        });

        // ── 2. Groups metadata updates ─────────────────────────────────────────
        sock.ev.on('groups.update', async (updates: any[]) => {
            for (const g of updates) {
                const jid = g.id;
                if (!jid || !jid.includes('@g.us')) continue;
                const leadPhone = jid;
                const subject = g.subject;
                try {
                    if (supabaseAdmin) {
                        await supabaseAdmin.from('whatsapp_contacts').upsert({
                            user_id: userId,
                            lead_phone: leadPhone,
                            contact_name: subject || null,
                            is_group: true,
                            updated_at: new Date().toISOString(),
                        }, { onConflict: 'user_id,lead_phone' });
                        this.io.to(userId).emit('whatsapp-chat-update', { lead_phone: String(leadPhone), contact_name: subject });
                    }
                } catch (_) { /* ignore */ }
            }
        });

        // ── 3. Contacts upsert (for names) ─────────────────────────────────────
        sock.ev.on('contacts.upsert', async (contacts: Contact[]) => {
            for (const c of contacts) {
                const jid = c.id || c.phoneNumber;
                if (!jid || jid.includes('@g.us')) continue;
                const leadPhone = jidToLeadPhone(jid);
                try {
                    if (supabaseAdmin) {
                        await supabaseAdmin.from('whatsapp_contacts').upsert({
                            user_id: userId,
                            lead_phone: leadPhone,
                            contact_name: c.notify || c.name || null,
                            profile_picture_url: c.imgUrl || null,
                            is_group: false,
                            updated_at: new Date().toISOString(),
                        }, { onConflict: 'user_id,lead_phone' });
                    }
                } catch (_) { /* ignore */ }
            }
        });

        // ── 4. Real-time incoming messages ────────────────────────────────────
        sock.ev.on('messages.upsert', async (m) => {
            console.log(`[WhatsAppConnectionManager] Incoming message (messages.upsert): type=${m.type}, count=${m.messages?.length || 0}`);
            if (m.type === 'notify' || m.type === 'append') {
                for (const msg of m.messages || []) {
                    if (!msg.key?.fromMe) await this.handleIncomingMessage(userId, msg);
                }
            }
        });

        // ── 5. Message status updates (sent, delivered, read) ──────────────────
        sock.ev.on('messages.update', async (updates) => {
            for (const update of updates) {
                if (!update.key.fromMe) continue;
                const msgId = update.key.id;
                const remoteJid = update.key.remoteJid;
                if (!remoteJid) continue;

                const leadPhone = jidToLeadPhone(remoteJid);

                const statusMap: Record<number, string> = {
                    0: 'error', 1: 'pending', 2: 'sent', 3: 'delivered', 4: 'read', 5: 'played',
                };
                const statusNum = (update.update as any)?.status;
                const statusStr = statusMap[statusNum] ?? 'sent';

                try {
                    await supabaseAdmin?.from('whatsapp_messages')
                        .update({ status: statusStr })
                        .eq('user_id', userId)
                        .eq('message_id', msgId);
                } catch (_) { /* ignore */ }

                this.io.to(userId).emit('whatsapp-status', { messageId: msgId, leadPhone, status: statusStr });
            }
        });

        // ── 6. Typing / Presence indicators ───────────────────────────────────
        sock.ev.on('presence.update', (presenceData: any) => {
            const jid = presenceData.id;
            if (!jid) return;
            const leadPhone = jidToLeadPhone(jid);
            const presences = presenceData.presences || {};
            const firstPresence = Object.values(presences)[0] as any;
            const isTyping = firstPresence?.lastKnownPresence === 'composing';
            this.io.to(userId).emit('whatsapp-typing', { leadPhone, isTyping });
        });

        return sock;
    }

    private async handleIncomingMessage(userId: string, msg: WAMessage) {
        const remoteJid = msg.key?.remoteJid;
        const fromMe = msg.key?.fromMe;
        const msgId = msg.key?.id;

        if (!msg.message) {
            console.log(`[WhatsAppConnectionManager] Skipping message (no content): remoteJid=${remoteJid}, id=${msgId}`);
            return;
        }
        if (fromMe) return;

        if (!remoteJid || remoteJid === 'status@broadcast') {
            console.log(`[WhatsAppConnectionManager] Skipping (invalid jid): ${remoteJid}`);
            return;
        }

        const isGroup = remoteJid.includes('@g.us');
        const leadPhone = jidToLeadPhone(remoteJid);

        const sock = this.activeSockets.get(userId);
        let contactName = msg.pushName || '';

        if (!contactName) {
            try {
                const { data: existing } = await supabaseAdmin?.from('whatsapp_messages')
                    .select('contact_name').eq('user_id', userId).eq('lead_phone', leadPhone)
                    .not('contact_name', 'is', null).limit(1).maybeSingle() || { data: null };
                if (existing?.contact_name) contactName = existing.contact_name;
            } catch (_) { }
        }

        if (isGroup && sock) {
            try {
                const groupMeta = await sock.groupMetadata(remoteJid).catch(() => null);
                if (groupMeta?.subject) contactName = groupMeta.subject;
            } catch (_) { }
        }

        let content: string;
        if (msg.message.imageMessage) {
            try {
                if (sock) {
                    const buffer = await downloadMediaMessage(msg, 'buffer', {}, { logger, reuploadRequest: sock.updateMediaMessage });
                    const base64 = (buffer as Buffer).toString('base64');
                    const mime = msg.message.imageMessage.mimetype || 'image/jpeg';
                    content = `[IMAGE:data:${mime};base64,${base64}]`;
                } else {
                    content = '[Image]';
                }
            } catch (err) {
                console.error('[WhatsAppConnectionManager] Error downloading image:', err);
                content = '[Image]';
            }
        } else {
            content = extractMessageContentSync(msg);
        }

        const finalMsgId = msg.key.id;
        console.log(`[WhatsAppConnectionManager] Saving message from ${contactName || leadPhone}: ${content.substring(0, 80)}...`);

        if (!supabaseAdmin) {
            console.error('[WhatsAppConnectionManager] supabaseAdmin is null - cannot save message');
            return;
        }

        try {
            const { data: savedMsg } = await supabaseAdmin.from('whatsapp_messages').insert({
                user_id: userId,
                lead_phone: leadPhone,
                content,
                sender: 'lead',
                message_id: finalMsgId,
                status: 'received',
                contact_name: contactName || null,
                is_group: isGroup,
            }).select().single() || { data: null };

            const leadPhoneStr = String(leadPhone);
            const payload = {
                id: savedMsg?.id,
                lead_phone: leadPhoneStr,
                contact_name: contactName,
                is_group: isGroup,
                content,
                sender: 'lead',
                message_id: finalMsgId,
                timestamp: new Date().toISOString(),
                status: 'received',
            };

            this.io.to(userId).emit('whatsapp-message', payload);
            this.io.to(userId).emit('new_whatsapp_message', payload);

            // Persist contact name so Inbox shows name + number
            if (contactName && leadPhone) {
                try {
                    await supabaseAdmin?.from('whatsapp_contacts').upsert({
                        user_id: userId,
                        lead_phone: leadPhoneStr,
                        contact_name: contactName,
                        is_group: isGroup,
                        updated_at: new Date().toISOString(),
                    }, { onConflict: 'user_id,lead_phone' });
                    this.io.to(userId).emit('whatsapp-chat-update', { lead_phone: leadPhoneStr, contact_name: contactName });
                } catch (_) { /* ignore if table missing */ }
            }

            if (!isGroup && sock) {
                const { data: credentials } = await supabaseAdmin
                    ?.from('whatsapp_credentials')
                    .select('ai_enabled, auto_reply_enabled, auto_reply_text')
                    .eq('user_id', userId)
                    .maybeSingle() || { data: null };

                const autoReplyEnabled = credentials?.auto_reply_enabled === true;
                const autoText = (credentials?.auto_reply_text ?? '').trim();
                if (autoReplyEnabled && autoText) {
                    try {
                        // Use the exact JID we received from (handles LID and standard format)
                        const jid = isGroup ? remoteJid : (jidNormalizedUser(remoteJid) || remoteJid);
                        if (!jid) {
                            console.warn('[WhatsAppConnectionManager] Auto-reply skipped: invalid JID for', leadPhoneStr);
                        } else {
                            console.log('[WhatsAppConnectionManager] Sending auto-reply to JID:', jid);
                            const sendResult = await sock.sendMessage(jid, { text: autoText });
                            const autoMessageId = sendResult?.key?.id;
                            const { data: autoMsg } = await supabaseAdmin?.from('whatsapp_messages').insert({
                                user_id: userId,
                                lead_phone: leadPhoneStr,
                                content: autoText,
                                sender: 'ai',
                                status: 'sent',
                                is_group: false,
                                message_id: autoMessageId || undefined,
                            }).select().single() || { data: null };
                            this.io.to(userId).emit('whatsapp-message', {
                                id: autoMsg?.id,
                                lead_phone: leadPhoneStr,
                                content: autoText,
                                sender: 'ai',
                                message_id: autoMessageId,
                                timestamp: new Date().toISOString(),
                                status: 'sent',
                            });
                        }
                    } catch (err) {
                        console.error('[WhatsAppConnectionManager] Error sending auto-reply:', err);
                    }
                } else if (credentials?.ai_enabled) {
                    await this.triggerAiReply(userId, leadPhone, content);
                }
            }
        } catch (e) {
            console.error(`[WhatsAppConnectionManager] Error saving message:`, e);
        }
    }

    /** Expose for debugging: verify sock exists and events are registered */
    public getConnectionStatus(userId: string): { connected: boolean; hasSock: boolean } {
        const sock = this.activeSockets.get(userId);
        return {
            connected: !!sock,
            hasSock: !!sock,
        };
    }

    // ── Send text message ─────────────────────────────────────────────────────
    public async sendMessage(userId: string, to: string, text: string, quotedMsgId?: string): Promise<{ success: boolean; error?: string; messageId?: string }> {
        const sock = this.activeSockets.get(userId);
        if (!sock) return { success: false, error: 'WhatsApp not connected. Please reconnect from Automations.' };

        const jid = this.resolveJid(to);
        if (!jid) {
            return { success: false, error: 'Invalid recipient (empty or invalid number).' };
        }

        try {
            console.log('[WhatsAppConnectionManager] Sending message to JID:', jid);
            const result = await sock.sendMessage(jid, { text: text });
            console.log('[WhatsAppConnectionManager] Message sent:', result?.key?.id);
            const messageId = result?.key?.id;

            // Save to DB and emit to frontend
            if (supabaseAdmin && messageId) {
                try {
                    const leadPhone = String(jidToLeadPhone(jid));
                    const { data: savedMsg, error: dbErr } = await supabaseAdmin.from('whatsapp_messages').insert({
                        user_id: userId,
                        lead_phone: leadPhone,
                        content: text,
                        sender: 'user',
                        message_id: messageId,
                        status: 'sent',
                        is_group: jid.includes('@g.us'),
                    }).select().maybeSingle();

                    if (dbErr) console.warn("[DB Insert Error for Send]", dbErr);

                    this.io.to(userId).emit('whatsapp-message', {
                        id: savedMsg?.id || `temp-${messageId}`,
                        lead_phone: leadPhone,
                        content: text,
                        sender: 'user',
                        message_id: messageId,
                        timestamp: new Date().toISOString(),
                        status: 'sent',
                    });
                } catch (dbEx) {
                    console.error("[DB Exception for Send]", dbEx);
                }
            }

            return { success: true, messageId };
        } catch (error: any) {
            console.error("Send message failed:", error);
            return { success: false, error: error.message };
        }
    }

    /** Build JID for sending; use Baileys jidNormalizedUser so WhatsApp accepts the message. */
    private resolveJid(to: string): string {
        if (!to || typeof to !== 'string') return '';
        if (to.includes('@g.us')) return to;
        if (to.includes('@')) return jidNormalizedUser(to) || to;
        const digits = to.replace(/\D/g, '');
        if (!digits) return '';
        const isGroup = digits.length > 15;
        const raw = isGroup ? `${digits}@g.us` : `${digits}@s.whatsapp.net`;
        return isGroup ? raw : (jidNormalizedUser(raw) || raw);
    }

    // ── Send media ───────────────────────────────────────────────────────────
    public async sendMedia(userId: string, to: string, buffer: Buffer, mimetype: string, caption?: string, filename?: string): Promise<{ success: boolean; error?: string; messageId?: string }> {
        const sock = this.activeSockets.get(userId);
        if (!sock) return { success: false, error: 'WhatsApp not connected.' };

        const jid = this.resolveJid(to);
        let msgContent: any;

        if (mimetype.startsWith('image/')) {
            msgContent = { image: buffer, caption: caption || '', mimetype };
        } else if (mimetype.startsWith('audio/')) {
            msgContent = { audio: buffer, mimetype, ptt: false };
        } else {
            msgContent = { document: buffer, mimetype, fileName: filename || 'file', caption: caption || '' };
        }

        try {
            const sent = await sock.sendMessage(jid, msgContent);
            const messageId = sent?.key?.id;
            const label = mimetype.startsWith('image/') ? '[Image]' : mimetype.startsWith('audio/') ? '[Audio]' : `[File: ${filename || 'document'}]`;
            const content = caption ? `${label} — ${caption}` : label;

            if (supabaseAdmin) {
                try {
                    const leadPhone = String(jidToLeadPhone(jid));
                    const { data: savedMsg, error: dbErr } = await supabaseAdmin.from('whatsapp_messages').insert({
                        user_id: userId,
                        lead_phone: leadPhone,
                        content,
                        sender: 'user',
                        message_id: messageId,
                        status: 'sent',
                        is_group: jid.includes('@g.us'),
                    }).select().maybeSingle();

                    if (dbErr) console.warn("[DB Insert Error for Media]", dbErr);

                    this.io.to(userId).emit('whatsapp-message', {
                        id: savedMsg?.id || `temp-${messageId}`,
                        lead_phone: leadPhone,
                        content,
                        sender: 'user',
                        message_id: messageId,
                        timestamp: new Date().toISOString(),
                        status: 'sent',
                    });
                } catch (dbEx) {
                    console.error("[DB Exception for Media]", dbEx);
                }
            }

            return { success: true, messageId };
        } catch (e: any) {
            console.error('[WhatsAppConnectionManager] sendMedia error:', e);
            return { success: false, error: e.message };
        }
    }

    private async triggerAiReply(userId: string, leadPhone: string, latestMessage: string) {
        try {
            const sock = this.activeSockets.get(userId);
            if (!sock) return;

            const { data: credentials } = await supabaseAdmin
                ?.from('whatsapp_credentials')
                .select('ai_enabled')
                .eq('user_id', userId)
                .single() || { data: null };

            if (!credentials?.ai_enabled) return;

            const jid = this.resolveJid(leadPhone);
            if (!jid) {
                console.warn('[WhatsAppConnectionManager] AI reply skipped: invalid JID for', leadPhone);
                return;
            }

            const { data: history } = await supabaseAdmin
                ?.from('whatsapp_messages')
                .select('*')
                .eq('user_id', userId)
                .eq('lead_phone', leadPhone)
                .order('timestamp', { ascending: false })
                .limit(5) || { data: [] };

            const aiMessages = (history || []).reverse().map((m: any) => ({
                role: m.sender === 'user' || m.sender === 'ai' ? 'assistant' : 'user',
                content: m.content
            }));

            aiMessages.unshift({ role: 'system', content: 'You are a helpful and polite CRM assistant. Keep replies brief.' });

            const replyText = await generateAIReply(aiMessages as any);
            await sock.sendMessage(jid, { text: replyText });

            const leadPhoneStr = String(leadPhone);
            const { data: aiMsg } = await supabaseAdmin?.from('whatsapp_messages').insert({
                user_id: userId,
                lead_phone: leadPhoneStr,
                content: replyText,
                sender: 'ai',
                status: 'sent',
                is_group: false,
            }).select().single() || { data: null };

            this.io.to(userId).emit('whatsapp-message', {
                id: aiMsg?.id,
                lead_phone: leadPhoneStr,
                content: replyText,
                sender: 'ai',
                timestamp: new Date().toISOString(),
                status: 'sent',
            });
        } catch (err) {
            console.error('[WhatsAppConnectionManager] Error sending AI reply:', err);
        }
    }

    public async disconnectWhatsApp(userId: string) {
        const sock = this.activeSockets.get(userId);
        if (sock) {
            try { sock.logout(); } catch (e) { }
            this.activeSockets.delete(userId);
        } else {
            const { clearAll } = await useSupabaseAuthState(userId);
            await clearAll();
        }
    }
}
