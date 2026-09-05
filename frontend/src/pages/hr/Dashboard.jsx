import React, { useEffect, useState, useCallback } from 'react';
import Swal from 'sweetalert2';
import { CheckCircle2, FileClock, Ban, Hourglass, X, Eye } from 'lucide-react';
import Layout from '../../components/Layout';
import api from '../../api/axios';
import { fileUrl } from '../../utils/fileUrl';
import { confirmLeaveApproval } from '../../utils/leaveApproval';

export default function HrDashboard() {
    const [employees, setEmployees] = useState([]);
    const [leaves, setLeaves] = useState([]);
    const [pendingDocs, setPendingDocs] = useState([]);

    const [modal, setModal] = useState(null); // null | 'documents' | 'inactive' | 'leaves'
    const [expandedLeaveId, setExpandedLeaveId] = useState(null);
    const [expandedEmployeeId, setExpandedEmployeeId] = useState(null);

    const load = useCallback(async () => {
        const [empRes, leaveRes, docsRes] = await Promise.all([
            api.get('/employees'),
            api.get('/leaves'),
            api.get('/documents/pending')
        ]);
        setEmployees(empRes.data);
        setLeaves(leaveRes.data);
        setPendingDocs(docsRes.data);
    }, []);

    useEffect(() => {
        load();
        const interval = setInterval(load, 20000);
        return () => clearInterval(interval);
    }, [load]);

    const active = employees.filter((e) => e.is_active).length;
    // "Inactive" reflects HR's actual employment decision (they left, etc.),
    // not whether documents happen to be fully approved yet - tracked separately below.
    const inactive = employees.filter((e) => !e.is_active);
    // Real documents awaiting review, regardless of the employee's hiring status.
    const pendingLeaves = leaves.filter((l) => l.status === 'pending');

    async function approveDoc(docId, status) {
        await api.put(`/documents/${docId}/status`, { status });
        load();
    }

    async function approveLeave(leave) {
        const payStatus = await confirmLeaveApproval(leave);
        if (!payStatus) return;
        await api.put(`/leaves/${leave.id}/status`, { status: 'approved', pay_status: payStatus });
        load();
    }

    async function rejectLeave(leaveId) {
        await api.put(`/leaves/${leaveId}/status`, { status: 'rejected' });
        load();
    }

    async function reactivate(id) {
        await api.put(`/employees/${id}/active`, { is_active: true });
        Swal.fire('Success', 'Employee reactivated.', 'success');
        load();
    }

    return (
        <Layout title="HR Dashboard">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-6 mb-10">
                <StatCard icon={CheckCircle2} label="Active Employees" value={active} />
                <StatCard icon={FileClock} label="Pending Documents" value={pendingDocs.length} onClick={() => setModal('documents')} />
                <StatCard icon={Ban} label="Inactive" value={inactive.length} onClick={() => { setExpandedEmployeeId(null); setModal('inactive'); }} />
                <StatCard icon={Hourglass} label="Pending Leave Requests" value={pendingLeaves.length} onClick={() => { setExpandedLeaveId(null); setModal('leaves'); }} />
            </div>

            <div className="bg-white rounded-2xl shadow p-4 sm:p-6 max-w-3xl">
                <h2 className="text-lg font-bold text-brand-900 mb-4">Latest Leave Requests</h2>
                <div className="overflow-x-auto thin-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-brand-700 text-white">
                            <tr>
                                <th className="py-3 px-4 whitespace-nowrap">Employee</th>
                                <th className="py-3 px-4 whitespace-nowrap">Leave Type</th>
                                <th className="py-3 px-4 whitespace-nowrap">Days</th>
                                <th className="py-3 px-4 whitespace-nowrap">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {leaves.slice(0, 8).map((l) => (
                                <tr key={l.id} className="border-b last:border-0">
                                    <td className="py-3 px-4 whitespace-nowrap">{l.employee_name}</td>
                                    <td className="py-3 px-4 whitespace-nowrap">{l.leave_type}</td>
                                    <td className="py-3 px-4 whitespace-nowrap">{l.total_days}</td>
                                    <td className="py-3 px-4 capitalize whitespace-nowrap">{l.status}</td>
                                </tr>
                            ))}
                            {leaves.length === 0 && (
                                <tr><td colSpan="4" className="text-center text-gray-400 py-6">No leave requests yet.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {modal === 'documents' && (
                <QuickActionModal title="Pending Documents" onClose={() => setModal(null)}>
                    {pendingDocs.length === 0 && <EmptyRow text="No documents awaiting review." />}
                    {pendingDocs.map((d) => (
                        <ModalRow key={d.id}>
                            <div className="min-w-0">
                                <p className="font-medium text-gray-800 truncate">{d.employee_name}</p>
                                <p className="text-xs text-gray-500 truncate">{d.document_type}</p>
                                <p className="text-xs text-gray-400">Submitted {new Date(d.uploaded_at).toLocaleDateString()}</p>
                            </div>
                            <div className="flex gap-1.5 shrink-0">
                                {d.file_path && (
                                    <a href={fileUrl(d.file_path)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-2.5 py-1 rounded text-xs font-medium">
                                        <Eye className="w-3 h-3" /> View
                                    </a>
                                )}
                                <button onClick={() => approveDoc(d.id, 'Approved')} className="bg-green-500 hover:bg-green-600 text-white px-2.5 py-1 rounded text-xs font-medium">Approve</button>
                                <button onClick={() => approveDoc(d.id, 'Rejected')} className="bg-red-500 hover:bg-red-600 text-white px-2.5 py-1 rounded text-xs font-medium">Reject</button>
                            </div>
                        </ModalRow>
                    ))}
                </QuickActionModal>
            )}

            {modal === 'inactive' && (
                <QuickActionModal title="Inactive Employees" onClose={() => setModal(null)}>
                    {inactive.length === 0 && <EmptyRow text="Everyone here is active." />}
                    {inactive.map((e) => (
                        <div key={e.id}>
                            <ModalRow>
                                <div className="min-w-0">
                                    <p className="font-medium text-gray-800 truncate">{[e.first_name, e.middle_name, e.last_name].filter(Boolean).join(' ') || e.name}</p>
                                    <p className="text-xs text-gray-500 truncate">{e.email}</p>
                                </div>
                                <div className="flex gap-1.5 shrink-0">
                                    <button onClick={() => setExpandedEmployeeId(expandedEmployeeId === e.id ? null : e.id)} className="inline-flex items-center gap-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-2.5 py-1 rounded text-xs font-medium">
                                        <Eye className="w-3 h-3" /> View
                                    </button>
                                    <button onClick={() => reactivate(e.id)} className="bg-green-600 hover:bg-green-700 text-white px-2.5 py-1 rounded text-xs font-medium">Reactivate</button>
                                </div>
                            </ModalRow>
                            {expandedEmployeeId === e.id && (
                                <div className="px-5 pb-3 -mt-1 text-xs text-gray-600 space-y-1 bg-gray-50">
                                    <p><span className="font-semibold">Position:</span> {e.current_position || '-'}</p>
                                    <p><span className="font-semibold">Mobile:</span> {e.mobile_number || '-'}</p>
                                    <p><span className="font-semibold">Documents:</span> {e.doc_summary.approved} approved, {e.doc_summary.pending} pending, {e.doc_summary.not_uploaded} not uploaded</p>
                                </div>
                            )}
                        </div>
                    ))}
                </QuickActionModal>
            )}

            {modal === 'leaves' && (
                <QuickActionModal title="Pending Leave Requests" onClose={() => setModal(null)}>
                    {pendingLeaves.length === 0 && <EmptyRow text="No leave requests waiting on you." />}
                    {pendingLeaves.map((l) => (
                        <div key={l.id}>
                            <ModalRow>
                                <div className="min-w-0">
                                    <p className="font-medium text-gray-800 truncate">{l.employee_name}</p>
                                    <p className="text-xs text-gray-500 truncate">{l.leave_type} - {l.total_days} day(s)</p>
                                </div>
                                <div className="flex gap-1.5 shrink-0">
                                    <button onClick={() => setExpandedLeaveId(expandedLeaveId === l.id ? null : l.id)} className="inline-flex items-center gap-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-2.5 py-1 rounded text-xs font-medium">
                                        <Eye className="w-3 h-3" /> View
                                    </button>
                                    <button onClick={() => approveLeave(l)} className="bg-green-500 hover:bg-green-600 text-white px-2.5 py-1 rounded text-xs font-medium">Approve</button>
                                    <button onClick={() => rejectLeave(l.id)} className="bg-red-500 hover:bg-red-600 text-white px-2.5 py-1 rounded text-xs font-medium">Reject</button>
                                </div>
                            </ModalRow>
                            {expandedLeaveId === l.id && (
                                <div className="px-5 pb-3 -mt-1 text-xs text-gray-600 space-y-1 bg-gray-50">
                                    <p><span className="font-semibold">Dates:</span> {l.start_date} to {l.end_date}</p>
                                    <p><span className="font-semibold">Reason:</span> {l.reason || '-'}</p>
                                    <p><span className="font-semibold">Remaining balance:</span> {l.remaining_balance} day(s)</p>
                                    <p><span className="font-semibold">Applied:</span> {new Date(l.applied_at).toLocaleDateString()}</p>
                                </div>
                            )}
                        </div>
                    ))}
                </QuickActionModal>
            )}
        </Layout>
    );
}

function StatCard({ icon: Icon, label, value, onClick }) {
    const Wrapper = onClick ? 'button' : 'div';
    return (
        <Wrapper
            onClick={onClick}
            className={`bg-white rounded-2xl shadow p-4 sm:p-6 text-center w-full ${onClick ? 'hover:shadow-md active:scale-[0.98] transition cursor-pointer' : ''}`}
        >
            <div className="w-11 h-11 sm:w-12 sm:h-12 mx-auto mb-2.5 sm:mb-3 rounded-xl bg-brand-50 flex items-center justify-center">
                <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-brand-700" />
            </div>
            <p className="text-gray-600 font-medium text-xs sm:text-sm">{label}</p>
            <p className="text-xl sm:text-2xl font-bold text-brand-900 mt-1">{value}</p>
        </Wrapper>
    );
}

function QuickActionModal({ title, onClose, children }) {
    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-3 sm:p-4">
            <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl relative max-h-[85vh] flex flex-col">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                    <h3 className="font-bold text-brand-800">{title}</h3>
                    <button onClick={onClose} aria-label="Close" className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 transition">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="overflow-y-auto thin-scrollbar divide-y divide-gray-50">
                    {children}
                </div>
            </div>
        </div>
    );
}

function ModalRow({ children }) {
    return <div className="flex items-center justify-between gap-3 px-5 py-3">{children}</div>;
}

function EmptyRow({ text }) {
    return <p className="text-sm text-gray-400 text-center py-8">{text}</p>;
}
