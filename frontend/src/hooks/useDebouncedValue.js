import { useEffect, useState } from 'react';

// Returns `value`, but only after it has stopped changing for `delay` ms.
// Use it for search boxes so typing "kirvie" sends ONE request instead of six:
//   const [search, setSearch] = useState('');
//   const debouncedSearch = useDebouncedValue(search, 400);
//   useEffect(() => { load(); }, [debouncedSearch]);   // <- fetch on the debounced value
export default function useDebouncedValue(value, delay = 400) {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(t);
    }, [value, delay]);
    return debounced;
}
