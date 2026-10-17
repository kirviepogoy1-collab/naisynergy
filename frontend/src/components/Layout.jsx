import React, { useState } from 'react';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import NotificationBell from './NotificationBell';
import GlobalSearch from './GlobalSearch';
import InventorySearch from './InventorySearch';
import PageSearch from './PageSearch';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Layout({ title, children, headerExtra, hideSearch = false, pageSearch = null }) {
    const { user } = useAuth();
    const { pathname } = useLocation();
    // Header search: employees/documents/leaves outside inventory (HR + superadmin),
    // asset name/code inside inventory pages. hideSearch turns it off on pages that
    // have their own search bar or nothing to look up (e.g. settings).
    const inInventory = pathname.startsWith('/inventory');
    const canSearchPeople = !hideSearch && !inInventory && (user?.role === 'hr_staff' || user?.role === 'superadmin');
    const canSearchAssets = !hideSearch && inInventory && ['superadmin', 'inventory_staff', 'inventory_viewer'].includes(user?.role);
    // pageSearch ({ value, onChange, placeholder }) wins: the page filters its own list.
    const searchNode = pageSearch
        ? <PageSearch {...pageSearch} />
        : canSearchAssets ? <InventorySearch /> : canSearchPeople ? <GlobalSearch /> : null;
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
            <Sidebar open={mobileMenuOpen} onOpenChange={setMobileMenuOpen} />
            <main className="flex-1 md:ml-64 min-w-0 pb-20 md:pb-0">
                <div className="sticky top-0 z-10 hidden md:flex items-center justify-between gap-4 px-6 lg:px-10 py-5 bg-gray-50/95 backdrop-blur">
                    <div className="flex items-center gap-4 min-w-0">
                        {title && <h1 className="font-display text-2xl lg:text-3xl font-semibold text-brand-700 truncate">{title}</h1>}
                        {headerExtra}
                    </div>
                    <div className="flex items-center gap-3">
                        {searchNode}
                        <NotificationBell />
                    </div>
                </div>

                <div className="md:hidden flex items-center justify-between gap-3 px-4 py-4 bg-gray-50">
                    <div className="min-w-0">
                        {title && <h1 className="font-display text-xl font-semibold text-brand-700 truncate">{title}</h1>}
                    </div>
                    <NotificationBell />
                </div>

                {searchNode && (
                    <div className="md:hidden px-4 pb-3">
                        {searchNode}
                    </div>
                )}

                {headerExtra && <div className="md:hidden px-4 pb-3">{headerExtra}</div>}

                <div className="px-4 pb-8 md:px-10 md:pb-10">{children}</div>
            </main>

            <BottomNav />
        </div>
    );
}
