import { useEffect, useRef, useState } from 'react';
import axios from 'axios';

// Returns `value` only after it has stopped changing for `delay` ms.
// If the trimmed text is shorter than `minLength` (but not empty), it returns ''
// so a single typed letter doesn't hit the backend.
//   const debouncedSearch = useDebouncedValue(search);   // 500ms, min 2 letters
export default function useDebouncedValue(value, delay = 500, minLength = 2) {
    const clean = (v) => {
        if (typeof v !== 'string') return v;
        const t = v.trim();
        return t.length < minLength ? '' : t;
    };
    const [debounced, setDebounced] = useState(() => clean(value));
    useEffect(() => {
        const t = setTimeout(() => setDebounced(clean(value)), delay);
        return () => clearTimeout(t);
    }, [value, delay, minLength]);
    return debounced;
}

// Cancels the previous in-flight request when a new one starts, so slow
// replies can't pile up or overwrite newer results.
//   const nextSignal = useLatestSignal();
//   api.get(url, { params, signal: nextSignal() })
export function useLatestSignal() {
    const ref = useRef(null);
    return () => {
        ref.current?.abort();
        ref.current = new AbortController();
        return ref.current.signal;
    };
}

export const isCanceled = (err) => axios.isCancel(err) || err?.code === 'ERR_CANCELED';
