import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import api from '../api/axios';
import useDebouncedValue, { useLatestSignal, isCanceled } from '../hooks/useDebouncedValue';

// Header search for the inventory pages: finds assets by name or code and jumps
// to the room that holds them. Same request rules as every other search box:
// waits 0.5s after typing stops, needs 2+ letters, cancels the previous request.
export default function InventorySearch() {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState(null);
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const debounced = useDebouncedValue(query);
    const nextSignal = useLatestSignal();
    const wrapperRef = useRef(null);
    const navigate = useNavigate();

    useEffect(() => {
        if (!debounced) { setResults(null); setLoading(false); return; }
        setLoading(true);
        api.get('/inventory/quick-search', { params: { q: debounced }, signal: nextSignal() })
            .then((res) => { setResults(res.data); setLoading(false); })
            .catch((err) => { if (!isCanceled(err)) { setResults([]); setLoading(false); } });
    }, [debounced]);

    useEffect(() => {
        function onClickOutside(e) {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
        }
        document.addEventListener('mousedown', onClickOutside);
        return () => document.removeEventListener('mousedown', onClickOutside);
    }, []);

    function goTo(item) {
        setOpen(false);
        setQuery('');
        setResults(null);
        navigate(`/inventory/rooms/${item.room_code}?search=${encodeURIComponent(item.asset_code)}`);
    }

    const showPanel = open && query.trim().length >= 2;

    return (
        <div className="relative flex-1 max-w-sm" ref={wrapperRef}>
            <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                    value={query}
                    onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
                    onFocus={() => setOpen(true)}
                    placeholder="Search asset name or code..."
                    className="w-full pl-9 pr-8 py-2 rounded-full bg-white/70 focus:bg-white text-sm shadow-sm outline-none focus:ring-2 focus:ring-brand-300 transition"
                />
                {query && (
                    <button onClick={() => { setQuery(''); setResults(null); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" aria-label="Clear search">
                        <X className="w-4 h-4" />
                    </button>
                )}
            </div>

            {showPanel && (
                <div className="absolute left-0 mt-2 w-full min-w-[20rem] bg-white rounded-2xl shadow-xl border border-gray-100 z-40 overflow-hidden max-h-96 overflow-y-auto">
                    {(loading || query.trim() !== debounced) && <p className="text-sm text-gray-400 text-center py-6">Searching...</p>}
                    {!loading && query.trim() === debounced && results && results.length === 0 && (
                        <p className="text-sm text-gray-400 text-center py-6">No assets match "{query}".</p>
                    )}
                    {!loading && query.trim() === debounced && results?.map((item) => (
                        <button key={item.id} onClick={() => goTo(item)} className="w-full text-left px-4 py-2 hover:bg-gray-50 transition">
                            <p className="text-sm font-medium text-gray-800">{item.asset_name} <span className="text-xs text-gray-400">{item.asset_code}</span></p>
                            <p className="text-xs text-gray-400">{item.room_name} - {item.building}</p>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
