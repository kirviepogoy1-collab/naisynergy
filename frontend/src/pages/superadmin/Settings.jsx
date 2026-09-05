import React, { useState, useRef, useEffect } from 'react';
import Swal from 'sweetalert2';
import { Upload } from 'lucide-react';
import Layout from '../../components/Layout';
import api from '../../api/axios';
import { useSettings } from '../../context/SettingsContext';
import { applyColor } from '../../context/SettingsContext';

export default function Settings() {
    const { settings, refresh } = useSettings();
    const [schoolName, setSchoolName] = useState(settings.school_name);
    const [primaryColor, setPrimaryColor] = useState(settings.primary_color);
    const [logoPreview, setLogoPreview] = useState(settings.logo_url);
    const [uploading, setUploading] = useState(false);
    const [saving, setSaving] = useState(false);
    const fileRef = useRef(null);

    const [maintenanceMode, setMaintenanceMode] = useState(settings.maintenance_mode);
    const [maintenanceMessage, setMaintenanceMessage] = useState(settings.maintenance_message || '');
    const [savingMaintenance, setSavingMaintenance] = useState(false);

    // Live-preview the color as it's picked, but revert if this page is left
    // without saving so the rest of the app doesn't stay on an unsaved color.
    useEffect(() => {
        applyColor(primaryColor);
        return () => applyColor(settings.primary_color);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [primaryColor]);

    async function handleLogoChange(e) {
        const file = e.target.files[0];
        if (!file) return;
        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('logo', file);
            const { data } = await api.post('/settings/logo', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setLogoPreview(data.logo_url);
        } catch (err) {
            Swal.fire('Error', err.response?.data?.error || 'Failed to upload logo.', 'error');
        } finally {
            setUploading(false);
        }
    }

    async function handleSave(e) {
        e.preventDefault();
        setSaving(true);
        try {
            await api.put('/settings', {
                school_name: schoolName,
                logo_url: logoPreview,
                primary_color: primaryColor
            });
            await refresh();
            Swal.fire('Saved', 'Branding updated for everyone.', 'success');
        } catch (err) {
            Swal.fire('Error', err.response?.data?.error || 'Failed to save settings.', 'error');
        } finally {
            setSaving(false);
        }
    }

    async function handleMaintenanceSave() {
        setSavingMaintenance(true);
        try {
            await api.put('/settings', { maintenance_mode: maintenanceMode, maintenance_message: maintenanceMessage });
            await refresh();
            Swal.fire('Saved', maintenanceMode ? 'Maintenance mode is now ON - only superadmin can access the site.' : 'Maintenance mode is now off.', 'success');
        } catch (err) {
            Swal.fire('Error', err.response?.data?.error || 'Failed to save maintenance settings.', 'error');
        } finally {
            setSavingMaintenance(false);
        }
    }

    return (
        <Layout title="System Settings">
            <div className="max-w-2xl">
                <p className="text-sm text-gray-500 mb-6">
                    Customize the logo, color theme, and name shown across the whole system - useful if another school
                    reuses this platform and needs their own branding without editing any code.
                </p>

                <form onSubmit={handleSave} className="bg-white rounded-2xl shadow p-5 sm:p-6 grid gap-6">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">School / Organization Name</label>
                        <input
                            required
                            value={schoolName}
                            onChange={(e) => setSchoolName(e.target.value)}
                            className="w-full p-2.5 border rounded-lg"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Logo</label>
                        <div className="flex items-center gap-4">
                            <img src={logoPreview} alt="Logo preview" className="w-16 h-16 rounded-full border object-contain bg-gray-50" />
                            <div>
                                <button
                                    type="button"
                                    onClick={() => fileRef.current?.click()}
                                    disabled={uploading}
                                    className="inline-flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3.5 py-2 rounded-lg text-sm font-medium disabled:opacity-60"
                                >
                                    <Upload className="w-4 h-4" /> {uploading ? 'Uploading...' : 'Upload new logo'}
                                </button>
                                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleLogoChange} className="hidden" />
                                <p className="text-xs text-gray-400 mt-1.5">PNG, JPG, or WEBP. Square images look best.</p>
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Primary Color</label>
                        <div className="flex items-center gap-3">
                            <input
                                type="color"
                                value={primaryColor}
                                onChange={(e) => setPrimaryColor(e.target.value)}
                                className="w-12 h-12 rounded-lg border cursor-pointer p-0.5"
                            />
                            <input
                                value={primaryColor}
                                onChange={(e) => setPrimaryColor(e.target.value)}
                                placeholder="#16a34a"
                                className="p-2.5 border rounded-lg w-32 font-mono text-sm"
                            />
                            <p className="text-xs text-gray-400">Used for buttons, links, and the sidebar.</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2 border-t">
                        <button type="submit" disabled={saving} className="bg-brand-600 hover:bg-brand-700 text-white rounded-lg px-5 py-2.5 font-semibold min-h-[44px] mt-4 disabled:opacity-60">
                            {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>

                <div className={`mt-8 rounded-2xl shadow p-5 sm:p-6 grid gap-4 border-2 ${maintenanceMode ? 'bg-amber-50 border-amber-300' : 'bg-white border-transparent'}`}>
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <h2 className="font-bold text-gray-800">Maintenance Mode</h2>
                            <p className="text-sm text-gray-500 mt-1">
                                When on, every visitor sees a friendly "under maintenance" page instead of the site - except
                                you (superadmin), who can keep using the app normally to fix things and turn this back off.
                            </p>
                        </div>
                        <label className="inline-flex items-center cursor-pointer shrink-0">
                            <input
                                type="checkbox"
                                checked={maintenanceMode}
                                onChange={(e) => setMaintenanceMode(e.target.checked)}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-300 peer-checked:bg-amber-500 rounded-full relative transition after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition peer-checked:after:translate-x-5" />
                        </label>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Message shown to visitors</label>
                        <textarea
                            value={maintenanceMessage}
                            onChange={(e) => setMaintenanceMessage(e.target.value)}
                            rows={2}
                            className="w-full p-2.5 border rounded-lg text-sm"
                            placeholder="We're currently making some improvements. Please check back shortly."
                        />
                    </div>

                    <div>
                        <button
                            type="button"
                            onClick={handleMaintenanceSave}
                            disabled={savingMaintenance}
                            className={`rounded-lg px-5 py-2.5 font-semibold min-h-[44px] disabled:opacity-60 ${maintenanceMode ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'bg-brand-600 hover:bg-brand-700 text-white'}`}
                        >
                            {savingMaintenance ? 'Saving...' : maintenanceMode ? 'Turn Maintenance Mode ON' : 'Save'}
                        </button>
                    </div>
                </div>
            </div>
        </Layout>
    );
}
