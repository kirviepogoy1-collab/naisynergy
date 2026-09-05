import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Hourglass, ClipboardCheck, XCircle, ArrowRight } from 'lucide-react';
import Layout from '../../components/Layout';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';

export default function EmployeeDashboard() {
    const { user } = useAuth();
    const [leaveInfo, setLeaveInfo] = useState(null);

    useEffect(() => {
        api.get('/leaves/mine').then((res) => setLeaveInfo(res.data));
    }, []);

    const counts = { pending: 0, approved: 0, rejected: 0 };
    leaveInfo?.history.forEach((l) => { counts[l.status] = (counts[l.status] || 0) + 1; });

    return (
        <Layout title="Dashboard">
            <p className="text-brand-800 font-semibold mb-6">Welcome Back, {user.name}!</p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-6 mb-10">
                <StatCard icon={Hourglass} label="Pending Leaves" value={counts.pending} />
                <StatCard icon={ClipboardCheck} label="Approved Leaves" value={counts.approved} />
                <StatCard icon={XCircle} label="Rejected Leaves" value={counts.rejected} />
            </div>

            <div className="bg-white rounded-2xl shadow max-w-3xl overflow-hidden">
                <div className="overflow-x-auto thin-scrollbar">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-brand-700 text-white">
                            <tr>
                                <th className="py-3 px-5 whitespace-nowrap">Leave Type</th>
                                <th className="py-3 px-5 whitespace-nowrap">Date</th>
                                <th className="py-3 px-5 whitespace-nowrap">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {leaveInfo?.history.slice(0, 6).map((l) => (
                                <tr key={l.id} className="border-b last:border-0">
                                    <td className="py-3 px-5 font-medium whitespace-nowrap">{l.leave_type}</td>
                                    <td className="py-3 px-5 whitespace-nowrap">{l.start_date}</td>
                                    <td className="py-3 px-5 capitalize whitespace-nowrap">{l.status === 'approved' ? 'Approve' : l.status}</td>
                                </tr>
                            ))}
                            {(!leaveInfo || leaveInfo.history.length === 0) && (
                                <tr><td colSpan="3" className="text-center text-gray-400 py-6">No leave requests yet.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <Link to="/employee/apply-leave" className="inline-flex items-center gap-1.5 mt-4 text-brand-700 text-sm font-semibold underline underline-offset-2">
                Apply for leave <ArrowRight className="w-4 h-4" />
            </Link>
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
