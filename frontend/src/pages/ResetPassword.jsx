import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import api from '../api/axios';
import { useSettings } from '../context/SettingsContext';
import PasswordInput from '../components/PasswordInput';
import { getPasswordStrength } from '../utils/passwordStrength';

export default function ResetPassword() {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token') || '';
    const navigate = useNavigate();
    const { settings } = useSettings();

    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [done, setDone] = useState(false);

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');
        if (newPassword !== confirmPassword) {
            setError("New password and confirmation don't match.");
            return;
        }
        if (newPassword.length < 8) {
            setError('Password must be at least 8 characters.');
            return;
        }
        if (getPasswordStrength(newPassword).label !== 'Strong') {
            setError('Password must include an uppercase letter, a lowercase letter, a number, and a symbol.');
            return;
        }
        setLoading(true);
        try {
            await api.post('/auth/reset-password', { token, new_password: newPassword });
            setDone(true);
            setTimeout(() => navigate('/login'), 2500);
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

                <h2 className="text-2xl font-extrabold mb-2 text-center text-brand-700">Reset Password</h2>

                {!token ? (
                    <p className="text-sm text-red-600 text-center mb-2">
                        This link is missing its reset code. Please use the link from your email, or request a new one.
                    </p>
                ) : done ? (
                    <p className="text-sm text-green-700 text-center mb-2">
                        Your password has been reset. Redirecting you to login...
                    </p>
                ) : (
                    <>
                        <p className="text-sm text-brand-800 text-center mb-6">Choose a new password for your account.</p>

                        {error && <p className="text-red-600 mb-4 text-center text-sm">{error}</p>}

                        <form onSubmit={handleSubmit}>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-brand-800 mb-1">New Password</label>
                                <PasswordInput
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    required
                                    minLength={8}
                                    autoFocus
                                    showStrength
                                    inputClassName="w-full p-3 rounded-lg bg-white/90 focus:outline-none focus:ring-2 focus:ring-brand-500"
                                />
                            </div>

                            <div className="mb-6">
                                <label className="block text-sm font-medium text-brand-800 mb-1">Confirm New Password</label>
                                <PasswordInput
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                    minLength={8}
                                    inputClassName="w-full p-3 rounded-lg bg-white/90 focus:outline-none focus:ring-2 focus:ring-brand-500"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-white/90 hover:bg-white text-brand-700 py-3 rounded-lg font-bold transition disabled:opacity-60 min-h-[44px]"
                            >
                                {loading ? 'Resetting...' : 'Reset Password'}
                            </button>
                        </form>
                    </>
                )}

                <Link to="/login" className="block text-center text-sm text-brand-800 mt-6 hover:underline">
                    ← Back to login
                </Link>
            </div>
        </div>
    );
}
