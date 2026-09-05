import React, { useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import { UserPlus, Trash2, Pencil } from 'lucide-react';
import Layout from '../../components/Layout';
import Pagination from '../../components/Pagination';
import usePagination from '../../hooks/usePagination';
import Modal from '../../components/Modal';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';

const EMPTY_PERSONNEL_FORM = { area: '', personnel_name: '', contact_number: '' };

export default function Personnel() {
    const { user } = useAuth();
    const canManage = user.role === 'superadmin' || user.role === 'inventory_staff';
    const [personnel, setPersonnel] = useState([]);
    const { pageItems: pagedPersonnel, page, setPage, totalPages } = usePagination(personnel, 15);
    const [rooms, setRooms] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState(EMPTY_PERSONNEL_FORM);
    const [building, setBuilding] = useState('');
    const [roomCode, setRoomCode] = useState('');

    const buildings = [...new Set(rooms.map((r) => r.building))].sort();
    const roomsInBuilding = rooms.filter((r) => r.building === building);

    async function load() {
        const { data } = await api.get('/personnel');
        setPersonnel(data);
    }

    async function loadRooms() {
        const { data } = await api.get('/rooms');
        setRooms(data);
    }

    useEffect(() => { load(); loadRooms(); }, []);

    // Keep form.area (the value actually saved) in sync with whichever
    // building/room the person picks in the two dropdowns.
    useEffect(() => {
        if (!building || !roomCode) return;
        const room = rooms.find((r) => r.building === building && r.room_code === roomCode);
        if (room) setForm((f) => ({ ...f, area: `${room.building} - ${room.room_name}` }));
    }, [building, roomCode, rooms]);

    function resetForm() {
        setForm(EMPTY_PERSONNEL_FORM);
        setBuilding('');
        setRoomCode('');
        setEditingId(null);
        setShowForm(false);
    }

    async function handleSubmit(e) {
        e.preventDefault();
        try {
            if (editingId) {
                await api.put(`/personnel/${editingId}`, form);
                Swal.fire('Success', 'Personnel updated.', 'success');
            } else {
                await api.post('/personnel', form);
                Swal.fire('Success', 'Personnel added.', 'success');
            }
            resetForm();
            load();
        } catch (err) {
            Swal.fire('Error', err.response?.data?.error || 'Failed to save personnel.', 'error');
        }
    }

    function startAdd() {
        setEditingId(null);
        setForm(EMPTY_PERSONNEL_FORM);
        setBuilding('');
        setRoomCode('');
        setShowForm(true);
    }

    function startEdit(person) {
        setEditingId(person.id);
        setForm({
            area: person.area,
            personnel_name: person.personnel_name,
            contact_number: person.contact_number || ''
        });
        // Try to preselect the matching building/room in the dropdowns;
        // older free-text areas that don't match any room just start blank
        // and can be re-picked from the list.
        const match = rooms.find((r) => `${r.building} - ${r.room_name}` === person.area);
        setBuilding(match ? match.building : '');
        setRoomCode(match ? match.room_code : '');
        setShowForm(true);
    }

    async function handleDelete(id) {
        const result = await Swal.fire({ title: 'Remove this personnel record?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#16a34a' });
        if (result.isConfirmed) {
            await api.delete(`/personnel/${id}`);
            load();
        }
    }

    return (
        <Layout title="Assigned Personnel">
            {canManage && (
                <div className="mb-6">
                    <button onClick={startAdd} className="inline-flex items-center gap-2 bg-brand-600 text-white px-4 py-2.5 rounded-lg font-semibold hover:bg-brand-700 min-h-[44px]">
                        <UserPlus className="w-4 h-4" /> New Personnel
                    </button>
                </div>
            )}

            <Modal open={showForm} onClose={resetForm} title={editingId ? 'Edit Personnel' : 'Add Personnel'} maxWidth="max-w-xl">
                <form onSubmit={handleSubmit} className="grid sm:grid-cols-1 gap-4">
                    <div>
                        <label className="text-xs font-medium text-gray-500 block mb-1">Building</label>
                        <select
                            required
                            value={building}
                            onChange={(e) => { setBuilding(e.target.value); setRoomCode(''); }}
                            className="p-2.5 border rounded-lg w-full"
                        >
                            <option value="">Select a building</option>
                            {buildings.map((b) => <option key={b} value={b}>{b}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs font-medium text-gray-500 block mb-1">Room</label>
                        <select
                            required
                            value={roomCode}
                            onChange={(e) => setRoomCode(e.target.value)}
                            disabled={!building}
                            className="p-2.5 border rounded-lg w-full disabled:bg-gray-100"
                        >
                            <option value="">{building ? 'Select a room' : 'Select a building first'}</option>
                            {roomsInBuilding.map((r) => <option key={r.room_code} value={r.room_code}>{r.room_name}</option>)}
                        </select>
                    </div>
                    <input required placeholder="Personnel Name" value={form.personnel_name} onChange={(e) => setForm({ ...form, personnel_name: e.target.value })} className="p-2.5 border rounded-lg" />
                    <input placeholder="Contact Number" value={form.contact_number} onChange={(e) => setForm({ ...form, contact_number: e.target.value })} className="p-2.5 border rounded-lg" />
                    <div className="flex flex-wrap gap-2">
                        <button type="submit" className="bg-brand-600 text-white rounded-lg px-4 py-2.5 font-semibold hover:bg-brand-700 min-h-[44px]">{editingId ? 'Update Personnel' : 'Add Personnel'}</button>
                        <button type="button" onClick={resetForm} className="bg-gray-200 text-gray-700 rounded-lg px-4 py-2.5 font-semibold hover:bg-gray-300 min-h-[44px]">Cancel</button>
                    </div>
                </form>
            </Modal>

            <div className="overflow-x-auto thin-scrollbar bg-white rounded-xl shadow p-4 sm:p-6">
                <table className="w-full text-sm text-left">
                    <thead className="bg-brand-700 text-white uppercase text-xs">
                        <tr>
                            <th className="py-2 px-3 whitespace-nowrap">Area</th>
                            <th className="py-2 px-3 whitespace-nowrap">Name</th>
                            <th className="py-2 px-3 whitespace-nowrap">Contact</th>
                            {canManage && <th className="py-2 px-3 whitespace-nowrap">Action</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {pagedPersonnel.map((p) => (
                            <tr key={p.id} className="border-b hover:bg-brand-50">
                                <td className="py-2 px-3 whitespace-nowrap">{p.area}</td>
                                <td className="py-2 px-3 whitespace-nowrap">{p.personnel_name}</td>
                                <td className="py-2 px-3 whitespace-nowrap">{p.contact_number || '—'}</td>
                                {canManage && (
                                    <td className="py-2 px-3 whitespace-nowrap space-x-2">
                                        <button onClick={() => startEdit(p)} className="inline-flex items-center gap-1 text-slate-700 hover:text-slate-900 text-xs font-medium">
                                            <Pencil className="w-3.5 h-3.5" /> Edit
                                        </button>
                                        <button onClick={() => handleDelete(p.id)} className="inline-flex items-center gap-1 text-red-500 hover:text-red-700 text-xs font-medium">
                                            <Trash2 className="w-3.5 h-3.5" /> Remove
                                        </button>
                                    </td>
                                )}
                            </tr>
                        ))}
                        {personnel.length === 0 && (
                            <tr><td colSpan={canManage ? 4 : 3} className="text-center text-gray-400 py-6">No personnel added yet.</td></tr>
                        )}
                    </tbody>
                </table>
                <Pagination page={page} totalPages={totalPages} totalItems={personnel.length} pageSize={15} onPageChange={setPage} />
            </div>
        </Layout>
    );
}
