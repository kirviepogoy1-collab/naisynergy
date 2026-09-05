import React, { useEffect, useRef, useState } from 'react';
import Swal from 'sweetalert2';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, UploadCloud, FileText, Trash2 } from 'lucide-react';
import Layout from '../../components/Layout';
import api from '../../api/axios';
import { fileUrl } from '../../utils/fileUrl';

const DOC_TYPES = [
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

export default function Documents() {
    const navigate = useNavigate();
    const [documents, setDocuments] = useState([]);
    const [docType, setDocType] = useState('');
    const [file, setFile] = useState(null);
    const [dragOver, setDragOver] = useState(false);
    const fileInputRef = useRef();

    async function load() {
        const { data } = await api.get('/documents/mine');
        setDocuments(data);
    }

    useEffect(() => { load(); }, []);

    function handleDrop(e) {
        e.preventDefault();
        setDragOver(false);
        if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]);
    }

    async function handleUpload() {
        if (!file || !docType) {
            Swal.fire('Error', 'Select a document type and a file first.', 'error');
            return;
        }
        const formData = new FormData();
        formData.append('credential_file', file);
        formData.append('document_type', docType);
        try {
            await api.post('/documents/upload', formData);
            Swal.fire('Success', 'Document uploaded!', 'success');
            setFile(null);
            setDocType('');
            if (fileInputRef.current) fileInputRef.current.value = '';
            load();
        } catch (err) {
            Swal.fire('Error', err.response?.data?.error || 'Upload failed.', 'error');
        }
    }

    async function handleRemove(id) {
        const result = await Swal.fire({ title: 'Remove this document?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#16a34a' });
        if (result.isConfirmed) {
            await api.delete(`/documents/${id}`);
            load();
        }
    }

    return (
        <Layout
            title="Government Credentials"
            headerExtra={
                <button
                    onClick={() => navigate('/employee/profile')}
                    className="w-10 h-10 flex items-center justify-center rounded-full bg-brand-900 text-white hover:bg-brand-800 active:bg-brand-950 transition"
                    title="Back to Profile"
                    aria-label="Back to profile"
                >
                    <ArrowLeft className="w-4 h-4" />
                </button>
            }
        >
            <div className="bg-white rounded-2xl shadow p-4 sm:p-6 max-w-3xl">
                <div className="border rounded-xl p-4 mb-6 text-sm">
                    <p className="font-bold text-brand-700 mb-2">INSTRUCTIONS:</p>
                    <ul className="space-y-1 text-gray-700 list-none">
                        <li>Upload all pertaining/required documents only.</li>
                        <li>All documents must be submitted in PDF format.</li>
                        <li>The only exception is the specifically requested image file, which may be submitted in its required image format (e.g., JPG or PNG).</li>
                        <li>All files must follow the required naming convention.</li>
                        <li>Format: yourcompletename_SSS</li>
                        <li>Do not upload files in any format other than PDF, except for the requested image.</li>
                        <li>Ensure all files are clearly labeled and correctly named before submission.</li>
                    </ul>
                </div>

                <div
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current.click()}
                    className={`border-2 border-dashed rounded-xl p-6 sm:p-8 text-center cursor-pointer mb-4 transition ${dragOver ? 'border-brand-600 bg-brand-50' : 'border-gray-300'}`}
                >
                    <UploadCloud className="w-8 h-8 mx-auto mb-2 text-brand-400" />
                    <p className="text-brand-700 font-semibold">Drag & Drop files here</p>
                    <p className="text-sm text-gray-500">or tap to browse (Max 25MB)</p>
                    {file && <p className="text-sm text-brand-800 mt-2 font-medium">Selected: {file.name}</p>}
                    <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => setFile(e.target.files[0])} />
                </div>

                <select value={docType} onChange={(e) => setDocType(e.target.value)} className="w-full p-3 border rounded-lg mb-4">
                    <option value="">Select Document</option>
                    {DOC_TYPES.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>

                <button onClick={handleUpload} className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-brand-700 hover:bg-brand-800 active:bg-brand-900 text-white px-6 py-3 rounded-full font-semibold mb-6 min-h-[44px]">
                    <UploadCloud className="w-4 h-4" /> Upload
                </button>

                <div className="overflow-x-auto thin-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
                <table className="w-full text-sm text-left">
                    <thead className="bg-brand-700 text-white">
                        <tr>
                            <th className="py-3 px-4 whitespace-nowrap">Document</th>
                            <th className="py-3 px-4 whitespace-nowrap">Status</th>
                            <th className="py-3 px-4 whitespace-nowrap">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {Object.entries(
                            documents.reduce((acc, doc) => {
                                (acc[doc.document_type] = acc[doc.document_type] || []).push(doc);
                                return acc;
                            }, {})
                        ).map(([type, docs]) => (
                            <tr key={type} className="border-b last:border-0 align-top">
                                <td className="py-3 px-4">{type}</td>
                                <td className="py-3 px-4">
                                    <div className="space-y-2">
                                        {docs.map((doc, i) => (
                                            <div key={doc.id} className="capitalize">
                                                {docs.length > 1 && <span className="text-xs text-gray-400 normal-case mr-1">File {i + 1}:</span>}
                                                {doc.status}
                                            </div>
                                        ))}
                                    </div>
                                </td>
                                <td className="py-3 px-4">
                                    <div className="space-y-2">
                                        {docs.map((doc) => (
                                            <div key={doc.id} className="flex flex-wrap gap-2">
                                                {doc.file_path && (
                                                    <a href={fileUrl(doc.file_path)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 bg-brand-700 hover:bg-brand-800 text-white px-3 py-1.5 rounded-full text-xs font-medium">
                                                        <FileText className="w-3 h-3" /> View
                                                    </a>
                                                )}
                                                <button onClick={() => handleRemove(doc.id)} className="inline-flex items-center gap-1 bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-full text-xs font-medium">
                                                    <Trash2 className="w-3 h-3" /> Remove
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {documents.length === 0 && (
                            <tr><td colSpan="3" className="text-center text-gray-400 py-6">No documents uploaded yet.</td></tr>
                        )}
                    </tbody>
                </table>
                </div>
            </div>
        </Layout>
    );
}
