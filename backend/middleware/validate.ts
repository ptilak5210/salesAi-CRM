import { Request, Response, NextFunction } from 'express';

/**
 * Lightweight request body validator — no extra packages needed.
 * Usage: router.post('/', validateBody(['name', 'phone']), handler)
 */
export function validateBody(requiredFields: string[]) {
    return (req: Request, res: Response, next: NextFunction): any => {
        const missing: string[] = [];
        for (const field of requiredFields) {
            const val = req.body?.[field];
            if (val === undefined || val === null || val === '') {
                missing.push(field);
            }
        }
        if (missing.length > 0) {
            return res.status(400).json({
                error: `Missing required field(s): ${missing.join(', ')}`
            });
        }
        next();
    };
}

/**
 * Sanitise a phone number string: strip all non-digit characters.
 * Returns the digits-only string (e.g. "919876543210").
 */
export function sanitizePhone(phone: string): string {
    return (phone || '').replace(/\D/g, '');
}

/**
 * Validate phone looks like a real international number (7–15 digits).
 */
export function isValidPhone(phone: string): boolean {
    const digits = sanitizePhone(phone);
    return digits.length >= 7 && digits.length <= 15;
}
