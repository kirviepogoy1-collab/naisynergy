import React, { useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import { useParams, useNavigate } from 'react-router-dom';
import { Pencil, Trash2, Plus } from 'lucide-react';
import Layout from '../../components/Layout';
import Modal from '../../components/Modal';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';

export default function BuildingRooms() {
    const { building } = useParams();
    const buildingName = decodeURIComponent(building);
    const navigate = useNavigate();
    const { user } = useAuth();
    const canManage = user.role === 'superadmin' || user.role === 'inventory_staff';

    const [rooms, setRooms] = useState([]);
    const [search, setSearch] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ room_code: '', room_name: '' });

    async function load() {
        const { data } = await api.get('/rooms', { params: { building: buildingName } });
        setRooms(data);
    }

    useEffect(() => { load(); }, [buildingName]);

    async function handleCreate(e) {
        e.preventDefault();
        try {
            await api.post('/rooms', { ...form, building: buildingName });
            setForm({ room_code: '', room_name: '' });
            setShowForm(false);
            Swal.fire('Success', 'Room created.', 'success');
            load();
        } catch (err) {
            Swal.fire('Error', err.response?.data?.error || 'Failed to create room.', 'error');
        }
    }

    async function handleRename(e, room) {
        e.stopPropagation();
        const { value: roomName } = await Swal.fire({
            title: 'Rename Room', input: 'text', inputValue: room.room_name, showCancelButton: true
        });
        if (!roomName) return;
        await api.put(`/rooms/${room.id}`, { room_name: roomName, building: buildingName });
        load();
    }

    async function handleDelete(e, room) {
        e.stopPropagation();
        const result = await Swal.fire({
            title: `Delete ${room.room_name}?`,
            text: 'All inventory items filed under this room will also be deleted.',
            icon: 'warning', showCancelButton: true, confirmButtonColor: '#16a34a'
        });
        if (result.isConfirmed) {
            await api.delete(`/rooms/${room.id}`);
            load();
        }
    }

    const filtered = rooms.filter((r) => r.room_code.toLowerCase().includes(search.toLowerCase()));

    return (
        <Layout title={`${buildingName} Rooms`}>
            <input
                placeholder="Search by Room Code"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full p-3 border rounded-lg mb-6 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {filtered.map((r) => (
                    <div
                        key={r.id}
                        onClick={() => navigate(`/inventory/rooms/${r.room_code}`)}
                        className="bg-white rounded-xl shadow p-4 hover:shadow-lg transition cursor-pointer relative"
                    >
                        {canManage && (
                            <div className="absolute top-3 right-3 flex gap-1">
                                <button
                                    onClick={(e) => handleRename(e, r)}
                                    className="w-8 h-8 flex items-center justify-center bg-yellow-400 hover:bg-yellow-500 active:bg-yellow-600 rounded-lg text-white transition"
                                    title="Rename"
                                    aria-label="Rename room"
                                >
                                    <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    onClick={(e) => handleDelete(e, r)}
                                    className="w-8 h-8 flex items-center justify-center bg-red-500 hover:bg-red-600 active:bg-red-700 rounded-lg text-white transition"
                                    title="Delete"
                                    aria-label="Delete room"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        )}
                        <h3 className="text-lg font-bold text-brand-900 pr-16">{r.room_code}</h3>
                        <p className="text-sm text-gray-500">{r.room_name}</p>
                    </div>
                ))}
                {filtered.length === 0 && <p className="text-gray-400 col-span-full">No rooms match your search.</p>}
            </div>

            {canManage && (
                <button onClick={() => setShowForm(true)} className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-brand-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-brand-700 active:bg-brand-800 transition min-h-[44px]">
                    <Plus className="w-4 h-4" /> Add Room
                </button>
            )}

            <Modal open={showForm} onClose={() => setShowForm(false)} title="Add Room" maxWidth="max-w-xl">
                <form onSubmit={handleCreate} className="grid sm:grid-cols-2 gap-4">
                    <input required autoFocus placeholder="Room Code (e.g. MB105)" value={form.room_code} onChange={(e) => setForm({ ...form, room_code: e.target.value })} className="p-2.5 border rounded-lg" />
                    <input required placeholder="Room Name (e.g. Room 105)" value={form.room_name} onChange={(e) => setForm({ ...form, room_name: e.target.value })} className="p-2.5 border rounded-lg" />
                    <div className="sm:col-span-2 flex flex-wrap gap-2">
                        <button type="submit" className="bg-brand-600 text-white rounded-lg px-4 py-2.5 font-semibold hover:bg-brand-700 min-h-[44px]">Create Room</button>
                        <button type="button" onClick={() => setShowForm(false)} className="bg-gray-200 text-gray-700 rounded-lg px-4 py-2.5 font-semibold hover:bg-gray-300 min-h-[44px]">Cancel</button>
                    </div>
                </form>
            </Modal>
        </Layout>
    );
}
