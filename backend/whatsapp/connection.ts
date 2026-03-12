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
export function jidToLeadPhone(jid: string): string | null {
    if (!jid) return null;
    // If it's a group JID, it doesn't have a lead_phone
    if (jid.includes('@g.us')) return null;
    // If it's a Linked Identity (LID), no true phone number yet
    if (jid.includes('@lid')) return null;
    
    // Extract the part before @ for normal phone numbers
    const phone = jid.split('@')[0];
    return phone;
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

    constructor(io: Server) {
        this.io = io;
    }

    public async connectToWhatsApp(userId: string, webSocketId?: string) {
        if (this.connectingUsers.has(userId)) {
            console.log(`[WhatsAppConnectionManager] Connection already in progress for user ${userId}. Skipping.`);
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
                console.log(`[WhatsAppConnectionManager] Connection opened for user ${userId}`);
                if (supabaseAdmin) {
                    await supabaseAdmin.from('whatsapp_credentials').upsert(
                        { user_id: userId, is_connected: true, updated_at: new Date().toISOString() },
                        { onConflict: 'user_id' }
                    );
                }
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
                    contactMap.set(String(jid), { name: c.notify || c.name, imgUrl: c.imgUrl || undefined });
                }
            }

            // Store chat names (groups especially)
            for (const chat of chats) {
                const jid = chat.id;
                if (!jid) continue;
                const leadPhone = jidToLeadPhone(jid);
                const isGroup = jid.includes('@g.us');
                const name = chat.name || contactMap.get(jid)?.name;
                if (name) contactMap.set(jid, { ...contactMap.get(jid), name });
                try {
                    if (supabaseAdmin) {
                        await supabaseAdmin.from('whatsapp_contacts').upsert({
                            user_id: userId,
                            lead_phone: leadPhone,
                            jid: jid,
                            contact_name: name || null,
                            profile_picture_url: contactMap.get(jid)?.imgUrl || null,
                            is_group: isGroup,
                            updated_at: new Date().toISOString(),
                        }, { onConflict: 'user_id,jid' });
                    }
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

                let contactName = msg.pushName || contactMap.get(remoteJid)?.name || '';
                if (isGroup && msg.key.participant) {
                    contactName = msg.pushName || contactMap.get(msg.key.participant)?.name || contactName;
                }

                const msgId = msg.key.id;
                if (!msgId || seenIds.has(msgId)) continue;
                seenIds.add(msgId);

                const content = extractMessageContentSync(msg);
                const ts = msg.messageTimestamp ? (typeof msg.messageTimestamp === 'number' ? msg.messageTimestamp : Number(msg.messageTimestamp)) : Date.now() / 1000;
                const timestamp = new Date(ts * 1000).toISOString();

                try {
                    if (supabaseAdmin) {
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
                const jid = c.id || c.phoneNumber;
                if (!jid || jid.includes('@g.us')) continue;
                const leadPhone = jidToLeadPhone(jid);
                try {
                    if (supabaseAdmin) {
                        await supabaseAdmin.from('whatsapp_contacts').upsert({
                            user_id: userId,
                            lead_phone: leadPhone,
                            jid: jid,
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
        if (fromMe) return;

        if (!remoteJid || remoteJid === 'status@broadcast') {
            console.log(`[WhatsAppConnectionManager] Skipping (invalid jid): ${remoteJid}`);
            return;
        }

        const isGroup = remoteJid.includes('@g.us');
        let leadPhone = jidToLeadPhone(remoteJid);

        const sock = this.activeSockets.get(userId);

        // Attempt to resolve LID to a real phone number if it looks like a LID
        if (!isGroup && remoteJid.includes('@lid') && sock) {
            try {
                // Check if we already have a mapping in our contacts
                let existingContact = null;
                if (supabaseAdmin) {
                    const { data } = await supabaseAdmin.from('whatsapp_contacts')
                        .select('lead_phone')
                        .eq('user_id', userId)
                        .eq('jid', remoteJid)
                        .not('lead_phone', 'is', null) // Ensure it's not null
                        .order('updated_at', { ascending: false })
                        .limit(1).maybeSingle();
                    existingContact = data;
                }

                if (existingContact?.lead_phone) {
                    leadPhone = existingContact.lead_phone;
                } else {
                    // Try to resolve via Baileys
                    const [result] = await sock.onWhatsApp(remoteJid).catch(() => []);
                    
                    // The result from onWhatsApp can return the real JID format for a LID
                    if (result && result.exists && result.jid && !result.jid.includes('@lid')) {
                        const newPhone = jidToLeadPhone(result.jid);
                        console.log(`[WhatsAppConnectionManager] Resolved LID ${remoteJid} to phone ${newPhone}`);
                        
                        // Trigger a background update for this contact across all tables
                        const performResolution = async () => {
                            try {
                                if (supabaseAdmin) {
                                    // Check if the real phone number already exists
                                    const { data: contactWithRealPhone } = await supabaseAdmin
                                        .from('whatsapp_contacts')
                                        .select('lead_phone')
                                        .eq('user_id', userId)
                                        .eq('lead_phone', newPhone)
                                        .maybeSingle();

                                    if (contactWithRealPhone) {
                                        // Merge/Delete: avoid duplicate key by removing the LID record
                                        await supabaseAdmin.from('whatsapp_contacts').delete()
                                            .eq('user_id', userId)
                                            .eq('jid', remoteJid)
                                            .neq('lead_phone', newPhone);
                                    } else {
                                        // Safe update
                                        await supabaseAdmin.from('whatsapp_contacts').update({
                                            lead_phone: newPhone,
                                            updated_at: new Date().toISOString(),
                                        }).eq('user_id', userId).eq('jid', remoteJid);
                                    }

                                    // Update messages
                                    await supabaseAdmin.from('whatsapp_messages').update({
                                        lead_phone: newPhone,
                                    }).eq('user_id', userId).eq('jid', remoteJid);
                                }
                            } catch (err) {
                                console.warn('[WhatsAppConnectionManager] Background LID update failed:', err);
                            }
                        };
                        performResolution();
                        
                        leadPhone = newPhone;
                        this.io.to(userId).emit('whatsapp-chat-update', { 
                            lead_phone: newPhone, 
                            jid: remoteJid,
                            resolved_from_lid: true
                        });
                    }
                }
            } catch (err) {
                console.warn('[WhatsAppConnectionManager] LID resolution failed:', err);
            }
        }
        let contactName = msg.pushName || '';

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
            const extractPhone = (jid: string) => (jid || '').split('@')[0];
            const leadPhoneStr = extractPhone(remoteJid) || String(leadPhone);

            const { data: savedMsg } = await supabaseAdmin.from('whatsapp_messages').insert({
                user_id: userId,
                lead_phone: leadPhoneStr,
                jid: remoteJid,
                content,
                sender: 'lead',
                message_id: finalMsgId,
                status: 'received',
                contact_name: contactName || null,
                is_group: isGroup,
            }).select().single() || { data: null };

            // Auto-create lead if missing
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
                jid: remoteJid,
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
                    if (supabaseAdmin) {
                        await supabaseAdmin.from('whatsapp_contacts').upsert({
                            user_id: userId,
                            lead_phone: leadPhoneStr,
                            jid: remoteJid,
                            contact_name: contactName,
                            is_group: isGroup,
                            updated_at: new Date().toISOString(),
                        }, { onConflict: 'user_id,jid' });
                    }
                    this.io.to(userId).emit('whatsapp-chat-update', { lead_phone: leadPhoneStr, contact_name: contactName, jid: remoteJid });
                } catch (_) { /* ignore if table missing */ }
            }

            // --- HARDCODED "I AM INTERESTED" AUTOMATION ---
            if (!isGroup && content.trim().toLowerCase() === 'i am interested') {
                console.log(`[WhatsAppConnectionManager] "I am interested" matched for ${remoteJid}`);
                try {
                    // Create standard lead if not already caught (ignoring errors if exists)
                    if (supabaseAdmin) {
                        await supabaseAdmin.from('leads').insert({
                            user_id: userId,
                            name: contactName || leadPhoneStr,
                            phone: leadPhoneStr,
                            whatsapp: leadPhoneStr,
                            source: 'whatsapp',
                            display_name: contactName || leadPhoneStr,
                            status: 'New'
                        });
                    }
                    
                    if (sock) {
                        const replyContent = "Thank you for your interest! Our team will contact you shortly.";
                        const sendResult = await sock.sendMessage(remoteJid, { text: replyContent });
                        
                        if (supabaseAdmin) {
                            const { data: autoMsg } = await supabaseAdmin.from('whatsapp_messages').insert({
                                user_id: userId,
                                lead_phone: leadPhoneStr,
                                jid: remoteJid,
                                content: replyContent,
                                sender: 'ai',
                                status: 'sent',
                                is_group: false,
                                message_id: sendResult?.key?.id || undefined,
                                contact_name: contactName
                            }).select().single();
                            
                            this.io.to(userId).emit('whatsapp-message', {
                                id: autoMsg?.id,
                                lead_phone: leadPhoneStr,
                                jid: remoteJid,
                                content: replyContent,
                                sender: 'ai',
                                message_id: sendResult?.key?.id,
                                timestamp: new Date().toISOString(),
                                status: 'sent',
                            });
                        }
                    }
                    return; // Early return to avoid duplicate generic auto-replies
                } catch (e) {
                    console.error('[WhatsAppConnectionManager] Auto-reply error:', e);
                }
            }
            // ---------------------------------------------

            if (!isGroup && sock) {
                let credentials = null;
                if (supabaseAdmin) {
                    const { data } = await supabaseAdmin
                        .from('whatsapp_credentials')
                        .select('ai_enabled, auto_reply_enabled, auto_reply_text')
                        .eq('user_id', userId)
                        .maybeSingle();
                    credentials = data;
                }

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
                            let autoMsg = null;
                            if (supabaseAdmin) {
                                const { data } = await supabaseAdmin.from('whatsapp_messages').insert({
                                    user_id: userId,
                                    lead_phone: leadPhoneStr,
                                    jid: jid,
                                    content: autoText,
                                    sender: 'ai',
                                    status: 'sent',
                                    is_group: false,
                                    message_id: autoMessageId || undefined,
                                }).select().single();
                                autoMsg = data;
                            }
                            this.io.to(userId).emit('whatsapp-message', {
                                id: autoMsg?.id,
                                lead_phone: leadPhoneStr,
                                jid: jid,
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
                    await this.triggerAiReply(userId, remoteJid, content);
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
    public async sendMessage(userId: string, to: string, text: string, quotedMsgId?: string, contactNameFromBody?: string): Promise<{ success: boolean; error?: string; messageId?: string }> {
        const sock = this.activeSockets.get(userId);
        if (!sock) return { success: false, error: 'WhatsApp not connected. Please reconnect from Automations.' };

        let jid = '';
        if (supabaseAdmin) {
            const { data } = await supabaseAdmin
                .from('whatsapp_contacts')
                .select('jid')
                .eq('user_id', userId)
                .eq('lead_phone', to)
                .maybeSingle();
            if (data?.jid) jid = data.jid;
        }

        if (!jid) jid = this.resolveJid(to);
        
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
                    const extractPhone = (j: string) => (j || '').split('@')[0];
                    const leadPhone = extractPhone(jid);
                    
                    // Fetch contact name for payload enrichment
                    let contactName = null;
                    const { data: contactData } = await supabaseAdmin
                        .from('whatsapp_contacts')
                        .select('contact_name')
                        .or(`jid.eq.${jid},lead_phone.eq.${leadPhone}`)
                        .eq('user_id', userId)
                        .maybeSingle();
                    contactName = contactData?.contact_name || contactNameFromBody || leadPhone;

                    const { data: savedMsg, error: dbErr } = await supabaseAdmin.from('whatsapp_messages').insert({
                        user_id: userId,
                        lead_phone: leadPhone,
                        jid: jid,
                        content: text,
                        sender: 'user',
                        message_id: messageId,
                        status: 'sent',
                        is_group: jid.includes('@g.us'),
                        contact_name: contactName
                    }).select().maybeSingle();

                    if (dbErr) console.warn("[DB Insert Error for Send]", dbErr);

                    this.io.to(userId).emit('whatsapp-message', {
                        id: savedMsg?.id || `temp-${messageId}`,
                        lead_phone: leadPhone,
                        jid: jid,
                        content: text,
                        sender: 'user',
                        message_id: messageId,
                        timestamp: new Date().toISOString(),
                        status: 'sent',
                        contact_name: contactName
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
    public async sendMedia(userId: string, to: string, buffer: Buffer, mimetype: string, caption?: string, filename?: string, contactNameFromBody?: string): Promise<{ success: boolean; error?: string; messageId?: string }> {
        const sock = this.activeSockets.get(userId);
        if (!sock) return { success: false, error: 'WhatsApp not connected.' };

        let jid = '';
        if (supabaseAdmin) {
            const { data } = await supabaseAdmin
                .from('whatsapp_contacts')
                .select('jid')
                .eq('user_id', userId)
                .eq('lead_phone', to)
                .maybeSingle();
            if (data?.jid) jid = data.jid;
        }

        if (!jid) jid = this.resolveJid(to);
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
            
            let content = '';
            let uploadError: any = null;

            if (supabaseAdmin) {
                try {
                    const extMap: Record<string, string> = {
                        'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
                        'video/mp4': 'mp4', 'audio/ogg; codecs=opus': 'ogg', 'audio/mpeg': 'mp3',
                        'application/pdf': 'pdf'
                    };
                    const ext = extMap[mimetype] || mimetype.split('/')[1] || 'bin';
                    const sObjectName = `${userId}/${jid.replace(/[^a-zA-Z0-9]/g, '_')}_outgoing_${Date.now()}.${ext}`;

                    // Upload buffer to Supabase
                    const { error } = await supabaseAdmin.storage
                        .from('whatsapp-media')
                        .upload(sObjectName, buffer, { contentType: mimetype, upsert: true });

                    uploadError = error;

                    if (!uploadError) {
                        const { data: { publicUrl } } = supabaseAdmin.storage.from('whatsapp-media').getPublicUrl(sObjectName);
                        if (mimetype.startsWith('image/')) content = `[IMAGE:${publicUrl}] ${caption || ''}`.trim();
                        else if (mimetype.startsWith('audio/')) content = `[AUDIO:${publicUrl}] ${caption || ''}`.trim();
                        else if (mimetype.startsWith('video/')) content = `[VIDEO:${publicUrl}] ${caption || ''}`.trim();
                        else content = `[FILE:${publicUrl}] ${caption || ''}`.trim();
                    }
                } catch (err) {
                    uploadError = err;
                }
            }

            // Fallback if uploading failed or supabaseAdmin missing
            if (uploadError || !content) {
                if (uploadError) console.error('[WhatsAppConnectionManager] Outgoing media upload failed:', uploadError);
                if (mimetype.startsWith('image/')) {
                    const base64 = buffer.toString('base64');
                    content = buffer.length < 500 * 1024 ? `[IMAGE:data:${mimetype};base64,${base64}]` : '[Image]';
                } else if (mimetype.startsWith('video/')) {
                    const base64 = buffer.toString('base64');
                    content = buffer.length < 500 * 1024 ? `[VIDEO:data:${mimetype};base64,${base64}]` : '[Video]';
                } else {
                    const label = mimetype.startsWith('audio/') ? '[Audio]' : `[File: ${filename || 'document'}]`;
                    content = caption ? `${label} — ${caption}` : label;
                }
            }

            if (supabaseAdmin) {
                try {
                    const extractPhone = (j: string) => (j || '').split('@')[0];
                    const leadPhone = extractPhone(jid);

                    // Fetch contact name
                    let contactName = null;
                    const { data: contactData } = await supabaseAdmin
                        .from('whatsapp_contacts')
                        .select('contact_name')
                        .or(`jid.eq.${jid},lead_phone.eq.${leadPhone}`)
                        .eq('user_id', userId)
                        .maybeSingle();
                    contactName = contactData?.contact_name || contactNameFromBody || leadPhone;

                    const { data: savedMsg, error: dbErr } = await supabaseAdmin.from('whatsapp_messages').insert({
                        user_id: userId,
                        lead_phone: leadPhone,
                        jid: jid,
                        content,
                        sender: 'user',
                        message_id: messageId,
                        status: 'sent',
                        is_group: jid.includes('@g.us'),
                        contact_name: contactName
                    }).select().maybeSingle();

                    if (dbErr) console.warn("[DB Insert Error for Media]", dbErr);

                    this.io.to(userId).emit('whatsapp-message', {
                        id: savedMsg?.id || `temp-${messageId}`,
                        lead_phone: leadPhone,
                        jid: jid,
                        content,
                        sender: 'user',
                        message_id: messageId,
                        timestamp: new Date().toISOString(),
                        status: 'sent',
                        contact_name: contactName
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
            await sock.sendMessage(remoteJid, { text: replyText });

            const leadPhone = jidToLeadPhone(remoteJid);
            const leadPhoneStr = leadPhone || '';
            const { data: aiMsg } = await supabaseAdmin.from('whatsapp_messages').insert({
                user_id: userId,
                lead_phone: leadPhoneStr,
                jid: remoteJid,
                content: replyText,
                sender: 'ai',
                status: 'sent',
                is_group: false,
            }).select().single();

            this.io.to(userId).emit('whatsapp-message', {
                id: aiMsg?.id,
                lead_phone: leadPhoneStr,
                jid: remoteJid,
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
