"use client";

import { useState, useCallback, useRef, useEffect, useTransition } from "react";
import { Search, Loader2, MoreVertical, CreditCard, Banknote, Wallet, Smartphone, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { deletePaymentAction } from "./actions";

type Payment = {
  id: string; amount: number; method: string; transactionCode: string | null; date: string;
  direction: string; source: string | null; note: string | null;
};
type ActiveShop = { id: string; name: string; location: string };
type Props = {
  activeShop: ActiveShop; isAdmin: boolean;
  payments: Payment[];
  stats: { total: number; totalAmount: number; methodBreakdown: Record<string, number> };
};

const METHOD_LABELS: Record<string, string> = {
  cash: "Cash", mpesa: "M-Pesa", card: "Card", bank: "Bank Transfer",
  credit: "Credit", credit_downpayment: "Credit Down", cheque: "Cheque",
};

function methodIcon(method: string) {
  switch (method.toLowerCase()) {
    case "cash":   return <Banknote size={13} className="text-emerald-600" />;
    case "mpesa":  return <Smartphone size={13} className="text-green-600" />;
    case "card":   return <CreditCard size={13} className="text-blue-600" />;
    default:       return <Wallet size={13} className="text-indigo-600" />;
  }
}

function methodColor(method: string) {
  switch (method.toLowerCase()) {
    case "cash":   return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "mpesa":  return "bg-green-50 text-green-700 border-green-200";
    case "card":   return "bg-blue-50 text-blue-700 border-blue-200";
    case "credit": return "bg-amber-50 text-amber-700 border-amber-200";
    default:       return "bg-indigo-50 text-indigo-700 border-indigo-200";
  }
}

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
    const dw = 160, gap = 6, dh = 80;
    let top = r.bottom + gap, left = r.right - dw;
    if (top + dh > window.innerHeight - gap) top = r.top - dh - gap;
    if (left < gap) left = gap;
    if (left + dw > window.innerWidth - gap) left = window.innerWidth - dw - gap;
    setDd({ id, top, left });
  }, [dd.id, close]);
  return { dd, open, close, menuRef };
}

export default function PaymentsView({ activeShop, isAdmin, payments, stats }: Props) {
  const router = useRouter();
  const [search, setSearch]         = useState("");
  const [filterMethod, setMethod]   = useState("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [mounted, setMounted]       = useState(false);
  const [, startTransition]         = useTransition();
  const { dd, open, close, menuRef } = usePortalDD();

  useEffect(() => setMounted(true), []);

  const handleDelete = (id: string) => {
    close();
    if (!confirm("Delete this payment record?")) return;
    setDeletingId(id);
    startTransition(async () => {
      const res = await deletePaymentAction(id, activeShop.id);
      setDeletingId(null);
      if (res.success) router.refresh(); else alert(res.error ?? "Delete failed");
    });
  };

  const allMethods = Array.from(new Set(payments.map(p => p.method)));
  const filtered   = payments.filter(p => {
    const q = search.toLowerCase();
    const matchSearch = `${p.method} ${p.transactionCode ?? ""}`.toLowerCase().includes(q);
    const matchMethod = filterMethod === "all" || p.method === filterMethod;
    return matchSearch && matchMethod;
  });

  const ddPayment = dd.id ? payments.find(p => p.id === dd.id) : null;

  return (
    <>
      <style>{`
        @keyframes rowIn{from{opacity:0;transform:translateX(-5px)}to{opacity:1;transform:translateX(0)}}
        .pay-table tbody tr{animation:rowIn 0.18s ease both}
        @keyframes ddIn{from{opacity:0;transform:scale(0.95) translateY(-4px)}to{opacity:1;transform:scale(1) translateY(0)}}
        .dd-menu{animation:ddIn 0.12s ease both;transform-origin:top right}
      `}</style>

      <div className="min-h-screen bg-slate-50/80 px-3 py-5 md:px-6">
        <div className="mx-auto max-w-screen-xl space-y-5">

          {/* Header */}
          <div className="flex items-center justify-between rounded-xl border bg-white px-5 py-4 shadow-sm">
            <div>
              <h1 className="text-xl font-black text-gray-900 flex items-center gap-2">
                <CreditCard size={22} className="text-indigo-600" /> Payments
              </h1>
              <p className="text-xs text-gray-400 mt-0.5">{activeShop.name} · {activeShop.location}</p>
            </div>
            <p className="text-xs text-gray-400 bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-lg">
              Payments are auto-recorded from sales
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: "Total Records", value: stats.total, accent: "bg-indigo-500" },
              { label: "Total Received", value: `KSh ${stats.totalAmount.toLocaleString()}`, accent: "bg-emerald-500" },
              { label: "Cash", value: `KSh ${(stats.methodBreakdown["cash"] ?? 0).toLocaleString()}`, accent: "bg-teal-500" },
              { label: "M-Pesa", value: `KSh ${(stats.methodBreakdown["mpesa"] ?? 0).toLocaleString()}`, accent: "bg-green-500" },
            ].map(s => (
              <div key={s.label} className="relative overflow-hidden rounded-xl border border-gray-100 bg-white px-4 pt-4 pb-3 shadow-sm">
                <div className={`absolute top-0 left-0 right-0 h-0.5 ${s.accent}`} />
                <p className="text-[0.63rem] font-bold uppercase tracking-widest text-gray-400 mb-1">{s.label}</p>
                <p className="text-2xl font-black tabular-nums text-gray-900">{s.value}</p>
              </div>
            ))}
          </div>

          {/* Method breakdown pills */}
          {Object.keys(stats.methodBreakdown).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {Object.entries(stats.methodBreakdown).map(([method, amount]) => (
                <div key={method} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold ${methodColor(method)}`}>
                  {methodIcon(method)}
                  <span>{METHOD_LABELS[method] ?? method}:</span>
                  <span>KSh {amount.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search payments…"
                className="w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 py-2 text-xs focus:border-indigo-400 outline-none shadow-sm transition" />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => setMethod("all")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${filterMethod === "all" ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-600 border-gray-300 hover:border-indigo-400"}`}>
                All
              </button>
              {allMethods.map(m => (
                <button key={m} onClick={() => setMethod(m)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${filterMethod === m ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-600 border-gray-300 hover:border-indigo-400"}`}>
                  {METHOD_LABELS[m] ?? m}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="pay-table w-full min-w-[560px] text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-gray-200">
                    {["#", "Method", "Amount", "Source", "Transaction Code", "Date", ""].map(h => (
                      <th key={h} className="px-4 py-3.5 text-left text-xs font-bold uppercase tracking-widest text-gray-400 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((p, i) => (
                    <tr key={p.id} style={{ animationDelay: `${i * 0.025}s` }} className="bg-white hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-xs text-gray-400 font-bold w-8">{i + 1}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${methodColor(p.method)}`}>
                          {methodIcon(p.method)} {METHOD_LABELS[p.method] ?? p.method}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`tabular-nums font-black text-[0.85rem] ${p.direction === "out" ? "text-red-600" : "text-emerald-700"}`}>
                          {p.direction === "out" ? "−" : "+"}KSh {p.amount.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {p.source ? (
                          <span className="text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded-lg capitalize">
                            {p.source.replace(/_/g, " ")}
                            {p.note ? <span className="text-gray-400"> · {p.note}</span> : null}
                          </span>
                        ) : <span className="text-gray-300 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {p.transactionCode
                          ? <span className="font-mono text-xs text-gray-600 bg-gray-50 px-2 py-0.5 rounded-lg">{p.transactionCode}</span>
                          : <span className="text-gray-300 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{p.date}</td>
                      <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                        {isAdmin && (
                          <button onClick={e => open(p.id, e)}
                            className={`rounded-lg p-1.5 transition-colors ${dd.id === p.id ? "bg-gray-200" : "hover:bg-gray-100 text-gray-400"}`}>
                            <MoreVertical size={15} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={7} className="py-24 text-center">
                      <div className="flex flex-col items-center gap-3 text-gray-300">
                        <CreditCard size={38} strokeWidth={1} />
                        <p className="text-sm font-semibold text-gray-400">No payment records found</p>
                      </div>
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>

      {mounted && dd.id && ddPayment && createPortal(
        <div ref={menuRef} className="dd-menu fixed z-[99999] w-[156px] bg-white rounded-2xl shadow-2xl border border-gray-100 py-1.5" style={{ top: dd.top, left: dd.left }}>
          <button onClick={() => handleDelete(ddPayment.id)} disabled={deletingId === ddPayment.id}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-red-50 text-red-500">
              {deletingId === ddPayment.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
            </span>Delete
          </button>
        </div>,
        document.body
      )}
    </>
  );
}
