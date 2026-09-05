import React, { useEffect, useState } from 'react';
import { History, Search } from 'lucide-react';
import Layout from '../../components/Layout';
import Pagination from '../../components/Pagination';
import usePagination from '../../hooks/usePagination';
import api from '../../api/axios';
import { timeAgo } from '../../utils/formatDate';

export default function HrActivityLog() {
    const [activity, setActivity] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get('/activity', { params: { module: 'hr' } }).then(({ data }) => {
            setActivity(data);
            setLoading(false);
        });
    }, []);

    const filtered = activity.filter((a) => {
        if (!search.trim()) return true;
        const haystack = `${a.actor_name || ''} ${a.action_type} ${a.target_name || ''} ${a.description || ''}`.toLowerCase();
        return haystack.includes(search.toLowerCase());
    });

    const { pageItems: pagedActivity, page, setPage, totalPages } = usePagination(filtered, 15);

    return (
        <Layout title="Activity Log">
            <div className="bg-white rounded-2xl shadow p-4 sm:p-6 max-w-4xl">
                <div className="flex items-center justify-between mb-4 gap-3">
                    <p className="text-sm text-gray-500">Last {activity.length} HR actions - leave approvals, document reviews, hiring, and account changes.</p>
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
                        {pagedActivity.map((a) => (
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
                        {filtered.length === 0 && (
                            <li className="text-center text-gray-400 py-10">No matching activity.</li>
                        )}
                    </ul>
                )}
                {!loading && <Pagination page={page} totalPages={totalPages} totalItems={filtered.length} pageSize={15} onPageChange={setPage} />}
            </div>
        </Layout>
    );
}
