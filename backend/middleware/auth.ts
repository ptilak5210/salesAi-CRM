import { Request, Response, NextFunction } from 'express';
import { supabase } from '../../database/supabase';

declare global {
    namespace Express {
        interface Request {
            user?: any;
        }
    }
}

/**
 * Express Middleware — Validates Supabase JWT token from the Authorization header.
 * Usage: app.get('/api/protected', requireAuth, handler)
 */
export const requireAuth = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    // 1. Check for N8N API Key (for external automation like n8n)
    const apiKey = req.headers['x-api-key'];
    const validApiKey = process.env.N8N_API_KEY;

    if (apiKey && validApiKey && apiKey === validApiKey) {
        console.log('[Auth Middleware] Authenticated via N8N API Key');
        // We set a mock user object if it's missing but required by routes
        // Usually n8n will provide a userId in the body, which we'll handle in the routes
        return next();
    }

    // 2. Fallback to Supabase JWT (for frontend)
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        console.error('[Auth Middleware] Missing or invalid header:', header);
        return res.status(401).json({ error: 'Missing or invalid Authorization header. Expected: Bearer <token> or x-api-key header' });
    }

    const token = header.replace('Bearer ', '').trim();

    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
        console.error('[Auth Middleware] Invalid token or Supabase error:', error?.message);
        return res.status(401).json({ error: 'Invalid or expired session token.' });
    }

    req.user = user;
    next();
};
