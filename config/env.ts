// Environment variables — loaded by dotenv in backend, by Vite in frontend
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// In ESM, __dirname is not available; reconstruct it from import.meta.url
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from the project root (one level up from /config)
dotenv.config({ path: path.resolve(__dirname, '../.env') });

export const env = {
    // Gemini AI
    geminiApiKey: process.env.GEMINI_API_KEY || '',

    // Supabase — backend reads non-VITE_ prefixed vars, with VITE_ as fallback
    supabaseUrl: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
    supabaseKey: process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '',

    // Service role key — BACKEND ONLY, never send to frontend
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',

    // Server
    port: parseInt(process.env.PORT || '3001', 10),
    isProduction: process.env.NODE_ENV === 'production',
};

