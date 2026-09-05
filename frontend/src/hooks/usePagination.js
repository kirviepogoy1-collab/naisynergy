import { useState, useMemo, useEffect } from 'react';

// Usage:
//   const { pageItems, page, setPage, totalPages } = usePagination(filteredRows, 15);
//   ...render pageItems instead of the full list, <Pagination page={page} totalPages={totalPages} onPageChange={setPage} totalItems={filteredRows.length} pageSize={15} />
//
// Resets to page 1 automatically whenever the list's length or first item
// changes - covers the common case of a search/filter/date-range narrowing
// the results out from under whatever page the user was sitting on.
export default function usePagination(items, pageSize = 15) {
    const [page, setPage] = useState(1);

    const totalPages = Math.max(1, Math.ceil(items.length / pageSize));

    // Clamp page back into range if the list shrank (e.g. filtered down).
    useEffect(() => {
        if (page > totalPages) setPage(totalPages);
    }, [totalPages, page]);

    const pageItems = useMemo(() => {
        const start = (page - 1) * pageSize;
        return items.slice(start, start + pageSize);
    }, [items, page, pageSize]);

    return { pageItems, page, setPage, totalPages };
}
