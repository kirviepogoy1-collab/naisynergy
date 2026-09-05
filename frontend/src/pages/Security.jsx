import React, { useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import { ShieldCheck, ShieldOff, KeyRound } from 'lucide-react';
import Layout from '../components/Layout';
import api from '../api/axios';
import PasswordInput from '../components/PasswordInput';
import { getPasswordStrength } from '../utils/passwordStrength';

export default function Security() {
    const [enabled, setEnabled] = useState(null); // null while loading
    const [setupData, setSetupData] = useState(null); // { qrCode, secret } while mid-setup
    const [code, setCode] = useState('');
    const [busy, setBusy] = useState(false);

    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [pwBusy, setPwBusy] = useState(false);

    async function loadStatus() {
        const { data } = await api.get('/2fa/status');
        setEnabled(data.enabled);
    }

    useEffect(() => { loadStatus(); }, []);

    async function handleChangePassword(e) {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            Swal.fire('Error', "New password and confirmation don't match.", 'error');
            return;
        }
        if (newPassword.length < 8) {
            Swal.fire('Error', 'New password must be at least 8 characters.', 'error');
            return;
        }
        if (getPasswordStrength(newPassword).label !== 'Strong') {
            Swal.fire('Error', 'New password must include an uppercase letter, a lowercase letter, a number, and a symbol.', 'error');
            return;
        }
        setPwBusy(true);
        try {
            await api.put('/auth/change-password', { current_password: currentPassword, new_password: newPassword });
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            Swal.fire('Success', 'Your password has been changed.', 'success');
        } catch (err) {
            Swal.fire('Error', err.response?.data?.error || 'Failed to change password.', 'error');
        } finally {
            setPwBusy(false);
        }
    }

    async function handleStartSetup() {
        setBusy(true);
        try {
            const { data } = await api.post('/2fa/setup');
            setSetupData(data);
            setCode('');
        } catch (err) {
            Swal.fire('Error', err.response?.data?.error || 'Failed to start setup.', 'error');
        } finally {
            setBusy(false);
        }
    }

    async function handleConfirmEnable(e) {
        e.preventDefault();
        setBusy(true);
        try {
            await api.post('/2fa/enable', { token: code });
            setSetupData(null);
            setCode('');
            await loadStatus();
            Swal.fire('Enabled', 'Two-factor authentication is now on for your account.', 'success');
        } catch (err) {
            Swal.fire('Error', err.response?.data?.error || 'Incorrect code.', 'error');
        } finally {
            setBusy(false);
        }
    }

    async function handleDisable() {
        const { value: token, isConfirmed } = await Swal.fire({
            title: 'Disable two-factor authentication?',
            input: 'text',
            inputLabel: 'Enter your current 6-digit code to confirm',
            inputPlaceholder: '123456',
            showCancelButton: true,
            confirmButtonText: 'Disable',
            confirmButtonColor: '#ef4444'
        });
        if (!isConfirmed || !token) return;

        try {
            await api.post('/2fa/disable', { token });
            await loadStatus();
            Swal.fire('Disabled', 'Two-factor authentication has been turned off.', 'success');
        } catch (err) {
            Swal.fire('Error', err.response?.data?.error || 'Incorrect code.', 'error');
        }
    }

    return (
        <Layout title="Security">
            <div className="max-w-xl space-y-6">
                <div className="bg-white rounded-2xl shadow p-4 sm:p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <KeyRound className="w-8 h-8 text-brand-600" />
                        <div>
                            <h2 className="font-bold text-brand-800">Change Password</h2>
                            <p className="text-sm text-gray-500">Update the password you use to log in.</p>
                        </div>
                    </div>

                    <form onSubmit={handleChangePassword} className="space-y-3">
                        <div>
                            <label className="text-sm font-medium text-gray-700">Current Password</label>
                            <PasswordInput
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                required
                                inputClassName="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-brand-400"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-gray-700">New Password</label>
                            <PasswordInput
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                required
                                minLength={8}
                                showStrength
                                inputClassName="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-brand-400"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-gray-700">Confirm New Password</label>
                            <PasswordInput
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                minLength={8}
                                inputClassName="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-brand-400"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={pwBusy}
                            className="w-full bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold py-2.5 rounded-lg disabled:opacity-50"
                        >
                            {pwBusy ? 'Changing...' : 'Change Password'}
                        </button>
                    </form>
                </div>

                <div className="bg-white rounded-2xl shadow p-4 sm:p-6">
                <div className="flex items-center gap-3 mb-2">
                    {enabled ? (
                        <ShieldCheck className="w-8 h-8 text-green-600" />
                    ) : (
                        <ShieldOff className="w-8 h-8 text-gray-400" />
                    )}
                    <div>
                        <h2 className="font-bold text-brand-800">Two-Factor Authentication</h2>
                        <p className="text-sm text-gray-500">
                            Adds a 6-digit code from an authenticator app on top of your password.
                        </p>
                    </div>
                </div>

                {enabled === null && <p className="text-sm text-gray-400 mt-4">Loading...</p>}

                {enabled === true && (
                    <div className="mt-4">
                        <p className="text-sm text-green-700 bg-green-50 rounded-lg px-4 py-3 mb-4">
                            Two-factor authentication is currently <strong>ON</strong> for your account.
                        </p>
                        <button
                            onClick={handleDisable}
                            className="bg-red-500 hover:bg-red-600 text-white text-sm font-semibold px-4 py-2 rounded-lg"
                        >
                            Turn Off
                        </button>
                    </div>
                )}

                {enabled === false && !setupData && (
                    <div className="mt-4">
                        <p className="text-sm text-gray-500 bg-gray-50 rounded-lg px-4 py-3 mb-4">
                            Two-factor authentication is currently <strong>off</strong>. Turning it on means
                            you'll need a code from an app like Google Authenticator or Authy every time you
                            log in, in addition to your password.
                        </p>
                        <button
                            onClick={handleStartSetup}
                            disabled={busy}
                            className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50"
                        >
                            Set Up Two-Factor Authentication
                        </button>
                    </div>
                )}

                {setupData && (
                    <div className="mt-4 border-t pt-4">
                        <p className="text-sm text-gray-600 mb-3">
                            1. Scan this QR code with Google Authenticator, Authy, or any TOTP app:
                        </p>
                        <img src={setupData.qrCode} alt="2FA QR code" className="w-48 h-48 mx-auto mb-3 border rounded-lg" />
                        <p className="text-xs text-gray-400 text-center mb-4">
                            Can't scan? Enter this code manually: <span className="font-mono">{setupData.secret}</span>
                        </p>

                        <form onSubmit={handleConfirmEnable} className="flex flex-col gap-3">
                            <label className="text-sm text-gray-600">
                                2. Enter the 6-digit code the app shows now, to confirm setup:
                            </label>
                            <input
                                value={code}
                                onChange={(e) => setCode(e.target.value)}
                                placeholder="123456"
                                maxLength={6}
                                className="p-2 border rounded-lg text-center tracking-widest text-lg"
                            />
                            <div className="flex gap-2">
                                <button
                                    type="submit"
                                    disabled={busy || code.length !== 6}
                                    className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50"
                                >
                                    Confirm & Enable
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSetupData(null)}
                                    className="text-sm text-gray-500 px-4 py-2"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                )}
                </div>
            </div>
        </Layout>
    );
}
