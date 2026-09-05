import React from 'react';
import { useSettings } from '../context/SettingsContext';

export default function Maintenance() {
    const { settings } = useSettings();

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
            <div className="max-w-md w-full text-center">
                <img src={settings.logo_url || '/logo.png'} alt="" className="w-20 h-20 object-contain mx-auto mb-6" />

                <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-brand-50 flex items-center justify-center">
                    <i className="fa-solid fa-screwdriver-wrench text-2xl text-brand-700"></i>
                </div>

                <h1 className="font-display text-2xl sm:text-3xl font-semibold text-brand-800">
                    We'll be right back
                </h1>
                <p className="mt-4 text-gray-600 leading-7">
                    {settings.maintenance_message || "We're currently making some improvements. Please check back shortly."}
                </p>

                <p className="mt-10 text-xs text-gray-400">
                    Staff access: <a href="/login" className="text-brand-700 hover:underline">Sign in</a>
                </p>
            </div>
        </div>
    );
}
