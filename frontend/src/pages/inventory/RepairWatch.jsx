import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Wrench, AlertTriangle, MessageSquare, Send, Check, X as XIcon, Plus } from 'lucide-react';
import Swal from 'sweetalert2';
import Layout from '../../components/Layout';
import Modal from '../../components/Modal';
import FlagUnitModal from '../../components/FlagUnitModal';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { formatDateTime } from '../../utils/formatDate';

const AGING_THRESHOLD_DAYS = 45;

export default function RepairWatch() {
    const { user } = useAuth();
    const canManage = user.role === 'superadmin' || user.role === 'inventory_staff';
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [commentItem, setCommentItem] = useState(null);
    const [flagItem, setFlagItem] = useState(null);
    const [roomFilter, setRoomFilter] = useState('');
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState('');
    const [commentsLoading, setCommentsLoading] = useState(false);

    useEffect(() => {
        api.get('/inventory/repair-watch').then(({ data }) => {
            setItems(data);
            setLoading(false);
        });
    }, []);

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

    async function refreshItems() {
        const { data } = await api.get('/inventory/repair-watch');
        setItems(data);
    }

    async function submitComment(e) {
        e.preventDefault();
        if (!newComment.trim()) return;
        await api.post(`/inventory/${commentItem.id}/comments`, { comment: newComment.trim() });
        setNewComment('');
        const { data } = await api.get(`/inventory/${commentItem.id}/comments`);
        setComments(data);
        refreshItems();
    }

    async function deleteComment(id) {
        await api.delete(`/inventory/comments/${id}`);
        setComments((prev) => prev.filter((c) => c.id !== id));
        refreshItems();
    }

    async function resolveUnit(unit, outcome) {
        const fixed = outcome === 'fixed';
        const result = await Swal.fire({
            title: fixed ? `Mark "${unit.unit_label}" as fixed?` : `Mark "${unit.unit_label}" as can't be repaired?`,
            icon: 'question', showCancelButton: true, confirmButtonColor: '#16a34a',
            confirmButtonText: fixed ? 'Yes, it works again' : 'Yes, non-working'
        });
        if (!result.isConfirmed) return;
        try {
            await api.post(`/inventory/repair-units/${unit.id}/resolve`, { outcome });
            refreshItems();
        } catch (err) {
            Swal.fire('Error', err.response?.data?.error || 'Failed to update.', 'error');
        }
    }

    // Room filter options come from the data already loaded (only rooms that
    // actually have something in repair), so a comlab with 40 mice can be
    // narrowed to just that room.
    const roomOptions = Array.from(new Map(items.map((i) => [i.room_code, `${i.room_name} (${i.building})`])).entries());
    const visibleItems = roomFilter ? items.filter((i) => i.room_code === roomFilter) : items;
    const aging = visibleItems.filter((i) => (i.days_in_repair ?? 0) >= AGING_THRESHOLD_DAYS);

    return (
        <Layout title="Repair Watch">
            <p className="text-sm text-gray-500 mb-6">
                Every item currently flagged "for repair," oldest first. Rows flagged {AGING_THRESHOLD_DAYS}+ days
                are highlighted so nothing quietly sits forgotten for a whole school year.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
                <StatTile label="Total In Repair" value={visibleItems.reduce((sum, i) => sum + Number(i.for_repair || 0), 0)} icon={Wrench} color="bg-yellow-100 text-yellow-700" />
                <StatTile label="Item Rows" value={visibleItems.length} icon={Wrench} color="bg-brand-100 text-brand-700" />
                <StatTile label={`${AGING_THRESHOLD_DAYS}+ Days`} value={aging.length} icon={AlertTriangle} color="bg-red-100 text-red-700" />
            </div>

            <div className="mb-4">
                <select value={roomFilter} onChange={(e) => setRoomFilter(e.target.value)} className="p-2.5 border rounded-lg w-full sm:w-80 bg-white">
                    <option value="">All rooms</option>
                    {roomOptions.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
                </select>
            </div>

            <div className="overflow-x-auto thin-scrollbar bg-white rounded-xl shadow p-4 sm:p-6">
                <table className="w-full text-sm text-left">
                    <thead className="bg-brand-700 text-white uppercase text-xs">
                        <tr>
                            <th className="py-2 px-3 whitespace-nowrap">Asset</th>
                            <th className="py-2 px-3 whitespace-nowrap">Room</th>
                            <th className="py-2 px-3 whitespace-nowrap">Building</th>
                            <th className="py-2 px-3 whitespace-nowrap">For Repair</th>
                            <th className="py-2 px-3 whitespace-nowrap">Which units</th>
                            <th className="py-2 px-3 whitespace-nowrap">Reason</th>
                            <th className="py-2 px-3 whitespace-nowrap">Days Flagged</th>
                            <th className="py-2 px-3 whitespace-nowrap">Comments</th>
                        </tr>
                    </thead>
                    <tbody>
                        {visibleItems.map((item) => {
                            const days = item.days_in_repair;
                            const isAging = days !== null && days >= AGING_THRESHOLD_DAYS;
                            return (
                                <tr key={item.id} className={`border-b hover:bg-brand-50 ${isAging ? 'bg-red-50' : ''}`}>
                                    <td className="py-2 px-3">
                                        <Link to={`/inventory/rooms/${item.room_code}`} className="font-medium text-brand-700 hover:underline">
                                            {item.asset_name}
                                        </Link>
                                        <div className="text-xs text-gray-400">{item.asset_code}</div>
                                    </td>
                                    <td className="py-2 px-3">{item.room_name}</td>
                                    <td className="py-2 px-3">{item.building}</td>
                                    <td className="py-2 px-3">
                                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full text-white text-xs font-semibold bg-yellow-500">{item.for_repair}</span>
                                    </td>
                                    <td className="py-2 px-3 min-w-[16rem]">
                                        <UnitList item={item} canManage={canManage} onResolve={resolveUnit} onFlag={() => setFlagItem(item)} />
                                    </td>
                                    <td className="py-2 px-3 text-gray-600">{item.repair_reason || '—'}</td>
                                    <td className="py-2 px-3">
                                        {days === null ? (
                                            <span className="text-gray-400">—</span>
                                        ) : (
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${isAging ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                                                {isAging && <AlertTriangle className="w-3 h-3" />}
                                                {days}d
                                            </span>
                                        )}
                                    </td>
                                    <td className="py-2 px-3">
                                        <button onClick={() => openComments(item)} className="inline-flex items-center gap-1 text-brand-600 hover:text-brand-800 text-xs font-medium">
                                            <MessageSquare className="w-3.5 h-3.5" />
                                            Comment
                                            {item.comment_count > 0 && (
                                                <span className="ml-1 bg-brand-100 text-brand-700 rounded-full px-1.5 py-0.5 text-[10px]">{item.comment_count}</span>
                                            )}
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                        {!loading && items.length === 0 && (
                            <tr><td colSpan={8} className="text-center text-gray-400 py-10">Nothing is currently flagged for repair. 🎉</td></tr>
                        )}
                        {loading && (
                            <tr><td colSpan={8} className="text-center text-gray-400 py-10">Loading...</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            <FlagUnitModal item={flagItem} open={!!flagItem} onClose={() => setFlagItem(null)} onSaved={refreshItems} />

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
                        placeholder="Add a comment, e.g. this is done repair..."
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

function UnitList({ item, canManage, onResolve, onFlag }) {
    const units = Array.isArray(item.units) ? item.units : [];
    const untagged = Math.max(Number(item.for_repair) - units.length, 0);
    return (
        <div className="space-y-1.5">
            {units.map((u) => (
                <div key={u.id} className="flex items-center justify-between gap-2 bg-yellow-50 border border-yellow-200 rounded-lg px-2 py-1">
                    <div className="min-w-0">
                        <p className="text-xs font-semibold text-gray-800 truncate">{u.unit_label}</p>
                        <p className="text-[10px] text-gray-500 truncate">{u.days}d in repair</p>
                    </div>
                    {canManage && (
                        <div className="flex gap-1 shrink-0">
                            <button onClick={() => onResolve(u, 'fixed')} title="Fixed - back to working" className="w-6 h-6 inline-flex items-center justify-center rounded bg-green-600 hover:bg-green-700 text-white"><Check className="w-3.5 h-3.5" /></button>
                            <button onClick={() => onResolve(u, 'non_working')} title="Can't be repaired" className="w-6 h-6 inline-flex items-center justify-center rounded bg-red-500 hover:bg-red-600 text-white"><XIcon className="w-3.5 h-3.5" /></button>
                        </div>
                    )}
                </div>
            ))}
            {untagged > 0 && (
                <p className="text-[11px] text-amber-700">{untagged} unit{untagged > 1 ? 's' : ''} not identified yet</p>
            )}
            {canManage && (
                <button onClick={onFlag} className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:text-brand-900">
                    <Plus className="w-3 h-3" /> {untagged > 0 ? 'Name a unit' : 'Flag another unit'}
                </button>
            )}
        </div>
    );
}

function StatTile({ label, value, icon: Icon, color }) {
    return (
        <div className="bg-white rounded-xl shadow p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${color}`}>
                <Icon className="w-5 h-5" />
            </div>
            <div>
                <p className="text-xl font-bold text-brand-800">{value}</p>
                <p className="text-xs text-gray-500">{label}</p>
            </div>
        </div>
    );
}
