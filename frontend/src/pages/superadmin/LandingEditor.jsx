import React, { useState, useEffect, useRef } from 'react';
import Swal from 'sweetalert2';
import { ChevronUp, ChevronDown, Pencil, Trash2, Eye, EyeOff, Plus, Upload, X } from 'lucide-react';
import Layout from '../../components/Layout';
import api from '../../api/axios';
import { SECTION_TYPES } from '../../components/landing/sectionTypes';

// ---------- small reusable bits ----------

function Field({ label, children, hint }) {
    return (
        <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">{label}</label>
            {children}
            {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
        </div>
    );
}

function TextInput(props) {
    return <input {...props} className={`w-full p-2.5 border rounded-lg text-sm ${props.className || ''}`} />;
}

function TextArea(props) {
    return <textarea {...props} rows={props.rows || 3} className={`w-full p-2.5 border rounded-lg text-sm ${props.className || ''}`} />;
}

function ImagePicker({ value, onChange }) {
    const fileRef = useRef(null);
    const [uploading, setUploading] = useState(false);

    async function handleFile(e) {
        const file = e.target.files[0];
        if (!file) return;
        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('image', file);
            const { data } = await api.post('/landing-sections/upload-image', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            onChange(data.url);
        } catch (err) {
            Swal.fire('Error', err.response?.data?.error || 'Failed to upload image.', 'error');
        } finally {
            setUploading(false);
        }
    }

    return (
        <div className="flex items-center gap-3">
            {value && <img src={value} alt="" className="w-16 h-16 rounded-lg border object-cover bg-gray-50" />}
            <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-60"
            >
                <Upload className="w-4 h-4" /> {uploading ? 'Uploading...' : value ? 'Replace image' : 'Upload image'}
            </button>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleFile} className="hidden" />
        </div>
    );
}

// Generic editor for an array of plain strings (e.g. About's paragraphs).
function StringListEditor({ items, onChange, placeholder }) {
    function update(i, val) {
        const next = [...items];
        next[i] = val;
        onChange(next);
    }
    function remove(i) {
        onChange(items.filter((_, idx) => idx !== i));
    }
    return (
        <div className="space-y-2">
            {items.map((item, i) => (
                <div key={i} className="flex gap-2">
                    <TextArea value={item} placeholder={placeholder} onChange={(e) => update(i, e.target.value)} rows={2} />
                    <button type="button" onClick={() => remove(i)} className="shrink-0 text-red-500 hover:text-red-700 px-2">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            ))}
            <button
                type="button"
                onClick={() => onChange([...items, ''])}
                className="text-sm text-brand-700 font-semibold hover:underline"
            >
                + Add paragraph
            </button>
        </div>
    );
}

// Generic editor for an array of objects, where `fields` describes each
// object's shape: [{ key, label, type: 'text'|'textarea'|'checkbox' }, ...]
function ObjectListEditor({ items, onChange, fields, addLabel, emptyItem }) {
    function update(i, key, val) {
        const next = items.map((item, idx) => (idx === i ? { ...item, [key]: val } : item));
        onChange(next);
    }
    function remove(i) {
        onChange(items.filter((_, idx) => idx !== i));
    }
    return (
        <div className="space-y-3">
            {items.map((item, i) => (
                <div key={i} className="border rounded-lg p-3 bg-gray-50 relative">
                    <button
                        type="button"
                        onClick={() => remove(i)}
                        className="absolute top-2 right-2 text-red-500 hover:text-red-700"
                        aria-label="Remove item"
                    >
                        <X className="w-4 h-4" />
                    </button>
                    <div className="grid sm:grid-cols-2 gap-3 pr-6">
                        {fields.map((f) => (
                            <div key={f.key} className={f.type === 'textarea' ? 'sm:col-span-2' : ''}>
                                <label className="block text-xs font-semibold text-gray-500 mb-1">{f.label}</label>
                                {f.type === 'textarea' ? (
                                    <TextArea value={item[f.key] || ''} onChange={(e) => update(i, f.key, e.target.value)} rows={2} />
                                ) : f.type === 'checkbox' ? (
                                    <input
                                        type="checkbox"
                                        checked={!!item[f.key]}
                                        onChange={(e) => update(i, f.key, e.target.checked)}
                                        className="w-4 h-4"
                                    />
                                ) : (
                                    <TextInput value={item[f.key] || ''} onChange={(e) => update(i, f.key, e.target.value)} />
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            ))}
            <button
                type="button"
                onClick={() => onChange([...items, { ...emptyItem }])}
                className="text-sm text-brand-700 font-semibold hover:underline"
            >
                + {addLabel}
            </button>
        </div>
    );
}

// ---------- per-type content forms ----------

function HeroForm({ content, onChange }) {
    const set = (key, val) => onChange({ ...content, [key]: val });
    return (
        <div className="grid gap-4">
            <Field label="Heading (first line)"><TextInput value={content.headingPrefix || ''} onChange={(e) => set('headingPrefix', e.target.value)} /></Field>
            <Field label="Heading (highlighted line)"><TextInput value={content.headingHighlight || ''} onChange={(e) => set('headingHighlight', e.target.value)} /></Field>
            <Field label="Subheading"><TextArea value={content.subheading || ''} onChange={(e) => set('subheading', e.target.value)} /></Field>
            <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Button text (leave blank to hide the button)"><TextInput value={content.ctaText || ''} onChange={(e) => set('ctaText', e.target.value)} /></Field>
                <Field label="Button link" hint="e.g. #about, or a full URL"><TextInput value={content.ctaHref || ''} onChange={(e) => set('ctaHref', e.target.value)} /></Field>
            </div>
            <Field label="Background image"><ImagePicker value={content.backgroundImage} onChange={(url) => set('backgroundImage', url)} /></Field>
        </div>
    );
}

function AboutForm({ content, onChange }) {
    const set = (key, val) => onChange({ ...content, [key]: val });
    return (
        <div className="grid gap-4">
            <Field label="Badge text"><TextInput value={content.badge || ''} onChange={(e) => set('badge', e.target.value)} /></Field>
            <Field label="Heading"><TextInput value={content.heading || ''} onChange={(e) => set('heading', e.target.value)} /></Field>
            <Field label="Image"><ImagePicker value={content.image} onChange={(url) => set('image', url)} /></Field>
            <Field label="Paragraphs">
                <StringListEditor items={content.paragraphs || []} onChange={(v) => set('paragraphs', v)} placeholder="A paragraph of text..." />
            </Field>
            <Field label="Highlight cards" hint="e.g. Mission / Vision cards. Icon uses Font Awesome class names like fa-solid fa-bullseye.">
                <ObjectListEditor
                    items={content.highlights || []}
                    onChange={(v) => set('highlights', v)}
                    addLabel="Add highlight card"
                    emptyItem={{ icon: 'fa-solid fa-star', title: '', text: '' }}
                    fields={[
                        { key: 'icon', label: 'Icon class' },
                        { key: 'title', label: 'Title' },
                        { key: 'text', label: 'Text', type: 'textarea' }
                    ]}
                />
            </Field>
        </div>
    );
}

function CardsGridForm({ content, onChange }) {
    const set = (key, val) => onChange({ ...content, [key]: val });
    return (
        <div className="grid gap-4">
            <Field label="Badge text"><TextInput value={content.badge || ''} onChange={(e) => set('badge', e.target.value)} /></Field>
            <Field label="Heading"><TextInput value={content.heading || ''} onChange={(e) => set('heading', e.target.value)} /></Field>
            <Field label="Description"><TextArea value={content.description || ''} onChange={(e) => set('description', e.target.value)} /></Field>
            <Field label="Cards" hint="Icon uses Font Awesome class names like fa-solid fa-graduation-cap.">
                <ObjectListEditor
                    items={content.cards || []}
                    onChange={(v) => set('cards', v)}
                    addLabel="Add card"
                    emptyItem={{ icon: 'fa-solid fa-star', title: '', text: '' }}
                    fields={[
                        { key: 'icon', label: 'Icon class' },
                        { key: 'title', label: 'Title' },
                        { key: 'text', label: 'Text', type: 'textarea' }
                    ]}
                />
            </Field>
        </div>
    );
}

function SystemsGridForm({ content, onChange }) {
    const set = (key, val) => onChange({ ...content, [key]: val });
    return (
        <div className="grid gap-4">
            <Field label="Badge text"><TextInput value={content.badge || ''} onChange={(e) => set('badge', e.target.value)} /></Field>
            <Field label="Heading"><TextInput value={content.heading || ''} onChange={(e) => set('heading', e.target.value)} /></Field>
            <Field label="Description"><TextArea value={content.description || ''} onChange={(e) => set('description', e.target.value)} /></Field>
            <Field label="Systems" hint="Check 'Internal' for links within this app (like /login); leave unchecked for external links, which open in a new tab.">
                <ObjectListEditor
                    items={content.systems || []}
                    onChange={(v) => set('systems', v)}
                    addLabel="Add system"
                    emptyItem={{ name: '', icon: 'fa-solid fa-circle', description: '', url: '', internal: false }}
                    fields={[
                        { key: 'name', label: 'Name' },
                        { key: 'icon', label: 'Icon class' },
                        { key: 'description', label: 'Description' },
                        { key: 'url', label: 'URL' },
                        { key: 'internal', label: 'Internal link', type: 'checkbox' }
                    ]}
                />
            </Field>
        </div>
    );
}

function ContactForm({ content, onChange }) {
    const set = (key, val) => onChange({ ...content, [key]: val });
    return (
        <div className="grid gap-4">
            <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Badge text"><TextInput value={content.badge || ''} onChange={(e) => set('badge', e.target.value)} /></Field>
                <Field label="Heading"><TextInput value={content.heading || ''} onChange={(e) => set('heading', e.target.value)} /></Field>
            </div>
            <Field label="Description"><TextArea value={content.description || ''} onChange={(e) => set('description', e.target.value)} /></Field>
            <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Address" hint="Line breaks are kept as-is."><TextArea value={content.address || ''} onChange={(e) => set('address', e.target.value)} /></Field>
                <Field label="Office hours" hint="Line breaks are kept as-is."><TextArea value={content.officeHours || ''} onChange={(e) => set('officeHours', e.target.value)} /></Field>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Phone"><TextInput value={content.phone || ''} onChange={(e) => set('phone', e.target.value)} /></Field>
                <Field label="Email"><TextInput value={content.email || ''} onChange={(e) => set('email', e.target.value)} /></Field>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Map search text" hint="e.g. your campus name + address. Leave blank to hide the map."><TextInput value={content.mapQuery || ''} onChange={(e) => set('mapQuery', e.target.value)} /></Field>
                <Field label="Map 'open in Google Maps' link"><TextInput value={content.mapExternalUrl || ''} onChange={(e) => set('mapExternalUrl', e.target.value)} /></Field>
            </div>
            <Field label="Social links" hint="Icon uses Font Awesome class names like fa-brands fa-facebook-f.">
                <ObjectListEditor
                    items={content.socialLinks || []}
                    onChange={(v) => set('socialLinks', v)}
                    addLabel="Add social link"
                    emptyItem={{ icon: 'fa-brands fa-facebook-f', label: '', href: '' }}
                    fields={[
                        { key: 'icon', label: 'Icon class' },
                        { key: 'label', label: 'Label' },
                        { key: 'href', label: 'Link' }
                    ]}
                />
            </Field>
        </div>
    );
}

function CustomHtmlForm({ content, onChange }) {
    return (
        <div className="grid gap-2">
            <Field
                label="Raw HTML"
                hint="Free-form escape hatch for anything the other section types don't cover. No formatting help here - write real HTML."
            >
                <TextArea
                    value={content.html || ''}
                    onChange={(e) => onChange({ ...content, html: e.target.value })}
                    rows={8}
                    className="font-mono"
                />
            </Field>
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                This HTML renders exactly as typed, with no sanitization - only superadmin can edit this, which is the same trust level superadmin already has over the rest of the app.
            </p>
        </div>
    );
}

const CONTENT_FORMS = {
    hero: HeroForm,
    about: AboutForm,
    cards_grid: CardsGridForm,
    systems_grid: SystemsGridForm,
    contact: ContactForm,
    custom_html: CustomHtmlForm
};

// ---------- one section row, with its own local edit draft ----------

function SectionRow({ section, isFirst, isLast, onMove, onSaved, onDeleted, onToggleVisible }) {
    const [expanded, setExpanded] = useState(false);
    const [draft, setDraft] = useState(null); // { anchor, nav_label, show_in_nav, content }
    const [saving, setSaving] = useState(false);

    const meta = SECTION_TYPES[section.type];
    const ContentForm = CONTENT_FORMS[section.type];

    function startEdit() {
        setDraft({
            anchor: section.anchor || '',
            nav_label: section.nav_label || '',
            show_in_nav: !!section.show_in_nav,
            content: section.content
        });
        setExpanded(true);
    }

    function cancel() {
        setExpanded(false);
        setDraft(null);
    }

    async function save() {
        setSaving(true);
        try {
            const { data } = await api.put(`/landing-sections/${section.id}`, draft);
            onSaved(data);
            setExpanded(false);
            setDraft(null);
            Swal.fire({ icon: 'success', title: 'Saved', timer: 1200, showConfirmButton: false });
        } catch (err) {
            Swal.fire('Error', err.response?.data?.error || 'Failed to save section.', 'error');
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete() {
        const result = await Swal.fire({
            title: 'Delete this section?',
            text: `This removes the "${meta?.label || section.type}" section from the landing page permanently.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Delete',
            confirmButtonColor: '#dc2626'
        });
        if (!result.isConfirmed) return;
        try {
            await api.delete(`/landing-sections/${section.id}`);
            onDeleted(section.id);
        } catch (err) {
            Swal.fire('Error', err.response?.data?.error || 'Failed to delete section.', 'error');
        }
    }

    const preview = section.content?.heading || section.content?.headingHighlight || (section.type === 'custom_html' ? 'Custom HTML block' : '(untitled)');

    return (
        <div className="bg-white rounded-2xl shadow border overflow-hidden">
            <div className="flex items-center gap-3 p-4">
                <div className="flex flex-col">
                    <button type="button" disabled={isFirst} onClick={() => onMove(section.id, -1)} className="disabled:opacity-25 text-gray-500 hover:text-brand-700">
                        <ChevronUp className="w-4 h-4" />
                    </button>
                    <button type="button" disabled={isLast} onClick={() => onMove(section.id, 1)} className="disabled:opacity-25 text-gray-500 hover:text-brand-700">
                        <ChevronDown className="w-4 h-4" />
                    </button>
                </div>

                <div className="flex-1 min-w-0">
                    <span className="text-xs font-bold uppercase tracking-wide text-brand-700 bg-brand-50 px-2 py-0.5 rounded">
                        {meta?.label || section.type}
                    </span>
                    <p className="font-semibold text-gray-800 truncate mt-1">{preview}</p>
                    {!section.is_visible && <span className="text-xs text-gray-400">Hidden from the live page</span>}
                </div>

                <button type="button" onClick={() => onToggleVisible(section)} title={section.is_visible ? 'Hide from live page' : 'Show on live page'} className="text-gray-500 hover:text-brand-700 p-2">
                    {section.is_visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
                <button type="button" onClick={expanded ? cancel : startEdit} title="Edit" className="text-gray-500 hover:text-brand-700 p-2">
                    <Pencil className="w-4 h-4" />
                </button>
                <button type="button" onClick={handleDelete} title="Delete" className="text-gray-500 hover:text-red-600 p-2">
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>

            {expanded && draft && (
                <div className="border-t bg-gray-50 p-4 sm:p-6 grid gap-6">
                    <div className="grid sm:grid-cols-3 gap-4 pb-4 border-b">
                        <Field label="Section anchor" hint="Used for the #link. Letters/numbers only, no spaces. Leave blank if this section shouldn't be linkable.">
                            <TextInput value={draft.anchor} onChange={(e) => setDraft({ ...draft, anchor: e.target.value.replace(/[^a-zA-Z0-9-_]/g, '') })} />
                        </Field>
                        <Field label="Nav menu label" hint="Leave blank to keep this section out of the top menu.">
                            <TextInput value={draft.nav_label} onChange={(e) => setDraft({ ...draft, nav_label: e.target.value })} />
                        </Field>
                        <Field label="Show in top menu">
                            <input type="checkbox" checked={draft.show_in_nav} onChange={(e) => setDraft({ ...draft, show_in_nav: e.target.checked })} className="w-5 h-5" />
                        </Field>
                    </div>

                    {ContentForm && <ContentForm content={draft.content} onChange={(next) => setDraft({ ...draft, content: next })} />}

                    <div className="flex gap-2 pt-2 border-t">
                        <button type="button" onClick={save} disabled={saving} className="bg-brand-600 hover:bg-brand-700 text-white rounded-lg px-5 py-2.5 font-semibold disabled:opacity-60">
                            {saving ? 'Saving...' : 'Save Section'}
                        </button>
                        <button type="button" onClick={cancel} className="bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg px-5 py-2.5 font-semibold">
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// ---------- page ----------

export default function LandingEditor() {
    const [sections, setSections] = useState(null);
    const [addingType, setAddingType] = useState('hero');
    const [adding, setAdding] = useState(false);

    async function load() {
        const { data } = await api.get('/landing-sections/admin');
        setSections(data.sort((a, b) => a.position - b.position));
    }

    useEffect(() => { load(); }, []);

    function replaceSection(updated) {
        setSections((prev) => prev.map((s) => (s.id === updated.id ? { ...s, ...updated } : s)));
    }

    function removeSection(id) {
        setSections((prev) => prev.filter((s) => s.id !== id));
    }

    async function toggleVisible(section) {
        try {
            const { data } = await api.put(`/landing-sections/${section.id}`, { is_visible: !section.is_visible });
            replaceSection(data);
        } catch (err) {
            Swal.fire('Error', err.response?.data?.error || 'Failed to update section.', 'error');
        }
    }

    async function move(id, direction) {
        const idx = sections.findIndex((s) => s.id === id);
        const swapWith = idx + direction;
        if (swapWith < 0 || swapWith >= sections.length) return;

        const next = [...sections];
        [next[idx], next[swapWith]] = [next[swapWith], next[idx]];
        setSections(next); // optimistic

        try {
            await api.put('/landing-sections/reorder', { order: next.map((s) => s.id) });
        } catch (err) {
            Swal.fire('Error', 'Failed to save the new order.', 'error');
            load(); // revert to server truth
        }
    }

    async function addSection() {
        setAdding(true);
        try {
            await api.post('/landing-sections', { type: addingType });
            await load();
        } catch (err) {
            Swal.fire('Error', err.response?.data?.error || 'Failed to add section.', 'error');
        } finally {
            setAdding(false);
        }
    }

    return (
        <Layout title="Landing Page Editor">
            <div className="max-w-4xl">
                <p className="text-sm text-gray-500 mb-6">
                    Build the public landing page without touching code. Add, remove, reorder, and edit sections below -
                    changes go live as soon as you save each one.
                </p>

                {sections === null ? (
                    <p className="text-gray-500">Loading...</p>
                ) : (
                    <div className="space-y-4">
                        {sections.map((section, i) => (
                            <SectionRow
                                key={section.id}
                                section={section}
                                isFirst={i === 0}
                                isLast={i === sections.length - 1}
                                onMove={move}
                                onSaved={replaceSection}
                                onDeleted={removeSection}
                                onToggleVisible={toggleVisible}
                            />
                        ))}
                    </div>
                )}

                <div className="mt-8 bg-white rounded-2xl shadow border p-5 flex flex-wrap items-center gap-3">
                    <select
                        value={addingType}
                        onChange={(e) => setAddingType(e.target.value)}
                        className="p-2.5 border rounded-lg text-sm"
                    >
                        {Object.entries(SECTION_TYPES).map(([key, { label }]) => (
                            <option key={key} value={key}>{label}</option>
                        ))}
                    </select>
                    <button
                        type="button"
                        onClick={addSection}
                        disabled={adding}
                        className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg px-4 py-2.5 font-semibold disabled:opacity-60"
                    >
                        <Plus className="w-4 h-4" /> {adding ? 'Adding...' : 'Add Section'}
                    </button>
                    <p className="text-xs text-gray-400 w-full sm:w-auto">New sections start hidden from the top menu with placeholder text - edit it before making it visible.</p>
                </div>
            </div>
        </Layout>
    );
}
