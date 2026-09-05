import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// Client-side pagination controls. Pair with usePagination() below - this
// component only renders the Previous/Next + page info, it doesn't slice
// any data itself.
export default function Pagination({ page, totalPages, totalItems, pageSize, onPageChange }) {
    if (totalItems === 0) return null;

    const start = (page - 1) * pageSize + 1;
    const end = Math.min(page * pageSize, totalItems);

    return (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 mt-2 border-t">
            <p className="text-xs text-gray-500">
                Showing {start}-{end} of {totalItems}
            </p>
            <div className="flex items-center gap-2">
                <button
                    onClick={() => onPageChange(page - 1)}
                    disabled={page <= 1}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    <ChevronLeft className="w-3.5 h-3.5" /> Prev
                </button>
                <span className="text-xs text-gray-500 px-1 whitespace-nowrap">
                    Page {page} of {totalPages}
                </span>
                <button
                    onClick={() => onPageChange(page + 1)}
                    disabled={page >= totalPages}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    Next <ChevronRight className="w-3.5 h-3.5" />
                </button>
            </div>
        </div>
    );
}
