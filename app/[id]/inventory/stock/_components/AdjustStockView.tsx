"use client";

import {
  useState, useCallback, useEffect, useRef, useMemo, useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import {
  Plus, Search, MapPin, Package, DollarSign,
  RotateCcw, Clock, SlidersHorizontal, MoreVertical,
  Eye, Trash2, Loader2, ChevronUp, ChevronDown,
  TrendingUp, TrendingDown, Minus,
} from "lucide-react";
import { deleteAdjustmentAction } from "./actions";
import { deleteReturnAction, updateReturnStatusAction } from "./returnactions";
import AdjustmentFormSideSheet from "./AdjustmentFormSideSheet";

// ── Types ─────────────────────────────────────────────────────────────────────

export type Adjustment = {
  id: string; productName: string; productId: string; adjustType: string;
  quantity: number; originalStock: number; newStockQty: number;
  value: number; adjustedBy: string; shop: string; shopId: string; date: string;
};

export type ReturnItem = {
  id: string; productId: string; productName: string;
  quantity: number; price: number; reason: string;
};

export type Return = {
  id: string; saleId: string | null; reason: string; status: string;
  returnedById: string; shopId: string; shopName: string; date: string;
  totalQty: number; totalValue: number; items: ReturnItem[];
};

type ProductOption = { id: string; productName: string; quantity: number; sellingPrice: number };
type SaleOption   = { id: string; label: string };
type Profile      = { role: string; shopId: string; fullName: string };

interface Props {
  shopId:     string;
  activeShop: { id: string; name: string; location: string };
  isOwner:    boolean;
  stats: {
    totalAdjustments: number; totalValue: number;
    totalReturns: number; totalReturnValue: number; pendingReturns: number;
  };
  adjustments: Adjustment[];
  returns:     Return[];
  products:    ProductOption[];
  sales:       SaleOption[];
  profile:     Profile;
}

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS = {
  pending:  { bg: "bg-amber-50",  text: "text-amber-700",  dot: "bg-amber-400",  border: "border-amber-200" },
  approved: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500", border: "border-emerald-200" },
  rejected: { bg: "bg-red-50",    text: "text-red-700",    dot: "bg-red-500",    border: "border-red-200"    },
} as const;

const ADJ_TYPE = {
  increase: { bg: "bg-emerald-50", text: "text-emerald-700", Icon: TrendingUp,   iconCls: "text-emerald-600", cardBg: "bg-emerald-100" },
  decrease: { bg: "bg-red-50",     text: "text-red-700",     Icon: TrendingDown, iconCls: "text-red-500",     cardBg: "bg-red-100"     },
  set:      { bg: "bg-blue-50",    text: "text-blue-700",    Icon: Minus,        iconCls: "text-blue-500",    cardBg: "bg-blue-100"    },
} as const;

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, accent }: {
  icon: React.ReactNode; label: string; value: string | number; accent: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 flex items-center gap-4">
      <div className={`h-11 w-11 shrink-0 rounded-xl flex items-center justify-center ${accent}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-gray-400">{label}</p>
        <p className="text-xl font-bold text-gray-900 leading-tight tabular-nums">{value}</p>
      </div>
    </div>
  );
}

// ── Portal Dropdown ───────────────────────────────────────────────────────────

type DDState = { id: string | null; top: number; left: number };

function useDropdown() {
  const [dd, setDd] = useState<DDState>({ id: null, top: 0, left: 0 });
  const menuRef     = useRef<HTMLDivElement>(null);
  const close       = useCallback(() => setDd({ id: null, top: 0, left: 0 }), []);

  useEffect(() => {
    if (!dd.id) return;
    const h = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) close(); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [dd.id, close]);

  const open = useCallback((id: string, e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (dd.id === id) { close(); return; }
    const r = e.currentTarget.getBoundingClientRect();
    const dw = 192, gap = 6, dh = 160;
    let top  = r.bottom + gap;
    let left = r.right - dw;
    if (top + dh > window.innerHeight - gap) top = r.top - dh - gap;
    if (top < gap) top = gap;
    if (left < gap) left = gap;
    if (left + dw > window.innerWidth - gap) left = window.innerWidth - dw - gap;
    setDd({ id, top, left });
  }, [dd.id, close]);

  return { dd, open, close, menuRef };
}

// ── Empty Row ─────────────────────────────────────────────────────────────────

function EmptyRow({ cols, label }: { cols: number; label: string }) {
  return (
    <tr>
      <td colSpan={cols} className="py-20 text-center">
        <Package size={40} strokeWidth={1} className="mx-auto text-gray-200 mb-3" />
        <p className="text-sm text-gray-400 font-medium">{label}</p>
      </td>
    </tr>
  );
}

// ── Sortable header ───────────────────────────────────────────────────────────

type SortDir = "asc" | "desc";

function SortTh({ label, col, sortKey, sortDir, onSort, className = "" }: {
  label: string; col: string; sortKey: string; sortDir: SortDir;
  onSort: (col: string) => void; className?: string;
}) {
  const active = sortKey === col;
  return (
    <th
      onClick={() => onSort(col)}
      className={`px-4 py-3.5 text-[0.68rem] font-bold uppercase tracking-widest text-gray-400 cursor-pointer select-none whitespace-nowrap ${className}`}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active
          ? (sortDir === "asc" ? <ChevronUp size={11} className="text-indigo-400" /> : <ChevronDown size={11} className="text-indigo-400" />)
          : <ChevronUp size={11} className="opacity-20" />}
      </span>
    </th>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function AdjustStockView({
  shopId, activeShop, isOwner, stats, adjustments, returns, products, sales, profile,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const refresh = useCallback(() => startTransition(() => router.refresh()), [router]);

  const [tab,          setTab]          = useState<"adjustments" | "returns">("adjustments");
  const [search,       setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState<"all"|"pending"|"approved"|"rejected">("all");
  const [adjSortKey,   setAdjSortKey]   = useState("date");
  const [adjSortDir,   setAdjSortDir]   = useState<SortDir>("desc");
  const [retSortKey,   setRetSortKey]   = useState("date");
  const [retSortDir,   setRetSortDir]   = useState<SortDir>("desc");

  const [showForm,   setShowForm]   = useState(false);
  const [formMode,   setFormMode]   = useState<"adjustment" | "return">("adjustment");
  const [viewAdj,    setViewAdj]    = useState<Adjustment | undefined>();
  const [viewRet,    setViewRet]    = useState<Return | undefined>();

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const { dd, open, close, menuRef } = useDropdown();

  const ddAdj = tab === "adjustments" && dd.id ? adjustments.find((a) => a.id === dd.id) : null;
  const ddRet = tab === "returns"     && dd.id ? returns.find((r) => r.id === dd.id)     : null;

  const toggleAdjSort = (col: string) => {
    if (adjSortKey === col) setAdjSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setAdjSortKey(col); setAdjSortDir("asc"); }
  };
  const toggleRetSort = (col: string) => {
    if (retSortKey === col) setRetSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setRetSortKey(col); setRetSortDir("asc"); }
  };

  const filteredAdj = useMemo(() => {
    let list = adjustments.filter((a) =>
      `${a.productName} ${a.adjustType} ${a.adjustedBy}`.toLowerCase().includes(search.toLowerCase())
    );
    list = [...list].sort((a, b) => {
      const dir = adjSortDir === "asc" ? 1 : -1;
      if (adjSortKey === "value")    return (a.value    - b.value)    * dir;
      if (adjSortKey === "quantity") return (a.quantity - b.quantity) * dir;
      if (adjSortKey === "product")  return a.productName.localeCompare(b.productName) * dir;
      return a.date.localeCompare(b.date) * dir; // default: date
    });
    return list;
  }, [adjustments, search, adjSortKey, adjSortDir]);

  const filteredRet = useMemo(() => {
    let list = returns.filter((r) => {
      const txt = `${r.id} ${r.shopName} ${r.reason} ${r.items.map((i) => i.productName).join(" ")}`.toLowerCase();
      return txt.includes(search.toLowerCase()) && (statusFilter === "all" || r.status === statusFilter);
    });
    list = [...list].sort((a, b) => {
      const dir = retSortDir === "asc" ? 1 : -1;
      if (retSortKey === "qty")   return (a.totalQty   - b.totalQty)   * dir;
      if (retSortKey === "value") return (a.totalValue - b.totalValue) * dir;
      return a.date.localeCompare(b.date) * dir;
    });
    return list;
  }, [returns, search, statusFilter, retSortKey, retSortDir]);

  const openAdd = () => {
    setFormMode(tab === "returns" ? "return" : "adjustment");
    setViewAdj(undefined); setViewRet(undefined);
    setShowForm(true);
  };

  const openViewAdj = (a: Adjustment) => { setFormMode("adjustment"); setViewAdj(a); setViewRet(undefined); setShowForm(true); close(); };
  const openViewRet = (r: Return)     => { setFormMode("return");     setViewRet(r); setViewAdj(undefined); setShowForm(true); close(); };

  const handleDeleteAdj = async (id: string) => {
    close();
    if (!confirm("Delete this adjustment?")) return;
    setDeletingId(id);
    const res = await deleteAdjustmentAction(id, shopId);
    setDeletingId(null);
    if (res.success) refresh(); else alert(res.error ?? "Delete failed");
  };

  const handleDeleteRet = async (id: string) => {
    close();
    if (!confirm("Delete this return? Stock will be reversed.")) return;
    setDeletingId(id);
    const res = await deleteReturnAction(id);
    setDeletingId(null);
    if (res.success) refresh(); else alert(res.error ?? "Delete failed");
  };

  const handleStatusChange = async (id: string, status: string) => {
    close();
    setUpdatingId(id);
    const res = await updateReturnStatusAction(id, status);
    setUpdatingId(null);
    if (res.success) refresh(); else alert(res.error ?? "Update failed");
  };

  const fmt = (n: number) => n.toLocaleString();

  return (
    <>
      <div className="min-h-screen bg-slate-50/70 px-3 py-5 md:px-6 space-y-5">

        {/* ── Shop Banner ─────────────────────────────────────────────────── */}
        <div className="flex items-center gap-4 rounded-2xl bg-linear-to-r from-violet-600 to-indigo-600 px-5 py-4 shadow-lg shadow-violet-200/40">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20">
            <SlidersHorizontal size={18} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[0.6rem] font-semibold uppercase tracking-widest text-violet-200">Adjust Stock</p>
            <p className="font-bold text-white truncate">{activeShop.name}</p>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs text-violet-100 shrink-0">
            <MapPin size={11} />{activeShop.location}
          </div>
          {!isOwner && (
            <span className="rounded-full bg-amber-400/20 border border-amber-300/30 px-3 py-1 text-xs font-bold text-amber-200 shrink-0">
              Staff
            </span>
          )}
        </div>

        {/* ── Stats ───────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard icon={<SlidersHorizontal size={18} className="text-indigo-600" />} label="Adjustments"    value={fmt(stats.totalAdjustments)} accent="bg-indigo-50" />
          <StatCard icon={<DollarSign size={18} className="text-emerald-600" />}       label="Adj. Value"     value={fmt(stats.totalValue)} accent="bg-emerald-50" />
          <StatCard icon={<RotateCcw size={18} className="text-violet-600" />}         label="Returns"        value={fmt(stats.totalReturns)} accent="bg-violet-50" />
          <StatCard icon={<Package size={18} className="text-blue-600" />}             label="Return Value"   value={fmt(stats.totalReturnValue)} accent="bg-blue-50" />
          <StatCard icon={<Clock size={18} className="text-amber-500" />}              label="Pending Returns" value={stats.pendingReturns} accent="bg-amber-50" />
        </div>

        {/* ── Tabs ────────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-1 rounded-xl bg-gray-100/80 p-1 w-fit">
          {([
            { key: "adjustments" as const, icon: <SlidersHorizontal size={14} />, label: "Adjustments", count: adjustments.length },
            { key: "returns"     as const, icon: <RotateCcw size={14} />,          label: "Returns",     count: returns.length, badge: stats.pendingReturns > 0 ? stats.pendingReturns : 0 },
          ]).map(({ key, icon, label, count, badge }) => (
            <button
              key={key}
              onClick={() => { setTab(key); setSearch(""); close(); }}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-all ${
                tab === key ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {icon} {label}
              <span className={`rounded-full px-2 py-0.5 text-[0.6rem] font-bold ${tab === key ? "bg-indigo-100 text-indigo-600" : "bg-gray-200 text-gray-500"}`}>
                {count}
              </span>
              {!!badge && (
                <span className="rounded-full bg-amber-500 text-white px-1.5 py-0.5 text-[0.6rem] font-bold">
                  {badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Toolbar ─────────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            {tab === "returns" && (
              (["all","pending","approved","rejected"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold capitalize transition-all ${
                    statusFilter === s
                      ? s === "rejected" ? "bg-red-600 text-white border-red-600"
                        : s === "approved" ? "bg-emerald-600 text-white border-emerald-600"
                        : s === "pending"  ? "bg-amber-500 text-white border-amber-500"
                        : "bg-indigo-600 text-white border-indigo-600"
                      : "bg-white text-gray-600 border-gray-200 hover:border-indigo-300"
                  }`}
                >
                  {s === "all" ? `All (${returns.length})` : s}
                </button>
              ))
            )}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={13} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={tab === "adjustments" ? "Search adjustments…" : "Search returns…"}
                className="w-52 rounded-xl border border-gray-200 bg-white pl-9 pr-3 py-2 text-xs shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition"
              />
            </div>
          </div>

          <button
            onClick={openAdd}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 shadow-sm transition shrink-0"
          >
            <Plus size={14} />
            {tab === "adjustments" ? "Add Adjustment" : "New Return"}
          </button>
        </div>

        {/* ══ ADJUSTMENTS TABLE ═══════════════════════════════════════════ */}
        {tab === "adjustments" && (
          <div className={`rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden transition-opacity duration-200 ${isPending ? "opacity-60 pointer-events-none" : ""}`}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-gray-200">
                    <th className="sticky left-0 bg-slate-50 z-10 px-4 py-3.5 text-left text-[0.68rem] font-bold uppercase tracking-widest text-gray-400">
                      Product
                    </th>
                    <th className="px-4 py-3.5 text-[0.68rem] font-bold uppercase tracking-widest text-gray-400 text-left">Type</th>
                    <SortTh label="Qty"   col="quantity" sortKey={adjSortKey} sortDir={adjSortDir} onSort={toggleAdjSort} className="text-right" />
                    <th className="px-4 py-3.5 text-[0.68rem] font-bold uppercase tracking-widest text-gray-400 text-right">Old → New</th>
                    <SortTh label="Value" col="value"    sortKey={adjSortKey} sortDir={adjSortDir} onSort={toggleAdjSort} className="text-right" />
                    <th className="px-4 py-3.5 text-[0.68rem] font-bold uppercase tracking-widest text-gray-400 text-left">By</th>
                    <SortTh label="Date" col="date" sortKey={adjSortKey} sortDir={adjSortDir} onSort={toggleAdjSort} className="text-left" />
                    {isOwner && <th className="px-4 py-3.5 text-center text-[0.68rem] font-bold uppercase tracking-widest text-gray-400">Act.</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredAdj.map((a, i) => {
                    const cfg = ADJ_TYPE[a.adjustType as keyof typeof ADJ_TYPE] ?? ADJ_TYPE.set;
                    const { Icon } = cfg;
                    return (
                      <tr
                        key={a.id}
                        onClick={() => openViewAdj(a)}
                        className="cursor-pointer hover:bg-slate-50/70 transition-colors"
                        style={{ animationDelay: `${i * 0.02}s` }}
                      >
                        {/* Sticky product cell */}
                        <td
                          className="sticky left-0 bg-white z-[5] px-4 py-3 hover:bg-slate-50/70"
                          onClick={(e) => e.stopPropagation()}
                          onMouseEnter={(e) => { const td = e.currentTarget; td.style.backgroundColor = "#f8fafc"; }}
                          onMouseLeave={(e) => { const td = e.currentTarget; td.style.backgroundColor = "#ffffff"; }}
                        >
                          <div className="flex items-center gap-3 min-w-[160px]">
                            <div className={`h-9 w-9 shrink-0 rounded-xl flex items-center justify-center ${cfg.cardBg}`}>
                              <Icon size={15} className={cfg.iconCls} />
                            </div>
                            <p className="font-semibold text-gray-800 text-xs truncate max-w-[130px]">{a.productName}</p>
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[0.7rem] font-semibold capitalize ${cfg.bg} ${cfg.text}`}>
                            {a.adjustType}
                          </span>
                        </td>

                        <td className="px-4 py-3 text-right font-bold text-gray-900 tabular-nums">{a.quantity}</td>

                        <td className="px-4 py-3 text-right text-xs">
                          <span className="text-gray-400 tabular-nums">{a.originalStock}</span>
                          <span className="mx-1 text-gray-300">→</span>
                          <span className="font-bold text-gray-800 tabular-nums">{a.newStockQty}</span>
                        </td>

                        <td className="px-4 py-3 text-right font-semibold text-gray-700 tabular-nums text-xs">
                          {fmt(a.value)}
                        </td>

                        <td className="px-4 py-3">
                          <span className="text-xs text-gray-500 truncate max-w-[100px] block">{a.adjustedBy || "—"}</span>
                        </td>

                        <td className="px-4 py-3">
                          <span className="text-xs text-gray-400 whitespace-nowrap">{a.date}</span>
                        </td>

                        {isOwner && (
                          <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={(e) => open(a.id, e)}
                              className={`rounded-lg p-1.5 transition-colors ${dd.id === a.id ? "bg-gray-200 text-gray-700" : "text-gray-400 hover:bg-gray-100 hover:text-gray-700"}`}
                            >
                              <MoreVertical size={15} />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                  {filteredAdj.length === 0 && (
                    <EmptyRow cols={isOwner ? 8 : 7} label={search ? "No adjustments match your search" : "No adjustments yet"} />
                  )}
                </tbody>
              </table>
            </div>
            <div className="border-t border-gray-100 px-4 py-2.5 text-xs text-gray-400">
              {filteredAdj.length} of {adjustments.length} adjustments
            </div>
          </div>
        )}

        {/* ══ RETURNS TABLE ═══════════════════════════════════════════════ */}
        {tab === "returns" && (
          <div className={`rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden transition-opacity duration-200 ${isPending ? "opacity-60 pointer-events-none" : ""}`}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-gray-200">
                    <th className="sticky left-0 bg-slate-50 z-10 px-4 py-3.5 text-left text-[0.68rem] font-bold uppercase tracking-widest text-gray-400">
                      Products
                    </th>
                    <th className="px-4 py-3.5 text-left text-[0.68rem] font-bold uppercase tracking-widest text-gray-400">Return ID</th>
                    <SortTh label="Qty"   col="qty"   sortKey={retSortKey} sortDir={retSortDir} onSort={toggleRetSort} className="text-right" />
                    <SortTh label="Value" col="value" sortKey={retSortKey} sortDir={retSortDir} onSort={toggleRetSort} className="text-right" />
                    <th className="px-4 py-3.5 text-left text-[0.68rem] font-bold uppercase tracking-widest text-gray-400">Reason</th>
                    <th className="px-4 py-3.5 text-left text-[0.68rem] font-bold uppercase tracking-widest text-gray-400">Status</th>
                    <SortTh label="Date" col="date" sortKey={retSortKey} sortDir={retSortDir} onSort={toggleRetSort} className="text-left" />
                    {isOwner && <th className="px-4 py-3.5 text-center text-[0.68rem] font-bold uppercase tracking-widest text-gray-400">Act.</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredRet.map((r, i) => {
                    const st          = STATUS[r.status as keyof typeof STATUS] ?? STATUS.pending;
                    const firstName   = r.items[0]?.productName ?? "—";
                    const extra       = r.items.length - 1;
                    return (
                      <tr
                        key={r.id}
                        onClick={() => openViewRet(r)}
                        className="cursor-pointer hover:bg-slate-50/70 transition-colors"
                        style={{ animationDelay: `${i * 0.02}s` }}
                      >
                        {/* Sticky */}
                        <td className="sticky left-0 bg-white z-[5] px-4 py-3"
                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#f8fafc"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#ffffff"; }}
                        >
                          <div className="flex items-center gap-3 min-w-[160px]">
                            <div className="h-9 w-9 shrink-0 rounded-xl bg-violet-100 flex items-center justify-center">
                              <RotateCcw size={14} className="text-violet-500" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-gray-800 text-xs truncate max-w-[130px]">{firstName}</p>
                              {extra > 0 && <p className="text-[0.62rem] text-indigo-500 font-semibold">+{extra} more</p>}
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <span className="font-mono text-[0.68rem] bg-gray-50 text-gray-400 border border-gray-100 rounded-md px-2 py-0.5">
                            {r.id.slice(0, 8).toUpperCase()}
                          </span>
                        </td>

                        <td className="px-4 py-3 text-right font-bold text-gray-900 tabular-nums">{r.totalQty}</td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-700 tabular-nums text-xs">{fmt(r.totalValue)}</td>

                        <td className="px-4 py-3">
                          <span className="text-xs text-gray-500 truncate max-w-[120px] block">{r.reason || "—"}</span>
                        </td>

                        <td className="px-4 py-3">
                          {updatingId === r.id ? (
                            <Loader2 size={14} className="animate-spin text-gray-400" />
                          ) : (
                            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.68rem] font-bold capitalize ${st.bg} ${st.text} ${st.border}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                              {r.status}
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3">
                          <span className="text-xs text-gray-400 whitespace-nowrap">{r.date}</span>
                        </td>

                        {isOwner && (
                          <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={(e) => open(r.id, e)}
                              className={`rounded-lg p-1.5 transition-colors ${dd.id === r.id ? "bg-gray-200 text-gray-700" : "text-gray-400 hover:bg-gray-100 hover:text-gray-700"}`}
                            >
                              <MoreVertical size={15} />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                  {filteredRet.length === 0 && (
                    <EmptyRow cols={isOwner ? 8 : 7} label={search ? "No returns match your search" : "No returns recorded"} />
                  )}
                </tbody>
              </table>
            </div>
            <div className="border-t border-gray-100 px-4 py-2.5 text-xs text-gray-400">
              {filteredRet.length} of {returns.length} returns
            </div>
          </div>
        )}
      </div>

      {/* ── Form Sheet ────────────────────────────────────────────────────── */}
      {showForm && (
        <AdjustmentFormSideSheet
          shopId={shopId}
          mode={formMode}
          viewAdj={viewAdj}
          viewRet={viewRet}
          products={products}
          sales={sales}
          profile={profile}
          onSuccess={() => { setShowForm(false); setViewAdj(undefined); setViewRet(undefined); refresh(); }}
          onClose={() => { setShowForm(false); setViewAdj(undefined); setViewRet(undefined); }}
        />
      )}

      {/* ── Adjustment Dropdown ───────────────────────────────────────────── */}
      {tab === "adjustments" && dd.id && ddAdj && typeof document !== "undefined" && createPortal(
        <div
          ref={menuRef}
          className="fixed z-[9999] w-48 bg-white rounded-2xl shadow-2xl border border-gray-100 py-1.5 overflow-hidden"
          style={{ top: dd.top, left: dd.left }}
        >
          <div className="px-3 py-1.5 border-b border-gray-50 mb-1">
            <p className="text-[0.63rem] font-bold uppercase tracking-widest text-gray-400">Adjustment</p>
            <p className="text-xs font-semibold text-gray-700 truncate">{ddAdj.productName}</p>
          </div>
          <button onClick={() => openViewAdj(ddAdj)}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition">
            <Eye size={13} className="text-gray-400" /> View details
          </button>
          <div className="my-1 border-t border-gray-100" />
          <button onClick={() => handleDeleteAdj(ddAdj.id)}
            disabled={deletingId === ddAdj.id}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-xs font-medium text-red-600 hover:bg-red-50 transition disabled:opacity-50">
            {deletingId === ddAdj.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
            Delete
          </button>
        </div>,
        document.body
      )}

      {/* ── Return Dropdown ───────────────────────────────────────────────── */}
      {tab === "returns" && dd.id && ddRet && typeof document !== "undefined" && createPortal(
        <div
          ref={menuRef}
          className="fixed z-[9999] w-52 bg-white rounded-2xl shadow-2xl border border-gray-100 py-1.5 overflow-hidden"
          style={{ top: dd.top, left: dd.left }}
        >
          <div className="px-3 py-1.5 border-b border-gray-50 mb-1">
            <p className="text-[0.63rem] font-bold uppercase tracking-widest text-gray-400">Return</p>
            <p className="text-xs font-semibold text-gray-700">{ddRet.id.slice(0, 8).toUpperCase()}</p>
          </div>
          <button onClick={() => openViewRet(ddRet)}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition">
            <Eye size={13} className="text-gray-400" /> View details
          </button>
          <div className="my-1 border-t border-gray-100" />
          <p className="px-4 py-1.5 text-[0.63rem] font-bold uppercase tracking-widest text-gray-400">Set Status</p>
          {(["pending","approved","rejected"] as const).map((s) => {
            const cfg = STATUS[s];
            return (
              <button key={s} onClick={() => handleStatusChange(ddRet.id, s)}
                disabled={updatingId === ddRet.id || ddRet.status === s}
                className={`flex w-full items-center gap-2.5 px-4 py-2 text-xs font-medium capitalize transition disabled:opacity-40 ${cfg.text} hover:${cfg.bg}`}>
                <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                {s}
                {ddRet.status === s && <span className="ml-auto text-[0.6rem] text-gray-400">current</span>}
              </button>
            );
          })}
          <div className="my-1 border-t border-gray-100" />
          <button onClick={() => handleDeleteRet(ddRet.id)}
            disabled={deletingId === ddRet.id}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-xs font-medium text-red-600 hover:bg-red-50 transition disabled:opacity-50">
            {deletingId === ddRet.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
            Delete return
          </button>
        </div>,
        document.body
      )}
    </>
  );
}
