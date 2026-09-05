import React, { useEffect, useRef, useState } from 'react';
import Swal from 'sweetalert2';
import { Download } from 'lucide-react';
import Layout from '../../components/Layout';
import api from '../../api/axios';
import { formatDateTime } from '../../utils/formatDate';
import { fileUrl } from '../../utils/fileUrl';
import { confirmLeaveApproval } from '../../utils/leaveApproval';

export default function LeaveApplications() {
    const [leaves, setLeaves] = useState([]);
    const [filter, setFilter] = useState('pending');
    const [mySignature, setMySignature] = useState(null);
    const fileInputRef = useRef(null);

    async function load() {
        const { data } = await api.get('/leaves');
        setLeaves(data);
    }

    async function loadMyProfile() {
        const { data } = await api.get('/profile');
        setMySignature(data.hr_signature_path || null);
    }

    useEffect(() => {
        load();
        loadMyProfile();
        // Keep the list fresh without a manual refresh - e.g. a new application
        // coming in while this tab is already open.
        const interval = setInterval(load, 20000);
        return () => clearInterval(interval);
    }, []);

    async function updateStatus(id, status, pay_status) {
        await api.put(`/leaves/${id}/status`, { status, pay_status });
        load();
    }

    async function handleApprove(leave) {
        const payStatus = await confirmLeaveApproval(leave);
        if (!payStatus) return;
        await updateStatus(leave.id, 'approved', payStatus);
    }

    async function handleReject(leave) {
        const confirm = await Swal.fire({
            title: 'Reject this leave request?',
            text: `${leave.employee_name}'s ${leave.leave_type} request will be marked rejected.`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Reject',
            confirmButtonColor: '#ef4444'
        });
        if (!confirm.isConfirmed) return;
        await updateStatus(leave.id, 'rejected');
    }

    function handleView(l) {
        const signatureHtml = l.reviewer_signature
            ? `<img src="${fileUrl(l.reviewer_signature)}" alt="signature" class="mx-auto mt-1 max-h-16" />`
            : `<p class="text-gray-400 text-xs mt-1">No signature on file</p>`;

        Swal.fire({
            title: 'Leave Request Details',
            html: `
                <div class="text-left text-sm space-y-1">
                    <p><strong>Employee:</strong> ${l.employee_name}</p>
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

    async function handleSignatureFile(e) {
        const file = e.target.files[0];
        if (!file) return;
        const formData = new FormData();
        formData.append('signature', file);
        try {
            const { data } = await api.post('/profile/signature', formData);
            setMySignature(data.hr_signature_path);
            Swal.fire('Saved', 'Your signature will now appear on leave decisions you make.', 'success');
        } catch (err) {
            Swal.fire('Error', err.response?.data?.error || 'Failed to upload signature.', 'error');
        }
        e.target.value = '';
    }

    const filtered = filter === 'all' ? leaves : leaves.filter((l) => l.status === filter);

    async function handleExport() {
        const res = await api.get('/leaves/export', { responseType: 'blob' });
        const url = window.URL.createObjectURL(new Blob([res.data]));
        const a = document.createElement('a');
        a.href = url;
        a.download = 'leave-requests.xlsx';
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
    }

    return (
        <Layout title="Leave Applications" headerExtra={
            <div className="flex flex-wrap items-center gap-2">
                {mySignature && (
                    <img src={fileUrl(mySignature)} alt="my signature" className="h-8 border rounded bg-white px-1" />
                )}
                <button
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs bg-white border border-brand-600 text-brand-700 px-3 py-2 rounded-lg font-medium whitespace-nowrap"
                >
                    {mySignature ? 'Change' : 'Upload'} My Signature
                </button>
                <input ref={fileInputRef} type="file" accept=".jpg,.jpeg,.png" className="hidden" onChange={handleSignatureFile} />
            </div>
        }>
            <div className="mb-6 flex flex-wrap items-center gap-2 overflow-x-auto thin-scrollbar pb-1">
                {['pending', 'approved', 'rejected', 'all'].map((f) => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium capitalize whitespace-nowrap ${filter === f ? 'bg-brand-600 text-white' : 'bg-white text-brand-700 border hover:bg-brand-50'}`}
                    >
                        {f}
                    </button>
                ))}
                <button onClick={handleExport} className="ml-auto inline-flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap">
                    <Download className="w-4 h-4" /> Export
                </button>
            </div>

            <div className="overflow-x-auto thin-scrollbar bg-white rounded-xl shadow p-4 sm:p-6">
                <table className="w-full text-sm text-left">
                    <thead className="bg-brand-700 text-white uppercase text-xs font-semibold">
                        <tr>
                            <th className="py-3 px-4 whitespace-nowrap">Employee</th>
                            <th className="py-3 px-4 whitespace-nowrap">Type</th>
                            <th className="py-3 px-4 whitespace-nowrap">Dates</th>
                            <th className="py-3 px-4 whitespace-nowrap">Days</th>
                            <th className="py-3 px-4 whitespace-nowrap">Remaining</th>
                            <th className="py-3 px-4 whitespace-nowrap">Reason</th>
                            <th className="py-3 px-4 whitespace-nowrap">Status</th>
                            <th className="py-3 px-4 whitespace-nowrap">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map((l) => {
                            const exceeds = l.remaining_balance !== null &&
                                l.total_days > l.remaining_balance;
                            return (
                                <tr key={l.id} className="border-b hover:bg-brand-50">
                                    <td className="py-2 px-4 whitespace-nowrap">{l.employee_name}</td>
                                    <td className="py-2 px-4 whitespace-nowrap">{l.leave_type}</td>
                                    <td className="py-2 px-4 whitespace-nowrap">{l.start_date} - {l.end_date}</td>
                                    <td className="py-2 px-4 whitespace-nowrap">{l.total_days}</td>
                                    <td className="py-2 px-4 whitespace-nowrap">
                                        {l.remaining_balance === null ? (
                                            <span className="text-gray-400">Uncapped</span>
                                        ) : (
                                            <span className={exceeds ? 'text-red-600 font-semibold' : ''}>
                                                {l.remaining_balance} day(s){exceeds && ' — exceeds'}
                                            </span>
                                        )}
                                    </td>
                                    <td className="py-2 px-4">{l.reason}</td>
                                    <td className="py-2 px-4 capitalize whitespace-nowrap">{l.status}</td>
                                    <td className="py-2 px-4">
                                        <div className="flex gap-2 whitespace-nowrap">
                                            {l.status === 'pending' && (
                                                <>
                                                    <button onClick={() => handleApprove(l)} className="bg-green-500 hover:bg-green-600 text-white px-2 py-1 rounded text-xs font-medium">Approve</button>
                                                    <button onClick={() => handleReject(l)} className="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded text-xs font-medium">Reject</button>
                                                </>
                                            )}
                                            <button onClick={() => handleView(l)} className="bg-brand-600 hover:bg-brand-700 text-white px-2 py-1 rounded text-xs font-medium">View</button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                        {filtered.length === 0 && (
                            <tr><td colSpan="8" className="text-center text-gray-400 py-6">No leave requests.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </Layout>
    );
}
