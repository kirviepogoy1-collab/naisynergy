import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Swal from 'sweetalert2';
import { CheckCircle2, AlertTriangle, XCircle, Eye, UserPlus, X, FileText, User, Download, FileDown, Upload, Pencil } from 'lucide-react';
import Layout from '../../components/Layout';
import Modal from '../../components/Modal';
import Pagination from '../../components/Pagination';
import usePagination from '../../hooks/usePagination';
import PasswordInput from '../../components/PasswordInput';
import api from '../../api/axios';
import { fileUrl } from '../../utils/fileUrl';
import { confirmLeaveApproval } from '../../utils/leaveApproval';

export default function Employees() {
    const [employees, setEmployees] = useState([]);
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('all');
    const [selected, setSelected] = useState(null); // full profile detail
    const [showAddForm, setShowAddForm] = useState(false);
    const [addForm, setAddForm] = useState({ name: '', username: '', email: '', password: '', employee_number: '', current_position: '', date_employment: '' });
    const [importing, setImporting] = useState(false);
    const fileInputRef = React.useRef(null);
    const [searchParams, setSearchParams] = useSearchParams();

    async function loadEmployees() {
        const { data } = await api.get('/employees');
        setEmployees(data);
    }

    useEffect(() => { loadEmployees(); }, []);

    // Coming from a notification (e.g. "?employee=5") - jump straight to that
    // employee's profile instead of making HR hunt for them in the table.
    useEffect(() => {
        const employeeId = searchParams.get('employee');
        if (employeeId) {
            openProfile(employeeId);
            searchParams.delete('employee');
            setSearchParams(searchParams, { replace: true });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    async function openProfile(id) {
        const { data } = await api.get(`/employees/${id}`);
        setSelected(data);
    }

    async function handleExport() {
        const res = await api.get('/employees/export', { responseType: 'blob' });
        const url = window.URL.createObjectURL(new Blob([res.data]));
        const a = document.createElement('a');
        a.href = url;
        a.download = 'employees.xlsx';
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
    }

    async function toggleActive(id, makeActive) {
        const verb = makeActive ? 'reactivate' : 'deactivate';
        const result = await Swal.fire({
            title: makeActive ? 'Reactivate employee?' : 'Deactivate employee?',
            text: makeActive ? undefined : "They'll be marked inactive but their record and documents stay on file.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: makeActive ? '#16a34a' : '#6b7280',
            confirmButtonText: makeActive ? 'Reactivate' : 'Deactivate'
        });
        if (!result.isConfirmed) return;
        await api.put(`/employees/${id}/active`, { is_active: makeActive });
        loadEmployees();
        if (selected?.id === id) openProfile(id);
    }

    async function removeEmployee(id) {
        const result = await Swal.fire({
            title: 'Remove this employee?',
            text: 'This permanently deletes their account, uploaded documents, and records. This cannot be undone.',
            icon: 'error',
            showCancelButton: true,
            confirmButtonColor: '#dc2626',
            confirmButtonText: 'Remove Permanently'
        });
        if (!result.isConfirmed) return;
        await api.delete(`/employees/${id}`);
        if (selected?.id === id) setSelected(null);
        loadEmployees();
    }

    async function updateDocStatus(docId, status) {
        await api.put(`/documents/${docId}/status`, { status });
        openProfile(selected.id);
        loadEmployees();
    }

    async function markDocNA(docName) {
        await api.post('/documents/mark-na', { user_id: selected.id, doc_name: docName });
        openProfile(selected.id);
        loadEmployees();
    }

    async function approveLeave(leave) {
        const payStatus = await confirmLeaveApproval(leave);
        if (!payStatus) return;
        await api.put(`/leaves/${leave.id}/status`, { status: 'approved', pay_status: payStatus });
        openProfile(selected.id);
        loadEmployees();
    }

    async function rejectLeave(leaveId) {
        await api.put(`/leaves/${leaveId}/status`, { status: 'rejected' });
        openProfile(selected.id);
        loadEmployees();
    }

    async function handleAddEmployee(e) {
        e.preventDefault();
        try {
            await api.post('/employees', addForm);
            Swal.fire('Success', 'Employee account created.', 'success');
            setAddForm({ name: '', username: '', email: '', password: '', employee_number: '', current_position: '', date_employment: '' });
            setShowAddForm(false);
            loadEmployees();
        } catch (err) {
            Swal.fire('Error', err.response?.data?.error || 'Failed to create employee account.', 'error');
        }
    }

    function downloadImportTemplate() {
        const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
        const token = localStorage.getItem('nai_token');
        const params = new URLSearchParams();
        if (token) params.set('token', token);
        window.open(`${baseUrl}/employees/import/template?${params.toString()}`, '_blank');
    }

    async function handleImportFile(e) {
        const file = e.target.files?.[0];
        e.target.value = ''; // allow re-selecting the same file next time
        if (!file) return;

        setImporting(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const { data } = await api.post('/employees/import', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            const errorList = data.errors.length
                ? `<div class="text-left text-xs text-red-600 mt-3 max-h-40 overflow-y-auto">${data.errors.map((er) => `Row ${er.row}: ${er.message}`).join('<br/>')}</div>`
                : '';
            Swal.fire({
                title: 'Import Finished',
                html: `${data.inserted} account(s) created, ${data.skipped} skipped.${errorList}`,
                icon: data.skipped > 0 ? 'warning' : 'success'
            });
            loadEmployees();
        } catch (err) {
            Swal.fire('Import Failed', err.response?.data?.error || 'Could not import that CSV.', 'error');
        } finally {
            setImporting(false);
        }
    }

    async function updateEmployeeNumber(employeeNumber) {
        try {
            await api.put(`/employees/${selected.id}/employee-number`, { employee_number: employeeNumber });
            openProfile(selected.id);
            loadEmployees();
        } catch (err) {
            Swal.fire('Could Not Update', err.response?.data?.error || 'Could not update the employee number.', 'error');
        }
    }

    async function updatePosition(position) {
        await api.put(`/employees/${selected.id}/position`, { current_position: position });
        openProfile(selected.id);
        loadEmployees();
    }

    async function updateDateEmployment(date) {
        await api.put(`/employees/${selected.id}/date-employment`, { date_employment: date });
        openProfile(selected.id);
        loadEmployees();
    }

    // Prefer the name the employee filled in on their own profile (First/Middle/Last)
    // over the placeholder name HR typed when first creating the account.
    function displayName(e) {
        return [e.first_name, e.middle_name, e.last_name].filter(Boolean).join(' ') || e.name;
    }

    const filtered = employees.filter((e) => {
        const matchSearch = displayName(e)?.toLowerCase().includes(search.toLowerCase()) || e.email?.toLowerCase().includes(search.toLowerCase());
        const matchFilter = filter === 'all' || e.status === filter;
        return matchSearch && matchFilter;
    });

    const { pageItems: pagedEmployees, page, setPage, totalPages } = usePagination(filtered, 15);

    return (
        <Layout title="Employees">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
                <input
                    placeholder="Search by name or email"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="p-3 border rounded w-full sm:w-1/3 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <select value={filter} onChange={(e) => setFilter(e.target.value)} className="p-3 border rounded w-full sm:w-1/4">
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                </select>
                <button onClick={handleExport} className="inline-flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-3 rounded-lg font-semibold whitespace-nowrap">
                    <Download className="w-4 h-4" /> Export
                </button>
                <button onClick={downloadImportTemplate} className="inline-flex items-center justify-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-3 rounded-lg font-semibold whitespace-nowrap">
                    <FileDown className="w-4 h-4" /> Import Template
                </button>
                <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={importing}
                    className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg font-semibold whitespace-nowrap disabled:opacity-60"
                >
                    <Upload className="w-4 h-4" /> {importing ? 'Importing...' : 'Bulk Import'}
                </button>
                <input ref={fileInputRef} type="file" accept=".csv" onChange={handleImportFile} className="hidden" />
            </div>

            <Modal open={showAddForm} onClose={() => setShowAddForm(false)} title="Add Employee" maxWidth="max-w-2xl">
                <form onSubmit={handleAddEmployee} className="grid sm:grid-cols-2 gap-4">
                    <p className="sm:col-span-2 text-sm text-gray-500">
                        Create a login for an employee who has already been hired. They'll use these credentials to sign in and fill out their profile and documents.
                    </p>
                    <input required placeholder="Full Name" value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} className="p-2.5 border rounded-lg" />
                    <input required placeholder="Username" value={addForm.username} onChange={(e) => setAddForm({ ...addForm, username: e.target.value })} className="p-2.5 border rounded-lg" />
                    <input required type="email" placeholder="Email" value={addForm.email} onChange={(e) => setAddForm({ ...addForm, email: e.target.value })} className="p-2.5 border rounded-lg" />
                    <div>
                        <PasswordInput
                            required
                            minLength={8}
                            placeholder="Temporary Password"
                            value={addForm.password}
                            onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                            showStrength
                            inputClassName="p-2.5 border rounded-lg w-full"
                        />
                    </div>
                    <input required placeholder="Employee Number (e.g. EMP0003)" value={addForm.employee_number} onChange={(e) => setAddForm({ ...addForm, employee_number: e.target.value })} className="p-2.5 border rounded-lg" />
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">Position (optional - can also set later)</label>
                        <select value={addForm.current_position} onChange={(e) => setAddForm({ ...addForm, current_position: e.target.value })} className="w-full p-2.5 border rounded-lg">
                            <option value="">Select Position</option>
                            {POSITION_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                        </select>
                    </div>
                    <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-gray-500 mb-1">Date of Employment (optional - can also set later)</label>
                        <input
                            type="date"
                            value={addForm.date_employment}
                            onChange={(e) => setAddForm({ ...addForm, date_employment: e.target.value })}
                            className="w-full p-2.5 border rounded-lg"
                        />
                    </div>
                    <div className="sm:col-span-2 flex flex-wrap gap-2 pt-2">
                        <button type="submit" className="bg-brand-700 text-white rounded-lg px-4 py-2.5 font-semibold hover:bg-brand-800 min-h-[44px]">Create Account</button>
                        <button type="button" onClick={() => setShowAddForm(false)} className="bg-gray-200 text-gray-700 rounded-lg px-4 py-2.5 font-semibold hover:bg-gray-300 min-h-[44px]">Cancel</button>
                    </div>
                </form>
            </Modal>

            <div className="overflow-x-auto thin-scrollbar bg-white rounded-xl shadow p-4 sm:p-6">
                <table className="w-full text-sm text-left">
                    <thead className="bg-brand-700 text-white uppercase text-xs font-semibold">
                        <tr>
                            <th className="py-3 px-4 whitespace-nowrap">Name</th>
                            <th className="py-3 px-4 whitespace-nowrap">Email</th>
                            <th className="py-3 px-4 whitespace-nowrap">Employee #</th>
                            <th className="py-3 px-4 whitespace-nowrap">Status</th>
                            <th className="py-3 px-4 whitespace-nowrap">Documents</th>
                            <th className="py-3 px-4 whitespace-nowrap">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {pagedEmployees.map((e) => (
                            <tr key={e.id} className="border-b hover:bg-brand-50">
                                <td className="py-2 px-4 capitalize whitespace-nowrap">{displayName(e)}</td>
                                <td className="py-2 px-4 whitespace-nowrap">{e.email}</td>
                                <td className="py-2 px-4 whitespace-nowrap">{e.employee_number || '—'}</td>
                                <td className="py-2 px-4">
                                    <StatusBadge status={e.status} />
                                </td>
                                <td className="py-2 px-4">
                                    <div className="flex gap-1 flex-wrap">
                                        {e.doc_summary.approved > 0 && <span className="inline-flex items-center gap-1 bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full"><CheckCircle2 className="w-3 h-3" /> {e.doc_summary.approved}</span>}
                                        {e.doc_summary.pending > 0 && <span className="inline-flex items-center gap-1 bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full"><AlertTriangle className="w-3 h-3" /> {e.doc_summary.pending}</span>}
                                        {e.doc_summary.not_uploaded > 0 && <span className="inline-flex items-center gap-1 bg-gray-200 text-gray-800 text-xs px-2 py-1 rounded-full"><XCircle className="w-3 h-3" /> {e.doc_summary.not_uploaded}</span>}
                                    </div>
                                </td>
                                <td className="py-2 px-4 space-y-1.5 whitespace-nowrap">
                                    <button onClick={() => openProfile(e.id)} className="inline-flex items-center gap-1 text-blue-500 hover:underline text-xs font-medium"><Eye className="w-3 h-3" /> View Profile</button>
                                    {e.status === 'active' && <button onClick={() => toggleActive(e.id, false)} className="block bg-gray-500 hover:bg-gray-600 text-white px-2 py-1 rounded text-xs font-medium">Deactivate</button>}
                                    {e.status === 'inactive' && <button onClick={() => toggleActive(e.id, true)} className="block bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded text-xs font-medium">Reactivate</button>}
                                    <button onClick={() => removeEmployee(e.id)} className="block bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded text-xs font-medium">Remove</button>
                                </td>
                            </tr>
                        ))}
                        {filtered.length === 0 && (
                            <tr><td colSpan="6" className="text-center text-gray-400 py-6">No employees found.</td></tr>
                        )}
                    </tbody>
                </table>
                <Pagination page={page} totalPages={totalPages} totalItems={filtered.length} pageSize={15} onPageChange={setPage} />
            </div>

            <div className="flex justify-end mt-4">
                <button onClick={() => setShowAddForm(true)} className="inline-flex items-center gap-2 bg-brand-700 hover:bg-brand-800 active:bg-brand-900 text-white px-6 py-3 rounded-full font-semibold min-h-[44px]">
                    <UserPlus className="w-4 h-4" /> Add Employee
                </button>
            </div>

            {selected && (
                <ProfileModal
                    employee={selected}
                    onClose={() => setSelected(null)}
                    onDocStatus={updateDocStatus}
                    onDocNA={markDocNA}
                    onLeaveApprove={approveLeave}
                    onLeaveReject={rejectLeave}
                    onEmployeeNumberChange={updateEmployeeNumber}
                    onPositionChange={updatePosition}
                    onDateEmploymentChange={updateDateEmployment}
                />
            )}
        </Layout>
    );
}

function StatusBadge({ status }) {
    const map = {
        active: 'bg-green-200 text-green-800',
        inactive: 'bg-gray-200 text-gray-800'
    };
    const text = { active: 'Active', inactive: 'Inactive' };
    return <span className={`px-2 py-1 rounded-full text-xs font-semibold ${map[status]}`}>{text[status]}</span>;
}

const REQUIRED_DOCS = [
    "Comprehensive Resume", "Application Letter", "Transcript of Records", "Diploma",
    "Master's or Doctorate Grades/Certificate",
    "Professional License (ID)/Board Rating/Certificate of Passing",
    "BIR Form (W-2/2316/1902/2305)", "SSS (E1/E4/SSS ID/UMID/Static Info)",
    "PhilHealth ID/Updated MDR", "Pag-Ibig (Loyalty ID/HDMF Form/Verification Slip)",
    "NBI Clearance", "Certificates of Trainings, Seminars, Conferences/Conventions Attended",
    "Clearance & Certification from Previous Employer", "PSA Birth Certificate",
    "Marriage Certificate/Contract (if married)",
    "Medical Exam - Complete Blood Count (CBC)", "Medical Exam - Urinalysis",
    "Medical Exam - Fecalysis", "Medical Exam - Chest X-ray", "Medical Exam - Physical Exam",
    "2x2 Picture (4 pcs, colored, white background)", "1x1 Picture (4 pcs, colored)"
];

const POSITION_OPTIONS = [
    'Pre-School / Elementary Teacher',
    'High School Teacher',
    'Academic Non-Teaching Staff',
    'Non-Teaching Staff',
    'Other'
];

function ProfileModal({ employee, onClose, onDocStatus, onDocNA, onLeaveApprove, onLeaveReject, onEmployeeNumberChange, onPositionChange, onDateEmploymentChange }) {
    const [position, setPosition] = useState(employee.current_position || '');
    const [dateEmployment, setDateEmployment] = useState(
        employee.date_employment ? new Date(employee.date_employment).toISOString().slice(0, 10) : ''
    );
    const [editingEmpNum, setEditingEmpNum] = useState(false);
    const [empNum, setEmpNum] = useState(employee.employee_number || '');

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto">
            <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl p-4 sm:p-6 relative max-h-[92vh] overflow-y-auto">
                <button
                    onClick={onClose}
                    aria-label="Close"
                    className="absolute top-3 right-3 w-9 h-9 flex items-center justify-center rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 transition"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="flex flex-col md:flex-row gap-6 items-center md:items-start pr-8">
                    {employee.profile_pic ? (
                        <img
                            src={fileUrl(employee.profile_pic)}
                            className="w-28 h-28 rounded-full border-4 border-brand-400 object-cover shrink-0"
                            alt="Profile"
                        />
                    ) : (
                        <div className="w-28 h-28 shrink-0 rounded-full border-4 border-brand-400 bg-brand-50 flex items-center justify-center">
                            <User className="w-12 h-12 text-brand-400" />
                        </div>
                    )}
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-700">
                        <div><strong>Name:</strong> {[employee.first_name, employee.middle_name, employee.last_name].filter(Boolean).join(' ') || employee.name}</div>
                        <div><strong>Email:</strong> {employee.email}</div>
                        <div className="flex items-center gap-1.5">
                            <strong>Employee #:</strong>
                            {editingEmpNum ? (
                                <>
                                    <input
                                        autoFocus
                                        value={empNum}
                                        onChange={(e) => setEmpNum(e.target.value)}
                                        className="p-1 border rounded text-sm w-28"
                                    />
                                    <button
                                        onClick={() => { onEmployeeNumberChange(empNum); setEditingEmpNum(false); }}
                                        disabled={!empNum.trim() || empNum.trim() === (employee.employee_number || '')}
                                        className="text-xs bg-brand-700 text-white px-2 py-1 rounded hover:bg-brand-800 disabled:opacity-40"
                                    >
                                        Save
                                    </button>
                                    <button
                                        onClick={() => { setEmpNum(employee.employee_number || ''); setEditingEmpNum(false); }}
                                        className="text-xs text-gray-500 hover:text-gray-700 px-1"
                                    >
                                        Cancel
                                    </button>
                                </>
                            ) : (
                                <>
                                    <span>{employee.employee_number || '—'}</span>
                                    <button
                                        onClick={() => setEditingEmpNum(true)}
                                        aria-label="Edit employee number"
                                        className="text-gray-400 hover:text-brand-700"
                                    >
                                        <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                </>
                            )}
                        </div>
                        <div><strong>Status:</strong> {employee.is_active ? 'Active' : 'Inactive'}</div>
                        <div><strong>Gender:</strong> {employee.gender || '—'}</div>
                        <div><strong>Civil Status:</strong> {employee.civil_status || '—'}</div>
                        <div><strong>Current Address:</strong> {employee.current_address || '—'}</div>
                        <div><strong>Home Number:</strong> {employee.home_number || '—'}</div>
                        <div><strong>Mobile:</strong> {employee.mobile_number || '—'}</div>
                        <div><strong>Date of Birth:</strong> {employee.dob ? new Date(employee.dob).toLocaleDateString() : '—'}</div>
                        <div><strong>Place of Birth:</strong> {employee.pob || '—'}</div>
                        <div><strong>Mother's Maiden Name:</strong> {employee.mother_maiden_name || '—'}</div>
                        <div><strong>Spouse Name:</strong> {employee.spouse_name || '—'}</div>
                        <div><strong>TIN No.:</strong> {employee.tin_no || '—'}</div>
                        <div><strong>SSS No.:</strong> {employee.sss_no || '—'}</div>
                        <div><strong>PhilHealth No.:</strong> {employee.philhealth_no || '—'}</div>
                        <div><strong>Pag-Ibig No.:</strong> {employee.pagibig_no || '—'}</div>
                        <div className="sm:col-span-2 text-xs bg-brand-50 rounded p-2">
                            <strong>Emergency Contact:</strong>{' '}
                            {employee.emergency_contact_name || '—'}
                            {employee.emergency_contact_mobile ? ` · ${employee.emergency_contact_mobile}` : ''}
                            {employee.emergency_contact_address ? ` · ${employee.emergency_contact_address}` : ''}
                        </div>
                        <div className="sm:col-span-2">
                            <label className="block text-xs font-semibold text-gray-500 mb-1">Position (set by HR)</label>
                            <div className="flex gap-2">
                                <select value={position} onChange={(e) => setPosition(e.target.value)} className="flex-1 p-2 border rounded text-sm">
                                    <option value="">Select Position</option>
                                    {POSITION_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                                </select>
                                <button
                                    onClick={() => onPositionChange(position)}
                                    disabled={!position || position === employee.current_position}
                                    className="bg-brand-700 text-white text-sm px-3 py-1 rounded hover:bg-brand-800 disabled:opacity-40"
                                >
                                    Save
                                </button>
                            </div>
                        </div>
                        <div className="sm:col-span-2">
                            <label className="block text-xs font-semibold text-gray-500 mb-1">Date of Employment (set by HR)</label>
                            <div className="flex gap-2">
                                <input
                                    type="date"
                                    value={dateEmployment}
                                    onChange={(e) => setDateEmployment(e.target.value)}
                                    className="flex-1 p-2 border rounded text-sm"
                                />
                                <button
                                    onClick={() => onDateEmploymentChange(dateEmployment)}
                                    disabled={!dateEmployment || dateEmployment === (employee.date_employment ? new Date(employee.date_employment).toISOString().slice(0, 10) : '')}
                                    className="bg-brand-700 text-white text-sm px-3 py-1 rounded hover:bg-brand-800 disabled:opacity-40"
                                >
                                    Save
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-6">
                    <h3 className="font-semibold text-brand-800 mb-2 flex items-center gap-1.5"><FileText className="w-4 h-4" /> Documents</h3>
                    <div className="max-h-56 overflow-y-auto space-y-2">
                        {REQUIRED_DOCS.map((docName) => {
                            const matches = employee.documents.filter((d) => d.document_type === docName);
                            if (matches.length === 0) {
                                return (
                                    <div key={docName} className="flex justify-between items-center p-2 border rounded bg-gray-50 text-sm">
                                        <span className="pr-2">{docName} (not uploaded)</span>
                                        <button onClick={() => onDocNA(docName)} className="shrink-0 bg-gray-500 hover:bg-gray-600 text-white px-2 py-1 rounded text-xs font-medium">Mark N/A</button>
                                    </div>
                                );
                            }
                            return (
                                <div key={docName} className="p-2 border rounded-lg text-sm">
                                    <div className="font-medium mb-1.5">
                                        {docName}
                                        {matches.length > 1 && <span className="ml-1.5 text-xs font-normal text-gray-400">({matches.length} files)</span>}
                                    </div>
                                    <div className="space-y-1.5">
                                        {matches.map((doc, i) => (
                                            <div key={doc.id} className="flex flex-wrap justify-between items-center gap-2 bg-gray-50 rounded px-2 py-1.5">
                                                {matches.length > 1 && <span className="text-xs text-gray-400 shrink-0">File {i + 1}</span>}
                                                <span className="text-xs px-2 py-1 rounded-full bg-gray-100 capitalize">{doc.status}</span>
                                                <div className="flex flex-wrap gap-1">
                                                    {doc.file_path && <a href={fileUrl(doc.file_path)} target="_blank" rel="noreferrer" className="text-blue-500 text-xs font-medium hover:underline flex items-center">View</a>}
                                                    <button onClick={() => onDocStatus(doc.id, 'Approved')} className="bg-green-500 hover:bg-green-600 text-white px-2 py-1 rounded text-xs font-medium">Approve</button>
                                                    <button onClick={() => onDocStatus(doc.id, 'Rejected')} className="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded text-xs font-medium">Reject</button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="mt-6">
                    <h3 className="font-semibold text-brand-800 mb-2 flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> Leave Balances & History</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
                        {Object.entries(employee.remaining_leaves).map(([type, days]) => (
                            <div key={type} className="bg-brand-50 rounded p-2 text-xs">
                                <div className="font-semibold">{type}</div>
                                <div className="text-brand-700">{days} day(s) left</div>
                            </div>
                        ))}
                    </div>
                    <div className="max-h-48 overflow-y-auto space-y-2">
                        {employee.leaves.map((leave) => (
                            <div key={leave.id} className="p-2 border rounded bg-gray-50 text-sm">
                                <div className="flex justify-between font-medium">
                                    <span>{leave.leave_type}</span>
                                    <span className="capitalize">{leave.status}</span>
                                </div>
                                <div className="text-xs text-gray-600">Days: {leave.total_days} | {leave.start_date} to {leave.end_date}</div>
                                <div className="text-xs text-gray-600">Reason: {leave.reason}</div>
                                {leave.status === 'pending' && (
                                    <div className="mt-1.5 flex gap-2">
                                        <button onClick={() => onLeaveApprove(leave)} className="bg-green-500 hover:bg-green-600 text-white px-2 py-1 rounded text-xs font-medium">Approve</button>
                                        <button onClick={() => onLeaveReject(leave.id)} className="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded text-xs font-medium">Reject</button>
                                    </div>
                                )}
                            </div>
                        ))}
                        {employee.leaves.length === 0 && <p className="text-gray-400 text-sm">No leave requests.</p>}
                    </div>
                </div>
            </div>
        </div>
    );
}
