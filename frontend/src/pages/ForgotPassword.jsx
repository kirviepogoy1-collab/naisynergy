import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { useSettings } from '../context/SettingsContext';

export default function ForgotPassword() {
    const [email, setEmail] = useState('');
    const [sent, setSent] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const { settings } = useSettings();

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await api.post('/auth/forgot-password', { email });
            // Always show the same success state, whether or not the email
            // matched an account - the backend deliberately doesn't reveal that.
            setSent(true);
        } catch (err) {
            setError(err.response?.data?.error || 'Something went wrong. Please try again.');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div
            className="min-h-screen flex items-center justify-center px-4 bg-cover bg-center"
            style={{ backgroundImage: "url('/school.jpg')" }}
        >
            <div className="bg-white/70 backdrop-blur-lg p-8 sm:p-10 rounded-3xl shadow-2xl w-full max-w-sm">
                <div className="flex justify-center mb-4">
                    <img src={settings.logo_url} alt="School Logo" className="w-24 h-24 object-contain" />
                </div>

                <h2 className="text-2xl font-extrabold mb-2 text-center text-brand-700">Forgot Password</h2>

                {!sent ? (
                    <>
                        <p className="text-sm text-brand-800 text-center mb-6">
                            Enter the email you used for your account. We'll send you a link to reset your password.
                        </p>

                        {error && <p className="text-red-600 mb-4 text-center text-sm">{error}</p>}

                        <form onSubmit={handleSubmit}>
                            <div className="mb-6">
                                <label className="block text-sm font-medium text-brand-800 mb-1">Email</label>
                                <input
                                    type="email"
                                    placeholder="Enter your email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    autoFocus
                                    className="w-full p-3 rounded-lg bg-white/90 focus:outline-none focus:ring-2 focus:ring-brand-500"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-white/90 hover:bg-white text-brand-700 py-3 rounded-lg font-bold transition disabled:opacity-60 min-h-[44px]"
                            >
                                {loading ? 'Sending...' : 'Send Reset Link'}
                            </button>
                        </form>
                    </>
                ) : (
                    <p className="text-sm text-brand-800 text-center mb-2">
                        If an account exists with that email, we've sent a link to reset your password.
                        It's valid for 1 hour. Check your inbox (and spam folder).
                    </p>
                )}

                <Link to="/login" className="block text-center text-sm text-brand-800 mt-6 hover:underline">
                    ← Back to login
                </Link>
            </div>
        </div>
    );
}
