import React, { useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import { UserPlus, Trash2, Pencil } from 'lucide-react';
import Layout from '../../components/Layout';
import Modal from '../../components/Modal';
import PasswordInput from '../../components/PasswordInput';
import api from '../../api/axios';

const EMPTY_FORM = { name: '', username: '', email: '', password: '', role: 'inventory_staff' };
const ROLE_OPTIONS = [
    { value: 'inventory_staff', label: 'Inventory Staff (full access)' },
    { value: 'inventory_viewer', label: 'Viewer / Commentor (view + comment only)' }
];

export default function InventoryManageUsers() {
    const [users, setUsers] = useState([]);
    const [search, setSearch] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState(EMPTY_FORM);

    async function loadUsers() {
        const { data } = await api.get('/users', { params: { search, scope: 'inventory' } });
        setUsers(data);
    }

    useEffect(() => { loadUsers(); }, [search]);

    function resetForm() {
        setForm(EMPTY_FORM);
        setEditingId(null);
        setShowForm(false);
    }

    function startAdd() {
        setEditingId(null);
        setForm(EMPTY_FORM);
        setShowForm(true);
    }

    function startEdit(u) {
        setEditingId(u.id);
        setForm({ name: u.name, username: u.username, email: u.email, password: '', role: u.role });
        setShowForm(true);
    }

    async function handleSubmit(e) {
        e.preventDefault();
        try {
            if (editingId) {
                await api.put(`/users/${editingId}`, form);
                await api.put(`/users/${editingId}/role`, { role: form.role });
                Swal.fire('Updated', 'Account updated successfully.', 'success');
            } else {
                await api.post('/users', { ...form, scope: 'inventory' });
                Swal.fire('Created', 'Account created.', 'success');
            }
            resetForm();
            loadUsers();
        } catch (err) {
            Swal.fire('Error', err.response?.data?.error || 'Failed to save account.', 'error');
        }
    }

    async function handleDelete(id) {
        const result = await Swal.fire({
            title: 'Delete this account?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#16a34a'
        });
        if (result.isConfirmed) {
            try {
                await api.delete(`/users/${id}`);
                loadUsers();
            } catch (err) {
                Swal.fire('Error', err.response?.data?.error || 'Failed to delete account.', 'error');
            }
        }
    }

    return (
        <Layout title="Manage Users">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
                <input
                    placeholder="Search by name, username, or email"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="p-3 border rounded w-full sm:w-1/3 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <button onClick={startAdd} className="inline-flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2.5 rounded-lg font-semibold min-h-[44px] transition">
                    <UserPlus className="w-4 h-4" /> New User
                </button>
            </div>

            <Modal open={showForm} onClose={resetForm} title={editingId ? 'Edit Inventory Account' : 'New Inventory Account'} maxWidth="max-w-xl">
                <form onSubmit={handleSubmit} className="grid sm:grid-cols-2 gap-4">
                    <input required placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="p-2.5 border rounded-lg sm:col-span-2" />
                    <input required placeholder="Username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className="p-2.5 border rounded-lg" />
                    <input required type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="p-2.5 border rounded-lg" />
                    <div className="sm:col-span-2">
                        <PasswordInput
                            required={!editingId}
                            minLength={8}
                            placeholder={editingId ? 'New password (leave blank to keep current)' : 'Password'}
                            value={form.password}
                            onChange={(e) => setForm({ ...form, password: e.target.value })}
                            showStrength={!editingId || !!form.password}
                            inputClassName="p-2.5 border rounded-lg w-full"
                        />
                    </div>
                    <div className="sm:col-span-2">
                        <label className="text-xs font-medium text-gray-500 block mb-1">Account Type</label>
                        <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="p-2.5 border rounded-lg w-full">
                            {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                        </select>
                    </div>
                    <div className="sm:col-span-2 flex flex-wrap gap-2">
                        <button type="submit" className="bg-brand-600 hover:bg-brand-700 text-white rounded-lg px-4 py-2.5 font-semibold min-h-[44px]">{editingId ? 'Save Changes' : 'Create'}</button>
                        <button type="button" onClick={resetForm} className="bg-gray-200 text-gray-700 rounded-lg px-4 py-2.5 font-semibold hover:bg-gray-300 min-h-[44px]">Cancel</button>
                    </div>
                </form>
            </Modal>

            <div className="overflow-x-auto thin-scrollbar bg-white rounded-xl shadow p-4 sm:p-6">
                <table className="w-full text-sm text-left">
                    <thead className="bg-brand-700 text-white uppercase text-xs font-semibold">
                        <tr>
                            <th className="py-3 px-4 whitespace-nowrap">Name</th>
                            <th className="py-3 px-4 whitespace-nowrap">Username</th>
                            <th className="py-3 px-4 whitespace-nowrap">Email</th>
                            <th className="py-3 px-4 whitespace-nowrap">Type</th>
                            <th className="py-3 px-4 whitespace-nowrap">Online</th>
                            <th className="py-3 px-4 whitespace-nowrap">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map((u) => (
                            <tr key={u.id} className="border-b hover:bg-brand-50">
                                <td className="py-2 px-4 whitespace-nowrap">{u.name}</td>
                                <td className="py-2 px-4 whitespace-nowrap">{u.username}</td>
                                <td className="py-2 px-4 whitespace-nowrap">{u.email}</td>
                                <td className="py-2 px-4 whitespace-nowrap">
                                    {u.role === 'inventory_staff' ? (
                                        <span className="bg-brand-100 text-brand-700 px-2 py-1 rounded-full text-xs">Staff</span>
                                    ) : (
                                        <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-full text-xs">Viewer/Commentor</span>
                                    )}
                                </td>
                                <td className="py-2 px-4">
                                    {u.is_online ? (
                                        <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs whitespace-nowrap">Online</span>
                                    ) : (
                                        <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-full text-xs whitespace-nowrap">Offline</span>
                                    )}
                                </td>
                                <td className="py-2 px-4 whitespace-nowrap space-x-3">
                                    <button onClick={() => startEdit(u)} className="inline-flex items-center gap-1 text-slate-700 hover:text-slate-900 text-xs font-medium">
                                        <Pencil className="w-3.5 h-3.5" /> Edit
                                    </button>
                                    <button onClick={() => handleDelete(u.id)} className="inline-flex items-center gap-1 text-red-500 hover:text-red-700 text-xs font-medium">
                                        <Trash2 className="w-3.5 h-3.5" /> Delete
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {users.length === 0 && (
                            <tr><td colSpan={6} className="text-center text-gray-400 py-6">No inventory accounts yet.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </Layout>
    );
}
