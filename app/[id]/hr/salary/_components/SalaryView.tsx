"use client";

import { useState } from "react";
import { Search, Banknote, TrendingDown, Users, CheckCircle2 } from "lucide-react";

type Salary = {
  id: string; staffName: string; staffId: string;
  amount: number; advances: number; netPayable: number;
  month: string; status: string; shop: string; shopId: string;
  date: string; isCurrentMonth: boolean;
};
type StaffOption = { id: string; fullName: string; baseSalary: number };
type ActiveShop  = { id: string; name: string; location: string };
type Props = {
  activeShop: ActiveShop; isStaff: boolean; isAdmin: boolean; isManager: boolean;
  currentMonth: string;
  stats: { totalSalaries: number; totalAmount: number; pendingAmount: number; paidCount: number; totalDeductions: number };
  salaries: Salary[]; staffList: StaffOption[];
};

function formatMonth(m: string) {
  const [y, mo] = m.split("-");
  return new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString("en-KE", { month: "long", year: "numeric" });
}

export default function SalaryView({ activeShop, currentMonth, stats, salaries }: Props) {
  const [search,      setSearch]      = useState("");
  const [filterMonth, setFilterMonth] = useState(currentMonth);

  const allMonths = Array.from(new Set(salaries.map(s => s.month))).sort().reverse();
  const filtered  = salaries.filter(s => {
    const q = search.toLowerCase();
    const matchSearch = `${s.staffName} ${s.status} ${s.shop}`.toLowerCase().includes(q);
    const matchMonth  = filterMonth === "all" || s.month === filterMonth;
    return matchSearch && matchMonth;
  });

  return (
    <>
      <style>{`
        .sal-table .col-sticky{position:sticky;left:0;z-index:10;box-shadow:6px 0 18px -6px rgba(0,0,0,0.06);clip-path:inset(0px -30px 0px 0px);}
        .sal-table thead .col-sticky{z-index:20;}
        @keyframes rowIn{from{opacity:0;transform:translateX(-5px)}to{opacity:1;transform:translateX(0)}}
        .sal-table tbody tr{animation:rowIn 0.18s ease both}
      `}</style>

      <div className="min-h-screen bg-slate-50/80 px-3 py-5 md:px-6">
        <div className="mx-auto max-w-screen-2xl space-y-5">

          {/* Header */}
          <div className="flex items-center justify-between rounded-xl border bg-white px-5 py-4 shadow-sm">
            <div>
              <h1 className="text-xl font-black text-gray-900 flex items-center gap-2">
                <Banknote size={22} className="text-emerald-600" /> Salaries
              </h1>
              <p className="text-xs text-gray-400 mt-0.5">{activeShop.name} · {activeShop.location}</p>
            </div>
            <span className="text-sm font-semibold text-gray-500 bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-lg">
              {formatMonth(currentMonth)}
            </span>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {[
              { icon: <Users size={18} className="text-indigo-600" />,     label: "Records",    value: stats.totalSalaries,                             accent: "bg-indigo-500" },
              { icon: <Banknote size={18} className="text-emerald-600" />, label: "Gross Total", value: `KSh ${stats.totalAmount.toLocaleString()}`,    accent: "bg-emerald-500" },
              { icon: <TrendingDown size={18} className="text-red-500" />, label: "Deductions",  value: `KSh ${stats.totalDeductions.toLocaleString()}`, accent: "bg-red-500" },
              { icon: <CheckCircle2 size={18} className="text-sky-600" />, label: "Paid",        value: stats.paidCount,                                 accent: "bg-sky-500" },
              { icon: <Banknote size={18} className="text-rose-600" />,    label: "Pending",     value: `KSh ${stats.pendingAmount.toLocaleString()}`,   accent: "bg-rose-500" },
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

          {/* Month filter + search */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search salary records…"
                className="w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 py-2 text-xs focus:border-emerald-400 outline-none shadow-sm transition" />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => setFilterMonth("all")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${filterMonth === "all" ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-gray-600 border-gray-300 hover:border-emerald-400"}`}>
                All
              </button>
              {allMonths.slice(0, 8).map(m => (
                <button key={m} onClick={() => setFilterMonth(m)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${filterMonth === m ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-gray-600 border-gray-300 hover:border-emerald-400"}`}>
                  {formatMonth(m)}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="sal-table w-full min-w-[680px] text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-gray-200">
                    <th className="col-sticky px-4 py-3.5 text-left text-xs font-bold uppercase tracking-widest text-gray-400 bg-slate-50 whitespace-nowrap">Staff</th>
                    {["Gross Salary", "Deductions", "Net Payable", "Month", "Status"].map(h => (
                      <th key={h} className="px-4 py-3.5 text-left text-xs font-bold uppercase tracking-widest text-gray-400 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((s, i) => (
                    <tr key={s.id} style={{ animationDelay: `${i * 0.025}s` }} className="bg-white hover:bg-slate-50 transition-colors">
                      <td className="col-sticky px-4 py-3 bg-white">
                        <div className="flex items-center gap-3">
                          <span className="text-[0.7rem] font-bold text-gray-300 w-5 text-center shrink-0">{i + 1}</span>
                          <div className="w-8 h-8 shrink-0 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-black text-xs">
                            {s.staffName.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-800 truncate max-w-[130px] text-[0.82rem]">{s.staffName}</p>
                            {s.isCurrentMonth && <p className="text-[0.63rem] text-emerald-500 font-semibold">Current month</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3"><span className="tabular-nums text-[0.82rem] font-bold text-gray-700">KSh {s.amount.toLocaleString()}</span></td>
                      <td className="px-4 py-3">
                        {s.advances > 0
                          ? <span className="tabular-nums text-[0.82rem] font-bold text-red-600">-KSh {s.advances.toLocaleString()}</span>
                          : <span className="text-gray-400 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3"><span className="tabular-nums text-[0.82rem] font-black text-emerald-700">KSh {s.netPayable.toLocaleString()}</span></td>
                      <td className="px-4 py-3 whitespace-nowrap"><span className="text-xs text-gray-500">{formatMonth(s.month)}</span></td>
                      <td className="px-4 py-3">
                        <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[0.68rem] font-bold capitalize ${
                          s.status === "paid" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"
                        }`}>{s.status}</span>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={6} className="py-24 text-center">
                      <div className="flex flex-col items-center gap-3 text-gray-300">
                        <Banknote size={38} strokeWidth={1} />
                        <p className="text-sm font-semibold text-gray-400">No salary records found</p>
                      </div>
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
