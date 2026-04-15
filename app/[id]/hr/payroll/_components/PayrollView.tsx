"use client";

import { useEffect, useState, useTransition, useCallback, useRef } from "react";
import {
  Search, Loader2, MoreVertical, TrendingUp, AlertCircle,
  Banknote, Users, TrendingDown, Trash2, BadgeCheck,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { updatePayrollStatusAction, deletePayrollAction } from "./actions";

type Payroll     = { id: string; staffName: string; staffId: string; salary: number; payable: number; advances: number; status: string; shop: string; shopId: string; date: string; isCurrentMonth: boolean };
type StaffOption = { id: string; fullName: string };
type ActiveShop  = { id: string; name: string; location: string };
type Props       = {
  activeShop: ActiveShop; isManager: boolean; currentMonth: string;
  stats: { totalPayrolls: number; totalDue: number; totalSalary: number; totalPayable: number; totalDeductions: number };
  payrolls: Payroll[]; staffList: StaffOption[];
};

type DDState = { id: string | null; top: number; left: number };

function usePortalDropdown() {
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
    const dw = 180, gap = 6, dh = menuRef.current?.offsetHeight ?? 160;
    let top = r.bottom + gap, left = r.right - dw;
    if (top + dh > window.innerHeight - gap) top = r.top - dh - gap;
    if (top < gap) top = gap;
    if (left < gap) left = gap;
    if (left + dw > window.innerWidth - gap) left = window.innerWidth - dw - gap;
    setDd({ id, top, left });
  }, [dd.id, close]);
  return { dd, open, close, menuRef };
}

export default function PayrollView({ activeShop, isManager, currentMonth, stats, payrolls }: Props) {
  const router = useRouter();
  const [search, setSearch]           = useState("");
  const [deletingId, setDeletingId]   = useState<string | null>(null);
  const [payingId, setPayingId]       = useState<string | null>(null);
  const [filterMonth, setFilterMonth] = useState(currentMonth);
  const [mounted, setMounted]         = useState(false);
  const [, startTransition]           = useTransition();

  useEffect(() => setMounted(true), []);
  const { dd, open, close, menuRef } = usePortalDropdown();

  const handleDelete = async (id: string) => {
    close();
    if (!confirm("Delete this payroll record?")) return;
    setDeletingId(id);
    const res = await deletePayrollAction(id);
    setDeletingId(null);
    if (res.success) router.refresh(); else alert(res.error || "Delete failed");
  };

  const handleMarkPaid = (id: string) => {
    close();
    if (!confirm("Mark this payroll as paid?")) return;
    setPayingId(id);
    startTransition(async () => {
      const res = await updatePayrollStatusAction(id, "paid");
      setPayingId(null);
      if (res.success) router.refresh(); else alert(res.error || "Failed");
    });
  };

  const allMonths   = Array.from(new Set(payrolls.map(p => p.date.substring(0, 7)))).sort().reverse();
  const formatMonth = (m: string) => {
    const [y, mo] = m.split("-");
    return new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString("en-KE", { month: "short", year: "numeric" });
  };

  const filtered = payrolls.filter(p => {
    const matchSearch = `${p.staffName} ${p.status} ${p.shop}`.toLowerCase().includes(search.toLowerCase());
    return matchSearch && (filterMonth === "all" || p.date.startsWith(filterMonth));
  });

  const ddPayroll = dd.id ? payrolls.find(p => p.id === dd.id) : null;

  return (
    <>
      <style>{`
        .prl-table .col-sticky{position:sticky;left:0;z-index:10;box-shadow:6px 0 18px -6px rgba(0,0,0,0.06);clip-path:inset(0px -30px 0px 0px);}
        .prl-table thead .col-sticky{z-index:20;}
        @keyframes rowIn{from{opacity:0;transform:translateX(-6px)}to{opacity:1;transform:translateX(0)}}
        .prl-table tbody tr{animation:rowIn 0.18s ease both}
        @keyframes ddIn{from{opacity:0;transform:scale(0.95) translateY(-4px)}to{opacity:1;transform:scale(1) translateY(0)}}
        .dd-menu{animation:ddIn 0.12s ease both;transform-origin:top right}
      `}</style>

      <div className="min-h-screen bg-slate-50/80 px-3 py-5 md:px-6">
        <div className="mx-auto max-w-screen-2xl space-y-5">

          {/* Header */}
          <div className="flex items-center justify-between rounded-xl border bg-white px-5 py-4 shadow-sm">
            <div>
              <h1 className="text-xl font-black text-gray-900 flex items-center gap-2">
                <Banknote size={22} className="text-indigo-600" /> Payroll
              </h1>
              <div className="text-xs text-gray-400 mt-0.5">{activeShop.name} · {activeShop.location}</div>
            </div>
            <div className="text-sm font-semibold text-gray-500 bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-lg">
              {formatMonth(currentMonth)}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {[
              { icon: <Users size={18} className="text-indigo-600" />,      label: "Records",      value: stats.totalPayrolls,                             accent: "bg-indigo-500" },
              { icon: <Banknote size={18} className="text-emerald-600" />,  label: "Total Salary", value: `KSh ${stats.totalSalary.toLocaleString()}`,    accent: "bg-emerald-500" },
              { icon: <TrendingDown size={18} className="text-red-500" />,  label: "Deductions",   value: `KSh ${stats.totalDeductions.toLocaleString()}`, accent: "bg-red-500" },
              { icon: <TrendingUp size={18} className="text-sky-600" />,    label: "Net Payable",  value: `KSh ${stats.totalPayable.toLocaleString()}`,   accent: "bg-sky-500" },
              { icon: <AlertCircle size={18} className="text-rose-600" />,  label: "Pending Due",  value: `KSh ${stats.totalDue.toLocaleString()}`,       accent: "bg-rose-500" },
            ].map(s => (
              <div key={s.label} className="relative overflow-hidden rounded-xl border border-gray-100 bg-white px-4 pt-4 pb-3 shadow-sm">
                <div className={`absolute top-0 left-0 right-0 h-0.5 ${s.accent}`} />
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="p-1.5 bg-gray-50 rounded-lg">{s.icon}</div>
                  <p className="text-[0.63rem] font-bold uppercase tracking-widest text-gray-400">{s.label}</p>
                </div>
                <p className="text-2xl font-black tabular-nums text-gray-900">{s.value}</p>
              </div>
            ))}
          </div>

          {/* Controls */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search payroll…"
                className="w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 py-2 text-xs focus:border-indigo-400 outline-none shadow-sm transition"
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setFilterMonth("all")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${filterMonth === "all" ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-600 border-gray-300 hover:border-indigo-400"}`}
              >All</button>
              {allMonths.slice(0, 6).map(m => (
                <button key={m} onClick={() => setFilterMonth(m)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${filterMonth === m ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-600 border-gray-300 hover:border-indigo-400"}`}
                >{formatMonth(m)}</button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="prl-table w-full min-w-[720px] text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-gray-200">
                    <th className="col-sticky px-4 py-3.5 text-left text-xs font-bold uppercase tracking-widest text-gray-400 bg-slate-50 whitespace-nowrap">Staff</th>
                    {["Base Salary", "Advances", "Net Payable", "Status", "Date", ""].map(h => (
                      <th key={h} className="px-4 py-3.5 text-left text-xs font-bold uppercase tracking-widest text-gray-400 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((p, i) => (
                    <tr key={p.id} style={{ animationDelay: `${i * 0.025}s` }}
                      className="bg-white hover:bg-slate-50 transition-colors duration-100">
                      <td className="col-sticky px-4 py-3 bg-white">
                        <div className="flex items-center gap-3">
                          <span className="text-[0.7rem] font-bold text-gray-300 w-5 text-center tabular-nums shrink-0">{i + 1}</span>
                          <div className="w-8 h-8 shrink-0 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-black text-xs">
                            {p.staffName.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-800 truncate max-w-[130px] text-[0.82rem]">{p.staffName}</p>
                            {p.isCurrentMonth && <p className="text-[0.63rem] text-indigo-500 font-semibold">Current month</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3"><span className="tabular-nums text-[0.82rem] font-bold text-gray-700">KSh {p.salary.toLocaleString()}</span></td>
                      <td className="px-4 py-3">
                        {p.advances > 0
                          ? <span className="tabular-nums text-[0.82rem] font-bold text-red-600">-KSh {p.advances.toLocaleString()}</span>
                          : <span className="text-gray-400 text-xs">—</span>
                        }
                      </td>
                      <td className="px-4 py-3"><span className="tabular-nums text-[0.82rem] font-black text-indigo-700">KSh {p.payable.toLocaleString()}</span></td>
                      <td className="px-4 py-3">
                        <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[0.68rem] font-bold capitalize ${
                          p.status === "paid" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"
                        }`}>{p.status}</span>
                      </td>
                      <td className="px-4 py-3"><span className="text-[0.73rem] text-gray-400 whitespace-nowrap">{p.date}</span></td>
                      <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          {isManager && p.status === "pending" && (
                            <button onClick={() => handleMarkPaid(p.id)} disabled={payingId === p.id}
                              className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-lg flex items-center gap-1 transition-colors disabled:opacity-60">
                              {payingId === p.id ? <Loader2 size={11} className="animate-spin" /> : "✓ Pay"}
                            </button>
                          )}
                          <button onClick={e => open(p.id, e)}
                            className={`rounded-lg p-1.5 transition-colors ${dd.id === p.id ? "bg-gray-200 text-gray-700" : "hover:bg-gray-100 text-gray-400"}`}>
                            <MoreVertical size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={8} className="py-24 text-center">
                      <div className="flex flex-col items-center gap-3 text-gray-300">
                        <Banknote size={38} strokeWidth={1} />
                        <p className="text-sm font-semibold text-gray-400">No payroll records found</p>
                      </div>
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>

      {mounted && dd.id && ddPayroll && createPortal(
        <div ref={menuRef} className="dd-menu fixed z-[99999] w-[176px] bg-white rounded-2xl shadow-2xl border border-gray-100 py-1.5" style={{ top: dd.top, left: dd.left }}>
          <div className="px-3 py-2 border-b border-gray-50 mb-1">
            <p className="text-[0.63rem] font-bold uppercase tracking-widest text-gray-400">Payroll</p>
            <p className="text-xs font-semibold text-gray-700 truncate">{ddPayroll.staffName}</p>
          </div>
          {isManager && ddPayroll.status === "pending" && (
            <button onClick={() => handleMarkPaid(ddPayroll.id)} disabled={payingId === ddPayroll.id}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors disabled:opacity-50">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                {payingId === ddPayroll.id ? <Loader2 size={12} className="animate-spin" /> : <BadgeCheck size={12} />}
              </span>Mark as Paid
            </button>
          )}
          <div className="my-1 border-t border-gray-100" />
          <button onClick={() => handleDelete(ddPayroll.id)} disabled={deletingId === ddPayroll.id}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-red-50 text-red-500">
              {deletingId === ddPayroll.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
            </span>Delete
          </button>
        </div>,
        document.body
      )}
    </>
  );
}
