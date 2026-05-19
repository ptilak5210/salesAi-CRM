/**
 * authService.ts
 * 
 * The single source of truth for all authentication logic.
 * Connects directly to Supabase Auth — no mock data, no localStorage hacks.
 */

import { supabase } from '../lib/supabase';
import { AuthSession, ClientProfile } from '../../utils/types';

// ─── Email / Password Auth ────────────────────────────────────────────────────

export interface SignupData {
    name: string;
    email: string;
    password: string;
    companyName: string;
}

/**
 * signup — Creates the account. Supabase sends a 6-digit OTP to the email.
 * Returns the email so the UI can show the OTP verification step.
 */
export const signup = async (data: SignupData): Promise<{ email: string; session?: AuthSession }> => {
    const { name, email, password, companyName } = data;

    const { data: authData, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: { name, companyName }
        }
    });

    if (error) {
        if (error.message.includes('Error sending confirmation email')) {
            throw new Error('Supabase failed to send the confirmation email. Check SMTP settings or rate limits.');
        }
        throw new Error(error.message);
    }

    if (!authData.user) throw new Error('Signup failed — please try again.');

    // If Supabase returned a session immediately, email confirmation is disabled!
    // We can skip the OTP step and log the user right in.
    if (authData.session) {
        return {
            email,
            session: await enhanceSession(authData.user, authData.session.access_token)
        };
    }

    // Return email for the OTP verification step
    return { email };
};

/**
 * verifyEmailOtp — Verifies the 6-digit OTP that Supabase sent to the user's email after signup.
 */
export const verifyEmailOtp = async (email: string, token: string): Promise<AuthSession> => {
    const { data, error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'signup'
    });

    if (error) throw new Error(error.message);
    if (!data.user) throw new Error('Verification failed — please try again.');

    return await enhanceSession(data.user, data.session?.access_token);
};

export const resendOtp = async (email: string): Promise<void> => {
    const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: {
            emailRedirectTo: window.location.origin
        }
    });
    if (error) throw new Error(error.message);
};

export const login = async (email: string, password: string): Promise<AuthSession> => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) throw new Error(error.message);
    if (!data.user) throw new Error('Login failed — please try again.');

    return await enhanceSession(data.user, data.session.access_token);
};

// ─── OAuth (Google / GitHub) ──────────────────────────────────────────────────

export const signInWithGoogle = async (): Promise<void> => {
    const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: window.location.origin,
            queryParams: {
                prompt: 'select_account'
            }
        }
    });
    if (error) throw new Error(error.message);
};

export const signInWithGitHub = async (): Promise<void> => {
    const { error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
            redirectTo: window.location.origin
        }
    });
    if (error) throw new Error(error.message);
};

// ─── Session Management ───────────────────────────────────────────────────────

export const signOut = async (): Promise<void> => {
    localStorage.removeItem('metaConnected');
    try {
        const { error } = await supabase.auth.signOut();
        if (error) {
            console.warn('[AuthService] Supabase signOut error:', error.message);
        }
    } catch (err) {
        console.warn('[AuthService] Exception in signOut:', err);
    }
};

export const getUserSession = async (): Promise<AuthSession | null> => {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) return null;
    return await enhanceSession(session.user, session.access_token);
};

export const createClientProfile = async (profileData: Omit<ClientProfile, 'id' | 'created_at'>): Promise<void> => {
    const { error } = await supabase.from('clients').upsert([profileData], { onConflict: 'user_id' });
    if (error) throw new Error(error.message);
};

/**
 * buildSession — Public wrapper to enhance a Supabase session with client profile data.
 * Useful for building the session from onAuthStateChange events to avoid lock contention.
 */
export const buildSessionFromSupabase = async (user: any, token?: string): Promise<AuthSession> => {
    return await enhanceSession(user, token);
};

// ─── Internal Helper ──────────────────────────────────────────────────────────

const enhanceSession = async (user: any, token?: string): Promise<AuthSession> => {
    const meta = user.user_metadata ?? {};
    console.log('[Auth] Building session for user:', user.id, user.email);

    // Step 1: Determine real role — call backend /api/me/role
    // This checks if this Supabase user is in the team_members table (team_member)
    // or not (super_admin / owner). Falls back gracefully if backend is down.
    let userRole: 'super_admin' | 'team_member' = 'super_admin';
    let teamMemberId: string | undefined;
    let ownerId: string = user.id; // default to self
    let title: string | undefined;
    let pipeline_ids: string[] = [];
    let permissions: AuthSession['user']['permissions'] | undefined;

    try {
        if (token) {
            const roleRes = await fetch('http://localhost:3001/api/me/role', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (roleRes.ok) {
                const roleData = await roleRes.json();
                if (roleData.role === 'team_member') {
                    userRole = 'team_member';
                    teamMemberId = roleData.team_member_id;
                    ownerId = roleData.owner_id || user.id;
                    title = roleData.title;
                    pipeline_ids = roleData.pipeline_ids || [];
                    permissions = roleData.permissions || {
                        can_export: false,
                        can_import: false,
                        can_delete: false,
                        can_edit: true,
                        can_view_analytics: false
                    };
                    console.log('[Auth] Role resolved: team_member | title:', title, '| permissions:', permissions);
                } else {
                    userRole = 'super_admin';
                    ownerId = roleData.owner_id || user.id;
                    console.log('[Auth] Role resolved: super_admin');
                }
            }
        }
    } catch (e) {
        console.warn('[Auth] Could not determine role from backend — defaulting to super_admin', e);
    }

    // Step 2: Check if user has a client profile (only relevant for super_admin)
    let hasClientProfile = true;
    if (userRole === 'super_admin') {
        try {
            const { data: clientData } = await import('../lib/supabase').then(m =>
                m.supabase.from('clients').select('id').eq('user_id', user.id).maybeSingle()
            );
            hasClientProfile = !!clientData;
        } catch (e) {
            console.warn('[Auth] Could not check client profile:', e);
            hasClientProfile = true; // fail open so user is not stuck
        }
    }

    const session: AuthSession = {
        user: {
            id: user.id,
            name: meta.name ?? meta.full_name ?? user.email?.split('@')[0] ?? 'User',
            email: user.email ?? '',
            role: userRole,
            companyId: meta.companyId ?? 'default',
            owner_id: ownerId,
            // RBAC fields — only populated for team members
            ...(userRole === 'team_member' && {
                team_member_id: teamMemberId,
                title,
                pipeline_ids,
                permissions
            })
        },
        company: {
            id: meta.companyId ?? 'default',
            name: meta.companyName ?? 'My Workspace',
            plan: 'Starter',
            limits: { leadsPerDay: 50, messagesPerDay: 100 },
            createdAt: new Date().toISOString()
        },
        token: token ?? '',
        hasClientProfile
    };

    console.log('[Auth] Final session built — role:', session.user.role, '| hasClientProfile:', hasClientProfile);
    return session;
};
