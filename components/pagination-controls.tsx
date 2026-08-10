"use client";

type PaginationControlsProps = {
  page: number;
  pageSize?: number;
  total: number;
  onPageChange: (page: number) => void;
};

export const DEFAULT_PAGE_SIZE = 100;

export function PaginationControls({
  page,
  pageSize = DEFAULT_PAGE_SIZE,
  total,
  onPageChange,
}: PaginationControlsProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(Math.max(page, 1), pageCount);
  const start = total ? (currentPage - 1) * pageSize + 1 : 0;
  const end = Math.min(currentPage * pageSize, total);

  return (
    <div className="flex flex-col gap-2 border-t border-slate-100 px-4 py-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
      <p>
        Showing {start}-{end} of {total}
      </p>
      <div className="flex items-center gap-2">
        <button
          className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 font-semibold text-slate-700 shadow-sm transition hover:border-sky-200 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          type="button"
        >
          Previous
        </button>
        <span className="min-w-20 text-center text-xs font-semibold uppercase text-slate-500">
          {currentPage} / {pageCount}
        </span>
        <button
          className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 font-semibold text-slate-700 shadow-sm transition hover:border-sky-200 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={currentPage >= pageCount}
          onClick={() => onPageChange(currentPage + 1)}
          type="button"
        >
          Next
        </button>
      </div>
    </div>
  );
}
