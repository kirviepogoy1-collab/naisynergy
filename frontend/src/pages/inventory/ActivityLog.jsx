import React, { useEffect, useRef, useState } from 'react';
import { History, Search } from 'lucide-react';
import Layout from '../../components/Layout';
import Pagination from '../../components/Pagination';
import useDebouncedValue, { useLatestSignal, isCanceled } from '../../hooks/useDebouncedValue';
import api from '../../api/axios';
import { timeAgo } from '../../utils/formatDate';

export default function InventoryActivityLog() {
    const PAGE_SIZE = 15;
    const [activity, setActivity] = useState([]);
    const [search, setSearch] = useState('');
    const debouncedSearch = useDebouncedValue(search);
    const nextSignal = useLatestSignal();
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);

    // Server-side paging and search: only the current page of 15 is sent to the browser.
    // A new search jumps back to page 1; changing the page just loads that page.
    const prevSearch = useRef(debouncedSearch);
    useEffect(() => {
        if (prevSearch.current !== debouncedSearch) {
            prevSearch.current = debouncedSearch;
            if (page !== 1) { setPage(1); return; }
        }
        api.get('/activity', { params: { module: 'inventory', search: debouncedSearch, page, limit: PAGE_SIZE }, signal: nextSignal() })
            .then(({ data }) => {
                setActivity(data.rows);
                setTotal(data.total);
                if (data.page !== page) setPage(data.page);
                setLoading(false);
            })
            .catch((err) => { if (!isCanceled(err)) throw err; });
    }, [debouncedSearch, page]);

    return (
        <Layout hideSearch title="User Activity">
            <div className="bg-white rounded-2xl shadow p-4 sm:p-6 max-w-4xl">
                <div className="flex items-center justify-between mb-4 gap-3">
                    <p className="text-sm text-gray-500">{total} account changes for inventory staff.</p>
                    <div className="relative">
                        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Filter..."
                            className="pl-9 pr-3 py-1.5 border rounded-lg text-sm w-40 sm:w-56"
                        />
                    </div>
                </div>

                {loading && <p className="text-sm text-gray-400 text-center py-10">Loading...</p>}

                {!loading && (
                    <ul className="divide-y divide-gray-50">
                        {activity.map((a) => (
                            <li key={a.id} className="py-3 flex items-start gap-3">
                                <div className="w-8 h-8 rounded-full bg-brand-50 flex items-center justify-center shrink-0">
                                    <History className="w-4 h-4 text-brand-700" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm text-gray-800">
                                        <span className="font-semibold">{a.actor_name || 'Unknown'}</span>{' '}
                                        <span className="text-gray-500">{a.action_type.replace(/_/g, ' ')}</span>
                                        {a.target_name && <> - <span className="font-medium">{a.target_name}</span></>}
                                    </p>
                                    {a.description && <p className="text-xs text-gray-500 mt-0.5">{a.description}</p>}
                                </div>
                                <p className="text-xs text-gray-400 whitespace-nowrap">{timeAgo(a.created_at)}</p>
                            </li>
                        ))}
                        {activity.length === 0 && (
                            <li className="text-center text-gray-400 py-10">No matching activity.</li>
                        )}
                    </ul>
                )}
                {!loading && <Pagination page={page} totalPages={totalPages} totalItems={total} pageSize={PAGE_SIZE} onPageChange={setPage} />}
            </div>
        </Layout>
    );
}
