import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(() => {
        const stored = localStorage.getItem('nai_user');
        return stored ? JSON.parse(stored) : null;
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // Keep localStorage in sync if user changes
        if (user) localStorage.setItem('nai_user', JSON.stringify(user));
        else localStorage.removeItem('nai_user');
    }, [user]);

    async function login(identifier, password) {
        setLoading(true);
        try {
            const { data } = await api.post('/auth/login', { identifier, password });

            if (data.requires2fa) {
                // Not logged in yet - the caller needs to collect a 6-digit code
                // and call verifyTwoFactor() with this pendingToken to finish.
                return { success: false, requires2fa: true, pendingToken: data.pendingToken };
            }

            localStorage.setItem('nai_token', data.token);
            setUser(data.user);
            return { success: true, user: data.user };
        } catch (err) {
            return { success: false, error: err.response?.data?.error || 'Login failed.' };
        } finally {
            setLoading(false);
        }
    }

    async function verifyTwoFactor(pendingToken, token) {
        setLoading(true);
        try {
            const { data } = await api.post('/auth/verify-2fa', { pendingToken, token });
            localStorage.setItem('nai_token', data.token);
            setUser(data.user);
            return { success: true, user: data.user };
        } catch (err) {
            return { success: false, error: err.response?.data?.error || 'Incorrect code.' };
        } finally {
            setLoading(false);
        }
    }

    async function logout() {
        try {
            await api.post('/auth/logout');
        } catch (e) {
            // ignore network errors on logout
        }
        localStorage.removeItem('nai_token');
        localStorage.removeItem('nai_user');
        setUser(null);
    }

    return (
        <AuthContext.Provider value={{ user, setUser, login, verifyTwoFactor, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
