import React, { useEffect, useRef, useState } from 'react';
import Swal from 'sweetalert2';
import { Trash2, Download, Plus, FileText, Search, Pencil } from 'lucide-react';
import Layout from '../../components/Layout';
import Modal from '../../components/Modal';
import Pagination from '../../components/Pagination';
import usePagination from '../../hooks/usePagination';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { fileUrl } from '../../utils/fileUrl';

const EMPTY_FORM = { item_name: '', quantity: 1, purchase_date: '', purchase_price: '', supplier: '', category: '' };

export default function Records() {
    const { user } = useAuth();
    const canManage = user.role === 'superadmin' || user.role === 'inventory_staff';

    const [records, setRecords] = useState([]);
    const [stats, setStats] = useState(null);
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [editingReceiptPath, setEditingReceiptPath] = useState(null);
    const [removeReceipt, setRemoveReceipt] = useState(false);
    const [form, setForm] = useState(EMPTY_FORM);
    const [selected, setSelected] = useState([]);
    const fileRef = useRef();
    const { pageItems: pagedRecords, page, setPage, totalPages } = usePagination(records, 15);

    async function load() {
        const [recordsRes, statsRes] = await Promise.all([
            api.get('/records', { params: { search, category, start_date: startDate, end_date: endDate } }),
            api.get('/records/stats/summary')
        ]);
        setRecords(recordsRes.data);
        setStats(statsRes.data);
    }

    function buildExportUrl() {
        const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
        const params = new URLSearchParams();
        if (search) params.set('search', search);
        if (category) params.set('category', category);
        if (startDate) params.set('start_date', startDate);
        if (endDate) params.set('end_date', endDate);
        const token = localStorage.getItem('nai_token');
        if (token) params.set('token', token);
        return `${baseUrl}/records/export?${params.toString()}`;
    }

    function exportCsv() {
        window.open(buildExportUrl(), '_blank');
    }

    useEffect(() => { load(); }, [search, category, startDate, endDate]);

    function resetForm() {
        setForm(EMPTY_FORM);
        setEditingId(null);
        setEditingReceiptPath(null);
        setRemoveReceipt(false);
        if (fileRef.current) fileRef.current.value = '';
        setShowForm(false);
    }

    function startEdit(record) {
        setEditingId(record.id);
        setEditingReceiptPath(record.receipt_path || null);
        setRemoveReceipt(false);
        setForm({
            item_name: record.item_name || '',
            quantity: record.quantity || 1,
            purchase_date: record.purchase_date || '',
            purchase_price: record.purchase_price || '',
            supplier: record.supplier || '',
            category: record.category || ''
        });
        setShowForm(true);
    }

    async function handleSubmit(e) {
        e.preventDefault();
        const formData = new FormData();
        Object.entries(form).forEach(([k, v]) => formData.append(k, v));
        if (fileRef.current?.files[0]) formData.append('receipt', fileRef.current.files[0]);
        if (editingId && removeReceipt && !fileRef.current?.files[0]) {
            formData.append('remove_receipt', '1');
        }

        try {
            if (editingId) {
                await api.put(`/records/${editingId}`, formData);
                Swal.fire('Success', 'Record updated.', 'success');
            } else {
                await api.post('/records', formData);
                Swal.fire('Success', 'Record added.', 'success');
            }
            resetForm();
            load();
        } catch (err) {
            Swal.fire('Error', err.response?.data?.error || 'Failed to save record.', 'error');
        }
    }

    async function handleDelete(id) {
        const result = await Swal.fire({ title: 'Delete this record?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#16a34a' });
        if (result.isConfirmed) {
            await api.delete(`/records/${id}`);
            load();
        }
    }

    async function handleBulkDelete() {
        if (selected.length === 0) return;
        const result = await Swal.fire({ title: `Delete ${selected.length} record(s)?`, icon: 'warning', showCancelButton: true, confirmButtonColor: '#16a34a' });
        if (result.isConfirmed) {
            await api.post('/records/bulk-delete', { ids: selected });
            setSelected([]);
            load();
        }
    }

    function toggleSelect(id) {
        setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
    }

    return (
        <Layout title="Purchase Records">
            {stats && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4 mb-8">
                    <MetricCard label="SPENT THIS MONTH" value={`₱${Number(stats.this_month_total).toLocaleString()}`} meta={new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })} color="border-blue-200 text-blue-700" />
                    <MetricCard label="SPENT THIS YEAR" value={`₱${Number(stats.this_year_total).toLocaleString()}`} meta={`${new Date().getFullYear()}`} color="border-green-200 text-green-700" />
                    <MetricCard label="MOST EXPENSIVE" value={stats.biggest_purchase ? stats.biggest_purchase.item_name : '—'} meta={stats.biggest_purchase ? `₱${Number(stats.biggest_purchase.purchase_price || 0).toLocaleString()}` : ''} color="border-yellow-200 text-yellow-700" />
                    <MetricCard label="TOP SUPPLIER" value={stats.top_supplier?.supplier || '—'} meta={stats.top_supplier ? `${stats.top_supplier.count} orders` : ''} color="border-purple-200 text-purple-700" />
                </div>
            )}

            {stats?.by_category && stats.by_category.length > 0 && (
                <div className="bg-white rounded-2xl sm:rounded-3xl shadow p-4 sm:p-6 mb-8">
                    <div className="flex items-center justify-between mb-5 gap-3">
                        <div>
                            <p className="text-xs uppercase tracking-[0.24em] text-slate-500 font-semibold">Spending by Category</p>
                            <p className="text-sm text-slate-600 mt-1">Review total spend and order counts per category.</p>
                        </div>
                    </div>
                    <div className="space-y-4">
                        {stats.by_category.map((cat) => (
                            <CategoryBar key={cat.category} category={cat} max={Math.max(...stats.by_category.map((c) => Number(c.total_spend) || 0), 1)} />
                        ))}
                    </div>
                </div>
            )}

            <div className="bg-white rounded-2xl sm:rounded-3xl shadow p-4 sm:p-6 mb-6">
                <div className="grid gap-4 lg:grid-cols-[2fr_1fr_1fr_1fr] items-end">
                    <div className="relative">
                        <label className="block text-xs font-semibold text-slate-500 mb-2">Search</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                placeholder="Asset, supplier, category..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-10 pr-3 py-3 w-full border rounded-lg focus:border-brand-600 focus:ring-brand-100"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-2">Category</label>
                        <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full p-3 border rounded-lg">
                            <option value="">All Categories</option>
                            {stats?.by_category?.map((cat) => (
                                <option key={cat.category} value={cat.category}>{cat.category}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-2">From</label>
                        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full p-3 border rounded-lg" />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-2">To</label>
                        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full p-3 border rounded-lg" />
                    </div>
                </div>
                <div className="mt-4 flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2.5 sm:gap-3">
                    <button type="button" onClick={load} className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 rounded-lg font-semibold min-h-[44px]">
                        <Search className="w-4 h-4" /> Filter
                    </button>
                    <button type="button" onClick={exportCsv} className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-5 py-3 rounded-lg font-semibold min-h-[44px]">
                        <Download className="w-4 h-4" /> Export CSV
                    </button>
                    {canManage && (
                        <button type="button" onClick={() => {
                            if (showForm) {
                                resetForm();
                            } else {
                                setEditingId(null);
                                setEditingReceiptPath(null);
                                setRemoveReceipt(false);
                                setForm(EMPTY_FORM);
                                setShowForm(true);
                            }
                        }} className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 rounded-lg font-semibold min-h-[44px]">
                            <Plus className="w-4 h-4" /> {showForm ? 'Cancel' : 'Add Record'}
                        </button>
                    )}
                </div>
            </div>
            <Modal open={showForm} onClose={resetForm} title={editingId ? 'Edit Purchase Record' : 'Add Purchase Record'} maxWidth="max-w-3xl">
                <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    <input required placeholder="Item Name" value={form.item_name} onChange={(e) => setForm({ ...form, item_name: e.target.value })} className="p-3 border rounded-lg" />
                    <input type="number" min="1" placeholder="Qty" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} className="p-3 border rounded-lg" />
                    <input type="date" value={form.purchase_date} onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} className="p-3 border rounded-lg" />
                    <input type="number" step="0.01" placeholder="Unit Price (₱)" value={form.purchase_price} onChange={(e) => setForm({ ...form, purchase_price: e.target.value })} className="p-3 border rounded-lg" />
                    <input placeholder="Supplier" value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} className="p-3 border rounded-lg" />
                    <input placeholder="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="p-3 border rounded-lg" />
                    <div className="sm:col-span-2 xl:col-span-3">
                        <label className="text-xs text-slate-500 block mb-2">Receipt (image or PDF)</label>
                        <input type="file" ref={fileRef} accept="image/*,application/pdf" className="w-full text-sm" />
                        {editingId && editingReceiptPath && (
                            <label className="mt-2 inline-flex items-center gap-2 text-sm text-slate-600">
                                <input type="checkbox" checked={removeReceipt} onChange={(e) => setRemoveReceipt(e.target.checked)} />
                                Remove existing receipt
                            </label>
                        )}
                    </div>
                    <div className="sm:col-span-2 xl:col-span-3 flex flex-wrap gap-3">
                        <button type="submit" className="bg-brand-600 text-white rounded-lg px-5 py-3 font-semibold hover:bg-brand-700">{editingId ? 'Update Record' : 'Save Record'}</button>
                        <button type="button" onClick={resetForm} className="bg-gray-200 text-gray-700 rounded-lg px-5 py-3 font-semibold hover:bg-gray-300">Cancel</button>
                    </div>
                </form>
            </Modal>

            {canManage && selected.length > 0 && (
                <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-slate-600">{selected.length} selected</p>
                    <button onClick={handleBulkDelete} className="inline-flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-4 py-2.5 rounded-lg font-semibold">
                        <Trash2 className="w-4 h-4" /> Delete Selected
                    </button>
                </div>
            )}

            <div className="overflow-x-auto thin-scrollbar bg-white rounded-2xl sm:rounded-3xl shadow p-4 sm:p-6">
                <table className="w-full text-sm text-left">
                    <thead className="bg-emerald-600 text-white uppercase text-xs">
                        <tr>
                            {canManage && <th className="py-3 px-3"></th>}
                            <th className="py-3 px-3 whitespace-nowrap">#</th>
                            <th className="py-3 px-3 whitespace-nowrap">Asset Name</th>
                            <th className="py-3 px-3 whitespace-nowrap">Category</th>
                            <th className="py-3 px-3 whitespace-nowrap">Qty</th>
                            <th className="py-3 px-3 whitespace-nowrap">Purchase Date</th>
                            <th className="py-3 px-3 whitespace-nowrap">Unit Price (₱)</th>
                            <th className="py-3 px-3 whitespace-nowrap">Total Cost (₱)</th>
                            <th className="py-3 px-3 whitespace-nowrap">Supplier</th>
                            <th className="py-3 px-3 whitespace-nowrap">Receipt</th>
                            <th className="py-3 px-3 whitespace-nowrap">Date Added</th>
                            {canManage && <th className="py-3 px-3 whitespace-nowrap">Actions</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {pagedRecords.map((r, index) => (
                            <tr key={r.id} className="border-b hover:bg-brand-50">
                                {canManage && (
                                    <td className="py-2 px-3">
                                        <input type="checkbox" checked={selected.includes(r.id)} onChange={() => toggleSelect(r.id)} />
                                    </td>
                                )}
                                <td className="py-2 px-3 whitespace-nowrap">{(page - 1) * 15 + index + 1}</td>
                                <td className="py-2 px-3 whitespace-nowrap font-semibold text-brand-700">{r.item_name}</td>
                                <td className="py-2 px-3 whitespace-nowrap">{r.category || '—'}</td>
                                <td className="py-2 px-3 whitespace-nowrap">{r.quantity}</td>
                                <td className="py-2 px-3 whitespace-nowrap">{formatDate(r.purchase_date)}</td>
                                <td className="py-2 px-3 whitespace-nowrap">₱{formatNumber(r.purchase_price)}</td>
                                <td className="py-2 px-3 whitespace-nowrap">₱{formatNumber(Number(r.quantity) * Number(r.purchase_price))}</td>
                                <td className="py-2 px-3 whitespace-nowrap">{r.supplier || '—'}</td>
                                <td className="py-2 px-3 whitespace-nowrap">
                                    {r.receipt_path ? (
                                        <a href={fileUrl(r.receipt_path)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-500 hover:underline">
                                            <FileText className="w-3.5 h-3.5" /> View
                                        </a>
                                    ) : '—'}
                                </td>
                                <td className="py-2 px-3 whitespace-nowrap">{formatDateTime(r.created_at)}</td>
                                {canManage && (
                                    <td className="py-2 px-3 whitespace-nowrap space-x-2">
                                        <button onClick={() => startEdit(r)} className="inline-flex items-center gap-1 text-slate-700 hover:text-slate-900 text-xs font-medium">
                                            <Pencil className="w-3.5 h-3.5" /> Edit
                                        </button>
                                        <button onClick={() => handleDelete(r.id)} className="inline-flex items-center gap-1 text-red-500 hover:text-red-700 text-xs font-medium">
                                            <Trash2 className="w-3.5 h-3.5" /> Delete
                                        </button>
                                    </td>
                                )}
                            </tr>
                        ))}
                        {records.length === 0 && (
                            <tr><td colSpan={canManage ? 12 : 11} className="text-center text-gray-400 py-6">No purchase records yet.</td></tr>
                        )}
                    </tbody>
                </table>
                <Pagination page={page} totalPages={totalPages} totalItems={records.length} pageSize={15} onPageChange={setPage} />
            </div>
        </Layout>
    );
}

function CategoryBar({ category, max }) {
    const width = Math.max(10, Math.round((Number(category.total_spend || 0) / max) * 100));
    return (
        <div>
            <div className="flex items-center justify-between gap-4 mb-2">
                <p className="font-semibold text-slate-700">{category.category}</p>
                <p className="text-sm text-slate-500">₱{Number(category.total_spend || 0).toLocaleString('en-PH')}</p>
            </div>
            <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${width}%` }} />
            </div>
        </div>
    );
}

function MetricCard({ label, value, meta, color }) {
    return (
        <div className={`rounded-2xl sm:rounded-3xl border ${color} bg-white shadow-sm p-3 sm:p-5 min-w-0`}>
            <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-[0.1em] sm:tracking-[0.18em] text-slate-500 truncate">{label}</p>
            <p className="mt-2 sm:mt-4 text-base sm:text-2xl font-bold text-slate-900 line-clamp-2 sm:truncate">{value}</p>
            {meta && <p className="mt-1 sm:mt-2 text-xs sm:text-sm text-slate-500 truncate">{meta}</p>}
        </div>
    );
}

function formatNumber(value) {
    return Number(value || 0).toLocaleString('en-PH');
}

function formatDate(value) {
    if (!value) return '—';
    return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(value) {
    if (!value) return '—';
    return new Date(value).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
