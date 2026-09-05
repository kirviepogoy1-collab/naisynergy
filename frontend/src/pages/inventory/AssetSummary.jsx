import React, { useEffect, useRef, useState } from 'react';
import Swal from 'sweetalert2';
import { X, Download, Upload, FileDown } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import Layout from '../../components/Layout';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';

export default function AssetSummary() {
    const { user } = useAuth();
    const canManage = user.role === 'superadmin' || user.role === 'inventory_staff';
    const [searchParams, setSearchParams] = useSearchParams();
    const [assets, setAssets] = useState([]);
    const [search, setSearch] = useState(searchParams.get('search') || '');
    const [status, setStatus] = useState(searchParams.get('status') || '');
    const [selected, setSelected] = useState(null);
    const [rooms, setRooms] = useState([]);
    const [importing, setImporting] = useState(false);
    const fileInputRef = useRef(null);

    async function load() {
        const { data } = await api.get('/inventory/asset-summary', { params: { search, status } });
        setAssets(data);
    }

    useEffect(() => { load(); }, [search, status]);

    useEffect(() => {
        const newSearch = searchParams.get('search') || '';
        const newStatus = searchParams.get('status') || '';
        if (newSearch !== search) setSearch(newSearch);
        if (newStatus !== status) setStatus(newStatus);
    }, [searchParams]);

    async function openDrilldown(assetName) {
        setSelected(assetName);
        const { data } = await api.get('/inventory/asset-rooms', { params: { asset_name: assetName } });
        setRooms(data);
    }

    function exportExcel() {
        const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
        const token = localStorage.getItem('nai_token');
        const params = new URLSearchParams();
        if (search) params.set('search', search);
        if (status) params.set('status', status);
        if (token) params.set('token', token);
        const url = `${baseUrl}/inventory/export?${params.toString()}`;
        window.open(url, '_blank');
    }

    function downloadTemplate() {
        const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
        const token = localStorage.getItem('nai_token');
        const params = new URLSearchParams();
        if (token) params.set('token', token);
        window.open(`${baseUrl}/inventory/import/template?${params.toString()}`, '_blank');
    }

    async function handleImportFile(e) {
        const file = e.target.files?.[0];
        e.target.value = ''; // allow re-selecting the same file next time
        if (!file) return;

        setImporting(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const { data } = await api.post('/inventory/import', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            const errorList = data.errors.length
                ? `<div class="text-left text-xs text-red-600 mt-3 max-h-40 overflow-y-auto">${data.errors.map((er) => `Row ${er.row}: ${er.message}`).join('<br/>')}</div>`
                : '';
            Swal.fire({
                title: 'Import Finished',
                html: `${data.inserted} added, ${data.updated} updated, ${data.skipped} skipped.${errorList}`,
                icon: data.skipped > 0 ? 'warning' : 'success'
            });
            load();
        } catch (err) {
            Swal.fire('Import Failed', err.response?.data?.error || 'Could not import that CSV.', 'error');
        } finally {
            setImporting(false);
        }
    }

    function updateQueryParams(nextSearch, nextStatus) {
        const params = {};
        if (nextSearch) params.search = nextSearch;
        if (nextStatus) params.status = nextStatus;
        setSearchParams(params);
    }

    const totals = assets.reduce(
        (acc, asset) => ({
            assetTypes: acc.assetTypes + 1,
            working: acc.working + Number(asset.working || 0),
            forRepair: acc.forRepair + Number(asset.for_repair || 0),
            nonWorking: acc.nonWorking + Number(asset.non_working || 0),
            salvage: acc.salvage + Number(asset.salvage || 0)
        }),
        { assetTypes: 0, working: 0, forRepair: 0, nonWorking: 0, salvage: 0 }
    );

    return (
        <Layout title="Asset Summary">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 sm:gap-4 mb-6">
                <StatTile label="Asset Types" value={totals.assetTypes} clickable onClick={() => updateQueryParams('', '')} />
                <StatTile label="Working" value={totals.working} clickable onClick={() => updateQueryParams('', 'working')} />
                <StatTile label="For Repair" value={totals.forRepair} clickable onClick={() => updateQueryParams('', 'for_repair')} />
                <StatTile label="Non Working" value={totals.nonWorking} clickable onClick={() => updateQueryParams('', 'non_working')} />
                <StatTile label="Unserviceable" value={totals.salvage} clickable onClick={() => updateQueryParams('', 'salvage')} />
            </div>

            <div className="flex flex-col sm:flex-row gap-4 mb-6 items-end">
                <input
                    placeholder="Search asset name"
                    value={search}
                    onChange={(e) => {
                        setSearch(e.target.value);
                        updateQueryParams(e.target.value, status);
                    }}
                    className="p-3 border rounded w-full sm:w-1/3"
                />
                <select value={status} onChange={(e) => {
                    setStatus(e.target.value);
                    updateQueryParams(search, e.target.value);
                }} className="p-3 border rounded w-full sm:w-1/4">
                    <option value="">All Statuses</option>
                    <option value="working">Working</option>
                    <option value="for_repair">For Repair</option>
                    <option value="non_working">Non-Working</option>
                    <option value="salvage">Unserviceable</option>
                </select>
                <button onClick={exportExcel} className="w-full sm:w-auto bg-brand-700 text-white px-4 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-brand-800 min-h-[44px]"> <Download className="w-4 h-4" /> Export Excel</button>
                {canManage && (
                    <>
                        <button onClick={downloadTemplate} className="w-full sm:w-auto bg-white border border-gray-300 text-gray-700 px-4 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-gray-50 min-h-[44px]">
                            <FileDown className="w-4 h-4" /> Import Template
                        </button>
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={importing}
                            className="w-full sm:w-auto bg-blue-600 text-white px-4 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-blue-700 disabled:opacity-60 min-h-[44px]"
                        >
                            <Upload className="w-4 h-4" /> {importing ? 'Importing...' : 'Import CSV'}
                        </button>
                        <input ref={fileInputRef} type="file" accept=".csv" onChange={handleImportFile} className="hidden" />
                    </>
                )}
            </div>

            <div className="overflow-x-auto thin-scrollbar bg-white rounded-xl shadow p-4 sm:p-6">
                <table className="w-full text-sm text-left">
                    <thead className="bg-brand-700 text-white uppercase text-xs">
                        <tr>
                            <th className="py-2 px-3 whitespace-nowrap">Asset</th>
                            <th className="py-2 px-3 whitespace-nowrap">Working</th>
                            <th className="py-2 px-3 whitespace-nowrap">Repair</th>
                            <th className="py-2 px-3 whitespace-nowrap">Non-Working</th>
                            <th className="py-2 px-3 whitespace-nowrap">Unserviceable</th>
                            <th className="py-2 px-3 whitespace-nowrap">Total</th>
                            <th className="py-2 px-3 whitespace-nowrap">In # Rooms</th>
                        </tr>
                    </thead>
                    <tbody>
                        {assets.map((a) => (
                            <tr key={a.asset_name} onClick={() => openDrilldown(a.asset_name)} className="border-b hover:bg-brand-50 cursor-pointer">
                                <td className="py-2 px-3 font-medium text-brand-700 whitespace-nowrap">{a.asset_name}</td>
                                <td className="py-2 px-3">{a.working}</td>
                                <td className="py-2 px-3">{a.for_repair}</td>
                                <td className="py-2 px-3">{a.non_working}</td>
                                <td className="py-2 px-3">{a.salvage}</td>
                                <td className="py-2 px-3 font-semibold">{a.total}</td>
                                <td className="py-2 px-3">{a.room_count}</td>
                            </tr>
                        ))}
                        {assets.length === 0 && (
                            <tr><td colSpan="7" className="text-center text-gray-400 py-6">No assets found.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {selected && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                    <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl p-5 sm:p-6 max-h-[85vh] overflow-y-auto relative">
                        <button
                            onClick={() => setSelected(null)}
                            aria-label="Close"
                            className="absolute top-3 right-3 w-9 h-9 flex items-center justify-center rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 transition"
                        >
                            <X className="w-5 h-5" />
                        </button>
                        <h3 className="text-xl font-bold text-brand-800 mb-4 pr-8">Rooms with "{selected}"</h3>
                        <div className="overflow-x-auto thin-scrollbar">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-brand-700 text-white uppercase text-xs">
                                <tr>
                                    <th className="py-2 px-3 whitespace-nowrap">Room</th>
                                    <th className="py-2 px-3 whitespace-nowrap">Building</th>
                                    <th className="py-2 px-3 whitespace-nowrap">Working</th>
                                    <th className="py-2 px-3 whitespace-nowrap">Repair</th>
                                    <th className="py-2 px-3 whitespace-nowrap">Non-Working</th>
                                    <th className="py-2 px-3 whitespace-nowrap">Unserviceable</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rooms.map((r) => (
                                    <tr key={r.id} className="border-b">
                                        <td className="py-2 px-3 whitespace-nowrap">{r.room_name}</td>
                                        <td className="py-2 px-3 whitespace-nowrap">{r.building}</td>
                                        <td className="py-2 px-3">{r.working}</td>
                                        <td className="py-2 px-3">{r.for_repair}</td>
                                        <td className="py-2 px-3">{r.non_working}</td>
                                        <td className="py-2 px-3">{r.salvage}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    );
}

function StatTile({ label, value, clickable, onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`w-full rounded-xl shadow p-3 sm:p-4 text-left ${clickable ? 'bg-white hover:shadow-2xl active:scale-[0.98] transition' : 'bg-slate-50'}`}
        >
            <p className="text-lg sm:text-2xl font-bold text-brand-700 truncate">{value}</p>
            <p className="text-xs sm:text-sm text-gray-500 mt-1 sm:mt-2 leading-tight">{label}</p>
        </button>
    );
}
