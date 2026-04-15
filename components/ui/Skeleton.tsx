"use client";

import { cn } from "@/lib/utils";

// ── Primitive ─────────────────────────────────────────────────────────────────
export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse rounded-lg bg-gray-200", className)} />
  );
}

// ── Stat card row (used by many pages) ───────────────────────────────────────
export function StatCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className={`grid gap-3`} style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-gray-100 bg-white px-4 pt-4 pb-3 shadow-sm space-y-2">
          <Skeleton className="h-2.5 w-16" />
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-2 w-12" />
        </div>
      ))}
    </div>
  );
}

// ── Table skeleton ────────────────────────────────────────────────────────────
export function TableSkeleton({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* header */}
      <div className="bg-slate-50 border-b border-gray-200 px-4 py-3.5 flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-2.5 flex-1" />
        ))}
      </div>
      {/* rows */}
      <div className="divide-y divide-gray-100">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="px-4 py-3 flex gap-4 items-center">
            {Array.from({ length: cols }).map((_, j) => (
              <Skeleton key={j} className={`h-3 flex-1 ${j === 1 ? "max-w-[180px]" : ""}`} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Standard page skeleton (header + stats + table) ──────────────────────────
export function PageSkeleton({
  statCount = 4, tableRows = 8, tableCols = 5, hasSearch = true,
}: {
  statCount?: number; tableRows?: number; tableCols?: number; hasSearch?: boolean;
}) {
  return (
    <div className="min-h-screen bg-slate-50/80 px-3 py-5 md:px-6">
      <div className="mx-auto max-w-screen-xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between rounded-2xl border bg-white px-5 py-4 shadow-sm">
          <div className="space-y-2">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="h-9 w-28 rounded-xl" />
        </div>
        {/* Stats */}
        <StatCardsSkeleton count={statCount} />
        {/* Search bar */}
        {hasSearch && <Skeleton className="h-9 w-64 rounded-xl" />}
        {/* Table */}
        <TableSkeleton rows={tableRows} cols={tableCols} />
      </div>
    </div>
  );
}

// ── Dashboard skeleton ────────────────────────────────────────────────────────
export function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50/80 px-3 py-5 md:px-6">
      <div className="mx-auto max-w-screen-xl space-y-5">
        {/* Welcome header */}
        <div className="rounded-2xl border bg-white px-5 py-4 shadow-sm space-y-2">
          <Skeleton className="h-6 w-52" />
          <Skeleton className="h-3 w-36" />
        </div>
        {/* Big stat cards row */}
        <StatCardsSkeleton count={4} />
        {/* Secondary stats */}
        <StatCardsSkeleton count={4} />
        {/* Two-column charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-2xl border bg-white shadow-sm p-5 space-y-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-28 w-full rounded-xl" />
          </div>
          <div className="rounded-2xl border bg-white shadow-sm p-5 space-y-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-28 w-full rounded-xl" />
          </div>
        </div>
        {/* Recent activity */}
        <TableSkeleton rows={5} cols={4} />
      </div>
    </div>
  );
}

// ── Margins/chart page skeleton ───────────────────────────────────────────────
export function ChartPageSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50/80 px-3 py-5 md:px-6">
      <div className="mx-auto max-w-screen-xl space-y-5">
        <div className="flex items-center justify-between rounded-2xl border bg-white px-5 py-4 shadow-sm">
          <div className="space-y-2"><Skeleton className="h-5 w-44" /><Skeleton className="h-3 w-56" /></div>
          <Skeleton className="h-7 w-28 rounded-full" />
        </div>
        <StatCardsSkeleton count={4} />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[0,1,2].map(i => (
            <div key={i} className="rounded-2xl border bg-white shadow-sm p-5 space-y-3">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-20 w-full rounded-xl" />
            </div>
          ))}
        </div>
        <div className="rounded-2xl border bg-white shadow-sm p-5 space-y-3">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
        <TableSkeleton rows={6} cols={7} />
      </div>
    </div>
  );
}
