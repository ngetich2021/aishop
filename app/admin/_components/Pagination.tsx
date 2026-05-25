"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  page:       number;
  totalPages: number;
  total:      number;
  perPage:    number;
  label?:     string;
  onPage:     (p: number) => void;
}

export default function Pagination({ page, totalPages, total, perPage, label = "records", onPage }: Props) {
  const from = Math.min((page - 1) * perPage + 1, total);
  const to   = Math.min(page * perPage, total);

  // Build visible page number list (with -1 as ellipsis placeholder)
  function pageList(): number[] {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (page <= 4)       return [1, 2, 3, 4, 5, -1, totalPages];
    if (page >= totalPages - 3) return [1, -1, totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    return [1, -1, page - 1, page, page + 1, -2, totalPages];
  }

  return (
    <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50 flex-wrap gap-2">
      <p className="text-xs text-gray-500">
        {total === 0
          ? `0 ${label}`
          : `${from}–${to} of ${total.toLocaleString()} ${label}`}
      </p>

      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPage(page - 1)}
            disabled={page <= 1}
            className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-white hover:border-gray-300 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={13} />
          </button>

          {pageList().map((p, i) =>
            p < 0 ? (
              <span key={`e${i}`} className="w-7 h-7 flex items-center justify-center text-xs text-gray-400">…</span>
            ) : (
              <button
                key={p}
                onClick={() => onPage(p)}
                className={[
                  "w-7 h-7 flex items-center justify-center rounded-lg text-xs font-medium border transition",
                  p === page
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "border-gray-200 text-gray-600 hover:bg-white hover:border-gray-300",
                ].join(" ")}
              >
                {p}
              </button>
            )
          )}

          <button
            onClick={() => onPage(page + 1)}
            disabled={page >= totalPages}
            className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-white hover:border-gray-300 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronRight size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
