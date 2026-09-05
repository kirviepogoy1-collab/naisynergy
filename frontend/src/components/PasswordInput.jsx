import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import PasswordStrengthMeter from './PasswordStrengthMeter';

// Drop-in replacement for <input type="password">. Every field gets its own
// eye toggle (rather than one shared toggle for a whole form), so showing
// your new password doesn't also expose your current one, for example.
export default function PasswordInput({ value, onChange, inputClassName = '', showStrength = false, ...props }) {
    const [visible, setVisible] = useState(false);

    return (
        <div>
            <div className="relative">
                <input
                    type={visible ? 'text' : 'password'}
                    value={value}
                    onChange={onChange}
                    className={`pr-11 ${inputClassName}`}
                    {...props}
                />
                <button
                    type="button"
                    onClick={() => setVisible((v) => !v)}
                    tabIndex={-1}
                    aria-label={visible ? 'Hide password' : 'Show password'}
                    className="absolute inset-y-0 right-0 w-10 flex items-center justify-center text-gray-400 hover:text-brand-700"
                >
                    {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
            </div>
            {showStrength && <PasswordStrengthMeter password={value} />}
        </div>
    );
}
