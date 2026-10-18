import { useEffect, useRef } from 'react';

// Calls `callback` every `intervalMs`, but only while the browser tab is visible,
// and once immediately when the tab becomes visible again. A tab nobody is looking
// at sends no requests at all; coming back refreshes the page right away.
//   usePolling(load, 20000);
export default function usePolling(callback, intervalMs, deps = []) {
    const saved = useRef(callback);
    saved.current = callback; // always call the latest version of the function

    useEffect(() => {
        const run = () => { if (!document.hidden) saved.current(); };
        const id = setInterval(run, intervalMs);
        document.addEventListener('visibilitychange', run);
        return () => {
            clearInterval(id);
            document.removeEventListener('visibilitychange', run);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [intervalMs, ...deps]);
}
