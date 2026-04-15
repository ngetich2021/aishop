"use client";

import {
  useState, useCallback, useRef, useEffect,
  useTransition, useActionState,
} from "react";
import {
  Search, Loader2, MoreVertical, Receipt, Plus, X,
  Pencil, Trash2, TrendingDown, Wallet, Eye, ArrowLeft,
  Package,
} from "lucide-react";
import { useRouter }      from "next/navigation";
import { createPortal }   from "react-dom";
import { saveExpenseAction, deleteExpenseAction } from "./actions";

// ── Types ─────────────────────────────────────────────────────────────────────
type Expense = {
  id: string; description: string; amount: number;
  category: string | null; paidById: string; paidByName: string;
  shop: string; shopId: string; date: string; time: string;
};
type ActiveShop = { id: string; name: string; location: string };
type StatPair   = { count: number; amount: number };
type Props = {
  activeShop:      ActiveShop;
  isAdmin:         boolean;
  isManager:       boolean;
  walletBalance:   number;
  currentUserName: string;
  expenses:        Expense[];
  stats: { today: StatPair; week: StatPair; month: StatPair; year: StatPair; total: StatPair };
};
type ActionResult = { success: boolean; error?: string };

const CATEGORIES = [
  "Operations","Utilities","Supplies","Transport","Marketing",
  "Maintenance","Rent","Staff Welfare","Food & Drinks","Others",
];

// ── Portal dropdown helper ────────────────────────────────────────────────────
type DDState = { id: string | null; top: number; left: number };
function usePortalDD() {
  const [dd, setDd] = useState<DDState>({ id: null, top: 0, left: 0 });
  const menuRef = useRef<HTMLDivElement | null>(null);
  const close   = useCallback(() => setDd({ id: null, top: 0, left: 0 }), []);
  useEffect(() => {
    if (!dd.id) return;
    const h = (e: MouseEvent) => { if (menuRef.current?.contains(e.target as Node)) return; close(); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [dd.id, close]);
  const open = useCallback((id: string, e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (dd.id === id) { close(); return; }
    const r = e.currentTarget.getBoundingClientRect();
    const dw = 168, gap = 6, dh = 140;
    let top = r.bottom + gap, left = r.right - dw;
    if (top + dh > window.innerHeight - gap) top = r.top - dh - gap;
    if (left < gap) left = gap;
    if (left + dw > window.innerWidth - gap) left = window.innerWidth - dw - gap;
    setDd({ id, top, left });
  }, [dd.id, close]);
  return { dd, open, close, menuRef };
}

// ── Side-sheet form ───────────────────────────────────────────────────────────
function ExpenseSideSheet({
  mode, expense, shopId, walletBalance, currentUserName, onClose, onDone,
}: {
  mode:            "add" | "edit" | "view";
  expense?:        Expense | null;
  shopId:          string;
  walletBalance:   number;
  currentUserName: string;
  onClose:         () => void;
  onDone:          () => void;
}) {
  const isView = mode === "view";
  const isEdit = mode === "edit";

  const [catSel,  setCatSel]  = useState(expense?.category ?? "");
  const [custCat, setCustCat] = useState("");
  const effectiveCat = catSel === "Others" ? custCat : catSel;

  const [state, action, pending] = useActionState<ActionResult, FormData>(
    async (prev, fd) => {
      fd.set("shopId",   shopId);
      fd.set("category", effectiveCat);
      return saveExpenseAction(prev, fd);
    },
    { success: false },
  );

  useEffect(() => { if (state?.success) onDone(); }, [state?.success]); // eslint-disable-line

  const fieldCls = isView
    ? "w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm bg-gray-50 cursor-not-allowed"
    : "w-full border border-gray-300 rounded-2xl px-4 py-3 text-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-50";

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex justify-end">
      <div className="w-full max-w-md h-full bg-white shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 border-b px-5 py-4 shrink-0">
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 transition">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              {isView ? <Eye size={17} className="text-gray-500" /> : <TrendingDown size={17} className="text-rose-600" />}
              {isView ? "View Expense" : isEdit ? "Edit Expense" : "Add Expense"}
            </h2>
            {expense && <p className="text-xs text-gray-400">{expense.date} · {expense.time}</p>}
          </div>
        </div>

        <form action={action} className="flex-1 overflow-y-auto p-5 space-y-5">
          {expense?.id && <input type="hidden" name="expenseId" value={expense.id} />}

          {/* Wallet balance */}
          {!isView && (
            <div className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${walletBalance > 0 ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
              <Wallet size={17} className={walletBalance > 0 ? "text-emerald-600" : "text-red-500"} />
              <div>
                <p className={`text-sm font-bold ${walletBalance > 0 ? "text-emerald-700" : "text-red-600"}`}>
                  Wallet: KSh {walletBalance.toLocaleString()}
                </p>
                {walletBalance <= 0 && <p className="text-xs text-red-500">No funds — top up wallet first.</p>}
              </div>
            </div>
          )}

          {state?.error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-2xl text-sm font-medium">
              {state.error}
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block mb-1.5 text-xs font-semibold text-gray-700 uppercase tracking-wide">Description *</label>
            <input name="description" defaultValue={expense?.description ?? ""} readOnly={isView}
              placeholder="e.g. Lunch for the team, Office supplies"
              className={fieldCls} />
          </div>

          {/* Amount */}
          <div>
            <label className="block mb-1.5 text-xs font-semibold text-gray-700 uppercase tracking-wide">Amount (KSh) *</label>
            <input name="amount" type="number" min="1" defaultValue={expense?.amount ?? ""} readOnly={isView}
              placeholder="0" className={fieldCls} />
            {!isView && (
              <p className="text-[0.7rem] text-gray-400 mt-1">
                Max: KSh {walletBalance.toLocaleString()}
              </p>
            )}
          </div>

          {/* Category */}
          <div>
            <label className="block mb-1.5 text-xs font-semibold text-gray-700 uppercase tracking-wide">Category</label>
            {isView ? (
              <input readOnly value={expense?.category ?? "—"} className={fieldCls} />
            ) : (
              <>
                <select value={catSel} onChange={e => { setCatSel(e.target.value); setCustCat(""); }}
                  className={fieldCls}>
                  <option value="">— None —</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                {catSel === "Others" && (
                  <input value={custCat} onChange={e => setCustCat(e.target.value)}
                    placeholder="Custom category…" className={`${fieldCls} mt-2`} />
                )}
              </>
            )}
          </div>

          {/* Paid by */}
          <div>
            <label className="block mb-1.5 text-xs font-semibold text-gray-700 uppercase tracking-wide">Paid By</label>
            <input readOnly value={isView ? (expense?.paidByName ?? "—") : currentUserName}
              className="w-full border border-blue-200 rounded-2xl px-4 py-3 text-sm bg-blue-50 text-blue-700 font-medium cursor-not-allowed" />
            {!isView && <p className="text-[0.7rem] text-gray-400 mt-1">Recorded as you (signed-in user)</p>}
          </div>

          {!isView && (
            <button type="submit" disabled={pending || walletBalance <= 0}
              className="w-full bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 text-white py-3.5 text-sm font-bold rounded-2xl flex items-center justify-center gap-2 transition-colors mt-4">
              {pending ? <Loader2 size={18} className="animate-spin" /> : <TrendingDown size={18} />}
              {isEdit ? "Update Expense" : "Record Expense"}
            </button>
          )}
        </form>
      </div>
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────
export default function ExpensesView({
  activeShop, isAdmin, isManager, walletBalance, currentUserName, expenses, stats,
}: Props) {
  const router  = useRouter();
  const [search,     setSearch]     = useState("");
  const [filterCat,  setFilterCat]  = useState("all");
  const [sheet,      setSheet]      = useState<{ mode: "add"|"edit"|"view"; expense?: Expense } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [mounted,    setMounted]    = useState(false);
  const [, startT]                  = useTransition();
  const { dd, open, close, menuRef } = usePortalDD();

  useEffect(() => setMounted(true), []);

  const handleDelete = (e: Expense) => {
    close();
    if (!confirm(`Delete "${e.description}" (KSh ${e.amount.toLocaleString()})?\nThis will refund the amount back to the wallet.`)) return;
    setDeletingId(e.id);
    startT(async () => {
      const res = await deleteExpenseAction(e.id, e.shopId);
      setDeletingId(null);
      if (res.success) router.refresh(); else alert(res.error ?? "Delete failed");
    });
  };

  const allCategories = Array.from(new Set(expenses.map(e => e.category).filter(Boolean))) as string[];
  const filtered = expenses.filter(e => {
    const q = search.toLowerCase();
    const matchSearch = `${e.description} ${e.category ?? ""} ${e.paidByName}`.toLowerCase().includes(q);
    const matchCat    = filterCat === "all" || e.category === filterCat;
    return matchSearch && matchCat;
  });

  const ddExpense = dd.id ? expenses.find(e => e.id === dd.id) : null;

  return (
    <>
      <style>{`
        @keyframes rowIn{from{opacity:0;transform:translateX(-4px)}to{opacity:1;transform:translateX(0)}}
        .exp-row{animation:rowIn 0.15s ease both}
        @keyframes ddIn{from{opacity:0;transform:scale(0.95) translateY(-4px)}to{opacity:1;transform:scale(1)translateY(0)}}
        .dd-menu{animation:ddIn 0.1s ease both;transform-origin:top right}
      `}</style>

      <div className="min-h-screen bg-slate-50/80 px-3 py-5 md:px-6">
        <div className="mx-auto max-w-screen-xl space-y-5">

          {/* ── Wallet banner ─────────────────────────────────────────────── */}
          <div className={`flex items-center gap-4 rounded-xl border px-5 py-3.5 shadow-sm ${walletBalance > 0 ? "bg-gradient-to-r from-emerald-50 to-white border-emerald-100" : "bg-gradient-to-r from-red-50 to-white border-red-100"}`}>
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg shadow ${walletBalance > 0 ? "bg-emerald-600" : "bg-red-500"}`}>
              <Wallet size={18} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-[0.63rem] font-bold uppercase tracking-widest ${walletBalance > 0 ? "text-emerald-500" : "text-red-400"}`}>
                Wallet Balance — {activeShop.name}
              </p>
              <p className={`font-black text-xl ${walletBalance > 0 ? "text-emerald-900" : "text-red-700"}`}>
                KSh {walletBalance.toLocaleString()}
              </p>
            </div>
            {walletBalance <= 0 && (
              <span className="shrink-0 rounded-full bg-red-100 border border-red-200 px-3 py-1 text-xs font-semibold text-red-700">
                No funds — top up wallet
              </span>
            )}
          </div>

          {/* ── Header ───────────────────────────────────────────────────── */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
                <TrendingDown size={24} className="text-rose-600" /> Expenses
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">
                {activeShop.name}
                {activeShop.location && <span className="text-gray-400"> · {activeShop.location}</span>}
              </p>
            </div>
            {isManager && (
              <button onClick={() => setSheet({ mode: "add" })}
                className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-4 py-2.5 rounded-xl font-semibold text-sm shadow-sm transition-colors">
                <Plus size={17} /> Add Expense
              </button>
            )}
          </div>

          {/* ── Stats ────────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {[
              { label: "Today",      ...stats.today },
              { label: "This Week",  ...stats.week  },
              { label: "This Month", ...stats.month },
              { label: "This Year",  ...stats.year  },
              { label: "All Time",   ...stats.total },
            ].map(s => (
              <div key={s.label} className="relative overflow-hidden rounded-xl border border-gray-100 bg-white px-4 pt-4 pb-3 shadow-sm">
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-rose-500" />
                <p className="text-[0.63rem] font-bold uppercase tracking-widest text-gray-400">{s.label}</p>
                <p className="mt-1 text-xl font-black tabular-nums text-gray-900">{s.count}</p>
                <p className="text-xs text-rose-600 font-semibold">KSh {s.amount.toLocaleString()}</p>
              </div>
            ))}
          </div>

          {/* ── Toolbar ──────────────────────────────────────────────────── */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search expenses…"
                className="w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 py-2 text-xs outline-none focus:border-rose-400 shadow-sm" />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <X size={13} />
                </button>
              )}
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button onClick={() => setFilterCat("all")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${filterCat === "all" ? "bg-rose-600 text-white border-rose-600" : "bg-white text-gray-600 border-gray-300 hover:border-rose-400"}`}>
                All
              </button>
              {allCategories.map(c => (
                <button key={c} onClick={() => setFilterCat(c === filterCat ? "all" : c)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${filterCat === c ? "bg-rose-600 text-white border-rose-600" : "bg-white text-gray-600 border-gray-300 hover:border-rose-400"}`}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* ── Table ────────────────────────────────────────────────────── */}
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-gray-200">
                    {["#","Description","Category","Amount","Paid By","Date",""].map(h => (
                      <th key={h} className="px-4 py-3.5 text-left text-xs font-bold uppercase tracking-widest text-gray-400 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((e, i) => (
                    <tr key={e.id}
                      onClick={() => setSheet({ mode: "view", expense: e })}
                      className="exp-row cursor-pointer bg-white hover:bg-slate-50 transition-colors"
                      style={{ animationDelay: `${i * 0.02}s` }}>
                      <td className="px-4 py-3 text-xs text-gray-400 font-bold w-8">{i + 1}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-rose-100 flex items-center justify-center shrink-0">
                            <Package size={12} className="text-rose-600" />
                          </div>
                          <p className="font-semibold text-gray-800 truncate max-w-[180px] text-[0.82rem]">{e.description}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {e.category
                          ? <span className="inline-block bg-orange-50 text-orange-700 border border-orange-200 rounded-full px-2.5 py-0.5 text-xs font-semibold">{e.category}</span>
                          : <span className="text-gray-300 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="tabular-nums font-black text-rose-600 text-[0.85rem]">
                          KSh {e.amount.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{e.paidByName}</td>
                      <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{e.date}</td>
                      <td className="px-4 py-3 text-center" onClick={ev => ev.stopPropagation()}>
                        {isManager && (
                          <button onClick={ev => open(e.id, ev)}
                            className={`rounded-lg p-1.5 transition-colors ${dd.id === e.id ? "bg-gray-200 text-gray-700" : "hover:bg-gray-100 text-gray-400"}`}>
                            <MoreVertical size={15} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={7} className="py-24 text-center">
                      <div className="flex flex-col items-center gap-3 text-gray-300">
                        <Receipt size={38} strokeWidth={1} />
                        <p className="text-sm font-semibold text-gray-400">
                          {expenses.length === 0 ? "No expenses recorded yet" : "No expenses match your search"}
                        </p>
                      </div>
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>

      {/* ── Portal dropdown ───────────────────────────────────────────────── */}
      {mounted && dd.id && ddExpense && createPortal(
        <div ref={menuRef} className="dd-menu fixed z-[99999] w-44 bg-white rounded-2xl shadow-2xl border border-gray-100 py-1.5"
          style={{ top: dd.top, left: dd.left }}>
          <div className="px-3 py-2 border-b border-gray-50 mb-1">
            <p className="text-[0.63rem] font-bold uppercase tracking-widest text-gray-400">Expense</p>
            <p className="text-xs font-semibold text-gray-700 truncate">{ddExpense.description}</p>
          </div>
          <button onClick={() => { close(); setSheet({ mode: "view", expense: ddExpense }); }}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><Eye size={12} /></span> View
          </button>
          {isManager && (
            <button onClick={() => { close(); setSheet({ mode: "edit", expense: ddExpense }); }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-violet-50 hover:text-violet-700 transition-colors">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-violet-50 text-violet-600"><Pencil size={12} /></span> Edit
            </button>
          )}
          {isAdmin && (
            <>
              <div className="my-1 border-t border-gray-100" />
              <button onClick={() => handleDelete(ddExpense)} disabled={deletingId === ddExpense.id}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-red-50 text-red-500">
                  {deletingId === ddExpense.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                </span> Delete
              </button>
            </>
          )}
        </div>,
        document.body,
      )}

      {/* ── Side sheet ───────────────────────────────────────────────────── */}
      {sheet && (
        <ExpenseSideSheet
          key={sheet.mode + (sheet.expense?.id ?? "new")}
          mode={sheet.mode}
          expense={sheet.expense}
          shopId={activeShop.id}
          walletBalance={walletBalance}
          currentUserName={currentUserName}
          onClose={() => setSheet(null)}
          onDone={() => { setSheet(null); router.refresh(); }}
        />
      )}
    </>
  );
}
