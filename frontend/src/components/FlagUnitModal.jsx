import React, { useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import Modal from './Modal';
import api from '../api/axios';

// Lets inventory staff name the SPECIFIC unit that needs repair - e.g. the
// mouse on PC-17 out of 40 mice in a comlab. Counts are kept in sync by the
// backend (flagging a unit moves it from Working to For Repair).
export default function FlagUnitModal({ item, open, onClose, onSaved }) {
    const [label, setLabel] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => { if (open) { setLabel(''); } }, [open]);

    async function submit(e) {
        e.preventDefault();
        setSaving(true);
        try {
            await api.post(`/inventory/${item.id}/repair-units`, { unit_label: label });
            onSaved?.();
            onClose();
        } catch (err) {
            Swal.fire('Error', err.response?.data?.error || 'Failed to flag unit.', 'error');
        } finally {
            setSaving(false);
        }
    }

    return (
        <Modal open={open} onClose={onClose} title={item ? `Flag a unit - ${item.asset_name}` : 'Flag a unit'} maxWidth="max-w-md">
            {item && (
                <form onSubmit={submit} className="space-y-3">
                    <p className="text-xs text-gray-500">
                        {item.room_name || item.room_code}: {item.working} working, {item.for_repair} for repair.
                        Name the exact unit so the repair list shows which one it is.
                    </p>
                    <input
                        required autoFocus maxLength={150}
                        placeholder='Which one? e.g. "PC-17 mouse" or serial no.'
                        value={label} onChange={(e) => setLabel(e.target.value)}
                        className="w-full p-2.5 border rounded-lg"
                    />
                    <div className="flex gap-2">
                        <button disabled={saving} type="submit" className="bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white rounded-lg px-4 py-2.5 font-semibold min-h-[44px]">Flag for repair</button>
                        <button type="button" onClick={onClose} className="bg-gray-200 text-gray-700 rounded-lg px-4 py-2.5 font-semibold hover:bg-gray-300 min-h-[44px]">Cancel</button>
                    </div>
                </form>
            )}
        </Modal>
    );
}
