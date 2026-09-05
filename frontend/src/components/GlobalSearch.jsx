import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import api from '../api/axios';

let debounceTimer = null;

export default function GlobalSearch() {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState(null);
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const wrapperRef = useRef(null);
    const navigate = useNavigate();

    const runSearch = useCallback((q) => {
        clearTimeout(debounceTimer);
        if (q.trim().length < 2) {
            setResults(null);
            return;
        }
        debounceTimer = setTimeout(async () => {
            setLoading(true);
            try {
                const { data } = await api.get('/search', { params: { q } });
                setResults(data);
            } catch (err) {
                setResults(null);
            } finally {
                setLoading(false);
            }
        }, 300);
    }, []);

    useEffect(() => {
        function handleClickOutside(e) {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    function goTo(path) {
        setOpen(false);
        setQuery('');
        setResults(null);
        navigate(path);
    }

    const hasResults = results && (results.employees.length || results.documents.length || results.leaves.length);

    return (
        <div className="relative flex-1 max-w-sm" ref={wrapperRef}>
            <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                    value={query}
                    onChange={(e) => { setQuery(e.target.value); runSearch(e.target.value); setOpen(true); }}
                    onFocus={() => setOpen(true)}
                    placeholder="Search employees, documents, leaves..."
                    className="w-full pl-9 pr-8 py-2 rounded-full bg-white/70 focus:bg-white text-sm shadow-sm outline-none focus:ring-2 focus:ring-brand-300 transition"
                />
                {query && (
                    <button
                        onClick={() => { setQuery(''); setResults(null); }}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        aria-label="Clear search"
                    >
                        <X className="w-4 h-4" />
                    </button>
                )}
            </div>

            {open && query.trim().length >= 2 && (
                <div className="absolute left-0 mt-2 w-full min-w-[20rem] bg-white rounded-2xl shadow-xl border border-gray-100 z-40 overflow-hidden max-h-96 overflow-y-auto">
                    {loading && <p className="text-sm text-gray-400 text-center py-6">Searching...</p>}

                    {!loading && !hasResults && (
                        <p className="text-sm text-gray-400 text-center py-6">No results for "{query}".</p>
                    )}

                    {!loading && results?.employees?.length > 0 && (
                        <div>
                            <p className="px-4 pt-3 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">Employees</p>
                            {results.employees.map((e) => (
                                <button key={e.id} onClick={() => goTo(`/hr/employees?employee=${e.id}`)} className="w-full text-left px-4 py-2 hover:bg-gray-50 transition">
                                    <p className="text-sm font-medium text-gray-800">{e.name}</p>
                                    <p className="text-xs text-gray-400">{e.current_position || e.email}</p>
                                </button>
                            ))}
                        </div>
                    )}

                    {!loading && results?.documents?.length > 0 && (
                        <div>
                            <p className="px-4 pt-3 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">Documents</p>
                            {results.documents.map((d) => (
                                <button key={d.id} onClick={() => goTo(`/hr/employees?employee=${d.user_id}`)} className="w-full text-left px-4 py-2 hover:bg-gray-50 transition">
                                    <p className="text-sm font-medium text-gray-800">{d.document_type}</p>
                                    <p className="text-xs text-gray-400">{d.employee_name} - {d.status}</p>
                                </button>
                            ))}
                        </div>
                    )}

                    {!loading && results?.leaves?.length > 0 && (
                        <div>
                            <p className="px-4 pt-3 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">Leave Requests</p>
                            {results.leaves.map((l) => (
                                <button key={l.id} onClick={() => goTo('/hr/leaves')} className="w-full text-left px-4 py-2 hover:bg-gray-50 transition">
                                    <p className="text-sm font-medium text-gray-800">{l.employee_name} - {l.leave_type}</p>
                                    <p className="text-xs text-gray-400">{l.start_date} to {l.end_date} - {l.status}</p>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
