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
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        console.error('[Auth Middleware] Missing or invalid header:', header);
        return res.status(401).json({ error: 'Missing or invalid Authorization header. Expected: Bearer <token>' });
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
