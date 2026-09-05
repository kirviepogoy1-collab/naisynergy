import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../api/axios';

const SettingsContext = createContext(null);

// Turns one hex color into the 7-shade scale the app's brand-* Tailwind
// classes expect (50 = near-white tint, 900 = near-black shade), so a
// superadmin only ever has to pick a single color.
function hexToRgb(hex) {
    const m = hex.replace('#', '').match(/.{2}/g);
    return m.map((h) => parseInt(h, 16));
}

function mix([r, g, b], [r2, g2, b2], amount) {
    return [
        Math.round(r + (r2 - r) * amount),
        Math.round(g + (g2 - g) * amount),
        Math.round(b + (b2 - b) * amount)
    ];
}

function buildShades(hex) {
    const base = hexToRgb(hex);
    const white = [255, 255, 255];
    const black = [0, 0, 0];
    return {
        50: mix(base, white, 0.94),
        100: mix(base, white, 0.88),
        400: mix(base, white, 0.18),
        500: base,
        600: mix(base, black, 0.12),
        700: mix(base, black, 0.28),
        900: mix(base, black, 0.55)
    };
}

export function applyColor(hex) {
    if (!hex) return;
    const shades = buildShades(hex);
    const root = document.documentElement.style;
    for (const [key, [r, g, b]] of Object.entries(shades)) {
        root.setProperty(`--brand-${key}`, `${r} ${g} ${b}`);
    }
}

const DEFAULTS = { school_name: 'NAI Synergy', logo_url: '/logo.png', primary_color: '#16a34a', maintenance_mode: false, maintenance_message: '' };

export function SettingsProvider({ children }) {
    const [settings, setSettings] = useState(DEFAULTS);
    const [loaded, setLoaded] = useState(false);

    const refresh = useCallback(async () => {
        try {
            const { data } = await api.get('/settings');
            setSettings(data);
            applyColor(data.primary_color);
            if (data.school_name) document.title = data.school_name;
        } catch (err) {
            // Keep defaults if settings can't be loaded (e.g. offline) - the app
            // should still look right, just un-customized.
        } finally {
            setLoaded(true);
        }
    }, []);

    useEffect(() => { refresh(); }, [refresh]);

    return (
        <SettingsContext.Provider value={{ settings, loaded, refresh }}>
            {children}
        </SettingsContext.Provider>
    );
}

export function useSettings() {
    return useContext(SettingsContext);
}
