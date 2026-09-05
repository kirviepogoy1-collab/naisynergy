import React from 'react';
import { NavLink } from 'react-router-dom';
import {
    LayoutDashboard,
    UserCog,
    Users,
    CalendarClock,
    Building2,
    Receipt,
    FilePlus2,
    UserCircle,
    History,
    ShieldCheck
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// Four tabs per role, mirroring the primary items in Sidebar's NAV_BY_ROLE.
// The hamburger (top bar, opens the Sidebar drawer) already covers "see
// everything else", so the 4th tab here is a real destination per role
// instead of a duplicate "More" button.
//
// superadmin / hr_staff / inventory_staff all have an Activity Log route,
// so their 4th tab is "Log". inventory_viewer and employee have no activity
// log route in App.jsx, so they get their next most useful page instead
// (Security, Leave History) — swap these if you'd rather have something else.
const TABS_BY_ROLE = {
    superadmin: [
        { to: '/superadmin', label: 'Dashboard', end: true, icon: LayoutDashboard },
        { to: '/superadmin/users', label: 'Users', icon: UserCog },
        { to: '/superadmin/settings', label: 'Settings', icon: UserCog },
        { to: '/superadmin/activity', label: 'Log', icon: History }
    ],
    hr_staff: [
        { to: '/hr', label: 'Dashboard', end: true, icon: LayoutDashboard },
        { to: '/hr/employees', label: 'Employees', icon: Users },
        { to: '/hr/leaves', label: 'Requests', icon: CalendarClock },
        { to: '/hr/activity', label: 'Log', icon: History }
    ],
    inventory_staff: [
        { to: '/inventory', label: 'Dashboard', end: true, icon: LayoutDashboard },
        { to: '/inventory/buildings', label: 'Buildings', icon: Building2 },
        { to: '/inventory/records', label: 'Records', icon: Receipt },
        { to: '/inventory/activity', label: 'Log', icon: History }
    ],
    // No /inventory/activity access for this role (see App.jsx route roles) —
    // Security stands in for the 4th tab.
    inventory_viewer: [
        { to: '/inventory', label: 'Dashboard', end: true, icon: LayoutDashboard },
        { to: '/inventory/buildings', label: 'Buildings', icon: Building2 },
        { to: '/inventory/records', label: 'Records', icon: Receipt },
        { to: '/security', label: 'Security', icon: ShieldCheck }
    ],
    // No activity log route for employees — Leave History stands in.
    employee: [
        { to: '/employee', label: 'Dashboard', end: true, icon: LayoutDashboard },
        { to: '/employee/apply-leave', label: 'Requests', icon: FilePlus2 },
        { to: '/employee/leave-history', label: 'History', icon: History },
        { to: '/employee/profile', label: 'Profile', icon: UserCircle }
    ]
};

export default function BottomNav() {
    const { user } = useAuth();
    const tabs = TABS_BY_ROLE[user?.role] || [];

    return (
        <nav
            className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-gray-200 shadow-[0_-2px_10px_rgba(0,0,0,0.06)]"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
            <div className="grid grid-cols-4 h-16">
                {tabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                        <NavLink
                            key={tab.to}
                            to={tab.to}
                            end={tab.end}
                            className={({ isActive }) =>
                                `flex flex-col items-center justify-center gap-1 text-[11px] font-semibold transition ${
                                    isActive ? 'text-brand-700' : 'text-gray-400'
                                }`
                            }
                        >
                            {({ isActive }) => (
                                <>
                                    <Icon className={`w-5 h-5 ${isActive ? 'text-brand-700' : 'text-gray-400'}`} />
                                    <span className="truncate max-w-[4.5rem]">{tab.label}</span>
                                </>
                            )}
                        </NavLink>
                    );
                })}
            </div>
        </nav>
    );
}
