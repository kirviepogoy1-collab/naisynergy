import React, { useEffect, useState } from 'react';
import { Users, UserCog, Boxes, GraduationCap } from 'lucide-react';
import Layout from '../../components/Layout';
import api from '../../api/axios';
import { formatDateTime } from '../../utils/formatDate';

export default function SuperadminDashboard() {
    const [stats, setStats] = useState(null);
    const [activity, setActivity] = useState([]);

    useEffect(() => {
        (async () => {
            const [usersRes, invSummaryRes, activityRes] = await Promise.all([
                api.get('/users'),
                api.get('/inventory/summary'),
                api.get('/users/activity/log')
            ]);
            const users = usersRes.data;
            setStats({
                total_users: users.length,
                by_role: users.reduce((acc, u) => {
                    acc[u.role] = (acc[u.role] || 0) + 1;
                    return acc;
                }, {}),
                inventory: invSummaryRes.data.overall
            });
            setActivity(activityRes.data.slice(0, 10));
        })();
    }, []);

    return (
        <Layout title="Superadmin Dashboard">
            {!stats ? (
                <p className="text-gray-500">Loading...</p>
            ) : (
                <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 mb-10">
                        <StatCard icon={Users} label="Total Users" value={stats.total_users} />
                        <StatCard icon={UserCog} label="HR Staff" value={stats.by_role.hr_staff || 0} />
                        <StatCard icon={Boxes} label="Inventory Staff" value={stats.by_role.inventory_staff || 0} />
                        <StatCard icon={GraduationCap} label="Employees" value={stats.by_role.employee || 0} />
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="bg-white rounded-2xl shadow p-4 sm:p-6">
                            <h2 className="text-lg font-bold text-brand-900 mb-4">Inventory Overview</h2>
                            <ul className="space-y-2 text-sm text-gray-700">
                                <li className="flex justify-between border-b border-gray-50 pb-2">Working assets <strong>{stats.inventory.working || 0}</strong></li>
                                <li className="flex justify-between border-b border-gray-50 pb-2">For repair <strong>{stats.inventory.for_repair || 0}</strong></li>
                                <li className="flex justify-between border-b border-gray-50 pb-2">Non-working <strong>{stats.inventory.non_working || 0}</strong></li>
                                <li className="flex justify-between border-b border-gray-50 pb-2">Unserviceable <strong>{stats.inventory.salvage || 0}</strong></li>
                                <li className="flex justify-between border-b border-gray-50 pb-2">Total assets <strong>{stats.inventory.total || 0}</strong></li>
                                <li className="flex justify-between">Total value <strong>₱{Number(stats.inventory.total_value || 0).toLocaleString()}</strong></li>
                            </ul>
                        </div>

                        <div className="bg-white rounded-2xl shadow p-4 sm:p-6">
                            <h2 className="text-lg font-bold text-brand-900 mb-4">Recent Activity</h2>
                            <ul className="space-y-2 text-sm text-gray-700 max-h-64 overflow-y-auto thin-scrollbar">
                                {activity.map((a) => (
                                    <li key={a.id} className="border-b border-gray-50 pb-2">
                                        <span className="font-medium">{a.actor_name}</span> {a.description}
                                        <span className="block text-xs text-gray-400">{formatDateTime(a.created_at)}</span>
                                    </li>
                                ))}
                                {activity.length === 0 && <li className="text-gray-400">No recent activity.</li>}
                            </ul>
                        </div>
                    </div>
                </>
            )}
        </Layout>
    );
}

function StatCard({ icon: Icon, label, value }) {
    return (
        <div className="bg-white rounded-2xl shadow p-4 sm:p-6 text-center">
            <div className="w-11 h-11 sm:w-12 sm:h-12 mx-auto mb-2.5 sm:mb-3 rounded-xl bg-brand-50 flex items-center justify-center">
                <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-brand-700" />
            </div>
            <p className="text-gray-600 font-medium text-xs sm:text-sm">{label}</p>
            <p className="text-xl sm:text-2xl font-bold text-brand-900 mt-1">{value}</p>
        </div>
    );
}
