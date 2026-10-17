import React from 'react';
import { Search, X } from 'lucide-react';

// Header search box that belongs to ONE page: the page owns the text and filters
// its own list with it (no backend request). Passed to <Layout pageSearch={...}>.
export default function PageSearch({ value, onChange, placeholder = 'Search...' }) {
    return (
        <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="w-full pl-9 pr-8 py-2 rounded-full bg-white/70 focus:bg-white text-sm shadow-sm outline-none focus:ring-2 focus:ring-brand-300 transition"
            />
            {value && (
                <button onClick={() => onChange('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" aria-label="Clear search">
                    <X className="w-4 h-4" />
                </button>
            )}
        </div>
    );
}
