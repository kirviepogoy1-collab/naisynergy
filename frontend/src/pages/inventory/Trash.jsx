import React, { useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import { Trash2, RotateCcw, XCircle } from 'lucide-react';
import Layout from '../../components/Layout';
import api from '../../api/axios';
import { formatDateTime } from '../../utils/formatDate';

export default function InventoryTrash() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);

    async function load() {
        setLoading(true);
        try {
            const { data } = await api.get('/inventory/trash');
            setItems(data);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { load(); }, []);

    async function handleRestore(item) {
        const result = await Swal.fire({
            title: `Restore ${item.asset_name}?`,
            text: `It will reappear in ${item.room_name} (${item.building}).`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Restore',
            confirmButtonColor: '#16a34a'
        });
        if (!result.isConfirmed) return;
        await api.post(`/inventory/${item.id}/restore`);
        Swal.fire('Restored', 'The asset is back in inventory.', 'success');
        load();
    }

    async function handlePurge(item) {
        const result = await Swal.fire({
            title: `Permanently delete ${item.asset_name}?`,
            text: 'This skips the 30-day wait and cannot be undone.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Delete Forever',
            confirmButtonColor: '#dc2626'
        });
        if (!result.isConfirmed) return;
        await api.delete(`/inventory/${item.id}/purge`);
        Swal.fire('Deleted', 'The asset has been permanently removed.', 'success');
        load();
    }

    return (
        <Layout title="Trash">
            <p className="text-sm text-gray-500 mb-6">
                Deleted assets sit here for 30 days before they're purged automatically, so an accidental
                delete or bulk-delete is never permanent. Restoring puts an item straight back in its room.
            </p>

            <div className="overflow-x-auto thin-scrollbar bg-white rounded-xl shadow p-4 sm:p-6">
                <table className="w-full text-sm text-left">
                    <thead className="bg-brand-700 text-white uppercase text-xs">
                        <tr>
                            <th className="py-2 px-3 whitespace-nowrap">Actions</th>
                            <th className="py-2 px-3 whitespace-nowrap">Asset Code</th>
                            <th className="py-2 px-3 whitespace-nowrap">Asset Name</th>
                            <th className="py-2 px-3 whitespace-nowrap">Room</th>
                            <th className="py-2 px-3 whitespace-nowrap">Building</th>
                            <th className="py-2 px-3 whitespace-nowrap">Deleted By</th>
                            <th className="py-2 px-3 whitespace-nowrap">Deleted At</th>
                            <th className="py-2 px-3 whitespace-nowrap">Days Left</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item) => (
                            <tr key={item.id} className="border-b hover:bg-brand-50">
                                <td className="py-2 px-3 space-x-1 whitespace-nowrap">
                                    <button onClick={() => handleRestore(item)} aria-label="Restore item" title="Restore" className="w-8 h-8 inline-flex items-center justify-center bg-green-500 hover:bg-green-600 active:bg-green-700 rounded-lg text-white transition"><RotateCcw className="w-3.5 h-3.5" /></button>
                                    <button onClick={() => handlePurge(item)} aria-label="Delete forever" title="Delete Forever" className="w-8 h-8 inline-flex items-center justify-center bg-red-600 hover:bg-red-700 active:bg-red-800 rounded-lg text-white transition"><XCircle className="w-3.5 h-3.5" /></button>
                                </td>
                                <td className="py-2 px-3 text-brand-700 font-medium whitespace-nowrap">{item.asset_code}</td>
                                <td className="py-2 px-3">{item.asset_name}</td>
                                <td className="py-2 px-3">{item.room_name}</td>
                                <td className="py-2 px-3">{item.building}</td>
                                <td className="py-2 px-3">{item.deleted_by_name || '—'}</td>
                                <td className="py-2 px-3 whitespace-nowrap">{formatDateTime(item.deleted_at)}</td>
                                <td className="py-2 px-3">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${item.days_left <= 5 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                                        {item.days_left}d
                                    </span>
                                </td>
                            </tr>
                        ))}
                        {!loading && items.length === 0 && (
                            <tr><td colSpan={8} className="text-center text-gray-400 py-10">
                                <Trash2 className="w-6 h-6 mx-auto mb-2 text-gray-300" />
                                Trash is empty.
                            </td></tr>
                        )}
                        {loading && (
                            <tr><td colSpan={8} className="text-center text-gray-400 py-10">Loading...</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </Layout>
    );
}
