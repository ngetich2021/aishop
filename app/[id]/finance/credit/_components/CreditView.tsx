"use client";

import { useState, useCallback, useRef, useEffect, useTransition } from "react";
import { Search, Loader2, MoreVertical, HandCoins, Plus, X, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { addCreditPaymentAction, deleteCreditAction } from "./actions";

type CreditPayment = { id: string; amount: number; method: string; note: string | null; paidAt: string };
type Credit = {
  id: string; customerName: string | null; customerPhone: string | null;
  amount: number; downPayment: number; dueDate: string | null; status: string;
  totalPaid: number; outstanding: number; date: string;
  payments: CreditPayment[];
};
type ActiveShop = { id: string; name: string; location: string };
type Props = {
  activeShop: ActiveShop; isAdmin: boolean; isManager: boolean;
  credits: Credit[];
  stats: { total: number; totalAmount: number; outstanding: number; paidCount: number };
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  partial: "bg-blue-50 text-blue-700 border-blue-200",
  paid:    "bg-emerald-50 text-emerald-700 border-emerald-200",
};

type DDState = { id: string | null; top: number; left: number };
function usePortalDD() {
  const [dd, setDd] = useState<DDState>({ id: null, top: 0, left: 0 });
  const menuRef = useRef<HTMLDivElement | null>(null);
  const close = useCallback(() => setDd({ id: null, top: 0, left: 0 }), []);
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
    const dw = 180, gap = 6, dh = 120;
    let top = r.bottom + gap, left = r.right - dw;
    if (top + dh > window.innerHeight - gap) top = r.top - dh - gap;
    if (left < gap) left = gap;
    if (left + dw > window.innerWidth - gap) left = window.innerWidth - dw - gap;
    setDd({ id, top, left });
  }, [dd.id, close]);
  return { dd, open, close, menuRef };
}

const METHODS = ["cash", "mpesa", "card", "bank", "cheque"];

function PaymentModal({ credit, shopId, onClose }: { credit: Credit; shopId: string; onClose: () => void }) {
  const router = useRouter();
  const [amount, setAmount] = useState(credit.outstanding.toString());
  const [method, setMethod] = useState("cash");
  const [note, setNote]     = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { setError("Enter a valid amount"); return; }
    setLoading(true); setError("");
    const res = await addCreditPaymentAction(credit.id, shopId, { amount: amt, method, note: note || undefined });
    setLoading(false);
    if (res.success) { router.refresh(); onClose(); }
    else setError(res.error ?? "Failed");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm border border-gray-100">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-sm font-black text-gray-900">Record Payment</h2>
            <p className="text-xs text-gray-400">{credit.customerName ?? "Unknown"} · Outstanding: KSh {credit.outstanding.toLocaleString()}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition"><X size={15} /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Amount (KSh)</label>
            <input type="number" min="1" step="0.01" value={amount} onChange={e => setAmount(e.target.value)}
              required className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-blue-400 outline-none" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Method</label>
            <select value={method} onChange={e => setMethod(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-blue-400 outline-none bg-white">
              {METHODS.map(m => <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Note <span className="text-gray-400 font-normal">(optional)</span></label>
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. M-Pesa ref XYZ"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-blue-400 outline-none" />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-200 rounded-xl py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition">Cancel</button>
            <button type="submit" disabled={loading}
              className="flex-1 bg-blue-600 text-white rounded-xl py-2 text-xs font-semibold hover:bg-blue-700 transition disabled:opacity-60 flex items-center justify-center gap-1">
              {loading && <Loader2 size={11} className="animate-spin" />} Save Payment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function CreditView({ activeShop, isAdmin, isManager, credits, stats }: Props) {
  const router = useRouter();
  const [search, setSearch]         = useState("");
  const [filterStatus, setStatus]   = useState("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [mounted, setMounted]       = useState(false);
  const [payCredit, setPayCredit]   = useState<Credit | null>(null);
  const [expanded, setExpanded]     = useState<Record<string, boolean>>({});
  const [, startTransition]         = useTransition();
  const { dd, open, close, menuRef } = usePortalDD();

  useEffect(() => setMounted(true), []);

  const handleDelete = (id: string) => {
    close();
    if (!confirm("Delete this credit record and all its payments?")) return;
    setDeletingId(id);
    startTransition(async () => {
      const res = await deleteCreditAction(id);
      setDeletingId(null);
      if (res.success) router.refresh(); else alert(res.error ?? "Delete failed");
    });
  };

  const filtered = credits.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = `${c.customerName ?? ""} ${c.customerPhone ?? ""}`.toLowerCase().includes(q);
    const matchStatus = filterStatus === "all" || c.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const ddCredit = dd.id ? credits.find(c => c.id === dd.id) : null;

  return (
    <>
      <style>{`
        @keyframes rowIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
        .cred-row{animation:rowIn 0.18s ease both}
        @keyframes ddIn{from{opacity:0;transform:scale(0.95) translateY(-4px)}to{opacity:1;transform:scale(1) translateY(0)}}
        .dd-menu{animation:ddIn 0.12s ease both;transform-origin:top right}
      `}</style>

      <div className="min-h-screen bg-slate-50/80 px-3 py-5 md:px-6">
        <div className="mx-auto max-w-screen-xl space-y-5">

          {/* Header */}
          <div className="flex items-center justify-between rounded-xl border bg-white px-5 py-4 shadow-sm">
            <div>
              <h1 className="text-xl font-black text-gray-900 flex items-center gap-2">
                <HandCoins size={22} className="text-blue-600" /> Credit
              </h1>
              <p className="text-xs text-gray-400 mt-0.5">{activeShop.name} · {activeShop.location}</p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: "Total Records", value: stats.total, accent: "bg-blue-500" },
              { label: "Total Credit", value: `KSh ${stats.totalAmount.toLocaleString()}`, accent: "bg-indigo-500" },
              { label: "Outstanding", value: `KSh ${stats.outstanding.toLocaleString()}`, accent: "bg-red-500" },
              { label: "Fully Paid", value: stats.paidCount, accent: "bg-emerald-500" },
            ].map(s => (
              <div key={s.label} className="relative overflow-hidden rounded-xl border border-gray-100 bg-white px-4 pt-4 pb-3 shadow-sm">
                <div className={`absolute top-0 left-0 right-0 h-0.5 ${s.accent}`} />
                <p className="text-[0.63rem] font-bold uppercase tracking-widest text-gray-400 mb-1">{s.label}</p>
                <p className="text-2xl font-black tabular-nums text-gray-900">{s.value}</p>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by customer…"
                className="w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 py-2 text-xs focus:border-blue-400 outline-none shadow-sm transition" />
            </div>
            <div className="flex items-center gap-2">
              {["all", "pending", "partial", "paid"].map(s => (
                <button key={s} onClick={() => setStatus(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all capitalize ${filterStatus === s ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Cards */}
          <div className="space-y-3">
            {filtered.map((c, i) => {
              const pct = c.amount > 0 ? Math.min(100, Math.round((c.totalPaid / c.amount) * 100)) : 0;
              const isExp = expanded[c.id];
              return (
                <div key={c.id} style={{ animationDelay: `${i * 0.03}s` }} className="cred-row rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                  <div className="px-5 py-4 flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-700 font-black text-sm shrink-0">
                      {(c.customerName ?? "?").charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="font-bold text-gray-900 text-sm">{c.customerName ?? "Unknown Customer"}</p>
                          {c.customerPhone && <p className="text-xs text-gray-400">{c.customerPhone}</p>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[0.68rem] font-bold capitalize ${STATUS_COLORS[c.status] ?? "bg-gray-50 text-gray-600 border-gray-200"}`}>
                            {c.status}
                          </span>
                          <button onClick={ev => ev.stopPropagation()} onMouseDown={ev => open(c.id, ev as unknown as React.MouseEvent<HTMLButtonElement>)}
                            className={`rounded-lg p-1.5 transition-colors ${dd.id === c.id ? "bg-gray-200" : "hover:bg-gray-100 text-gray-400"}`}>
                            <MoreVertical size={15} />
                          </button>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="text-gray-500">Paid: <span className="font-bold text-gray-800">KSh {c.totalPaid.toLocaleString()}</span></span>
                          <span className="text-gray-500">Total: <span className="font-bold text-gray-800">KSh {c.amount.toLocaleString()}</span></span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <div className="flex items-center justify-between mt-1.5">
                          <span className={`text-xs font-bold ${c.outstanding > 0 ? "text-red-600" : "text-emerald-600"}`}>
                            {c.outstanding > 0 ? `KSh ${c.outstanding.toLocaleString()} outstanding` : "Fully paid"}
                          </span>
                          <span className="text-[0.65rem] text-gray-400">{pct}%</span>
                        </div>
                      </div>

                      {/* Footer row */}
                      <div className="mt-2 flex items-center justify-between">
                        <div className="flex items-center gap-3 text-xs text-gray-400">
                          <span>Since {c.date}</span>
                          {c.dueDate && <span className={`font-semibold ${new Date(c.dueDate) < new Date() && c.status !== "paid" ? "text-red-500" : "text-gray-500"}`}>Due {c.dueDate}</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          {isManager && c.status !== "paid" && (
                            <button onClick={() => setPayCredit(c)}
                              className="flex items-center gap-1 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg transition">
                              <Plus size={11} /> Pay
                            </button>
                          )}
                          {c.payments.length > 0 && (
                            <button onClick={() => setExpanded(p => ({ ...p, [c.id]: !isExp }))}
                              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition">
                              {isExp ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                              {c.payments.length} payment{c.payments.length > 1 ? "s" : ""}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Payment history */}
                  {isExp && c.payments.length > 0 && (
                    <div className="border-t border-gray-100 bg-slate-50 px-5 py-3 space-y-2">
                      {c.payments.map(p => (
                        <div key={p.id} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className="inline-block bg-white border border-gray-200 rounded-lg px-2 py-0.5 text-gray-600 font-semibold capitalize">{p.method}</span>
                            {p.note && <span className="text-gray-400">{p.note}</span>}
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-black text-emerald-700">KSh {p.amount.toLocaleString()}</span>
                            <span className="text-gray-400">{p.paidAt}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {filtered.length === 0 && (
              <div className="rounded-2xl border border-gray-200 bg-white py-24 text-center">
                <div className="flex flex-col items-center gap-3 text-gray-300">
                  <HandCoins size={38} strokeWidth={1} />
                  <p className="text-sm font-semibold text-gray-400">No credit records found</p>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>

      {payCredit && (
        <PaymentModal credit={payCredit} shopId={activeShop.id} onClose={() => setPayCredit(null)} />
      )}

      {mounted && dd.id && ddCredit && createPortal(
        <div ref={menuRef} className="dd-menu fixed z-[99999] w-[176px] bg-white rounded-2xl shadow-2xl border border-gray-100 py-1.5" style={{ top: dd.top, left: dd.left }}>
          {isManager && ddCredit.status !== "paid" && (
            <button onClick={() => { close(); setPayCredit(ddCredit); }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><Plus size={12} /></span>
              Record Payment
            </button>
          )}
          {isAdmin && (
            <button onClick={() => handleDelete(ddCredit.id)} disabled={deletingId === ddCredit.id}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-red-50 text-red-500">
                {deletingId === ddCredit.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
              </span>Delete
            </button>
          )}
        </div>,
        document.body
      )}
    </>
  );
}
