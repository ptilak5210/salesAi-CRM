import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const REDIS_URL = process.env.REDIS_URL;
const REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379');

// Use REDIS_URL if available (e.g. Upstash), otherwise fallback to host/port
export const redisConnection = REDIS_URL 
    ? new IORedis(REDIS_URL, { 
        maxRetriesPerRequest: null,
        tls: REDIS_URL.startsWith('rediss://') ? { rejectUnauthorized: false } : undefined
    })
    : new IORedis({
        host: REDIS_HOST,
        port: REDIS_PORT,
        maxRetriesPerRequest: null,
        retryStrategy: (times) => {
            const delay = Math.min(times * 50, 2000);
            return delay;
        }
    });

redisConnection.on('error', (err) => {
    console.error('[Redis] Connection Error:', err);
});

redisConnection.on('connect', () => {
    console.log('[Redis] Connected to Redis server');
});

// Define the queue
export const messageQueue = new Queue('whatsapp-messages', {
    connection: redisConnection as any,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 1000,
        },
        removeOnComplete: true,
        removeOnFail: false,
    }
});

// Interface for the job data
export interface SendMessageJob {
    userId: string;
    to: string;
    message?: string;
    fileBuffer?: any; // serialized as {type: 'Buffer', data: [...]}
    mimeType?: string;
    caption?: string;
    fileName?: string;
    quotedMsgId?: string;
    contact_name?: string;
    type: 'text' | 'media';
}

/**
 * Initialize the queue worker
 * @param waManager - The WhatsAppConnectionManager instance to use for sending messages
 */
export const initWorker = (waManager: any) => {
    console.log('[Queue] Initializing worker...');
    
    const worker = new Worker('whatsapp-messages', async (job: Job<SendMessageJob>) => {
        const { userId, to, message, fileBuffer, mimeType, caption, fileName, quotedMsgId, contact_name, type } = job.data;
        
        console.log(`[Queue] Processing job ${job.id} (Type: ${type}) for user ${userId} to ${to}`);
        
        if (type === 'text') {
            if (!message) throw new Error('Text message content is missing');
            return await waManager.sendMessageRaw(userId, to, message, quotedMsgId, contact_name);
        } else if (type === 'media') {
            if (!fileBuffer) throw new Error('Media buffer is missing');
            
            let buffer: Buffer;
            if (Buffer.isBuffer(fileBuffer)) {
                buffer = fileBuffer;
            } else if (typeof fileBuffer === 'object' && fileBuffer.type === 'Buffer') {
                buffer = Buffer.from(fileBuffer.data);
            } else if (typeof fileBuffer === 'object' && 'data' in fileBuffer) {
                buffer = Buffer.from(fileBuffer.data);
            } else {
                throw new Error('Invalid file buffer format');
            }
            
            return await waManager.sendMediaRaw(userId, to, buffer, mimeType!, caption, fileName, contact_name);
        }
    }, { 
        connection: redisConnection as any,
        concurrency: 5
    });

    worker.on('completed', (job) => {
        console.log(`[Queue] Job ${job.id} completed successfully`);
    });

    worker.on('failed', (job, err) => {
        console.error(`[Queue] Job ${job?.id} failed with error:`, err.message);
    });

    return worker;
};
