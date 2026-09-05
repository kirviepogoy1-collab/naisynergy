import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import api from '../../api/axios';

export default function InventoryDashboard() {
    const navigate = useNavigate();
    const [summary, setSummary] = useState(null);
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState('');
    const [results, setResults] = useState([]);
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 10;

    useEffect(() => {
        api.get('/inventory/summary').then((res) => setSummary(res.data));
    }, []);

    useEffect(() => {
        api.get('/inventory', { params: { search, status } }).then((res) => {
            setResults(res.data);
            setPage(1);
        });
    }, [search, status]);

    const totalPages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
    const pageResults = results.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    function handleAssetRowClick(assetName) {
        navigate(`/inventory/asset-summary?search=${encodeURIComponent(assetName)}`);
    }

    return (
        <Layout title="Inventory Dashboard">
            {!summary ? (
                <p className="text-gray-500">Loading...</p>
            ) : (
                <>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 sm:gap-4 mb-8">
                        <StatCard label="Working" value={summary.overall.working || 0} color="bg-green-100 text-green-700" onClick={() => navigate('/inventory/asset-summary?status=working')} />
                        <StatCard label="For Repair" value={summary.overall.for_repair || 0} color="bg-yellow-100 text-yellow-700" onClick={() => navigate('/inventory/asset-summary?status=for_repair')} />
                        <StatCard label="Non-Working" value={summary.overall.non_working || 0} color="bg-red-100 text-red-700" onClick={() => navigate('/inventory/asset-summary?status=non_working')} />
                        <StatCard label="Unserviceable" value={summary.overall.salvage || 0} color="bg-gray-100 text-gray-700" onClick={() => navigate('/inventory/asset-summary?status=salvage')} />
                        <StatCard
                            label="Total Assets"
                            value={
                                (Number(summary.overall.working) || 0) +
                                (Number(summary.overall.for_repair) || 0) +
                                (Number(summary.overall.non_working) || 0) +
                                (Number(summary.overall.salvage) || 0)
                            }
                            color="bg-blue-100 text-blue-700"
                            onClick={() => navigate('/inventory/asset-summary')}
                        />
                        <StatCard label="Total Value" value={`₱${Number(summary.overall.total_value || 0).toLocaleString()}`} color="bg-brand-700 text-white" onClick={() => navigate('/inventory/asset-summary')} />
                    </div>

                    <div className="bg-white rounded-xl shadow p-4 sm:p-6 mb-8">
                        <h2 className="text-lg font-semibold text-brand-800 mb-4">By Building</h2>
                        <div className="overflow-x-auto thin-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-brand-700 text-white uppercase text-xs">
                                <tr>
                                    <th className="py-2 px-3">Building</th>
                                    <th className="py-2 px-3">Working</th>
                                    <th className="py-2 px-3">Repair</th>
                                    <th className="py-2 px-3">Non-Working</th>
                                    <th className="py-2 px-3">Unserviceable</th>
                                    <th className="py-2 px-3">Total</th>
                                    <th className="py-2 px-3">Value</th>
                                </tr>
                            </thead>
                            <tbody>
                                {summary.by_building.map((b) => (
                                    <tr key={b.building} className="border-b hover:bg-brand-50 cursor-pointer" onClick={() => navigate(`/inventory/buildings/${encodeURIComponent(b.building)}`)}>
                                        <td className="py-2 px-3 font-semibold text-brand-700">{b.building}</td>
                                        <td className="py-2 px-3">{b.working}</td>
                                        <td className="py-2 px-3">{b.for_repair}</td>
                                        <td className="py-2 px-3">{b.non_working}</td>
                                        <td className="py-2 px-3">{b.salvage}</td>
                                        <td className="py-2 px-3">{b.total}</td>
                                        <td className="py-2 px-3 whitespace-nowrap">₱{Number(b.total_value || 0).toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow p-4 sm:p-6">
                        <h2 className="text-lg font-semibold text-brand-800 mb-4">Search All Assets</h2>
                        <div className="flex flex-col sm:flex-row gap-4 mb-4">
                            <input placeholder="Search by code, name, or description" value={search} onChange={(e) => setSearch(e.target.value)} className="p-3 border rounded w-full sm:w-1/3" />
                            <select value={status} onChange={(e) => setStatus(e.target.value)} className="p-3 border rounded w-full sm:w-1/4">
                                <option value="">Any Condition</option>
                                <option value="working">Working</option>
                                <option value="for_repair">For Repair</option>
                                <option value="non_working">Non-Working</option>
                                <option value="salvage">Unserviceable</option>
                            </select>
                        </div>
                        <div className="overflow-x-auto thin-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-brand-700 text-white uppercase text-xs">
                                <tr>
                                    <th className="py-2 px-3 whitespace-nowrap">Code</th>
                                    <th className="py-2 px-3">Name</th>
                                    <th className="py-2 px-3">Room</th>
                                    <th className="py-2 px-3">Building</th>
                                    <th className="py-2 px-3">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pageResults.map((r) => (
                                    <tr key={r.id} className="border-b hover:bg-brand-50 cursor-pointer" onClick={() => handleAssetRowClick(r.asset_name)}>
                                        <td className="py-2 px-3">{r.asset_code}</td>
                                        <td className="py-2 px-3 font-semibold text-brand-700">{r.asset_name}</td>
                                        <td className="py-2 px-3">{r.room_name}</td>
                                        <td className="py-2 px-3">{r.building}</td>
                                        <td className="py-2 px-3">{r.total}</td>
                                    </tr>
                                ))}
                                {results.length === 0 && (
                                    <tr><td colSpan="5" className="text-center text-gray-400 py-6">No matching assets.</td></tr>
                                )}
                            </tbody>
                        </table>
                        </div>
                        {totalPages > 1 && (
                            <div className="flex flex-wrap justify-center items-center gap-2 mt-4">
                                <button
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className="min-w-[2.25rem] h-9 px-3 rounded text-sm font-medium bg-brand-50 text-brand-700 hover:bg-brand-100 disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    Prev
                                </button>

                                {getPageWindow(page, totalPages, 5).map((p, i) =>
                                    p === '...' ? (
                                        <span key={`ellipsis-${i}`} className="px-1 text-brand-400 select-none">
                                            …
                                        </span>
                                    ) : (
                                        <button
                                            key={p}
                                            onClick={() => setPage(p)}
                                            className={`min-w-[2.25rem] h-9 px-2 rounded text-sm font-medium ${p === page ? 'bg-brand-600 text-white' : 'bg-brand-50 text-brand-700 hover:bg-brand-100'}`}
                                        >
                                            {p}
                                        </button>
                                    )
                                )}

                                <button
                                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                    disabled={page === totalPages}
                                    className="min-w-[2.25rem] h-9 px-3 rounded text-sm font-medium bg-brand-50 text-brand-700 hover:bg-brand-100 disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    Next
                                </button>
                            </div>
                        )}
                    </div>
                </>
            )}
        </Layout>
    );
}

function StatCard({ label, value, color, onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`bg-white rounded-xl shadow p-3 sm:p-5 text-center w-full ${onClick ? 'hover:shadow-2xl active:scale-[0.98] transition cursor-pointer' : ''}`}
        >
            <p className={`inline-block max-w-full truncate text-sm sm:text-xl font-bold px-2.5 sm:px-3 py-1 rounded-full ${color}`}>{value}</p>
            <p className="text-[11px] sm:text-sm text-gray-500 mt-1.5 sm:mt-2 leading-tight">{label}</p>
        </button>
    );
}

// Returns a windowed array of page numbers with '...' gaps, e.g. [1, '...', 4, 5, 6, '...', 12]
function getPageWindow(current, total, windowSize = 5) {
    if (total <= windowSize + 2) {
        return Array.from({ length: total }, (_, i) => i + 1);
    }
    const half = Math.floor(windowSize / 2);
    let start = Math.max(2, current - half);
    let end = Math.min(total - 1, current + half);

    if (current - half <= 2) end = windowSize + 1;
    if (current + half >= total - 1) start = total - windowSize;

    const pages = [1];
    if (start > 2) pages.push('...');
    for (let p = start; p <= end; p++) pages.push(p);
    if (end < total - 1) pages.push('...');
    pages.push(total);

    return pages;
}