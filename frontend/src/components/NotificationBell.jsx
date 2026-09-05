import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import api from '../api/axios';
import { timeAgo } from '../utils/formatDate';

const POLL_INTERVAL_MS = 30000;

export default function NotificationBell() {
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [open, setOpen] = useState(false);
    const wrapperRef = useRef(null);
    const navigate = useNavigate();

    const fetchNotifications = useCallback(async () => {
        try {
            const { data } = await api.get('/notifications');
            setNotifications(data.notifications);
            setUnreadCount(data.unread_count);
        } catch (err) {
            // Silently ignore - a failed poll shouldn't disrupt the rest of the page
        }
    }, []);

    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, POLL_INTERVAL_MS);
        return () => clearInterval(interval);
    }, [fetchNotifications]);

    // Close the dropdown when clicking outside of it
    useEffect(() => {
        function handleClickOutside(e) {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
                setOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    async function handleItemClick(notification) {
        if (!notification.is_read) {
            setNotifications((prev) =>
                prev.map((n) => (n.id === notification.id ? { ...n, is_read: 1 } : n))
            );
            setUnreadCount((prev) => Math.max(0, prev - 1));
            api.patch(`/notifications/${notification.id}/read`).catch(() => {});
        }
        setOpen(false);
        if (notification.link) navigate(notification.link);
    }

    async function handleMarkAllRead() {
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
        setUnreadCount(0);
        try {
            await api.patch('/notifications/read-all');
        } catch (err) {
            // if it fails, the next poll will resync the real state
        }
    }

    return (
        <div className="relative" ref={wrapperRef}>
            <button
                onClick={() => setOpen((prev) => !prev)}
                className="relative w-10 h-10 flex items-center justify-center rounded-full bg-white/70 hover:bg-white active:bg-white transition shadow-sm"
                aria-label="Notifications"
            >
                <Bell className="w-5 h-5 text-brand-700" />
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {open && (
                <div className="absolute right-0 mt-2 w-80 max-w-[90vw] bg-white rounded-2xl shadow-xl border border-gray-100 z-40 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                        <p className="font-semibold text-brand-700">Notifications</p>
                        {unreadCount > 0 && (
                            <button
                                onClick={handleMarkAllRead}
                                className="text-xs font-semibold text-brand-600 hover:underline"
                            >
                                Mark all read
                            </button>
                        )}
                    </div>

                    <div className="max-h-80 overflow-y-auto">
                        {notifications.length === 0 ? (
                            <p className="text-sm text-gray-400 text-center py-8">No notifications yet.</p>
                        ) : (
                            notifications.map((n) => (
                                <button
                                    key={n.id}
                                    onClick={() => handleItemClick(n)}
                                    className={`w-full text-left px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition ${
                                        !n.is_read ? 'bg-brand-50' : ''
                                    }`}
                                >
                                    <p className="text-sm text-gray-800 leading-snug">{n.message}</p>
                                    <p className="text-xs text-gray-400 mt-1">{timeAgo(n.created_at)}</p>
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
