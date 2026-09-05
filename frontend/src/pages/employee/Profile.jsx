import React, { useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Camera, User, IdCard, Briefcase, PhoneCall } from 'lucide-react';
import Layout from '../../components/Layout';
import api from '../../api/axios';
import { fileUrl } from '../../utils/fileUrl';
import { useAuth } from '../../context/AuthContext';

export default function Profile() {
    const navigate = useNavigate();
    const { setUser } = useAuth();
    const [profile, setProfile] = useState(null);

    async function load() {
        const { data } = await api.get('/profile');
        setProfile(data);
    }

    useEffect(() => { load(); }, []);

    async function handleSave(e) {
        e.preventDefault();
        const fields = [
            'last_name', 'first_name', 'middle_name', 'gender', 'civil_status',
            'current_address', 'home_number', 'mobile_number', 'dob', 'pob',
            'mother_maiden_name', 'spouse_name',
            'tin_no', 'sss_no', 'philhealth_no', 'pagibig_no',
            'emergency_contact_name', 'emergency_contact_address', 'emergency_contact_mobile'
        ];
        const payload = {};
        fields.forEach((f) => { payload[f] = profile[f] || ''; });
        const { data } = await api.put('/profile', payload);
        // Refresh the cached session's display name so "Welcome Back" (and
        // anywhere else user.name is shown) updates immediately, instead of
        // only after the next login.
        setUser((prev) => (prev ? { ...prev, name: data.name } : prev));
        Swal.fire('Success', 'Profile updated successfully.', 'success');
    }

    async function handlePictureUpload(e) {
        const file = e.target.files[0];
        if (!file) return;
        const formData = new FormData();
        formData.append('profile_pic', file);
        const { data } = await api.post('/profile/picture', formData);
        setProfile((p) => ({ ...p, profile_pic: data.profile_pic }));
    }

    if (!profile) return <Layout title="My Profile"><p className="text-gray-500">Loading...</p></Layout>;

    return (
        <Layout
            title="My Profile"
            headerExtra={
                <button
                    onClick={() => navigate('/employee/documents')}
                    className="w-10 h-10 flex items-center justify-center rounded-full bg-brand-900 text-white hover:bg-brand-800 active:bg-brand-950 transition"
                    title="Government Credentials"
                    aria-label="Government credentials"
                >
                    <ArrowRight className="w-4 h-4" />
                </button>
            }
        >
            <div className="grid md:grid-cols-3 gap-6 md:gap-8">
                <div className="bg-white rounded-2xl shadow p-4 sm:p-6 text-center space-y-3 h-fit">
                    {profile.profile_pic ? (
                        <img
                            src={fileUrl(profile.profile_pic)}
                            className="w-28 h-28 rounded-full mx-auto border-4 border-brand-500 object-cover"
                            alt="Profile"
                        />
                    ) : (
                        <div className="w-28 h-28 rounded-full mx-auto border-4 border-brand-500 bg-brand-50 flex items-center justify-center">
                            <User className="w-12 h-12 text-brand-400" />
                        </div>
                    )}
                    <label className="inline-flex items-center gap-1.5 text-xs text-brand-600 cursor-pointer hover:text-brand-800 font-medium">
                        <Camera className="w-3.5 h-3.5" /> Change photo
                        <input type="file" accept="image/*" className="hidden" onChange={handlePictureUpload} />
                    </label>
                    <h2 className="text-lg font-semibold">{[profile.first_name, profile.last_name].filter(Boolean).join(' ') || profile.name}</h2>
                    <p className="text-sm text-gray-500">{profile.email}</p>
                    <span className="inline-block bg-brand-700 text-white px-4 py-1 text-xs rounded-full capitalize">{profile.role.replace('_', ' ')}</span>
                    <p className="font-semibold mt-2">Employee #:{profile.employee_number || '—'}</p>
                </div>

                <div className="md:col-span-2 bg-white rounded-2xl shadow p-4 sm:p-6">
                    <h3 className="text-lg font-bold mb-4 text-brand-700">Update Profile Information</h3>
                    <form onSubmit={handleSave} className="space-y-6">
                        <FormSection icon={User} title="Personal Information">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <TextField label="Last Name" value={profile.last_name} onChange={(v) => setProfile({ ...profile, last_name: v })} />
                                <TextField label="First Name" value={profile.first_name} onChange={(v) => setProfile({ ...profile, first_name: v })} />
                                <TextField label="Middle Name" value={profile.middle_name} onChange={(v) => setProfile({ ...profile, middle_name: v })} />
                                <TextField label="Employee Number" value={profile.employee_number} onChange={() => {}} disabled />
                                <div>
                                    <label className="text-sm font-medium text-gray-700">Gender</label>
                                    <div className="flex gap-4 mt-1">
                                        {['Female', 'Male'].map((g) => (
                                            <label key={g} className="flex items-center gap-2 text-sm">
                                                <input type="radio" checked={profile.gender === g} onChange={() => setProfile({ ...profile, gender: g })} /> {g}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-gray-700">Civil Status</label>
                                    <div className="flex gap-4 mt-1">
                                        {['Single', 'Married'].map((c) => (
                                            <label key={c} className="flex items-center gap-2 text-sm">
                                                <input type="radio" checked={profile.civil_status === c} onChange={() => setProfile({ ...profile, civil_status: c })} /> {c}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                <TextField label="Current Address" value={profile.current_address} onChange={(v) => setProfile({ ...profile, current_address: v })} />
                                <TextField label="Home Number" value={profile.home_number} onChange={(v) => setProfile({ ...profile, home_number: v })} />
                                <TextField label="Mobile Number" value={profile.mobile_number} onChange={(v) => setProfile({ ...profile, mobile_number: v })} digitsOnly maxLength={11} hint="11 digits, e.g. 09171234567" />
                                <TextField type="date" label="Date of Birth" value={profile.dob} onChange={(v) => setProfile({ ...profile, dob: v })} />
                                <TextField label="Place of Birth" value={profile.pob} onChange={(v) => setProfile({ ...profile, pob: v })} />
                                <TextField label="Mother's Maiden Name" value={profile.mother_maiden_name} onChange={(v) => setProfile({ ...profile, mother_maiden_name: v })} />
                                <TextField label="Spouse Name" value={profile.spouse_name} onChange={(v) => setProfile({ ...profile, spouse_name: v })} />
                            </div>
                        </FormSection>

                        <FormSection icon={IdCard} title="Government IDs">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <TextField label="TIN No." value={profile.tin_no} onChange={(v) => setProfile({ ...profile, tin_no: v })} digitsOnly maxLength={12} hint="9-12 digits" />
                                <TextField label="SSS No." value={profile.sss_no} onChange={(v) => setProfile({ ...profile, sss_no: v })} digitsOnly maxLength={10} hint="10 digits" />
                                <TextField label="PhilHealth No." value={profile.philhealth_no} onChange={(v) => setProfile({ ...profile, philhealth_no: v })} digitsOnly maxLength={12} hint="12 digits" />
                                <TextField label="Pag-Ibig No." value={profile.pagibig_no} onChange={(v) => setProfile({ ...profile, pagibig_no: v })} digitsOnly maxLength={12} hint="12 digits" />
                            </div>
                        </FormSection>

                        <FormSection icon={Briefcase} title="Employment Details" hint="Set by HR, can't be changed here">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-medium text-gray-700 block mb-1">Current Position</label>
                                    <input
                                        type="text"
                                        value={profile.current_position || 'Not yet set by HR'}
                                        disabled
                                        className="w-full p-2 border border-brand-300 rounded bg-gray-100 text-gray-600"
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-gray-700 block mb-1">Date of Employment</label>
                                    <input
                                        type="text"
                                        value={profile.date_employment ? new Date(profile.date_employment).toLocaleDateString() : 'Not yet set by HR'}
                                        disabled
                                        className="w-full p-2 border border-brand-300 rounded bg-gray-100 text-gray-600"
                                    />
                                </div>
                            </div>
                        </FormSection>

                        <FormSection icon={PhoneCall} title="Contact Person in Case of Emergency">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <TextField label="Name" value={profile.emergency_contact_name} onChange={(v) => setProfile({ ...profile, emergency_contact_name: v })} />
                                <TextField label="Mobile Number" value={profile.emergency_contact_mobile} onChange={(v) => setProfile({ ...profile, emergency_contact_mobile: v })} digitsOnly maxLength={11} hint="11 digits, e.g. 09171234567" />
                                <div className="md:col-span-2">
                                    <TextField label="Address" value={profile.emergency_contact_address} onChange={(v) => setProfile({ ...profile, emergency_contact_address: v })} />
                                </div>
                            </div>
                        </FormSection>

                        <div className="text-right pt-2">
                            <button type="submit" className="w-full sm:w-auto bg-brand-700 hover:bg-brand-800 active:bg-brand-900 text-white px-6 py-3 rounded-full transition font-semibold min-h-[44px]">Update Profile</button>
                        </div>
                    </form>
                </div>
            </div>
        </Layout>
    );
}

function FormSection({ icon: Icon, title, hint, children }) {
    return (
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-4">
                {Icon && <Icon className="w-4 h-4 text-brand-600 shrink-0" />}
                <h4 className="text-sm font-bold text-brand-700">{title}</h4>
                {hint && <span className="text-xs text-gray-400 font-normal">— {hint}</span>}
            </div>
            {children}
        </div>
    );
}

function TextField({ label, value, onChange, type = 'text', disabled = false, digitsOnly = false, maxLength, hint }) {
    return (
        <div>
            <label className="text-sm font-medium text-gray-700">{label}</label>
            <input
                type={type}
                value={value || ''}
                disabled={disabled}
                maxLength={maxLength}
                inputMode={digitsOnly ? 'numeric' : undefined}
                onChange={(e) => {
                    const raw = digitsOnly ? e.target.value.replace(/\D/g, '') : e.target.value;
                    onChange(maxLength ? raw.slice(0, maxLength) : raw);
                }}
                className="w-full p-2 border border-brand-300 rounded focus:ring-2 focus:ring-brand-400 disabled:bg-gray-100"
            />
            {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
        </div>
    );
}
