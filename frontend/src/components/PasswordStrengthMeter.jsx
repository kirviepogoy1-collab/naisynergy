import React from 'react';
import { getPasswordStrength } from '../utils/passwordStrength';

const BAR_COLOR = {
    Poor: 'bg-red-500',
    Medium: 'bg-amber-500',
    Strong: 'bg-green-600'
};

const TEXT_COLOR = {
    Poor: 'text-red-600',
    Medium: 'text-amber-600',
    Strong: 'text-green-700'
};

export default function PasswordStrengthMeter({ password }) {
    if (!password) return null;

    const { score, label } = getPasswordStrength(password);
    const pct = Math.min(100, (score / 5) * 100);

    return (
        <div className="mt-1.5">
            <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-gray-200 overflow-hidden">
                    <div className={`h-full ${BAR_COLOR[label]} transition-all`} style={{ width: `${pct}%` }} />
                </div>
                <span className={`text-xs font-semibold ${TEXT_COLOR[label]} whitespace-nowrap`}>{label}</span>
            </div>
            <p className="text-[11px] text-gray-400 mt-1">
                Use 8+ characters with uppercase, lowercase, a number, and a symbol.
            </p>
        </div>
    );
}
