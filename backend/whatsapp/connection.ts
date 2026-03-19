import makeWASocket, { DisconnectReason, fetchLatestBaileysVersion, WAMessage, downloadMediaMessage, jidNormalizedUser } from '@whiskeysockets/baileys';
import type { Contact, Chat } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import { useSupabaseAuthState } from './supabaseAuthState';
import { supabaseAdmin } from '../../database/supabase';
import { Server } from 'socket.io';
import QRCode from 'qrcode';
import pino from 'pino';
import { generateAIReply } from '../services/aiService';
import { messageQueue } from '../queue/messageQueue';

// A generic logger for Baileys
const logger = pino({ level: 'silent' }) as any;

// ── JID to phone mapping: 919876543210@s.whatsapp.net → 919876543210, 120363xxx@g.us → keep full JID ──
export function jidToLeadPhone(jid: string): string | null {
    if (!jid) return null;
    // Extract the part before @ for normal phone numbers and LIDs
    const phone = jid.split('@')[0];
    return phone;
}

/**
 * Normalize a JID for safe DB storage.
 * - Groups (@g.us) → kept as-is.
 * - Valid user JIDs (@s.whatsapp.net) → kept as-is.
 * - @lid JIDs → returned AS-IS. Must be resolved via Baileys onWhatsApp() before storing.
 *   DO NOT convert @lid → @s.whatsapp.net; the numeric part is NOT a real phone number.
 * - Bare digits (known real phone) → phone@s.whatsapp.net.
 */
function normalizeContactJid(jid: string): string {
    if (!jid) return jid;
    if (jid.includes('@g.us')) return jid;               // groups: always valid
    if (jid.includes('@s.whatsapp.net')) return jid;     // already correct
    if (jid.includes('@lid')) return jid;                // unresolved LID: keep, caller must handle
    // bare phone number (digits only) — only reach here for known real phones
    const digits = jid.replace(/\D/g, '');
    return digits ? digits + '@s.whatsapp.net' : jid;
}

/** Canonical format for DB storage: same number always stored the same (digits from JID, no + or spaces). */
function normalizeLeadPhoneForStorage(p: string | null | undefined): string {
    if (p == null || p === '') return '';
    const s = String(p).trim();
    if (s.includes('@')) return jidToLeadPhone(s) ?? '';
    return s.replace(/\D/g, '');
}

// Extract text/content from WAMessage for storage (sync - for history)
function extractMessageContentSync(msg: WAMessage): string {
    const m = msg.message;
    if (!m) return '[Unsupported Message Type]';
    const text = m.conversation || m.extendedTextMessage?.text;
    if (text) return text;

    if (m.documentMessage) return `[File: ${m.documentMessage.fileName || 'document'}]`;
    if (m.audioMessage) return '[Audio]';
    if (m.videoMessage) return '[Video]';
    if (m.stickerMessage) return '[Sticker]';
    if (m.locationMessage) return `[Location: ${m.locationMessage.name || 'Shared Location'}]`;
    if (m.liveLocationMessage) return '[Live Location]';
    if (m.contactMessage) return `[Contact: ${m.contactMessage.displayName}]`;
    if (m.contactsArrayMessage) return `[${m.contactsArrayMessage.contacts?.length} Contacts]`;
    if (m.pollCreationMessage) return `[Poll: ${m.pollCreationMessage.name}]`;
    if (m.pollUpdateMessage) return '[Poll Vote]';
    return '[Unsupported Message Type]';
}

export class WhatsAppConnectionManager {
    private io: Server;
    public activeSockets: Map<string, any> = new Map();
    private retryCount: Map<string, number> = new Map();
    private connectingUsers: Set<string> = new Set();
    /** Timestamp (ms) of when a connection last successfully opened, used as a post-open cooldown. */
    private recentlyConnected: Map<string, number> = new Map();

    constructor(io: Server) {
        this.io = io;
    }

    /** True if there is an active Baileys socket for this user. */
    public isConnected(userId: string): boolean {
        return this.activeSockets.has(userId);
    }

    public async connectToWhatsApp(userId: string, webSocketId?: string) {
        if (this.connectingUsers.has(userId)) {
            console.log(`[WhatsAppConnectionManager] Connection already in progress for user ${userId}. Skipping.`);
            return;
        }

        // Post-open cooldown: ignore reconnect requests within 10 seconds of a successful open.
        // This prevents the frontend re-emitting start-whatsapp-auth / join-inbox right after connect
        // from killing the healthy socket and creating an infinite reconnect loop.
        const lastConnected = this.recentlyConnected.get(userId);
        if (lastConnected && Date.now() - lastConnected < 10_000) {
            console.log(`[WhatsAppConnectionManager] Ignoring connect request — connection just opened ${Math.round((Date.now() - lastConnected) / 1000)}s ago for user ${userId}.`);
            return;
        }

        console.log(`[WhatsAppConnectionManager] Connecting for user: ${userId}`);
        this.connectingUsers.add(userId);

        try {
            const currentRetries = this.retryCount.get(userId) || 0;
            if (currentRetries > 3) {
                console.error(`[WhatsAppConnectionManager] Too many retries for user ${userId}. Stopping.`);
                if (webSocketId) this.io.to(webSocketId).emit('whatsapp-error', { message: 'Too many connection attempts. Please refresh and try again.' });
                this.retryCount.set(userId, 0);
                this.connectingUsers.delete(userId);
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
                connectTimeoutMs: 90000,
                defaultQueryTimeoutMs: 60000,
                keepAliveIntervalMs: 30000,
                retryRequestDelayMs: 5000,
                qrTimeout: 60000,
                syncFullHistory: false, // Disable full WhatsApp history sync to save resources
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
                    this.connectingUsers.delete(userId);

                    if (errorCode === DisconnectReason.loggedOut) {
                        console.warn(`[WhatsAppConnectionManager] Session logged out for user ${userId}. Clearing state...`);
                        await clearAll();
                        this.retryCount.set(userId, 0);
                        if (supabaseAdmin) {
                            await supabaseAdmin.from('whatsapp_credentials').update({ is_connected: false }).eq('user_id', userId);
                        }
                        if (webSocketId) this.io.to(webSocketId).emit('whatsapp-error', { message: 'WhatsApp logged out. Please reconnect.' });
                        return;
                    }

                    if (errorCode === 428 || errorCode === DisconnectReason.connectionLost || errorCode === DisconnectReason.restartRequired) {
                        console.log(`[WhatsAppConnectionManager] Temporary disconnection (Reason ${errorCode}) for user ${userId}. Retrying...`);
                        setTimeout(() => this.connectToWhatsApp(userId, webSocketId), 3000);
                        return;
                    }

                    if (!shouldReconnect) {
                        console.warn(`[WhatsAppConnectionManager] Permanent disconnection (Reason ${errorCode}) for user ${userId}.`);
                        this.activeSockets.delete(userId);
                        await clearAll();
                        this.retryCount.set(userId, 0);
                        if (supabaseAdmin) {
                            await supabaseAdmin.from('whatsapp_credentials').update({ is_connected: false }).eq('user_id', userId);
                        }
                        if (webSocketId) this.io.to(webSocketId).emit('whatsapp-disconnected');
                    } else {
                        setTimeout(() => this.connectToWhatsApp(userId, webSocketId), 3000);
                    }
                } else if (connection === 'open') {
                    this.connectingUsers.delete(userId);
                    this.retryCount.set(userId, 0);
                    // Record the time this connection opened so we can enforce a cooldown
                    // against immediate reconnect attempts (which cause the 428 loop).
                    this.recentlyConnected.set(userId, Date.now());
                    console.log(`[WhatsAppConnectionManager] Connection opened for user ${userId}`);
                    if (supabaseAdmin) {
                        await supabaseAdmin.from('whatsapp_credentials').upsert(
                            { user_id: userId, is_connected: true, updated_at: new Date().toISOString() },
                            { onConflict: 'user_id' }
                        );
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
                        contactMap.set(String(jid), { name: c.notify || c.name, imgUrl: c.imgUrl || undefined });
                    }
                }

                // Store chat names (groups and user contacts, including @lid — stored for display)
                for (const chat of chats) {
                    const rawJid = chat.id;
                    if (!rawJid) continue;
                    const isGroup = rawJid.includes('@g.us');
                    const leadPhone = jidToLeadPhone(rawJid);
                    const name = chat.name || contactMap.get(rawJid)?.name;
                    if (name) contactMap.set(rawJid, { ...contactMap.get(rawJid), name });
                    try {
                        if (supabaseAdmin) {
                            await supabaseAdmin.from('whatsapp_contacts').upsert({
                                user_id: userId,
                                lead_phone: leadPhone,
                                jid: rawJid,
                                contact_name: name || null,
                                profile_picture_url: contactMap.get(rawJid)?.imgUrl || null,
                                is_group: isGroup,
                                updated_at: new Date().toISOString(),
                            }, { onConflict: 'user_id,jid' });
                        }
                    } catch (_) { /* ignore if table missing */ }
                }

                // Store messages from history (include @lid — needed for display in inbox)
                const seenIds = new Set<string>();
                for (const msg of messages) {
                    const rawRemoteJid = msg.key.remoteJid;
                    if (!rawRemoteJid || rawRemoteJid === 'status@broadcast') continue;
                    const remoteJid = rawRemoteJid; // store as-is including @lid

                    const leadPhone = jidToLeadPhone(remoteJid);
                    const isGroup = remoteJid.includes('@g.us');
                    const fromMe = msg.key.fromMe || false;
                    const sender = fromMe ? (msg.key.participant ? 'lead' : 'user') : 'lead';
                    const actualSender = fromMe ? 'user' : 'lead';

                    let contactName = contactMap.get(remoteJid)?.name || '';
                    if (!fromMe && msg.pushName) contactName = msg.pushName || contactName;

                    if (isGroup && msg.key.participant) {
                        contactName = contactMap.get(msg.key.participant)?.name || contactName;
                        if (!fromMe && msg.pushName) contactName = msg.pushName || contactName;
                    }

                    const msgId = msg.key.id;
                    if (!msgId || seenIds.has(msgId)) continue;
                    seenIds.add(msgId);

                    const content = extractMessageContentSync(msg);
                    const ts = msg.messageTimestamp ? (typeof msg.messageTimestamp === 'number' ? msg.messageTimestamp : Number(msg.messageTimestamp)) : Date.now() / 1000;
                    const timestamp = new Date(ts * 1000).toISOString();

                    try {
                        if (supabaseAdmin) {
                            // Quick check for existing to avoid throwing errors in console
                            const { data: existing } = await supabaseAdmin.from('whatsapp_messages').select('id').eq('message_id', msgId).maybeSingle();
                            if (!existing) {
                                await supabaseAdmin.from('whatsapp_messages').insert({
                                    user_id: userId,
                                    lead_phone: leadPhone,
                                    jid: remoteJid,
                                    content,
                                    sender: actualSender,
                                    message_id: msgId,
                                    timestamp,
                                    status: fromMe ? 'sent' : 'received',
                                    contact_name: contactName || null,
                                    is_group: isGroup,
                                });
                            }
                        }
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
                                jid: jid,
                                contact_name: subject || null,
                                is_group: true,
                                updated_at: new Date().toISOString(),
                            }, { onConflict: 'user_id,jid' });
                            this.io.to(userId).emit('whatsapp-chat-update', { lead_phone: String(leadPhone), contact_name: subject, jid });
                        }
                    } catch (_) { /* ignore */ }
                }
            });

            // ── 3. Contacts upsert (for names) ─────────────────────────────────────
            sock.ev.on('contacts.upsert', async (contacts: Contact[]) => {
                for (const c of contacts) {
                    const rawJid = c.id || c.phoneNumber;
                    if (!rawJid || rawJid.includes('@g.us')) continue;
                    // Store @lid contacts as-is for display; real JID will update via contacts.update
                    const leadPhone = jidToLeadPhone(rawJid);
                    try {
                        if (supabaseAdmin) {
                            await supabaseAdmin.from('whatsapp_contacts').upsert({
                                user_id: userId,
                                lead_phone: leadPhone,
                                jid: rawJid,
                                contact_name: c.notify || c.name || null,
                                profile_picture_url: c.imgUrl || null,
                                is_group: false,
                                updated_at: new Date().toISOString(),
                            }, { onConflict: 'user_id,jid' });
                        }
                    } catch (_) { /* ignore */ }
                }
            });

            // ── 3.5 LID to PID mapping (for contacts with Linked Identities) ──────
            sock.ev.on('contacts.update', async (updates: any[]) => {
                for (const update of updates) {
                    const jid = update.id;
                    if (!jid || jid.includes('@g.us')) continue;

                    // If we get a phone number for this JID, update it in our contacts
                    const hasRealPhone = update.phoneNumber || (update.id.includes('@s.whatsapp.net') && !update.id.startsWith('1'));

                    if (hasRealPhone && supabaseAdmin) {
                        try {
                            const realPhone = update.phoneNumber || jidToLeadPhone(update.id);
                            const jidToUpdate = update.id;

                            // Check if the real phone number already exists in our contacts
                            const { data: existingContact } = await supabaseAdmin
                                .from('whatsapp_contacts')
                                .select('lead_phone')
                                .eq('user_id', userId)
                                .eq('lead_phone', realPhone)
                                .maybeSingle();

                            if (existingContact) {
                                // If it exists, we just delete the old LID record to avoid duplicate key errors
                                // The messages will simply be mapped to the existing realPhone
                                await supabaseAdmin.from('whatsapp_contacts').delete()
                                    .eq('user_id', userId)
                                    .eq('jid', jidToUpdate)
                                    .neq('lead_phone', realPhone); // Don't delete if somehow it's already updated
                            } else {
                                // Safe to update the existing contact's lead_phone
                                await supabaseAdmin.from('whatsapp_contacts').update({
                                    lead_phone: realPhone,
                                    updated_at: new Date().toISOString(),
                                }).eq('user_id', userId).eq('jid', jidToUpdate);
                            }

                            // Cascade update to messages
                            await supabaseAdmin.from('whatsapp_messages').update({
                                lead_phone: realPhone,
                            }).eq('user_id', userId).eq('jid', jidToUpdate);

                            this.io.to(userId).emit('whatsapp-chat-update', {
                                lead_phone: realPhone,
                                jid: jidToUpdate,
                                resolved_from_lid: true
                            });
                        } catch (err) {
                            console.warn('[WhatsAppConnectionManager] Error resolving LID to Phone in contacts.update:', err);
                        }
                    }
                }
            });

            // ── 4. Real-time incoming messages ────────────────────────────────────
            sock.ev.on('messages.upsert', async (m) => {
                console.log(`[WhatsAppConnectionManager] Incoming message (messages.upsert): type=${m.type}, count=${m.messages?.length || 0}`);
                if (m.type === 'notify' || m.type === 'append') {
                    for (const msg of m.messages || []) {
                        await this.handleIncomingMessage(userId, msg);
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
                        if (supabaseAdmin) {
                            await supabaseAdmin.from('whatsapp_messages')
                                .update({ status: statusStr })
                                .eq('user_id', userId)
                                .eq('message_id', msgId);
                        }
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
                this.io.to(userId).emit('whatsapp-typing', { leadPhone, jid, isTyping });
            });

            return sock;
        } catch (err) {
            console.error('[WhatsAppConnectionManager] Error in connectToWhatsApp:', err);
            this.connectingUsers.delete(userId);
        }
    }

    private async handleIncomingMessage(userId: string, msg: WAMessage) {
        const remoteJid = msg.key?.remoteJid;
        const fromMe = msg.key?.fromMe;
        const msgId = msg.key?.id;

        if (!msg.message) {
            console.log(`[WhatsAppConnectionManager] Skipping message (no content): remoteJid=${remoteJid}, id=${msgId}`);
            return;
        }

        // Fast path: duplicate message deduplication fix
        if (supabaseAdmin && msgId) {
            try {
                const { data: existingMsg } = await supabaseAdmin.from('whatsapp_messages')
                    .select('id')
                    .eq('message_id', msgId)
                    .maybeSingle();

                if (existingMsg) {
                    console.log(`[WhatsAppConnectionManager] Message ${msgId} already exists, skipping duplicate processing.`);
                    return;
                }
            } catch (err) {
                console.warn('[WhatsAppConnectionManager] Deduplication fast-path error:', err);
            }
        }
        // fromMe boolean dictates if the message was sent by the user (e.g. from their phone)
        const isOutgoing = !!fromMe;

        if (!remoteJid || remoteJid === 'status@broadcast') {
            console.log(`[WhatsAppConnectionManager] Skipping (invalid jid): ${remoteJid}`);
            return;
        }

        const isGroup = remoteJid.includes('@g.us') || remoteJid.includes('@newsletter') || remoteJid.includes('@broadcast');
        let leadPhone = jidToLeadPhone(remoteJid);

        const sock = this.activeSockets.get(userId);

        // ── LID Resolution (best-effort) ─────────────────────────────────────────
        // @lid identifiers are Linked Device IDs. We try to resolve them to real @s.whatsapp.net.
        // If resolution fails, we still store with @lid so the message appears in the inbox.
        // The SEND path (ensureSendableJid) separately prevents @lid from being used for delivery.
        let finalJid = remoteJid;

        if (!isGroup && remoteJid.includes('@lid')) {
            try {
                // 1. Check if already resolved in DB (e.g. from a previous contacts.update event)
                if (supabaseAdmin) {
                    const { data: existingContact } = await supabaseAdmin.from('whatsapp_contacts')
                        .select('jid, lead_phone')
                        .eq('user_id', userId)
                        .eq('lead_phone', leadPhone)
                        .not('jid', 'like', '%@lid')
                        .limit(1).maybeSingle();
                    if (existingContact?.jid) {
                        finalJid = existingContact.jid;
                        leadPhone = existingContact.lead_phone || jidToLeadPhone(finalJid) || leadPhone;
                        console.log(`[WhatsAppConnectionManager] LID ${remoteJid} resolved from DB to ${finalJid}`);
                    }
                }

                // 2. Try to resolve via Baileys onWhatsApp()
                if (finalJid === remoteJid && sock) {
                    const [result] = await sock.onWhatsApp(remoteJid).catch(() => []);
                    if (result?.exists && result?.jid && !String(result.jid).includes('@lid')) {
                        finalJid = result.jid as string;
                        leadPhone = jidToLeadPhone(finalJid) || leadPhone;
                        console.log(`[WhatsAppConnectionManager] LID ${remoteJid} resolved via Baileys to ${finalJid}`);
                    }
                }
            } catch (err) {
                console.warn('[WhatsAppConnectionManager] LID resolution attempt failed:', err);
            }
            // Note: if still @lid, finalJid = remoteJid — message stored with @lid for display
        }
        let contactName = '';
        if (!fromMe && msg.pushName) {
            contactName = msg.pushName;
        }

        if (!contactName) {
            try {
                if (supabaseAdmin) {
                    // 1. Try whatsapp_contacts
                    const { data: contactMeta } = await supabaseAdmin.from('whatsapp_contacts')
                        .select('contact_name').eq('user_id', userId).eq('jid', remoteJid).maybeSingle();

                    if (contactMeta?.contact_name) {
                        contactName = contactMeta.contact_name;
                    } else {
                        // 2. Fallback to whatsapp_messages
                        const { data: existing } = await supabaseAdmin.from('whatsapp_messages')
                            .select('contact_name').eq('user_id', userId).eq('lead_phone', leadPhone)
                            .not('contact_name', 'is', null).limit(1).maybeSingle();
                        if (existing?.contact_name) contactName = existing.contact_name;
                    }
                }
            } catch (_) { }
        }

        if (isGroup && sock) {
            try {
                const groupMeta = await sock.groupMetadata(remoteJid).catch(() => null);
                if (groupMeta?.subject) contactName = groupMeta.subject;
            } catch (_) { }
        }

        let content: string;
        if (msg.message.imageMessage || msg.message.videoMessage || msg.message.documentMessage || msg.message.audioMessage) {
            try {
                if (sock && supabaseAdmin) {
                    const messageType = msg.message.imageMessage ? 'imageMessage' :
                        msg.message.videoMessage ? 'videoMessage' :
                            msg.message.documentMessage ? 'documentMessage' :
                                'audioMessage';

                    const buffer = await downloadMediaMessage(msg, 'buffer', {}, { logger, reuploadRequest: sock.updateMediaMessage });

                    const mime = msg.message[messageType]?.mimetype || 'application/octet-stream';
                    // Extract extension based on mime type
                    const extMap: Record<string, string> = {
                        'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
                        'video/mp4': 'mp4', 'audio/ogg; codecs=opus': 'ogg', 'audio/mpeg': 'mp3',
                        'application/pdf': 'pdf'
                    };
                    const ext = extMap[mime] || mime.split('/')[1] || 'bin';
                    const fileName = `${userId}/${remoteJid.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.${ext}`;

                    // Upload buffer to Supabase Storage
                    const { data: uploadData, error: uploadError } = await supabaseAdmin
                        .storage
                        .from('whatsapp-media')
                        .upload(fileName, buffer, {
                            contentType: mime,
                            upsert: true
                        });

                    if (uploadError) {
                        console.error('[WhatsAppConnectionManager] Storage upload failed:', uploadError);
                        content = msg.message.imageMessage ? '[Image]' : msg.message.videoMessage ? '[Video]' : msg.message.audioMessage ? '[Audio]' : '[Document]';
                    } else {
                        // Generate public URL
                        const { data: { publicUrl } } = supabaseAdmin
                            .storage
                            .from('whatsapp-media')
                            .getPublicUrl(fileName);

                        if (msg.message.imageMessage) content = `[IMAGE:${publicUrl}]`;
                        else if (msg.message.videoMessage) content = `[VIDEO:${publicUrl}]`;
                        else if (msg.message.audioMessage) content = `[AUDIO:${publicUrl}]`;
                        else content = `[FILE:${publicUrl}]`;
                    }
                } else {
                    content = msg.message.imageMessage ? '[Image]' : msg.message.videoMessage ? '[Video]' : msg.message.audioMessage ? '[Audio]' : '[Document]';
                }
            } catch (err) {
                console.error('[WhatsAppConnectionManager] Error downloading media:', err);
                content = msg.message.imageMessage ? '[Image]' : msg.message.videoMessage ? '[Video]' : msg.message.audioMessage ? '[Audio]' : '[Document]';
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
            const extractPhone = (j: string) => (j || '').split('@')[0];
            // Use the resolved finalJid — never the raw remoteJid which could be @lid
            const leadPhoneStr = normalizeLeadPhoneForStorage(extractPhone(finalJid) || leadPhone);
            const actualSender = isOutgoing ? 'user' : 'lead';
            const initialStatus = isOutgoing ? 'sent' : 'received';

            const { data: savedMsg } = await supabaseAdmin.from('whatsapp_messages').insert({
                user_id: userId,
                lead_phone: leadPhoneStr,
                jid: finalJid, // ← always @s.whatsapp.net or @g.us (never @lid)
                content,
                sender: actualSender,
                message_id: finalMsgId,
                status: initialStatus,
                contact_name: contactName || null,
                is_group: isGroup,
                timestamp: msg.messageTimestamp ? new Date((typeof msg.messageTimestamp === 'number' ? msg.messageTimestamp : Number(msg.messageTimestamp)) * 1000).toISOString() : new Date().toISOString()
            }).select().single() || { data: null };

            // Auto-create lead if missing and it's an incoming message
            if (!isGroup && leadPhoneStr) {
                try {
                    const { data: existingLead } = await supabaseAdmin
                        .from('leads')
                        .select('id')
                        .or(`phone.eq.${leadPhoneStr},whatsapp.eq.${leadPhoneStr}`)
                        .eq('user_id', userId)
                        .maybeSingle();

                    if (!existingLead) {
                        await supabaseAdmin.from('leads').insert({
                            user_id: userId,
                            name: contactName || leadPhoneStr,
                            phone: leadPhoneStr,
                            whatsapp: leadPhoneStr,
                            source: 'whatsapp',
                            display_name: contactName || leadPhoneStr,
                            status: 'New'
                        });
                        console.log(`[WhatsAppConnectionManager] Auto-created new lead for ${leadPhoneStr}`);
                    }
                } catch (e) {
                    console.error('[WhatsAppConnectionManager] Failed trying to auto-create lead:', e);
                }
            }
            const payload = {
                id: savedMsg?.id,
                lead_phone: leadPhoneStr,
                jid: finalJid,
                contact_name: contactName,
                is_group: isGroup,
                content,
                sender: actualSender,
                message_id: finalMsgId,
                timestamp: savedMsg?.timestamp || new Date().toISOString(),
                status: initialStatus,
            };

            this.io.to(userId).emit('whatsapp-message', payload);

            // Persist contact name so Inbox shows name + number
            if (contactName && contactName !== leadPhoneStr) {
                try {
                    if (supabaseAdmin) {
                        await supabaseAdmin.from('whatsapp_contacts').upsert({
                            user_id: userId,
                            lead_phone: leadPhoneStr,
                            jid: finalJid, // ← resolved real JID (@s.whatsapp.net or @g.us)
                            contact_name: contactName,
                            is_group: isGroup,
                            updated_at: new Date().toISOString(),
                        }, { onConflict: 'user_id,jid' });
                    }
                    this.io.to(userId).emit('whatsapp-chat-update', { lead_phone: leadPhoneStr, contact_name: contactName, jid: finalJid });
                } catch (_) { /* ignore if table missing */ }
            }

            // ── Auto-Responder: keyword-triggered, settings-driven ────────────────
            // Fires ONLY when the incoming message contains an "interested" keyword.
            // Respects the Enable Auto Reply toggle and uses only the configured message text.
            if (!isOutgoing && !isGroup && sock) {
                const INTERESTED_KEYWORDS = ['i am interested', 'interested', 'intrested'];
                const msgLower = content.trim().toLowerCase();
                const isInterested = INTERESTED_KEYWORDS.some(kw => msgLower.includes(kw));

                // Fetch credentials once — used by both keyword-reply and AI-reply paths
                let credentials: { ai_enabled?: boolean; auto_reply_enabled?: boolean; auto_reply_text?: string; ai_agent_enabled?: boolean; n8n_webhook_url?: string } | null = null;
                if (supabaseAdmin) {
                    const { data } = await supabaseAdmin
                        .from('whatsapp_credentials')
                        .select('ai_enabled, auto_reply_enabled, auto_reply_text, ai_agent_enabled, n8n_webhook_url')
                        .eq('user_id', userId)
                        .maybeSingle();
                    credentials = data;
                }

                // ── n8n AI Agent Replier Check ────────────────────────
                console.log(`[n8n Debug] Credentials fetched: ai_agent_enabled=${credentials?.ai_agent_enabled}, webhook=${credentials?.n8n_webhook_url ? 'SET' : 'MISSING'}`);
                let aiPaused = false;
                if (credentials?.ai_agent_enabled && credentials?.n8n_webhook_url) {
                    // Check if AI is paused for this specific lead (Human Takeover)
                    if (supabaseAdmin) {
                        const { data: contactCheck } = await supabaseAdmin
                            .from('whatsapp_contacts')
                            .select('ai_paused')
                            .eq('user_id', userId)
                            .eq('lead_phone', leadPhoneStr)
                            .maybeSingle();
                        aiPaused = !!contactCheck?.ai_paused;
                        console.log(`[n8n Debug] ai_paused for ${leadPhoneStr}: ${aiPaused}`);
                    }

                    if (!aiPaused) {
                        // ── Lead Sync: Always run, regardless of which AI handles the reply ──
                        // This ensures leads are created/updated even when n8n is replying
                        if (supabaseAdmin) {
                            try {
                                const { data: existingLeadN8n } = await supabaseAdmin
                                    .from('leads')
                                    .select('id')
                                    .eq('user_id', userId)
                                    .eq('mobile', leadPhoneStr)
                                    .maybeSingle();

                                if (existingLeadN8n) {
                                    await supabaseAdmin
                                        .from('leads')
                                        .update({ status: 'Follow Up', score: 'Hot', updated_at: new Date().toISOString() })
                                        .eq('id', existingLeadN8n.id);
                                    console.log(`[n8n Debug] ✅ Lead updated (Hot/Follow Up) for ${leadPhoneStr}`);
                                } else {
                                    await supabaseAdmin.from('leads').insert({
                                        user_id: userId,
                                        name: contactName || leadPhoneStr,
                                        display_name: contactName || leadPhoneStr,
                                        email: '',
                                        mobile: leadPhoneStr,
                                        status: 'New',
                                        score: 'Hot',
                                        source: 'n8n AI Agent'
                                    });
                                    console.log(`[n8n Debug] ✅ New lead created for ${leadPhoneStr}`);
                                }
                            } catch (e) {
                                console.error('[n8n Debug] Failed to upsert lead:', e);
                            }
                        }

                        console.log(`[n8n Debug] ✅ Forwarding to n8n: ${credentials.n8n_webhook_url} for ${leadPhoneStr}`);
                        try {
                            // Fire and forget - do not await or block
                            fetch(credentials.n8n_webhook_url, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    userId,
                                    from: leadPhoneStr,
                                    jid: finalJid,
                                    contact_name: contactName || leadPhoneStr,
                                    message: content,
                                    timestamp: new Date().toISOString()
                                })
                            }).catch(err => console.error('[n8n Forward Error]:', err));
                        } catch (err) {
                            console.error('[n8n Fetch Setup Error]:', err);
                        }
                        
                        // Skip legacy auto-reply — n8n will handle the response
                        return;
                    } else {
                        console.log(`[WhatsAppConnectionManager] n8n skipped for ${leadPhoneStr} because AI is PAUSED (Human Takeover).`);
                    }
                }

                if (isInterested) {
                    console.log(`[WhatsAppConnectionManager] Keyword "interested" matched for ${remoteJid}. Syncing lead...`);

                    // Restore Lead Sync Logic
                    if (supabaseAdmin) {
                        try {
                            const { data: existingLead } = await supabaseAdmin
                                .from('leads')
                                .select('id')
                                .eq('user_id', userId)
                                .eq('mobile', leadPhoneStr)
                                .maybeSingle();

                            if (existingLead) {
                                await supabaseAdmin
                                    .from('leads')
                                    .update({ status: 'Follow Up', score: 'Hot', updated_at: new Date().toISOString() })
                                    .eq('id', existingLead.id);
                            } else {
                                await supabaseAdmin.from('leads').insert({
                                    user_id: userId,
                                    name: contactName || leadPhoneStr,
                                    display_name: contactName || leadPhoneStr,
                                    email: '',
                                    mobile: leadPhoneStr,
                                    status: 'New',
                                    score: 'Hot',
                                    source: 'WhatsApp Auto-Reply'
                                });
                            }
                        } catch (e) {
                            console.error('[WhatsAppConnectionManager] Failed to upsert interested lead:', e);
                        }
                    }

                    const autoReplyEnabled = credentials?.auto_reply_enabled === true;
                    const autoText = (credentials?.auto_reply_text ?? '').trim();

                    if (autoReplyEnabled && autoText) {
                        // Auto-reply is ON and message text is configured — send it
                        try {
                            const jidForSend = jidNormalizedUser(finalJid) || finalJid;
                            if (!jidForSend) {
                                console.warn('[WhatsAppConnectionManager] Auto-reply skipped: invalid JID for', leadPhoneStr);
                            } else {
                                const sendTo = await this.ensureSendableJid(sock, jidForSend, userId);
                                if ('error' in sendTo) {
                                    console.warn('[WhatsAppConnectionManager] Auto-reply skipped:', sendTo.error);
                                } else {
                                    console.log('[WhatsAppConnectionManager] Sending auto-reply to JID:', sendTo.jid);
                                    const sendResult = await sock.sendMessage(sendTo.jid, { text: autoText });
                                    const autoMessageId = sendResult?.key?.id;
                                    let autoMsg = null;
                                    if (supabaseAdmin) {
                                        const { data } = await supabaseAdmin.from('whatsapp_messages').insert({
                                            user_id: userId,
                                            lead_phone: leadPhoneStr,
                                            jid: sendTo.jid,
                                            content: autoText,
                                            sender: 'ai',
                                            status: 'sent',
                                            is_group: false,
                                            message_id: autoMessageId || undefined,
                                            contact_name: contactName || null,
                                        }).select().single();
                                        autoMsg = data;
                                    }
                                    this.io.to(userId).emit('whatsapp-message', {
                                        id: autoMsg?.id,
                                        lead_phone: leadPhoneStr,
                                        jid: sendTo.jid,
                                        content: autoText,
                                        sender: 'ai',
                                        message_id: autoMessageId,
                                        timestamp: autoMsg?.timestamp || new Date().toISOString(),
                                        status: 'sent',
                                    });
                                }
                            }
                        } catch (err) {
                            console.error('[WhatsAppConnectionManager] Error sending auto-reply:', err);
                        }
                    } else if (!autoReplyEnabled) {
                        console.log('[WhatsAppConnectionManager] Auto-reply is disabled — skipping reply.');
                    } else if (!autoText) {
                        console.log('[WhatsAppConnectionManager] Auto-reply message is empty — skipping reply.');
                    }
                } else if (credentials?.ai_enabled) {
                    // Keyword not matched — fall through to AI reply if enabled
                    await this.triggerAiReply(userId, finalJid, content);
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

    // ── Send text message ───────────────────────────────────────────
    public async sendMessage(userId: string, to: string, text: string, quotedMsgId?: string, contactNameFromBody?: string, senderType: 'user' | 'ai' = 'user'): Promise<{ success: boolean; error?: string; messageId?: string }> {
        // Calling directly for reliability instead of queueing to avoid Redis timeout errors on Windows.
        return await this.sendMessageRaw(userId, to, text, quotedMsgId, contactNameFromBody, senderType);
    }

    /** The actual Baileys send logic called by the worker */
    public async sendMessageRaw(userId: string, to: string, text: string, quotedMsgId?: string, contactNameFromBody?: string, senderType: 'user' | 'ai' = 'user'): Promise<{ success: boolean; error?: string; messageId?: string }> {
        const sock = this.activeSockets.get(userId);
        if (!sock) return { success: false, error: 'WhatsApp not connected.' };

        let jid = '';
        const toForLookup = normalizeLeadPhoneForStorage(to);
        if (supabaseAdmin && toForLookup) {
            const { data: rows } = await supabaseAdmin
                .from('whatsapp_contacts')
                .select('jid')
                .eq('user_id', userId)
                .eq('lead_phone', toForLookup)
                .limit(20);
            const list = (rows || []) as { jid?: string }[];
            // CRITICAL: Always prefer @s.whatsapp.net or @g.us over @lid
            const preferred = list.find(r => r.jid && (r.jid.endsWith('@s.whatsapp.net') || r.jid.endsWith('@g.us')));

            if (preferred?.jid) {
                jid = preferred.jid;
            } else if (to.includes('@')) {
                jid = to;
            } else if (list.length > 0 && list[0]?.jid) {
                jid = list[0].jid;
            } else if (toForLookup.length >= 7) {
                jid = `${toForLookup}@s.whatsapp.net`;
            } else {
                jid = this.resolveJid(to) || list[0]?.jid || '';
            }
        }

        if (!jid) jid = this.resolveJid(to);

        if (!jid) return { success: false, error: 'Invalid recipient.' };

        const sendable = await this.ensureSendableJid(sock, jid, userId);
        if ('error' in sendable) return { success: false, error: sendable.error };
        jid = sendable.jid;

        // Newsletters and channels are read-only for most users
        if (jid.includes('@newsletter')) {
            console.warn(`[WhatsAppConnectionManager] Blocked send to newsletter: ${jid}`);
            return { success: false, error: 'Cannot send messages to Newsletters/Channels. They are read-only.' };
        }

        // Prevent AI from sending to groups
        if (senderType === 'ai' && jid.includes('@g.us')) {
            console.warn(`[WhatsAppConnectionManager] Blocked AI from sending to group: ${jid}`);
            return { success: false, error: 'AI agent is not permitted to send messages to groups.' };
        }

        try {
            console.log(`[WhatsAppConnectionManager] [Worker] Sending message. User: ${userId}, JID: ${jid}, SocketStatus: ${sock.user ? 'Connected as ' + sock.user.id : 'No user'}`);
            const result = await sock.sendMessage(jid, { text });

            if (!result) {
                console.error(`[WhatsAppConnectionManager] sendMessage returned null/undefined for ${jid}`);
                return { success: false, error: 'WhatsApp failed to send the message (empty response).' };
            }

            console.log(`[WhatsAppConnectionManager] Raw Send Result:`, JSON.stringify(result));
            const messageId = result?.key?.id;
            console.log(`[WhatsAppConnectionManager] Message ID: ${messageId}`);

            if (supabaseAdmin && messageId) {
                try {
                    const extractPhone = (j: string) => (j || '').split('@')[0];
                    const leadPhone = normalizeLeadPhoneForStorage(extractPhone(jid));

                    let contactName = null;
                    const { data: contactData } = await supabaseAdmin
                        .from('whatsapp_contacts')
                        .select('contact_name')
                        .or(`jid.eq.${jid},lead_phone.eq.${leadPhone}`)
                        .eq('user_id', userId)
                        .maybeSingle();
                    contactName = contactData?.contact_name || contactNameFromBody || null;

                    const { data: savedMsg } = await supabaseAdmin.from('whatsapp_messages').insert({
                        user_id: userId,
                        lead_phone: leadPhone,
                        jid: jid,
                        content: text,
                        sender: senderType,
                        message_id: messageId,
                        status: 'sent',
                        is_group: jid.includes('@g.us'),
                        contact_name: contactName
                    }).select().maybeSingle();

                    this.io.to(userId).emit('whatsapp-message', {
                        id: savedMsg?.id || `temp-${messageId}`,
                        lead_phone: leadPhone,
                        jid: jid,
                        content: text,
                        sender: senderType,
                        message_id: messageId,
                        timestamp: new Date().toISOString(),
                        status: 'sent',
                        contact_name: contactName
                    });
                    
                    // ── Auto-Pause AI (Human Takeover) ───────────────────
                    // If the user manually sends a message, pause the AI for this lead
                    if (senderType === 'user' && supabaseAdmin) {
                        try {
                            await supabaseAdmin.from('whatsapp_contacts').update({ ai_paused: true })
                                .eq('user_id', userId).eq('lead_phone', leadPhone);
                            await supabaseAdmin.from('leads').update({ ai_paused: true })
                                .eq('user_id', userId).eq('whatsapp_number', leadPhone);
                        } catch (err) {
                            console.warn('[WhatsAppConnectionManager] Failed to auto-pause AI:', err);
                        }
                    }

                } catch (dbEx) {
                    console.error("[DB Exception for Send]", dbEx);
                }
            }
            return { success: true, messageId };
        } catch (error: any) {
            console.error("Send message failed:", error);
            throw error; // Rethrow for BullMQ retry
        }
    }
    /** Build JID for sending; use Baileys jidNormalizedUser so WhatsApp accepts the message. Never returns @lid (use ensureSendableJid to resolve LID). */
    private resolveJid(to: string): string {
        if (!to || typeof to !== 'string') return '';
        if (to === 'status@broadcast') return '';
        // Groups: preserve. LID: do not strip, preserve natively for sending!
        if (to.includes('@g.us')) return to;
        if (to.includes('@lid')) return to;
        if (to.includes('@')) return jidNormalizedUser(to) || to;

        const digits = to.replace(/\D/g, '');
        if (!digits) return '';

        const isGroup = digits.length > 15;
        const raw = isGroup ? `${digits}@g.us` : `${digits}@s.whatsapp.net`;
        return isGroup ? raw : (jidNormalizedUser(raw) || raw);
    }

    /**
     * Ensure JID is valid for sending: must be @s.whatsapp.net (user) or @g.us (group).
     * Resolves @lid to real user JID via Baileys onWhatsApp(); rejects status@broadcast and unresolved LID.
     */
    private async ensureSendableJid(sock: any, jid: string, userId: string): Promise<{ jid: string } | { error: string }> {
        if (!jid || typeof jid !== 'string') return { error: 'Invalid recipient.' };
        if (jid === 'status@broadcast') return { error: 'Cannot send to status broadcast.' };

        if (jid.endsWith('@g.us')) return { jid };
        if (jid.endsWith('@s.whatsapp.net')) return { jid };

        if (jid.endsWith('@lid')) {
            try {
                const [result] = await sock.onWhatsApp(jid).catch(() => []);
                if (result?.exists && result?.jid && !String(result.jid).includes('@lid')) {
                    const realJid = result.jid as string;
                    console.log(`[WhatsAppConnectionManager] Resolved LID ${jid} to ${realJid} for sending`);
                    if (supabaseAdmin) {
                        try {
                            await supabaseAdmin.from('whatsapp_contacts').update({
                                jid: realJid,
                                updated_at: new Date().toISOString(),
                            }).eq('user_id', userId).eq('jid', jid);
                            await supabaseAdmin.from('whatsapp_messages').update({ jid: realJid }).eq('user_id', userId).eq('jid', jid);
                        } catch (e) {
                            console.warn('[WhatsAppConnectionManager] DB update after LID resolve:', e);
                        }
                    }
                    return { jid: realJid };
                }
            } catch (e) {
                console.warn('[WhatsAppConnectionManager] LID resolve for send failed:', e);
            }
            // If we cannot resolve it to a standard phone number, WhatsApp STILL fully
            // supports native messaging directly to the LID in many cases. Do not block it.
            return { jid };
        }

        return { error: 'Unsupported JID format for sending. Use phone number or @s.whatsapp.net.' };
    }

    // ── Send media ──────────────────────────────────────────────────
    public async sendMedia(userId: string, to: string, buffer: Buffer, mimetype: string, caption?: string, filename?: string, contactNameFromBody?: string, senderType: 'user' | 'ai' = 'user'): Promise<{ success: boolean; error?: string; messageId?: string }> {
        // Calling directly for reliability instead of queueing to avoid Redis timeout errors on Windows.
        return await this.sendMediaRaw(userId, to, buffer, mimetype, caption, filename, contactNameFromBody, senderType);
    }

    /** The actual Baileys media logic called by the worker */
    public async sendMediaRaw(userId: string, to: string, buffer: Buffer, mimetype: string, caption?: string, filename?: string, contactNameFromBody?: string, senderType: 'user' | 'ai' = 'user'): Promise<{ success: boolean; error?: string; messageId?: string }> {
        const sock = this.activeSockets.get(userId);
        if (!sock) return { success: false, error: 'WhatsApp not connected.' };

        let jid = '';
        const toForLookup = normalizeLeadPhoneForStorage(to);
        if (supabaseAdmin && toForLookup) {
            const { data: rows } = await supabaseAdmin
                .from('whatsapp_contacts')
                .select('jid')
                .eq('user_id', userId)
                .eq('lead_phone', toForLookup)
                .limit(20);
            const list = (rows || []) as { jid?: string }[];
            // CRITICAL: Always prefer @s.whatsapp.net or @g.us over @lid
            const preferred = list.find(r => r.jid && (r.jid.endsWith('@s.whatsapp.net') || r.jid.endsWith('@g.us')));

            if (preferred?.jid) {
                jid = preferred.jid;
            } else if (to.includes('@')) {
                jid = to;
            } else if (list.length > 0 && list[0]?.jid) {
                jid = list[0].jid;
            } else if (toForLookup.length >= 7) {
                jid = `${toForLookup}@s.whatsapp.net`;
            } else {
                jid = this.resolveJid(to) || list[0]?.jid || '';
            }
        }

        if (!jid) jid = this.resolveJid(to);
        if (!jid) return { success: false, error: 'Invalid recipient.' };

        const sendable = await this.ensureSendableJid(sock, jid, userId);
        if ('error' in sendable) return { success: false, error: sendable.error };
        jid = sendable.jid;

        // Prevent AI from sending to groups
        if (senderType === 'ai' && jid.includes('@g.us')) {
            console.warn(`[WhatsAppConnectionManager] Blocked AI from sending media to group: ${jid}`);
            return { success: false, error: 'AI agent is not permitted to send messages to groups.' };
        }

        let msgContent: any;
        if (mimetype.startsWith('image/')) {
            msgContent = { image: buffer, caption: caption || '', mimetype };
        } else if (mimetype.startsWith('audio/')) {
            msgContent = { audio: buffer, mimetype, ptt: false };
        } else {
            msgContent = { document: buffer, mimetype, fileName: filename || 'file', caption: caption || '' };
        }

        try {
            console.log(`[WhatsAppConnectionManager] [Worker] Sending media message to JID: ${jid}`);
            const sent = await sock.sendMessage(jid, msgContent);
            const messageId = sent?.key?.id;

            let content = '';
            if (supabaseAdmin) {
                try {
                    const extMap: Record<string, string> = {
                        'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
                        'video/mp4': 'mp4', 'audio/ogg; codecs=opus': 'ogg', 'audio/mpeg': 'mp3',
                        'application/pdf': 'pdf'
                    };
                    const ext = extMap[mimetype] || mimetype.split('/')[1] || 'bin';
                    const sObjectName = `${userId}/${jid.replace(/[^a-zA-Z0-9]/g, '_')}_outgoing_${Date.now()}.${ext}`;

                    const { error } = await supabaseAdmin.storage
                        .from('whatsapp-media')
                        .upload(sObjectName, buffer, { contentType: mimetype, upsert: true });

                    if (!error) {
                        const { data: { publicUrl } } = supabaseAdmin.storage.from('whatsapp-media').getPublicUrl(sObjectName);
                        if (mimetype.startsWith('image/')) content = `[IMAGE:${publicUrl}] ${caption || ''}`.trim();
                        else if (mimetype.startsWith('audio/')) content = `[AUDIO:${publicUrl}] ${caption || ''}`.trim();
                        else if (mimetype.startsWith('video/')) content = `[VIDEO:${publicUrl}] ${caption || ''}`.trim();
                        else content = `[FILE:${publicUrl}] ${caption || ''}`.trim();
                    }
                } catch (err) { }
            }

            if (!content) {
                if (mimetype.startsWith('image/')) content = '[Image]';
                else if (mimetype.startsWith('video/')) content = '[Video]';
                else content = `[File: ${filename || 'document'}]` + (caption ? ` — ${caption}` : '');
            }

            if (supabaseAdmin) {
                try {
                    const extractPhone = (j: string) => (j || '').split('@')[0];
                    const leadPhone = normalizeLeadPhoneForStorage(extractPhone(jid));
                    let contactName = null;
                    const { data: contactData } = await supabaseAdmin
                        .from('whatsapp_contacts')
                        .select('contact_name')
                        .or(`jid.eq.${jid},lead_phone.eq.${leadPhone}`)
                        .eq('user_id', userId)
                        .maybeSingle();
                    contactName = contactData?.contact_name || contactNameFromBody || null;

                    const { data: savedMsg } = await supabaseAdmin.from('whatsapp_messages').insert({
                        user_id: userId,
                        lead_phone: leadPhone,
                        jid: jid,
                        content,
                        sender: senderType,
                        message_id: messageId,
                        status: 'sent',
                        is_group: jid.includes('@g.us'),
                        contact_name: contactName
                    }).select().maybeSingle();

                    this.io.to(userId).emit('whatsapp-message', {
                        id: savedMsg?.id || `temp-${messageId}`,
                        lead_phone: leadPhone,
                        jid: jid,
                        content,
                        sender: senderType,
                        message_id: messageId,
                        timestamp: new Date().toISOString(),
                        status: 'sent',
                        contact_name: contactName
                    });
                } catch (dbEx) { }
            }

            return { success: true, messageId };
        } catch (e: any) {
            console.error('[WhatsAppConnectionManager] sendMediaRaw error:', e);
            throw e; // Rethrow for BullMQ retry
        }
    }

    private async triggerAiReply(userId: string, remoteJid: string, latestMessage: string) {
        if (!remoteJid) return;
        try {
            const sock = this.activeSockets.get(userId);
            if (!sock) return;

            let credentials = null;
            if (supabaseAdmin) {
                const { data } = await supabaseAdmin
                    .from('whatsapp_credentials')
                    .select('ai_enabled')
                    .eq('user_id', userId)
                    .single();
                credentials = data;
            }

            if (!credentials?.ai_enabled) return;

            if (!supabaseAdmin) return;

            const { data: history } = await supabaseAdmin
                .from('whatsapp_messages')
                .select('*')
                .eq('user_id', userId)
                .eq('jid', remoteJid)
                .order('timestamp', { ascending: false })
                .limit(5);

            const aiMessages = (history || []).reverse().map((m: any) => ({
                role: m.sender === 'user' || m.sender === 'ai' ? 'assistant' : 'user',
                content: m.content
            }));

            aiMessages.unshift({ role: 'system', content: 'You are a helpful and polite CRM assistant. Keep replies brief. Do not use asterisks or formatting.' });

            const replyText = await generateAIReply(aiMessages as any);
            const sendTo = await this.ensureSendableJid(sock, remoteJid, userId);
            if ('error' in sendTo) {
                console.warn('[WhatsAppConnectionManager] AI reply skipped:', sendTo.error);
                return;
            }
            const sendResult = await sock.sendMessage(sendTo.jid, { text: replyText });
            const messageId = sendResult?.key?.id;

            const leadPhone = jidToLeadPhone(sendTo.jid);
            const leadPhoneStr = leadPhone || '';
            const { data: aiMsg } = await supabaseAdmin.from('whatsapp_messages').insert({
                user_id: userId,
                lead_phone: leadPhoneStr,
                jid: sendTo.jid,
                content: replyText,
                sender: 'ai',
                status: 'sent',
                is_group: false,
                message_id: messageId,
            }).select().single();

            this.io.to(userId).emit('whatsapp-message', {
                id: aiMsg?.id,
                lead_phone: leadPhoneStr,
                jid: sendTo.jid,
                content: replyText,
                sender: 'ai',
                message_id: messageId,
                timestamp: aiMsg?.timestamp || new Date().toISOString(),
                status: 'sent',
            });
        } catch (err) {
            console.error('[WhatsAppConnectionManager] Error sending AI reply:', err);
        }
    }

    public async disconnectWhatsApp(userId: string) {
        console.log(`[WhatsAppConnectionManager] Manual disconnect requested for user ${userId}`);
        const sock = this.activeSockets.get(userId);

        // 1. Always clear the DB session state first
        try {
            const { clearAll } = await useSupabaseAuthState(userId);
            await clearAll();
            console.log(`[WhatsAppConnectionManager] Cleared session state in DB for ${userId}`);
        } catch (e) {
            console.error('[WhatsAppConnectionManager] Error clearing auth state:', e);
        }

        // 2. Logout and clean up the active socket
        if (sock) {
            try {
                // We don't await logout because it can hang if already disconnected
                sock.logout().catch((e: any) => console.warn('[WhatsAppConnectionManager] Logout failed (expected if already offline):', e.message));
            } catch (e) { }
            this.activeSockets.delete(userId);
        }
    }
}
