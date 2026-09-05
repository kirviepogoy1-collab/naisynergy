import React, { useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import { Plus, RotateCcw, Pencil, Trash2 } from 'lucide-react';
import Layout from '../../components/Layout';
import Modal from '../../components/Modal';
import api from '../../api/axios';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]; // Feb shown as 29 so "day 29" stays pickable for leap years
const EMPTY_FORM = { name: '', default_days: '5', is_capped: true, employee_selectable: true, auto_reset_month: '', auto_reset_day: '1' };

// e.g. day=3 -> "3rd", day=21 -> "21st"
function ordinal(day) {
    const n = Number(day);
    if (n % 10 === 1 && n !== 11) return `${n}st`;
    if (n % 10 === 2 && n !== 12) return `${n}nd`;
    if (n % 10 === 3 && n !== 13) return `${n}rd`;
    return `${n}th`;
}

export default function LeaveTypes() {
    const [types, setTypes] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState(null); // the leave type row being edited, or null for "new"
    const [form, setForm] = useState(EMPTY_FORM);

    async function load() {
        const { data } = await api.get('/leave-types');
        setTypes(data);
    }

    useEffect(() => { load(); }, []);

    function openNew() {
        setEditing(null);
        setForm(EMPTY_FORM);
        setShowForm(true);
    }

    function openEdit(t) {
        setEditing(t);
        setForm({
            name: t.name,
            default_days: String(t.default_days),
            is_capped: !!t.is_capped,
            employee_selectable: !!t.employee_selectable,
            auto_reset_month: t.auto_reset_month ? String(t.auto_reset_month) : '',
            auto_reset_day: t.auto_reset_day ? String(t.auto_reset_day) : '1'
        });
        setShowForm(true);
    }

    async function handleSave(e) {
        e.preventDefault();
        const payload = {
            name: form.name.trim(),
            default_days: Number(form.default_days),
            is_capped: form.is_capped,
            employee_selectable: form.employee_selectable,
            auto_reset_month: form.auto_reset_month === '' ? null : Number(form.auto_reset_month),
            auto_reset_day: form.auto_reset_month === '' ? null : Number(form.auto_reset_day || 1)
        };
        try {
            if (editing) {
                await api.put(`/leave-types/${editing.id}`, payload);
                Swal.fire('Saved', 'Leave type updated.', 'success');
            } else {
                await api.post('/leave-types', payload);
                Swal.fire('Added', 'Leave type added. Every employee now has a balance for it.', 'success');
            }
            setShowForm(false);
            load();
        } catch (err) {
            Swal.fire('Error', err.response?.data?.error || 'Failed to save leave type.', 'error');
        }
    }

    async function handleToggleActive(t) {
        try {
            await api.put(`/leave-types/${t.id}`, { is_active: !t.is_active });
            load();
        } catch (err) {
            Swal.fire('Error', err.response?.data?.error || 'Failed to update leave type.', 'error');
        }
    }

    async function handleReset(t) {
        const confirm = await Swal.fire({
            title: `Reset "${t.name}" for everyone?`,
            text: `Every employee's balance for this type goes back to ${t.default_days} day(s). This can't be undone.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Reset for all employees',
            confirmButtonColor: '#dc2626'
        });
        if (!confirm.isConfirmed) return;
        try {
            await api.post(`/leave-types/${t.id}/reset`, {});
            Swal.fire('Done', `"${t.name}" has been reset for everyone.`, 'success');
            load();
        } catch (err) {
            Swal.fire('Error', err.response?.data?.error || 'Failed to reset balance.', 'error');
        }
    }

    async function handleResetAll() {
        const confirm = await Swal.fire({
            title: 'Reset ALL leave types for everyone?',
            text: 'Every employee, every leave type, back to its default day count. This can\'t be undone.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Reset everything',
            confirmButtonColor: '#dc2626'
        });
        if (!confirm.isConfirmed) return;
        try {
            await api.post('/leave-types/reset-all', {});
            Swal.fire('Done', 'All leave balances have been reset.', 'success');
            load();
        } catch (err) {
            Swal.fire('Error', err.response?.data?.error || 'Failed to reset balances.', 'error');
        }
    }

    async function handleDelete(t) {
        if (t.leaves_count > 0) {
            Swal.fire('Can\'t delete', 'This leave type has existing leave requests. Deactivate it instead so history stays intact.', 'info');
            return;
        }
        const confirm = await Swal.fire({
            title: `Delete "${t.name}"?`,
            text: 'This leave type has never been used, so this is safe - it can be undone by re-adding it.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Delete',
            confirmButtonColor: '#dc2626'
        });
        if (!confirm.isConfirmed) return;
        try {
            await api.delete(`/leave-types/${t.id}`);
            load();
        } catch (err) {
            Swal.fire('Error', err.response?.data?.error || 'Failed to delete leave type.', 'error');
        }
    }

    return (
        <Layout title="Leave Types" headerExtra={
            <button onClick={handleResetAll} className="inline-flex items-center gap-2 bg-red-50 text-red-700 border border-red-200 px-3 py-2 rounded-lg text-xs font-semibold hover:bg-red-100 whitespace-nowrap">
                <RotateCcw className="w-4 h-4" /> Reset All Types
            </button>
        }>
            <div className="mb-6">
                <button onClick={openNew} className="inline-flex items-center gap-2 bg-brand-600 text-white px-4 py-2.5 rounded-lg font-semibold hover:bg-brand-700 min-h-[44px]">
                    <Plus className="w-4 h-4" /> New Leave Type
                </button>
            </div>

            <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? 'Edit Leave Type' : 'Add Leave Type'} maxWidth="max-w-md">
                <form onSubmit={handleSave} className="grid gap-4">
                    <div>
                        <label className="block text-sm font-medium text-brand-900 mb-1">Name</label>
                        <input
                            required autoFocus placeholder="e.g. Bereavement Leave"
                            value={form.name}
                            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                            className="w-full p-2.5 border rounded-lg"
                            disabled={editing && editing.leaves_count > 0}
                        />
                        {editing && editing.leaves_count > 0 && (
                            <p className="text-xs text-gray-400 mt-1">Can't rename - this type already has {editing.leaves_count} leave request(s).</p>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-brand-900 mb-1">Days per reset</label>
                        <input
                            required type="number" min="0" step="0.5"
                            value={form.default_days}
                            onChange={(e) => setForm((f) => ({ ...f, default_days: e.target.value }))}
                            className="w-full p-2.5 border rounded-lg"
                        />
                    </div>

                    <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={form.is_capped} onChange={(e) => setForm((f) => ({ ...f, is_capped: e.target.checked }))} />
                        Capped - counts against the balance above (uncheck for granted-as-needed types like Maternity/Paternity)
                    </label>

                    {form.is_capped && (
                        <div>
                            <label className="block text-sm font-medium text-brand-900 mb-1">Auto-reset every year on</label>
                            <select
                                value={form.auto_reset_month}
                                onChange={(e) => {
                                    const month = e.target.value;
                                    setForm((f) => {
                                        if (month === '') return { ...f, auto_reset_month: month };
                                        const maxDay = DAYS_IN_MONTH[Number(month) - 1];
                                        const day = Number(f.auto_reset_day || 1);
                                        return { ...f, auto_reset_month: month, auto_reset_day: String(Math.min(day, maxDay)) };
                                    });
                                }}
                                className="w-full p-2.5 border rounded-lg"
                            >
                                <option value="">Manual only - I'll press Reset myself</option>
                                {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                            </select>

                            {form.auto_reset_month !== '' && (
                                <div className="mt-2">
                                    <select
                                        value={form.auto_reset_day}
                                        onChange={(e) => setForm((f) => ({ ...f, auto_reset_day: e.target.value }))}
                                        className="w-full p-2.5 border rounded-lg"
                                    >
                                        {Array.from({ length: DAYS_IN_MONTH[Number(form.auto_reset_month) - 1] }, (_, i) => i + 1).map((d) => (
                                            <option key={d} value={d}>{ordinal(d)}</option>
                                        ))}
                                    </select>
                                    <p className="text-xs text-gray-400 mt-1">
                                        In months without this day (e.g. {ordinal(30)} in February), it resets on that month's last day instead.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={form.employee_selectable} onChange={(e) => setForm((f) => ({ ...f, employee_selectable: e.target.checked }))} />
                        Employees can select this when applying for leave
                    </label>

                    <div className="flex flex-wrap gap-2">
                        <button type="submit" className="bg-brand-600 text-white rounded-lg px-4 py-2.5 font-semibold hover:bg-brand-700 min-h-[44px]">
                            {editing ? 'Save Changes' : 'Create Leave Type'}
                        </button>
                        <button type="button" onClick={() => setShowForm(false)} className="bg-gray-200 text-gray-700 rounded-lg px-4 py-2.5 font-semibold hover:bg-gray-300 min-h-[44px]">Cancel</button>
                    </div>
                </form>
            </Modal>

            <div className="overflow-x-auto thin-scrollbar bg-white rounded-xl shadow p-4 sm:p-6">
                <table className="w-full text-sm text-left">
                    <thead className="bg-brand-700 text-white uppercase text-xs font-semibold">
                        <tr>
                            <th className="py-3 px-4 whitespace-nowrap">Name</th>
                            <th className="py-3 px-4 whitespace-nowrap">Days</th>
                            <th className="py-3 px-4 whitespace-nowrap">Capped</th>
                            <th className="py-3 px-4 whitespace-nowrap">Auto-reset</th>
                            <th className="py-3 px-4 whitespace-nowrap">Employee-selectable</th>
                            <th className="py-3 px-4 whitespace-nowrap">Status</th>
                            <th className="py-3 px-4 whitespace-nowrap">Requests</th>
                            <th className="py-3 px-4 whitespace-nowrap">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {types.map((t) => (
                            <tr key={t.id} className="border-b hover:bg-brand-50">
                                <td className="py-2 px-4 whitespace-nowrap font-medium">{t.name}</td>
                                <td className="py-2 px-4 whitespace-nowrap">{Number(t.default_days)}</td>
                                <td className="py-2 px-4 whitespace-nowrap">{t.is_capped ? 'Yes' : 'No'}</td>
                                <td className="py-2 px-4 whitespace-nowrap">{t.auto_reset_month ? `${ordinal(t.auto_reset_day || 1)} of ${MONTHS[t.auto_reset_month - 1]}` : 'Manual only'}</td>
                                <td className="py-2 px-4 whitespace-nowrap">{t.employee_selectable ? 'Yes' : 'HR only'}</td>
                                <td className="py-2 px-4 whitespace-nowrap">
                                    <button
                                        onClick={() => handleToggleActive(t)}
                                        className={`px-2 py-1 rounded text-xs font-medium ${t.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                                    >
                                        {t.is_active ? 'Active' : 'Inactive'}
                                    </button>
                                </td>
                                <td className="py-2 px-4 whitespace-nowrap">{t.leaves_count}</td>
                                <td className="py-2 px-4">
                                    <div className="flex gap-2 whitespace-nowrap">
                                        <button onClick={() => openEdit(t)} className="bg-brand-600 hover:bg-brand-700 text-white px-2 py-1 rounded text-xs font-medium inline-flex items-center gap-1">
                                            <Pencil className="w-3 h-3" /> Edit
                                        </button>
                                        {t.is_capped && (
                                            <button onClick={() => handleReset(t)} className="bg-amber-500 hover:bg-amber-600 text-white px-2 py-1 rounded text-xs font-medium inline-flex items-center gap-1">
                                                <RotateCcw className="w-3 h-3" /> Reset
                                            </button>
                                        )}
                                        <button onClick={() => handleDelete(t)} className="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded text-xs font-medium inline-flex items-center gap-1">
                                            <Trash2 className="w-3 h-3" /> Delete
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {types.length === 0 && (
                            <tr><td colSpan="8" className="text-center text-gray-400 py-6">No leave types yet.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </Layout>
    );
}
