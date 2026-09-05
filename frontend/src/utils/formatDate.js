// The company operates in the Philippines, so timestamps are always shown
// in Philippine time (Asia/Manila, UTC+8) - regardless of what timezone an
// individual device happens to be set to. The backend sends UTC timestamps
// (see backend/config/db.js); this is where that gets converted for display.
const PH_TIMEZONE = 'Asia/Manila';

export function formatDateTime(dateString) {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('en-PH', {
        timeZone: PH_TIMEZONE,
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    });
}

export function formatTimeOnly(dateString) {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleTimeString('en-PH', {
        timeZone: PH_TIMEZONE,
        hour: 'numeric',
        minute: '2-digit'
    });
}

// Relative time ("5m ago") - this is based on real elapsed milliseconds so
// it's timezone-agnostic by nature; it only needed the backend's UTC fix
// to be accurate, not a timezone parameter here.
export function timeAgo(dateString) {
    const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
    if (seconds < 5) return 'just now';
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return formatDateTime(dateString);
}

// The calendar date (YYYY-MM-DD) that `dateString` falls on in Philippine
// time. Use this - never Date.prototype.toISOString() - for any date-only
// key or comparison. toISOString() always converts to UTC, which silently
// shifts the calendar date by a day for anyone ahead of UTC (like PH,
// UTC+8): local midnight Aug 11 in Manila is still Aug 10 in UTC, so a
// naive toISOString().slice(0,10) mislabels it "Aug 10" and, e.g., makes a
// leave calendar plot an approved leave one day later than it was filed for.
export function toDateKeyPH(dateString) {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-CA', { timeZone: PH_TIMEZONE });
}

// Today's calendar date in Philippine time, as YYYY-MM-DD - use instead of
// `new Date().toISOString().slice(0, 10)`, which can report "yesterday"
// for PH users during the first 8 hours of the local day (since UTC is
// still on the previous date until 8am Manila time).
export function todayKeyPH() {
    return toDateKeyPH(new Date());
}
