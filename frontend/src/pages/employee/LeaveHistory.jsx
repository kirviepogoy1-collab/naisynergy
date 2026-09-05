import React, { useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import Layout from '../../components/Layout';
import api from '../../api/axios';
import { formatDateTime } from '../../utils/formatDate';
import { fileUrl } from '../../utils/fileUrl';

export default function LeaveHistory() {
    const [history, setHistory] = useState([]);
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState('');

    async function load() {
        const { data } = await api.get('/leaves/mine');
        setHistory(data.history);
    }

    useEffect(() => {
        load();
        const interval = setInterval(load, 20000);
        return () => clearInterval(interval);
    }, []);

    async function handleCancel(id) {
        const result = await Swal.fire({ title: 'Cancel this leave request?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#16a34a' });
        if (result.isConfirmed) {
            await api.post(`/leaves/${id}/cancel`);
            load();
        }
    }

    function handleView(l) {
        const signatureHtml = l.reviewer_signature
            ? `<img src="${fileUrl(l.reviewer_signature)}" alt="signature" class="mx-auto mt-1 max-h-16" />`
            : `<p class="text-gray-400 text-xs mt-1">No signature on file</p>`;

        Swal.fire({
            title: 'Leave Request Details',
            html: `
                <div class="text-left text-sm space-y-1">
                    <p><strong>Type:</strong> ${l.leave_type}</p>
                    <p><strong>Dates:</strong> ${l.start_date} - ${l.end_date}</p>
                    <p><strong>Days:</strong> ${l.total_days}</p>
                    <p><strong>Reason:</strong> ${l.reason || '-'}</p>
                    <p><strong>Status:</strong> <span class="capitalize">${l.status}</span></p>
                    ${l.status !== 'pending' ? `
                        <hr class="my-2" />
                        <p><strong>Pay Status:</strong> <span class="capitalize">${l.pay_status || '-'}</span></p>
                        <p><strong>Decided by:</strong> ${l.reviewed_by_name || '-'}</p>
                        <p><strong>Decided on:</strong> ${l.hr_date ? formatDateTime(l.hr_date) : '-'}</p>
                        <p class="text-center mt-2"><strong>Signature</strong></p>
                        ${signatureHtml}
                    ` : ''}
                </div>
            `
        });
    }

    const filtered = history.filter((l) => {
        const matchSearch = l.leave_type.toLowerCase().includes(search.toLowerCase());
        const matchStatus = !status || l.status === status;
        return matchSearch && matchStatus;
    });

    return (
        <Layout title="Leave History">
            <Link to="/employee/apply-leave" className="inline-flex items-center gap-1.5 text-brand-700 text-sm font-medium hover:underline mb-4">
                <ArrowLeft className="w-4 h-4" /> Back to Apply Leave
            </Link>

            <div className="bg-white rounded-2xl shadow p-4 sm:p-6 max-w-3xl">
                <div className="flex flex-col sm:flex-row gap-3 mb-4">
                    <input placeholder="Search by leave type..." value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1 p-2.5 border rounded-lg" />
                    <select value={status} onChange={(e) => setStatus(e.target.value)} className="p-2.5 border rounded-lg">
                        <option value="">All Status</option>
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                    </select>
                </div>

                <div className="overflow-x-auto thin-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
                <table className="w-full text-sm text-left rounded-lg overflow-hidden">
                    <thead className="bg-brand-700 text-white">
                        <tr>
                            <th className="py-3 px-4 whitespace-nowrap">Leave Type</th>
                            <th className="py-3 px-4 whitespace-nowrap">Date</th>
                            <th className="py-3 px-4 whitespace-nowrap">Status</th>
                            <th className="py-3 px-4"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map((l) => (
                            <tr key={l.id} className="border-b last:border-0">
                                <td className="py-3 px-4 whitespace-nowrap">{l.leave_type}</td>
                                <td className="py-3 px-4 whitespace-nowrap">{l.start_date}</td>
                                <td className="py-3 px-4 capitalize whitespace-nowrap">{l.status === 'approved' ? 'Approve' : l.status}</td>
                                <td className="py-3 px-4">
                                    <div className="flex gap-3 justify-end whitespace-nowrap">
                                        {l.status === 'pending' && (
                                            <button onClick={() => handleCancel(l.id)} className="text-red-500 hover:underline text-xs font-medium">Cancel</button>
                                        )}
                                        <button onClick={() => handleView(l)} className="text-brand-600 hover:underline text-xs font-medium">View</button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {filtered.length === 0 && (
                            <tr><td colSpan="4" className="text-center text-gray-400 py-6">No leave requests found.</td></tr>
                        )}
                    </tbody>
                </table>
                </div>
            </div>
        </Layout>
    );
}
