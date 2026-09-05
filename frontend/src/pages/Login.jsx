import React, { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, ShieldCheck, AlertCircle, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { HOME_BY_ROLE } from '../utils/homeRoutes';
import PasswordInput from '../components/PasswordInput';
import CaptchaInput from '../components/CaptchaInput';

const fieldClass =
    'w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 transition';

function ErrorBanner({ children }) {
    if (!children) return null;
    return (
        <div className="mb-5 flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{children}</span>
        </div>
    );
}

export default function Login() {
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [captchaValue, setCaptchaValue] = useState('');
    const captchaRef = useRef(null);

    // Set once the password step succeeds for an account with 2FA on -
    // presence of this means we're showing the code-entry step instead.
    const [pendingToken, setPendingToken] = useState(null);
    const [code, setCode] = useState('');

    const { login, verifyTwoFactor, loading } = useAuth();
    const { settings } = useSettings();
    const navigate = useNavigate();

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');
        if (!captchaRef.current.isValid()) {
            setError("The code you entered doesn't match. Please try again.");
            captchaRef.current.refresh();
            return;
        }
        const result = await login(identifier, password);
        if (result.success) {
            navigate(HOME_BY_ROLE[result.user.role] || '/login');
        } else if (result.requires2fa) {
            setPendingToken(result.pendingToken);
        } else {
            setError(result.error);
            captchaRef.current.refresh();
        }
    }

    async function handleVerifyCode(e) {
        e.preventDefault();
        setError('');
        const result = await verifyTwoFactor(pendingToken, code);
        if (result.success) {
            navigate(HOME_BY_ROLE[result.user.role] || '/login');
        } else {
            setError(result.error);
        }
    }

    return (
        <div className="min-h-screen grid md:grid-cols-2 bg-white">
            {/* Brand panel - full photo on desktop, compact banner on mobile */}
            <div
                className="relative h-48 sm:h-64 md:h-auto bg-cover bg-center"
                style={{ backgroundImage: "url('/school.jpg')" }}
            >
                <div className="absolute inset-0 bg-gradient-to-br from-brand-900/95 via-brand-800/85 to-brand-600/70" />
                <div
                    className="absolute inset-0 opacity-[0.15]"
                    style={{
                        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)',
                        backgroundSize: '18px 18px'
                    }}
                />
                <div className="relative h-full flex flex-col justify-between p-6 sm:p-8 md:p-12 text-white">
                    <div className="flex items-center gap-3">
                        <img
                            src={settings.logo_url}
                            alt="School Logo"
                            className="w-10 h-10 md:w-11 md:h-11 object-contain bg-white rounded-full p-1.5 shadow-sm"
                        />
                        <span className="font-semibold tracking-wide text-sm md:text-base">{settings.school_name}</span>
                    </div>

                    <div className="hidden md:block max-w-md">
                        <span className="inline-block h-1 w-10 rounded-full bg-white/60 mb-5" />
                        <h1 className="font-display text-4xl lg:text-[3.25rem] leading-[1.1] mb-4">
                            Welcome back.
                        </h1>
                        <p className="text-white/80 text-base leading-relaxed">
                            Scheduling, inventory, and records — one system for the whole school.
                        </p>
                    </div>

                    <p className="hidden md:block text-xs text-white/50">
                        &copy; {new Date().getFullYear()} {settings.school_name}
                    </p>
                </div>
            </div>

            {/* Form panel */}
            <div className="flex items-center justify-center px-5 py-10 sm:px-10">
                <div className="w-full max-w-sm">
                    {!pendingToken ? (
                        <form onSubmit={handleSubmit}>
                            <h2 className="font-display text-2xl sm:text-3xl text-gray-900 mb-1">Sign in</h2>
                            <p className="text-sm text-gray-500 mb-7">Enter your credentials to continue.</p>

                            <ErrorBanner>{error}</ErrorBanner>

                            <div className="mb-4">
                                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">
                                    Email
                                </label>
                                <div className="relative">
                                    <Mail className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
                                    <input
                                        type="text"
                                        placeholder="Enter your email"
                                        value={identifier}
                                        onChange={(e) => setIdentifier(e.target.value)}
                                        required
                                        autoComplete="username"
                                        className={fieldClass}
                                    />
                                </div>
                            </div>

                            <div className="mb-2">
                                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">
                                    Password
                                </label>
                                <div className="relative">
                                    <Lock className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2 z-10" />
                                    <PasswordInput
                                        placeholder="Enter your password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        autoComplete="current-password"
                                        inputClassName={fieldClass}
                                    />
                                </div>
                            </div>

                            <div className="mb-6 text-right">
                                <Link to="/forgot-password" className="text-sm font-medium text-brand-700 hover:text-brand-800 hover:underline">
                                    Forgot password?
                                </Link>
                            </div>

                            <CaptchaInput ref={captchaRef} value={captchaValue} onChange={setCaptchaValue} />

                            <button
                                type="submit"
                                disabled={loading || !captchaValue}
                                className="group w-full inline-flex items-center justify-center gap-2 bg-brand-700 hover:bg-brand-800 text-white py-3.5 rounded-xl font-semibold shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
                            >
                                {loading ? 'Signing in...' : 'Sign in'}
                                {!loading && <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />}
                            </button>
                        </form>
                    ) : (
                        <form onSubmit={handleVerifyCode}>
                            <div className="w-11 h-11 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center mb-4">
                                <ShieldCheck className="w-5 h-5" />
                            </div>
                            <h2 className="font-display text-2xl sm:text-3xl text-gray-900 mb-1">Two-factor code</h2>
                            <p className="text-sm text-gray-500 mb-7">
                                Enter the 6-digit code from your authenticator app.
                            </p>

                            <ErrorBanner>{error}</ErrorBanner>

                            <div className="mb-6">
                                <input
                                    type="text"
                                    placeholder="123456"
                                    value={code}
                                    onChange={(e) => setCode(e.target.value)}
                                    maxLength={6}
                                    required
                                    autoFocus
                                    className="w-full p-3 rounded-xl border border-gray-200 focus:outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 text-center text-2xl tracking-[0.5em] transition"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading || code.length !== 6}
                                className="w-full bg-brand-700 hover:bg-brand-800 text-white py-3.5 rounded-xl font-semibold shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
                            >
                                {loading ? 'Verifying...' : 'Verify & sign in'}
                            </button>

                            <button
                                type="button"
                                onClick={() => { setPendingToken(null); setCode(''); setError(''); }}
                                className="w-full text-sm font-medium text-brand-700 hover:text-brand-800 mt-4"
                            >
                                ← Back to login
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
