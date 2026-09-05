import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
    LayoutDashboard,
    Users,
    UserCog,
    CalendarClock,
    CalendarDays,
    MessageSquare,
    Boxes,
    ClipboardList,
    Building2,
    UserSquare2,
    Receipt,
    FilePlus2,
    History,
    UserCircle,
    ShieldCheck,
    Settings as SettingsIcon,
    Menu,
    X,
    LogOut,
    Wrench,
    Trash2,
    Globe
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';

const BUILDING_LINKS = [
    { name: 'Memorial Building' },
    { name: 'Sussana Building' },
    { name: 'Edna & Edgar Building' },
    { name: 'NAI Offices' }
];

const NAV_BY_ROLE = {
    superadmin: [
        {
            label: 'General',
            items: [
                { to: '/superadmin', label: 'Dashboard', end: true, icon: LayoutDashboard },
                { to: '/superadmin/users', label: 'Manage Users', icon: UserCog },
                { to: '/superadmin/activity', label: 'Activity Log', icon: History },
                { to: '/superadmin/settings', label: 'System Settings', icon: SettingsIcon },
                { to: '/superadmin/landing-page', label: 'Landing Page', icon: Globe }
            ]
        },
        {
            label: 'HR',
            items: [
                { to: '/hr/employees', label: 'Employees', icon: Users },
                { to: '/hr/leaves', label: 'Leave Applications', icon: CalendarClock },
                { to: '/hr/leaves/calendar', label: 'Leave Calendar', icon: CalendarDays },
                { to: '/hr/leave-types', label: 'Leave Types', icon: SettingsIcon },
                { to: '/hr/chat', label: 'Chat', icon: MessageSquare },
                { to: '/hr/activity', label: 'Activity Log', icon: History }
            ]
        },
        {
            label: 'Inventory',
            items: [
                { to: '/inventory', label: 'Dashboard', end: true, icon: Boxes },
                { to: '/inventory/asset-summary', label: 'Asset Summary', icon: ClipboardList },
                { to: '/inventory/buildings', label: 'Buildings', icon: Building2 },
                ...BUILDING_LINKS.map((b) => ({ to: `/inventory/buildings/${encodeURIComponent(b.name)}`, label: b.name, icon: Building2 })),
                { to: '/inventory/personnel', label: 'Assigned Personnel', icon: UserSquare2 },
                { to: '/inventory/records', label: 'Purchase Records', icon: Receipt },
                { to: '/inventory/repair-watch', label: 'Repair Watch', icon: Wrench },
                { to: '/inventory/users', label: 'Manage Users', icon: UserCog },
                { to: '/inventory/activity', label: 'User Activity', icon: History },
                { to: '/inventory/trash', label: 'Trash', icon: Trash2 }
            ]
        },
        {
            label: 'Security',
            items: [
                { to: '/security', label: 'Security', icon: ShieldCheck }
            ]
        }
    ],
    hr_staff: [
        { to: '/hr', label: 'Dashboard', end: true, icon: LayoutDashboard },
        { to: '/hr/employees', label: 'Employees', icon: Users },
        { to: '/hr/leaves', label: 'Leave Applications', icon: CalendarClock },
        { to: '/hr/leaves/calendar', label: 'Leave Calendar', icon: CalendarDays },
        { to: '/hr/leave-types', label: 'Leave Types', icon: SettingsIcon },
        { to: '/hr/chat', label: 'Chat', icon: MessageSquare },
        { to: '/hr/activity', label: 'Activity Log', icon: History },
        { to: '/security', label: 'Security', icon: ShieldCheck }
    ],
    inventory_staff: [
        { to: '/inventory', label: 'Dashboard', end: true, icon: LayoutDashboard },
        { to: '/inventory/asset-summary', label: 'Asset Summary', icon: ClipboardList },
        {
            label: 'Buildings',
            items: [
                { to: '/inventory/buildings', label: 'All Buildings', icon: Building2 },
                ...BUILDING_LINKS.map((b) => ({ to: `/inventory/buildings/${encodeURIComponent(b.name)}`, label: b.name, icon: Building2 }))
            ]
        },
        { to: '/inventory/personnel', label: 'Assigned Personnel', icon: UserSquare2 },
        { to: '/inventory/records', label: 'Purchase Records', icon: Receipt },
        { to: '/inventory/repair-watch', label: 'Repair Watch', icon: Wrench },
        { to: '/inventory/activity', label: 'User Activity', icon: History },
        { to: '/inventory/trash', label: 'Trash', icon: Trash2 },
        { to: '/security', label: 'Security', icon: ShieldCheck }
    ],
    // View-only: can look at everything inventory_staff can, plus comment on
    // items, but has no Add/Edit/Delete anywhere and no account management.
    inventory_viewer: [
        { to: '/inventory', label: 'Dashboard', end: true, icon: LayoutDashboard },
        { to: '/inventory/asset-summary', label: 'Asset Summary', icon: ClipboardList },
        {
            label: 'Buildings',
            items: [
                { to: '/inventory/buildings', label: 'All Buildings', icon: Building2 },
                ...BUILDING_LINKS.map((b) => ({ to: `/inventory/buildings/${encodeURIComponent(b.name)}`, label: b.name, icon: Building2 }))
            ]
        },
        { to: '/inventory/personnel', label: 'Assigned Personnel', icon: UserSquare2 },
        { to: '/inventory/records', label: 'Purchase Records', icon: Receipt },
        { to: '/inventory/repair-watch', label: 'Repair Watch', icon: Wrench },
        { to: '/security', label: 'Security', icon: ShieldCheck }
    ],
    employee: [
        { to: '/employee', label: 'Dashboard', end: true, icon: LayoutDashboard },
        { to: '/employee/apply-leave', label: 'Apply Leave', icon: FilePlus2 },
        { to: '/employee/leave-history', label: 'Leave History', icon: History },
        { to: '/employee/chat', label: 'Chat with HR', icon: MessageSquare },
        { to: '/employee/profile', label: 'Profile', icon: UserCircle },
        { to: '/security', label: 'Security', icon: ShieldCheck }
    ]
};

const ROLE_LABEL = {
    superadmin: 'Super Admin',
    hr_staff: 'HR Staff',
    inventory_staff: 'Inventory Staff',
    employee: 'Employee'
};

export default function Sidebar({ open: openProp, onOpenChange }) {
    const { user, logout } = useAuth();
    const { settings } = useSettings();
    const navigate = useNavigate();
    // Falls back to internal state so Sidebar still works if ever rendered
    // without Layout's controlled props.
    const [internalOpen, setInternalOpen] = useState(false);
    const open = openProp !== undefined ? openProp : internalOpen;
    const setOpen = onOpenChange || setInternalOpen;
    const [activeSection, setActiveSection] = useState('');
    const sections = NAV_BY_ROLE[user?.role] || [];

    async function handleLogout() {
        await logout();
        navigate('/login');
    }

    const toggleSection = (label) => {
        setActiveSection((current) => (current === label ? '' : label));
    };

    const renderNavItems = (items) =>
        items.map((item) => {
            if (item.items) {
                return (
                    <div key={item.label} className="space-y-2">
                        <button
                            type="button"
                            onClick={() => toggleSection(item.label)}
                            className="flex items-center justify-between w-full px-4 py-3 rounded-2xl bg-white/10 text-left text-sm font-semibold text-white hover:bg-white/15 transition"
                        >
                            <span>{item.label}</span>
                            <span className="text-brand-100">{activeSection === item.label ? '−' : '+'}</span>
                        </button>
                        {activeSection === item.label && (
                            <div className="space-y-1 pl-4">
                                {item.items.map((subItem) => {
                                    const Icon = subItem.icon;
                                    return (
                                        <NavLink
                                            key={subItem.to}
                                            to={subItem.to}
                                            end={subItem.end}
                                            onClick={() => setOpen(false)}
                                            className={({ isActive }) =>
                                                `flex items-center gap-3 px-4 py-2 rounded-xl text-sm font-semibold transition ${
                                                    isActive
                                                        ? 'bg-yellow-300 text-brand-800 shadow-sm'
                                                        : 'text-white/90 hover:bg-white/10'
                                                }`
                                            }
                                        >
                                            {Icon && <Icon className="w-[18px] h-[18px] shrink-0" />}
                                            <span className="truncate">{subItem.label}</span>
                                        </NavLink>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                );
            }

            const Icon = item.icon;
            return (
                <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={() => setOpen(false)}
                    className={({ isActive }) =>
                        `flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition ${
                            isActive
                                ? 'bg-yellow-300 text-brand-800 shadow-sm'
                                : 'text-white/90 hover:bg-white/10'
                        }`
                    }
                >
                    {Icon && <Icon className="w-[18px] h-[18px] shrink-0" />}
                    <span className="truncate">{item.label}</span>
                </NavLink>
            );
        });

    return (
        <>
            {/* Mobile top bar */}
            <div className="md:hidden sticky top-0 z-20 flex items-center justify-between px-4 py-3 bg-brand-700 text-white shadow-sm">
                <div className="flex items-center gap-2">
                    <img src={settings.logo_url} alt="School Logo" className="w-8 h-8 rounded-full bg-white p-0.5 object-contain" />
                    <h1 className="text-base font-bold tracking-tight">{settings.school_name}</h1>
                </div>
                <button
                    onClick={() => setOpen(true)}
                    aria-label="Open navigation menu"
                    className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 active:bg-white/20 transition"
                >
                    <Menu className="w-6 h-6" />
                </button>
            </div>

            {/* Mobile backdrop */}
            {open && (
                <div
                    className="fixed inset-0 bg-black/40 z-30 md:hidden"
                    onClick={() => setOpen(false)}
                    aria-hidden="true"
                />
            )}

            <aside
                className={`fixed inset-y-0 left-0 w-72 max-w-[85vw] md:w-64 bg-brand-700 text-white flex flex-col shadow-lg transform
                ${open ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 transition-transform duration-300 ease-in-out z-40 md:rounded-r-3xl`}
            >
                <div className="flex items-center justify-between md:block px-5 pt-5 md:p-6 md:text-center">
                    <div className="flex items-center gap-3 md:flex-col md:gap-0">
                        <img src={settings.logo_url} alt="School Logo" className="w-12 h-12 md:w-20 md:h-20 md:mx-auto rounded-full bg-white p-1 object-contain" />
                        <div className="md:mt-3">
                            <p className="text-sm font-semibold">{ROLE_LABEL[user?.role]}</p>
                            <p className="text-xs text-brand-100 truncate max-w-[10rem] md:hidden">{user?.name}</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setOpen(false)}
                        aria-label="Close navigation menu"
                        className="md:hidden w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10 active:bg-white/20 transition"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <nav className="flex-1 overflow-y-auto thin-scrollbar px-4 py-4 md:pt-6 space-y-3">
                    {renderNavItems(sections)}
                </nav>

                <div className="p-4 border-t border-white/10">
                    <p className="hidden md:block text-xs text-center text-brand-100 mb-2 truncate">{user?.name}</p>
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 active:bg-red-700 text-white text-sm font-semibold py-2.5 rounded-full transition"
                    >
                        <LogOut className="w-4 h-4" />
                        Logout
                    </button>
                </div>
            </aside>
        </>
    );
}
