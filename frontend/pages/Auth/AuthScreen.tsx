import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, XCircle, Loader, CheckCircle } from 'lucide-react';
import { signup, login, signInWithGoogle, verifyEmailOtp, resendOtp } from '../../auth/authService';
import { AuthSession } from '../../../utils/types';

interface Props {
    onAuthSuccess: (session: AuthSession) => void;
    onBack: () => void;
    initialMode: 'login' | 'signup';
}

type Screen = 'login' | 'signup' | 'otp';

export const AuthScreen = ({ onAuthSuccess, onBack, initialMode }: Props) => {
    const urlParams = new URLSearchParams(window.location.search);
    const modeParam = urlParams.get('mode') as Screen | null;
    const [screen, setScreen] = useState<Screen>(modeParam || initialMode);
    const [name, setName] = useState('');
    const [company, setCompany] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
    const [pendingEmail, setPendingEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [oauthLoading, setOauthLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [resendTimer, setResendTimer] = useState(60);
    const otpRefs = useRef<Array<HTMLInputElement | null>>([]);

    // Countdown timer for resend
    useEffect(() => {
        if (screen !== 'otp') return;
        setResendTimer(60);
        const interval = setInterval(() => {
            setResendTimer(t => (t > 0 ? t - 1 : 0));
        }, 1000);
        return () => clearInterval(interval);
    }, [screen]);

    // Handle OTP digit input
    const handleOtpChange = (index: number, value: string) => {
        if (!/^\d*$/.test(value)) return;
        const next = [...otpDigits];
        next[index] = value.slice(-1);
        setOtpDigits(next);
        if (value && index < 5) otpRefs.current[index + 1]?.focus();
    };

    const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
        if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
            otpRefs.current[index - 1]?.focus();
        }
    };

    const handleOtpPaste = (e: React.ClipboardEvent) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        const next = ['', '', '', '', '', ''];
        pasted.split('').forEach((ch, i) => { next[i] = ch; });
        setOtpDigits(next);
        otpRefs.current[Math.min(pasted.length, 5)]?.focus();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
            if (screen === 'login') {
                const session = await login(email.trim(), password);
                onAuthSuccess(session);
            } else {
                if (!name || !company) { setError('Name and Company Name are required.'); return; }
                const result = await signup({ name: name.trim(), email: email.trim(), password, companyName: company.trim() });

                if (result.session) {
                    // Email confirmation is disabled in Supabase, auto-login
                    onAuthSuccess(result.session);
                } else {
                    setPendingEmail(result.email);
                    setScreen('otp');
                }
            }
        } catch (err: any) {
            setError(err.message || 'Authentication failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async () => {
        const token = otpDigits.join('');
        if (token.length < 6) { setError('Please enter the 6-digit code.'); return; }
        setError(null);
        setLoading(true);
        try {
            const session = await verifyEmailOtp(pendingEmail, token);
            onAuthSuccess(session);
        } catch (err: any) {
            setError(err.message || 'Invalid code. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleSignIn = async () => {
        setError(null);
        setOauthLoading(true);
        try {
            await signInWithGoogle();
        } catch (err: any) {
            setError(err.message || 'Google sign-in failed.');
            setOauthLoading(false);
        }
    };

    const switchScreen = (to: Screen) => { setScreen(to); setError(null); };

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 relative overflow-hidden">
            <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-purple-600/20 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-cyan-600/20 rounded-full blur-[120px] pointer-events-none" />

            <div className="absolute top-8 left-8 z-10">
                <button onClick={screen === 'otp' ? () => switchScreen('signup') : onBack} className="text-slate-400 hover:text-white flex items-center gap-2 transition-colors">
                    <ArrowLeft className="w-5 h-5" /> {screen === 'otp' ? 'Back' : 'Back'}
                </button>
            </div>

            <div className="max-w-md w-full bg-slate-900/80 backdrop-blur-xl p-8 rounded-3xl border border-white/10 shadow-2xl relative z-10">

                {/* ─── OTP Verification Screen ─── */}
                {screen === 'otp' && (
                    <>
                        <div className="text-center mb-8">
                            <h2 className="text-2xl sm:text-[28px] font-bold text-white mb-3 tracking-tight">Verify Email</h2>
                            <p className="text-slate-400 mt-2 text-[15px] leading-relaxed">
                                We've sent a 6-digit code to<br />
                                <span className="text-slate-300 font-semibold">{pendingEmail || 'tilak.vedanco@gmail.com'}</span>. Please enter it below<br />
                                to verify your account.
                            </p>
                        </div>

                        {error && (
                            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-xl flex items-start gap-2 text-red-200 text-sm">
                                <XCircle className="w-4 h-4 mt-0.5 shrink-0" /><span>{error}</span>
                            </div>
                        )}

                        <div className="mb-4">
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest block mb-2 text-left">
                                6-Digit Verification Code
                            </label>

                            {/* OTP Boxes inside single container */}
                            <div className="flex justify-between items-center bg-[#0F172A]/80 border border-slate-700/60 rounded-xl px-4 py-2" onPaste={handleOtpPaste}>
                                {otpDigits.map((digit, i) => (
                                    <input
                                        key={i}
                                        ref={el => { otpRefs.current[i] = el; }}
                                        type="text"
                                        inputMode="numeric"
                                        maxLength={1}
                                        value={digit}
                                        onChange={e => handleOtpChange(i, e.target.value)}
                                        onKeyDown={e => handleOtpKeyDown(i, e)}
                                        className="w-10 h-12 text-center text-2xl font-bold bg-transparent text-white outline-none transition-all placeholder-slate-600 focus:text-white"
                                        placeholder="0"
                                    />
                                ))}
                            </div>
                        </div>

                        <p className="text-center text-[12px] text-slate-500 mb-6">Check your email for a 6-digit code.</p>

                        <button
                            id="verify-otp-btn"
                            onClick={handleVerifyOtp}
                            disabled={loading || otpDigits.join('').length < 6}
                            className="w-full py-3.5 bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-cyan-500/20 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {loading && <Loader className="w-4 h-4 animate-spin" />}
                            Verify & Continue
                        </button>

                        <div className="mt-8 text-center text-[14px] text-slate-400">
                            {resendTimer > 0 ? (
                                <span>Resend code in <span className="text-white font-bold">{resendTimer}s</span></span>
                            ) : (
                                <button
                                    onClick={async () => {
                                        try {
                                            await resendOtp(pendingEmail);
                                            setResendTimer(60);
                                        } catch (err: any) {
                                            setError(err.message);
                                        }
                                    }}
                                    className="text-white font-semibold hover:text-slate-200 transition-colors"
                                >
                                    Resend code
                                </button>
                            )}
                        </div>

                        <div className="mt-4 text-center text-[14px] text-slate-500">
                            Wrong email?{' '}
                            <button onClick={() => switchScreen('signup')} className="text-slate-300 font-semibold hover:text-white transition-colors">Change email</button>
                        </div>
                    </>
                )}

                {/* ─── Login / Signup Screen ─── */}
                {screen !== 'otp' && (
                    <>
                        <div className="text-center mb-8">
                            <h2 className="text-2xl font-bold text-white">
                                {screen === 'login' ? 'Welcome back' : 'Create an account'}
                            </h2>
                            <p className="text-slate-400 mt-2 text-sm">
                                {screen === 'login' ? 'Sign in to your workspace' : 'Start automating your sales today'}
                            </p>
                        </div>

                        {error && (
                            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-xl flex items-start gap-2 text-red-200 text-sm">
                                <XCircle className="w-4 h-4 mt-0.5 shrink-0" /><span>{error}</span>
                            </div>
                        )}

                        {/* Google Button */}
                        <button id="google-signin-btn" onClick={handleGoogleSignIn} disabled={oauthLoading || loading}
                            className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-slate-700 hover:border-slate-500 rounded-xl bg-slate-800 hover:bg-slate-750 text-white transition-all mb-6 disabled:opacity-60 disabled:cursor-not-allowed">
                            {oauthLoading ? <Loader className="w-5 h-5 animate-spin" /> : (
                                <svg className="w-5 h-5" viewBox="0 0 24 24">
                                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                </svg>
                            )}
                            Continue with Google
                        </button>

                        <div className="relative mb-6">
                            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-800" /></div>
                            <div className="relative flex justify-center text-xs">
                                <span className="px-3 bg-slate-900/80 text-slate-500">or continue with email</span>
                            </div>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            {screen === 'signup' && (
                                <>
                                    <div>
                                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Full Name</label>
                                        <input id="signup-name" type="text" value={name} onChange={e => setName(e.target.value)}
                                            className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white placeholder-slate-500 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition-all"
                                            placeholder="John Doe" required />
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Company Name</label>
                                        <input id="signup-company" type="text" value={company} onChange={e => setCompany(e.target.value)}
                                            className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white placeholder-slate-500 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition-all"
                                            placeholder="Acme Inc." required />
                                    </div>
                                </>
                            )}
                            <div>
                                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Email</label>
                                <input id="auth-email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white placeholder-slate-500 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition-all"
                                    placeholder="you@company.com" required />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Password</label>
                                <input id="auth-password" type="password" value={password} onChange={e => setPassword(e.target.value)}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white placeholder-slate-500 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition-all"
                                    placeholder="••••••••" minLength={6} required />
                            </div>
                            <button id="auth-submit-btn" type="submit" disabled={loading || oauthLoading}
                                className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-cyan-500/20 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                                {loading && <Loader className="w-4 h-4 animate-spin" />}
                                {screen === 'login' ? 'Sign In' : 'Create Account'}
                            </button>
                        </form>

                        <p className="mt-6 text-center text-sm text-slate-500">
                            {screen === 'login' ? (
                                <>Don't have an account?{' '}<button onClick={() => switchScreen('signup')} className="text-cyan-400 hover:text-cyan-300 font-medium">Sign up</button></>
                            ) : (
                                <>Already have an account?{' '}<button onClick={() => switchScreen('login')} className="text-cyan-400 hover:text-cyan-300 font-medium">Log in</button></>
                            )}
                        </p>
                    </>
                )}
            </div>
        </div>
    );
};
