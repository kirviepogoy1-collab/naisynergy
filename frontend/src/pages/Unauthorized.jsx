import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';

export default function Unauthorized() {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-brand-50 text-center px-4">
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-5">
                <ShieldAlert className="w-8 h-8 text-red-600" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-brand-900 mb-2">Access Denied</h1>
            <p className="text-gray-600 mb-6 max-w-sm">You don't have permission to view this page.</p>
            <Link
                to="/login"
                className="bg-brand-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-brand-700 active:bg-brand-800 transition min-h-[44px] flex items-center"
            >
                Back to Login
            </Link>
        </div>
    );
}
