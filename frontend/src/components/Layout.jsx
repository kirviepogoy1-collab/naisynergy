import React, { useState } from 'react';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import NotificationBell from './NotificationBell';
import GlobalSearch from './GlobalSearch';
import { useAuth } from '../context/AuthContext';

export default function Layout({ title, children, headerExtra }) {
    const { user } = useAuth();
    const canSearch = user?.role === 'hr_staff' || user?.role === 'superadmin';
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
                        {canSearch && <GlobalSearch />}
                        <NotificationBell />
                    </div>
                </div>

                <div className="md:hidden flex items-center justify-between gap-3 px-4 py-4 bg-gray-50">
                    <div className="min-w-0">
                        {title && <h1 className="font-display text-xl font-semibold text-brand-700 truncate">{title}</h1>}
                    </div>
                    <NotificationBell />
                </div>

                {canSearch && (
                    <div className="md:hidden px-4 pb-3">
                        <GlobalSearch />
                    </div>
                )}

                {headerExtra && <div className="md:hidden px-4 pb-3">{headerExtra}</div>}

                <div className="px-4 pb-8 md:px-10 md:pb-10">{children}</div>
            </main>

            <BottomNav />
        </div>
    );
}
