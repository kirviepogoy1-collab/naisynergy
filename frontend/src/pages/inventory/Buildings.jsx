import React, { useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import { useNavigate } from 'react-router-dom';
import { Building2, Plus } from 'lucide-react';
import Layout from '../../components/Layout';
import Modal from '../../components/Modal';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';

export default function Buildings() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const canManage = user.role === 'superadmin' || user.role === 'inventory_staff';

    const [buildings, setBuildings] = useState([]);
    const [counts, setCounts] = useState({});
    const [showForm, setShowForm] = useState(false);
    const [name, setName] = useState('');

    async function load() {
        const [{ data: buildingList }, { data: rooms }] = await Promise.all([
            api.get('/buildings'),
            api.get('/rooms')
        ]);
        setBuildings(buildingList);

        const byBuilding = {};
        for (const r of rooms) byBuilding[r.building] = (byBuilding[r.building] || 0) + 1;
        setCounts(byBuilding);
    }

    useEffect(() => { load(); }, []);

    async function handleCreate(e) {
        e.preventDefault();
        try {
            await api.post('/buildings', { name: name.trim() });
            setName('');
            setShowForm(false);
            Swal.fire('Success', 'Building added.', 'success');
            load();
        } catch (err) {
            Swal.fire('Error', err.response?.data?.error || 'Failed to add building.', 'error');
        }
    }

    return (
        <Layout title="Buildings">
            {canManage && (
                <div className="mb-6">
                    <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 bg-brand-600 text-white px-4 py-2.5 rounded-lg font-semibold hover:bg-brand-700 min-h-[44px]">
                        <Plus className="w-4 h-4" /> New Building
                    </button>
                </div>
            )}

            <Modal open={showForm} onClose={() => setShowForm(false)} title="Add Building" maxWidth="max-w-md">
                <form onSubmit={handleCreate} className="grid gap-4">
                    <input required autoFocus placeholder="Building name (e.g. Science Wing)" value={name} onChange={(e) => setName(e.target.value)} className="p-2.5 border rounded-lg" />
                    <div className="flex flex-wrap gap-2">
                        <button type="submit" className="bg-brand-600 text-white rounded-lg px-4 py-2.5 font-semibold hover:bg-brand-700 min-h-[44px]">Create Building</button>
                        <button type="button" onClick={() => setShowForm(false)} className="bg-gray-200 text-gray-700 rounded-lg px-4 py-2.5 font-semibold hover:bg-gray-300 min-h-[44px]">Cancel</button>
                    </div>
                </form>
            </Modal>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
                {buildings.map((b) => (
                    <button
                        key={b.id ?? b.name}
                        onClick={() => navigate(`/inventory/buildings/${encodeURIComponent(b.name)}`)}
                        className="bg-white rounded-2xl shadow hover:shadow-lg active:shadow-sm transition p-5 sm:p-6 text-left border-2 border-transparent hover:border-brand-400"
                    >
                        <div className="w-12 h-12 rounded-xl bg-brand-50 flex items-center justify-center mb-3">
                            <Building2 className="w-6 h-6 text-brand-700" />
                        </div>
                        <h3 className="text-lg font-bold text-brand-900">{b.name}</h3>
                        <p className="text-sm text-gray-500 mt-1">{counts[b.name] || 0} room(s)</p>
                    </button>
                ))}
                {buildings.length === 0 && <p className="text-gray-400 col-span-full">No buildings yet.</p>}
            </div>
        </Layout>
    );
}
