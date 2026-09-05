import React, { useEffect, useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Layout from '../../components/Layout';
import api from '../../api/axios';
import { toDateKeyPH, todayKeyPH } from '../../utils/formatDate';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const LEAVE_COLORS = [
    'bg-brand-100 text-brand-800',
    'bg-blue-100 text-blue-800',
    'bg-amber-100 text-amber-800',
    'bg-purple-100 text-purple-800',
    'bg-rose-100 text-rose-800'
];

function pad2(n) {
    return String(n).padStart(2, '0');
}

// A grid cell's key is built directly from the (year, month, day) the
// calendar itself chose - never round-tripped through a Date object's
// toISOString(), which forces UTC and would shift it a day off for any
// timezone ahead of UTC (see toDateKeyPH in utils/formatDate).
function cellKey(year, month, day) {
    return `${year}-${pad2(month + 1)}-${pad2(day)}`;
}

function colorForType(leaveType) {
    let hash = 0;
    for (let i = 0; i < leaveType.length; i++) hash = (hash * 31 + leaveType.charCodeAt(i)) >>> 0;
    return LEAVE_COLORS[hash % LEAVE_COLORS.length];
}

// Today's Y/M/D in Philippine time, used both to highlight "today" and to
// default the calendar to the current Manila month on first load.
function todayPHParts() {
    const [y, m, d] = todayKeyPH().split('-').map(Number);
    return { year: y, month: m - 1, day: d };
}

export default function LeaveCalendar() {
    const [leaves, setLeaves] = useState([]);
    const [cursor, setCursor] = useState(() => {
        const { year, month } = todayPHParts();
        return { year, month };
    });

    useEffect(() => {
        api.get('/leaves').then(({ data }) => setLeaves(data.filter((l) => l.status === 'approved')));
    }, []);

    // Map each day (YYYY-MM-DD, in Philippine time) to the leaves covering it
    const leavesByDay = useMemo(() => {
        const map = {};
        for (const l of leaves) {
            const [sy, sm, sd] = toDateKeyPH(l.start_date).split('-').map(Number);
            const [ey, em, ed] = toDateKeyPH(l.end_date).split('-').map(Number);
            // Pure calendar-math walk from start to end (inclusive), using
            // Date.UTC purely as a day counter - we only ever read it back
            // with getUTC*, so it's never affected by the browser's own
            // timezone the way a local Date + toISOString() mix would be.
            const cursorDate = new Date(Date.UTC(sy, sm - 1, sd));
            const endDate = new Date(Date.UTC(ey, em - 1, ed));
            while (cursorDate <= endDate) {
                const key = cellKey(cursorDate.getUTCFullYear(), cursorDate.getUTCMonth(), cursorDate.getUTCDate());
                if (!map[key]) map[key] = [];
                map[key].push(l);
                cursorDate.setUTCDate(cursorDate.getUTCDate() + 1);
            }
        }
        return map;
    }, [leaves]);

    const { year, month } = cursor;
    const firstOfMonth = new Date(year, month, 1);
    const startOffset = firstOfMonth.getDay(); // 0 = Sunday
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let day = 1; day <= daysInMonth; day++) cells.push(day);

    const todayKey = todayKeyPH();
    const monthLabel = firstOfMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    function changeMonth(delta) {
        const next = new Date(year, month + delta, 1);
        setCursor({ year: next.getFullYear(), month: next.getMonth() });
    }

    return (
        <Layout title="Leave Calendar">
            <div className="bg-white rounded-2xl shadow p-4 sm:p-6">
                <div className="flex items-center justify-between mb-5">
                    <button
                        onClick={() => changeMonth(-1)}
                        className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500"
                        aria-label="Previous month"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <h2 className="font-bold text-brand-800 text-lg">{monthLabel}</h2>
                    <button
                        onClick={() => changeMonth(1)}
                        className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500"
                        aria-label="Next month"
                    >
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>

                <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-1">
                    {WEEKDAYS.map((d) => (
                        <div key={d} className="text-center text-xs font-semibold text-gray-400 py-1">{d}</div>
                    ))}
                </div>

                <div className="grid grid-cols-7 gap-1 sm:gap-2">
                    {cells.map((day, i) => {
                        if (!day) return <div key={i} />;
                        const key = cellKey(year, month, day);
                        const dayLeaves = leavesByDay[key] || [];
                        const isToday = key === todayKey;
                        return (
                            <div
                                key={i}
                                className={`min-h-[72px] sm:min-h-[92px] rounded-lg sm:rounded-xl border p-1.5 sm:p-2 ${isToday ? 'border-brand-500 bg-brand-50/40' : 'border-gray-100'}`}
                            >
                                <p className={`text-xs font-semibold mb-1 ${isToday ? 'text-brand-700' : 'text-gray-400'}`}>{day}</p>
                                <div className="space-y-1">
                                    {dayLeaves.slice(0, 3).map((l) => (
                                        <div key={l.id} title={`${l.employee_name} - ${l.leave_type}`} className={`text-[10px] sm:text-xs px-1.5 py-0.5 rounded truncate ${colorForType(l.leave_type)}`}>
                                            {l.employee_name}
                                        </div>
                                    ))}
                                    {dayLeaves.length > 3 && (
                                        <p className="text-[10px] text-gray-400">+{dayLeaves.length - 3} more</p>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </Layout>
    );
}
