import React, { useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Plus, RefreshCw, Pencil, Trash2, MessageSquare, Send } from 'lucide-react';
import Layout from '../../components/Layout';
import Pagination from '../../components/Pagination';
import usePagination from '../../hooks/usePagination';
import Modal from '../../components/Modal';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { formatDateTime } from '../../utils/formatDate';

const EMPTY_FORM = {
    asset_code: '', asset_name: '', description: '', purchase_date: '', purchase_price: '',
    working: 0, for_repair: 0, non_working: 0, salvage: 0, repair_reason: '', apply_to_all_rooms: false
};

function Badge({ value, color }) {
    const colors = {
        green: 'bg-green-600', yellow: 'bg-yellow-500', red: 'bg-red-600', gray: 'bg-gray-500'
    };
    return (
        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-white text-xs font-semibold ${colors[color]}`}>
            {value}
        </span>
    );
}

export default function RoomInventory() {
    const { roomCode } = useParams();
    const { user } = useAuth();
    const canManage = user.role === 'superadmin' || user.role === 'inventory_staff';

    const [room, setRoom] = useState(null);
    const [items, setItems] = useState([]);
    const { pageItems: pagedItems, page, setPage, totalPages } = usePagination(items, 15);
    const [personnel, setPersonnel] = useState([]);
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState(EMPTY_FORM);

    const [commentItem, setCommentItem] = useState(null); // the item whose comment thread is open
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState('');
    const [commentsLoading, setCommentsLoading] = useState(false);

    async function load() {
        const [roomRes, itemsRes] = await Promise.all([
            api.get(`/rooms/code/${roomCode}`),
            api.get('/inventory', { params: { room_code: roomCode, search, status } })
        ]);
        setRoom(roomRes.data);
        setItems(itemsRes.data);
        // Personnel are saved with area = "<Building> - <Room Name>" (see Personnel.jsx),
        // not the room code, so look them up by that same combined string.
        const area = `${roomRes.data.building} - ${roomRes.data.room_name}`;
        const personnelRes = await api.get('/personnel', { params: { area } });
        setPersonnel(personnelRes.data);
    }

    useEffect(() => { load(); }, [roomCode, search, status]);

    function startEdit(item) {
        setEditingId(item.id);
        setForm({
            asset_code: item.asset_code, asset_name: item.asset_name, description: item.description || '',
            purchase_date: item.purchase_date || '', purchase_price: item.purchase_price,
            working: item.working, for_repair: item.for_repair, non_working: item.non_working, salvage: item.salvage,
            repair_reason: item.repair_reason || '', apply_to_all_rooms: false
        });
        setShowForm(true);
    }

    function resetForm() {
        setForm(EMPTY_FORM);
        setEditingId(null);
        setShowForm(false);
    }

    async function handleSubmit(e) {
        e.preventDefault();
        try {
            if (editingId) {
                await api.put(`/inventory/${editingId}`, { ...form, apply_to_all_rooms: form.apply_to_all_rooms ? '1' : '0' });
            } else {
                await api.post('/inventory', { ...form, room_code: roomCode, apply_to_all_rooms: form.apply_to_all_rooms ? '1' : '0' });
            }
            Swal.fire('Success', 'Saved.', 'success');
            resetForm();
            load();
        } catch (err) {
            Swal.fire('Error', err.response?.data?.error || 'Failed to save asset.', 'error');
        }
    }

    async function handleDelete(item) {
        const { value: acrossAll } = await Swal.fire({
            title: `Move ${item.asset_name} to Trash?`,
            text: 'It will be hidden from inventory right away. Inventory staff and admins can still see and restore it from Trash for 30 days before it\'s gone for good.',
            input: 'radio',
            inputOptions: { this_room: 'Just this room', all_rooms: 'Delete across ALL rooms with this asset code' },
            inputValue: 'this_room',
            showCancelButton: true,
            confirmButtonText: 'Move to Trash',
            confirmButtonColor: '#dc2626'
        });
        if (acrossAll === undefined) return;

        const { data } = await api.delete(`/inventory/${item.id}`, { params: { delete_across_all_rooms: acrossAll === 'all_rooms' ? '1' : '0' } });
        Swal.fire('Moved to Trash', data.message, 'success');
        load();
    }

    function daysInRepair(item) {
        if (!item.repair_flagged_at || !item.for_repair) return null;
        return Math.floor((Date.now() - new Date(item.repair_flagged_at).getTime()) / 86400000);
    }

    async function handleGenerateItems() {
        const result = await Swal.fire({
            title: 'Generate Items',
            text: 'This fills in a zero-count row for every asset code used in any other room, so this room has the same checklist.',
            icon: 'info', showCancelButton: true, confirmButtonColor: '#16a34a'
        });
        if (!result.isConfirmed) return;
        const { data } = await api.post(`/rooms/code/${roomCode}/generate-items`);
        Swal.fire('Done', data.message, 'success');
        load();
    }

    async function openComments(item) {
        setCommentItem(item);
        setComments([]);
        setNewComment('');
        setCommentsLoading(true);
        try {
            const { data } = await api.get(`/inventory/${item.id}/comments`);
            setComments(data);
        } finally {
            setCommentsLoading(false);
        }
    }

    function closeComments() {
        setCommentItem(null);
        setComments([]);
        setNewComment('');
    }

    async function submitComment(e) {
        e.preventDefault();
        if (!newComment.trim()) return;
        await api.post(`/inventory/${commentItem.id}/comments`, { comment: newComment.trim() });
        setNewComment('');
        const { data } = await api.get(`/inventory/${commentItem.id}/comments`);
        setComments(data);
        load(); // refresh comment_count badges in the table
    }

    async function deleteComment(id) {
        await api.delete(`/inventory/comments/${id}`);
        setComments((prev) => prev.filter((c) => c.id !== id));
        load(); // refresh comment_count badges in the table
    }

    if (!room) return <Layout title="Room"><p className="text-gray-500">Loading...</p></Layout>;

    return (
        <Layout title={`${room.room_code} - ${room.room_name}`}>
            <Link to={`/inventory/buildings/${encodeURIComponent(room.building)}`} className="inline-flex items-center gap-1.5 text-brand-600 text-sm font-medium hover:underline mb-4">
                <ArrowLeft className="w-4 h-4" /> Back to {room.building}
            </Link>

            <div className="bg-white rounded-xl shadow p-4 sm:p-5 mb-6">
                <h3 className="font-semibold text-brand-900 mb-2">Assigned Personnel:</h3>
                {personnel.length === 0 ? (
                    <p className="text-gray-400 text-sm">No one is assigned to this room yet.</p>
                ) : (
                    <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                        {personnel.map((p) => <li key={p.id}>{p.personnel_name}</li>)}
                    </ul>
                )}
            </div>

            <div className="flex flex-wrap items-center gap-3 mb-6">
                {canManage && (
                    <>
                        <button onClick={() => { resetForm(); setShowForm(!showForm); }} className="inline-flex items-center gap-2 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white px-4 py-2.5 rounded-lg font-medium min-h-[42px]">
                            <Plus className="w-4 h-4" /> Add Inventory
                        </button>
                        <button onClick={handleGenerateItems} className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white px-4 py-2.5 rounded-lg font-medium min-h-[42px]">
                            <RefreshCw className="w-4 h-4" /> Generate Items
                        </button>
                    </>
                )}
                <input
                    placeholder="Search inventory..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="flex-1 min-w-[180px] p-2 border rounded-lg"
                />
                <select value={status} onChange={(e) => setStatus(e.target.value)} className="p-2 border rounded-lg">
                    <option value="">All Status</option>
                    <option value="working">Working</option>
                    <option value="for_repair">For Repair</option>
                    <option value="non_working">Non-Working</option>
                    <option value="salvage">Unserviceable</option>
                </select>
            </div>

            <Modal open={showForm} onClose={resetForm} title={editingId ? 'Edit Inventory Item' : 'Add Inventory Item'} maxWidth="max-w-3xl">
                <form onSubmit={handleSubmit} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <input required disabled={!!editingId} placeholder="Asset Code" value={form.asset_code} onChange={(e) => setForm({ ...form, asset_code: e.target.value })} className="p-2 border rounded disabled:bg-gray-100" />
                    <input required placeholder="Asset Name" value={form.asset_name} onChange={(e) => setForm({ ...form, asset_name: e.target.value })} className="p-2 border rounded" />
                    <input placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="p-2 border rounded" />
                    <input type="date" value={form.purchase_date} onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} className="p-2 border rounded" />
                    <input type="number" step="0.01" placeholder="Purchase Price" value={form.purchase_price} onChange={(e) => setForm({ ...form, purchase_price: e.target.value })} className="p-2 border rounded" />
                    <input placeholder="Repair Reason (optional)" value={form.repair_reason} onChange={(e) => setForm({ ...form, repair_reason: e.target.value })} className="p-2 border rounded" />

                    {['working', 'for_repair', 'non_working', 'salvage'].map((f) => (
                        <div key={f}>
                            <label className="text-xs text-gray-500 capitalize">{f === 'salvage' ? 'Unserviceable' : f.replace('_', ' ')}</label>
                            <input type="number" min="0" value={form[f]} onChange={(e) => setForm({ ...form, [f]: e.target.value })} className="p-2 border rounded w-full" />
                        </div>
                    ))}

                    <label className="flex items-center gap-2 text-sm sm:col-span-2 lg:col-span-3">
                        <input type="checkbox" checked={form.apply_to_all_rooms} onChange={(e) => setForm({ ...form, apply_to_all_rooms: e.target.checked })} />
                        {editingId
                            ? 'Apply this edit to every room that has this asset code'
                            : 'Also add this item to every other room that doesn\'t have this asset code yet'}
                    </label>

                    <div className="sm:col-span-2 lg:col-span-3 flex flex-wrap gap-2">
                        <button type="submit" className="bg-brand-600 text-white rounded-lg px-4 py-2.5 font-semibold hover:bg-brand-700 min-h-[44px]">
                            {editingId ? 'Save Changes' : 'Add Item'}
                        </button>
                        <button type="button" onClick={resetForm} className="bg-gray-200 text-gray-700 rounded-lg px-4 py-2.5 font-semibold hover:bg-gray-300 min-h-[44px]">Cancel</button>
                    </div>
                </form>
            </Modal>

            <div className="overflow-x-auto thin-scrollbar bg-white rounded-xl shadow p-4 sm:p-6">
                <table className="w-full text-sm text-left">
                    <thead className="bg-brand-700 text-white uppercase text-xs">
                        <tr>
                            {canManage && <th className="py-2 px-3 whitespace-nowrap">Actions</th>}
                            <th className="py-2 px-3 whitespace-nowrap">Asset Code</th>
                            <th className="py-2 px-3 whitespace-nowrap">Asset Name</th>
                            <th className="py-2 px-3 whitespace-nowrap">Description</th>
                            <th className="py-2 px-3 whitespace-nowrap">Purchase Date</th>
                            <th className="py-2 px-3 whitespace-nowrap">Price</th>
                            <th className="py-2 px-3 whitespace-nowrap">Working</th>
                            <th className="py-2 px-3 whitespace-nowrap">For Repair</th>
                            <th className="py-2 px-3 whitespace-nowrap">Non Working</th>
                            <th className="py-2 px-3 whitespace-nowrap">Unserviceable</th>
                            <th className="py-2 px-3 whitespace-nowrap">Total</th>
                            <th className="py-2 px-3 whitespace-nowrap">Comments</th>
                        </tr>
                    </thead>
                    <tbody>
                        {pagedItems.map((item) => (
                            <tr key={item.id} className="border-b hover:bg-brand-50">
                                {canManage && (
                                    <td className="py-2 px-3 space-x-1 whitespace-nowrap">
                                        <button onClick={() => startEdit(item)} aria-label="Edit item" className="w-8 h-8 inline-flex items-center justify-center bg-yellow-400 hover:bg-yellow-500 active:bg-yellow-600 rounded-lg text-white transition"><Pencil className="w-3.5 h-3.5" /></button>
                                        <button onClick={() => handleDelete(item)} aria-label="Delete item" className="w-8 h-8 inline-flex items-center justify-center bg-red-500 hover:bg-red-600 active:bg-red-700 rounded-lg text-white transition"><Trash2 className="w-3.5 h-3.5" /></button>
                                    </td>
                                )}
                                <td className="py-2 px-3 text-brand-700 font-medium whitespace-nowrap">{item.asset_code}</td>
                                <td className="py-2 px-3">
                                    {item.asset_name}
                                    {item.repair_reason && <div className="text-xs text-yellow-700">Repair note: {item.repair_reason}</div>}
                                </td>
                                <td className="py-2 px-3">{item.description || ''}</td>
                                <td className="py-2 px-3">{item.purchase_date || '—'}</td>
                                <td className="py-2 px-3">₱{Number(item.purchase_price).toLocaleString()}</td>
                                <td className="py-2 px-3"><Badge value={item.working} color="green" /></td>
                                <td className="py-2 px-3">
                                    <Badge value={item.for_repair} color="yellow" />
                                    {daysInRepair(item) !== null && (
                                        <div className={`text-[10px] mt-1 font-medium whitespace-nowrap ${daysInRepair(item) >= 45 ? 'text-red-600' : 'text-gray-400'}`}>
                                            {daysInRepair(item)}d in repair
                                        </div>
                                    )}
                                </td>
                                <td className="py-2 px-3"><Badge value={item.non_working} color="red" /></td>
                                <td className="py-2 px-3"><Badge value={item.salvage} color="gray" /></td>
                                <td className="py-2 px-3 font-semibold">{item.total}</td>
                                <td className="py-2 px-3">
                                    <button onClick={() => openComments(item)} className="inline-flex items-center gap-1 text-brand-600 hover:text-brand-800 text-xs font-medium">
                                        <MessageSquare className="w-3.5 h-3.5" />
                                        Comments
                                        {item.comment_count > 0 && (
                                            <span className="bg-brand-600 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">
                                                {item.comment_count}
                                            </span>
                                        )}
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {items.length === 0 && (
                            <tr><td colSpan={canManage ? 12 : 11} className="text-center text-gray-400 py-6">No items in this room yet.</td></tr>
                        )}
                    </tbody>
                </table>
                <Pagination page={page} totalPages={totalPages} totalItems={items.length} pageSize={15} onPageChange={setPage} />
            </div>

            <Modal open={!!commentItem} onClose={closeComments} title={commentItem ? `Comments - ${commentItem.asset_name}` : 'Comments'} maxWidth="max-w-lg">
                <div className="max-h-80 overflow-y-auto thin-scrollbar space-y-3 mb-4">
                    {commentsLoading && <p className="text-sm text-gray-400">Loading...</p>}
                    {!commentsLoading && comments.length === 0 && (
                        <p className="text-sm text-gray-400">No comments yet. Be the first to leave one.</p>
                    )}
                    {comments.map((c) => (
                        <div key={c.id} className="bg-gray-50 rounded-lg p-3">
                            <div className="flex items-center justify-between gap-2 mb-1">
                                <span className="text-xs font-semibold text-brand-800">{c.author_name}</span>
                                <span className="text-xs text-gray-400">{formatDateTime(c.created_at)}</span>
                            </div>
                            <p className="text-sm text-gray-700 whitespace-pre-wrap">{c.comment}</p>
                            {(c.user_id === user.id || canManage) && (
                                <button onClick={() => deleteComment(c.id)} className="text-xs text-red-500 hover:text-red-700 mt-1">Delete</button>
                            )}
                        </div>
                    ))}
                </div>
                <form onSubmit={submitComment} className="flex gap-2">
                    <input
                        placeholder="Add a comment..."
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        className="flex-1 p-2.5 border rounded-lg"
                    />
                    <button type="submit" className="bg-brand-600 hover:bg-brand-700 text-white rounded-lg px-4 flex items-center justify-center">
                        <Send className="w-4 h-4" />
                    </button>
                </form>
            </Modal>
        </Layout>
    );
}
