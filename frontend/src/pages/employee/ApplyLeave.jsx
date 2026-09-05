import React, { useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Layout from '../../components/Layout';
import api from '../../api/axios';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function ApplyLeave() {
    const navigate = useNavigate();
    const [leaveInfo, setLeaveInfo] = useState(null);
    const [leaveType, setLeaveType] = useState('');
    const [otherType, setOtherType] = useState('');
    const [reason, setReason] = useState('');
    // Map of dateStr -> 'full' | 'half-morning' | 'half-afternoon'. Clicking a
    // date cycles through these in order, then back to unselected.
    const [selectedDates, setSelectedDates] = useState({});
    const [viewDate, setViewDate] = useState(new Date());

    async function load() {
        const { data } = await api.get('/leaves/mine');
        setLeaveInfo(data);
    }

    useEffect(() => { load(); }, []);

    const leaveTypes = leaveInfo?.leave_types ?? [];
    // Absent (and anything else HR marks as HR-only) never shows up here -
    // employees only pick from types HR has flagged as employee-selectable.
    const selectableTypes = leaveTypes.filter((t) => t.employee_selectable);
    const used = leaveInfo && leaveType ? (leaveInfo.used_leave[leaveType] ?? 0) : null;
    const remaining = leaveInfo && leaveType ? (leaveInfo.remaining[leaveType] ?? null) : null;
    const isCapped = remaining !== null;

    const dayValue = (type) => (type === 'half-morning' || type === 'half-afternoon' ? 0.5 : 1);
    const totalSelectedDays = Object.values(selectedDates).reduce((sum, t) => sum + dayValue(t), 0);
    // Only picking a brand-new date (unselected -> full) can push the total up;
    // cycling an already-selected date only ever holds steady or shrinks it.
    const atLimit = isCapped && remaining !== null && totalSelectedDays >= remaining;

    // Selecting dates under one leave type's limit shouldn't silently carry over
    // if the employee switches to a different type - start fresh each time.
    useEffect(() => {
        setSelectedDates({});
    }, [leaveType]);

    const calendarDays = useMemo(() => {
        const year = viewDate.getFullYear();
        const month = viewDate.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const days = [];
        for (let i = 0; i < firstDay; i++) days.push(null);
        for (let d = 1; d <= daysInMonth; d++) days.push(d);
        return days;
    }, [viewDate]);

    function dateStr(day) {
        const y = viewDate.getFullYear();
        const m = String(viewDate.getMonth() + 1).padStart(2, '0');
        const d = String(day).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    // Cycle order for a single click: unselected -> full day -> AM half -> PM half -> unselected.
    // Only the very first click (unselected -> full) can increase the total days
    // selected - every later click in the cycle holds steady or frees up room,
    // so that's the only transition worth blocking against the balance.
    function toggleDate(day) {
        if (!day) return;
        const str = dateStr(day);
        const current = selectedDates[str];

        if (!current) {
            if (atLimit) {
                Swal.fire('Limit reached', `You only have ${remaining} day(s) left for ${leaveType}. Deselect a date first if you need to change your selection.`, 'warning');
                return;
            }
            setSelectedDates((prev) => ({ ...prev, [str]: 'full' }));
        } else if (current === 'full') {
            setSelectedDates((prev) => ({ ...prev, [str]: 'half-morning' }));
        } else if (current === 'half-morning') {
            setSelectedDates((prev) => ({ ...prev, [str]: 'half-afternoon' }));
        } else {
            setSelectedDates((prev) => {
                const next = { ...prev };
                delete next[str];
                return next;
            });
        }
    }

    function changeMonth(delta) {
        setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + delta, 1));
    }

    async function handleSubmit(e) {
        e.preventDefault();
        const dateEntries = Object.entries(selectedDates);
        if (!leaveType || dateEntries.length === 0) {
            Swal.fire('Error', 'Please select a leave type and at least one date on the calendar.', 'error');
            return;
        }
        try {
            await api.post('/leaves/apply', {
                leave_type: leaveType,
                other_leave_type: otherType,
                reason,
                dates: dateEntries.map(([date, type]) => ({ date, type }))
            });
            Swal.fire('Success', 'Leave application submitted.', 'success');
            setLeaveType(''); setOtherType(''); setReason(''); setSelectedDates({});
            load();
        } catch (err) {
            Swal.fire('Error', err.response?.data?.error || 'Failed to submit leave.', 'error');
        }
    }

    return (
        <Layout title="Apply Leave">
            <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow p-4 sm:p-6 max-w-2xl mx-auto">
                <h3 className="font-bold text-lg text-brand-900 mb-3">Leave Type</h3>
                <select required value={leaveType} onChange={(e) => setLeaveType(e.target.value)} className="w-full p-3 border rounded-lg mb-4">
                    <option value="">Select Leave Type</option>
                    {selectableTypes.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
                </select>

                {leaveType === 'Others' && (
                    <input
                        placeholder="Specify leave type"
                        value={otherType}
                        onChange={(e) => setOtherType(e.target.value)}
                        className="w-full p-3 border rounded-lg mb-4"
                    />
                )}

                {leaveType && (
                    <div className="flex justify-between text-sm mb-4">
                        <span>Total Used Days</span><span className="font-semibold">{used ?? 0}</span>
                    </div>
                )}
                {leaveType && (
                    <div className="flex justify-between text-sm mb-4">
                        <span>Remaining Days:</span><span className="font-semibold">{remaining ?? 0}</span>
                    </div>
                )}
                {leaveType && totalSelectedDays > 0 && (
                    <div className="flex justify-between text-sm mb-4">
                        <span>Selected:</span><span className="font-semibold">{totalSelectedDays} day(s)</span>
                    </div>
                )}
                {atLimit && (
                    <p className="text-xs text-red-600 mb-4">
                        You've selected the maximum {remaining} day(s) available for {leaveType}.
                    </p>
                )}

                <textarea required placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} className="w-full p-3 border rounded-lg mb-4" rows="2" />

                <div className="border rounded-xl p-3 sm:p-4">
                    <div className="flex items-center justify-between mb-3">
                        <button type="button" onClick={() => changeMonth(-1)} aria-label="Previous month" className="w-9 h-9 flex items-center justify-center rounded-full text-brand-700 hover:bg-brand-50"><ChevronLeft className="w-5 h-5" /></button>
                        <h4 className="font-semibold text-brand-900 text-sm sm:text-base">{viewDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</h4>
                        <button type="button" onClick={() => changeMonth(1)} aria-label="Next month" className="w-9 h-9 flex items-center justify-center rounded-full text-brand-700 hover:bg-brand-50"><ChevronRight className="w-5 h-5" /></button>
                    </div>
                    <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-500 mb-2">
                        {WEEKDAYS.map((w) => <div key={w}>{w}</div>)}
                    </div>
                    <div className="grid grid-cols-7 gap-1 text-center text-sm">
                        {calendarDays.map((day, idx) => {
                            const str = day ? dateStr(day) : null;
                            const dayType = str ? selectedDates[str] : undefined;
                            const disabledByLimit = day && !dayType && atLimit;

                            let cellClass = 'hover:bg-brand-100';
                            let label = day || '';
                            if (dayType === 'full') {
                                cellClass = 'bg-brand-700 text-white font-semibold';
                            } else if (dayType === 'half-morning') {
                                cellClass = 'bg-yellow-300 text-brand-900 font-semibold';
                                label = <>{day}<span className="block text-[9px] leading-none">AM</span></>;
                            } else if (dayType === 'half-afternoon') {
                                cellClass = 'bg-yellow-500 text-brand-900 font-semibold';
                                label = <>{day}<span className="block text-[9px] leading-none">PM</span></>;
                            } else if (disabledByLimit) {
                                cellClass = 'text-gray-300 cursor-not-allowed';
                            }

                            return (
                                <button
                                    type="button"
                                    key={idx}
                                    disabled={!day || disabledByLimit}
                                    onClick={() => toggleDate(day)}
                                    className={`py-2 sm:py-2.5 min-h-[36px] rounded-lg text-xs sm:text-sm ${!day ? '' : cellClass}`}
                                >
                                    {label}
                                </button>
                            );
                        })}
                    </div>
                    <p className="text-xs text-gray-400 mt-3">
                        Click a date to select a full day, click again for AM only, again for PM only, and once more to deselect.
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mt-6">
                    <button type="submit" className="bg-brand-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-brand-700 min-h-[44px]">
                        Submit Application
                    </button>
                    <button type="button" onClick={() => navigate('/employee/leave-history')} className="bg-brand-800 text-white px-5 py-3 rounded-lg font-semibold hover:bg-brand-900 min-h-[44px]">
                        View History
                    </button>
                </div>
            </form>
        </Layout>
    );
}
