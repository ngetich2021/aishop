"use client";

import { useState, useMemo } from "react";
import {
  TrendingUp, TrendingDown, ShoppingBag, Users, Banknote,
  BarChart3, Receipt, Package, CreditCard, ArrowUpRight,
} from "lucide-react";

type DayStat = { date: string; revenue: number; expenses: number; sales: number };
type TopProduct = { name: string; qty: number; revenue: number };
type PayBreakdown = { method: string; amount: number; count: number };

type Props = {
  activeShop: { id: string; name: string; location: string };
  period: "week" | "month" | "year";
  stats: {
    revenue:       number; prevRevenue:   number;
    expenses:      number; prevExpenses:  number;
    salesCount:    number; prevSales:     number;
    staffCount:    number;
    creditOut:     number;
    grossProfit:   number;
    netProfit:     number;
  };
  dailyData:    DayStat[];
  topProducts:  TopProduct[];
  payBreakdown: PayBreakdown[];
};

const PERIOD_LABELS: Record<string, string> = { week: "Last 7 days", month: "This month", year: "This year" };

function pct(current: number, prev: number) {
  if (prev === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - prev) / prev) * 100);
}

function StatCard({
  label, value, prev, icon, accent, prefix = "",
}: { label: string; value: number | string; prev?: number; icon: React.ReactNode; accent: string; prefix?: string }) {
  const change = typeof value === "number" && prev !== undefined ? pct(value as number, prev) : null;
  return (
    <div className="relative overflow-hidden rounded-2xl border border-gray-100 bg-white px-5 pt-5 pb-4 shadow-sm">
      <div className={`absolute top-0 left-0 right-0 h-1 ${accent}`} />
      <div className="flex items-start justify-between mb-3">
        <div className="p-2 bg-gray-50 rounded-xl">{icon}</div>
        {change !== null && (
          <div className={`flex items-center gap-0.5 text-xs font-bold ${change >= 0 ? "text-emerald-600" : "text-red-500"}`}>
            {change >= 0 ? <ArrowUpRight size={13} /> : <TrendingDown size={13} />}
            {Math.abs(change)}%
          </div>
        )}
      </div>
      <p className="text-[0.63rem] font-bold uppercase tracking-widest text-gray-400">{label}</p>
      <p className="text-2xl font-black tabular-nums text-gray-900 mt-0.5">
        {prefix}{typeof value === "number" ? value.toLocaleString() : value}
      </p>
    </div>
  );
}

function MiniBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pctW = max > 0 ? Math.max(2, (value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-500 w-20 truncate shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pctW}%`, transition: "width 0.6s ease" }} />
      </div>
      <span className="text-xs font-bold text-gray-700 tabular-nums w-24 text-right shrink-0">KSh {value.toLocaleString()}</span>
    </div>
  );
}

export default function ReportsView({ activeShop, stats, dailyData, topProducts, payBreakdown }: Props) {
  const [activePeriod] = useState("month");

  const maxDaily   = useMemo(() => Math.max(...dailyData.map(d => d.revenue), 1), [dailyData]);
  const maxProduct = useMemo(() => Math.max(...topProducts.map(p => p.revenue), 1), [topProducts]);
  const maxPay     = useMemo(() => Math.max(...payBreakdown.map(p => p.amount), 1), [payBreakdown]);

  const ACCENT_COLORS: Record<string, string> = {
    cash: "bg-emerald-500", mpesa: "bg-green-500", card: "bg-blue-500",
    bank: "bg-indigo-500", credit: "bg-amber-500",
  };

  return (
    <div className="min-h-screen bg-slate-50/80 px-3 py-5 md:px-6">
      <div className="mx-auto max-w-screen-2xl space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between rounded-xl border bg-white px-5 py-4 shadow-sm">
          <div>
            <h1 className="text-xl font-black text-gray-900 flex items-center gap-2">
              <BarChart3 size={22} className="text-indigo-600" /> Reports & Analytics
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">{activeShop.name} · {activeShop.location} · {PERIOD_LABELS[activePeriod]}</p>
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Revenue"     value={stats.revenue}    prev={stats.prevRevenue}  icon={<Banknote   size={16} className="text-emerald-600" />} accent="bg-emerald-500" prefix="KSh " />
          <StatCard label="Expenses"    value={stats.expenses}   prev={stats.prevExpenses} icon={<Receipt    size={16} className="text-rose-500"    />} accent="bg-rose-500"    prefix="KSh " />
          <StatCard label="Sales"       value={stats.salesCount} prev={stats.prevSales}    icon={<ShoppingBag size={16} className="text-sky-600"    />} accent="bg-sky-500"                  />
          <StatCard label="Staff"       value={stats.staffCount}                           icon={<Users      size={16} className="text-violet-600"  />} accent="bg-violet-500"               />
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <StatCard label="Gross Profit" value={stats.grossProfit} icon={<TrendingUp   size={16} className="text-emerald-600" />} accent="bg-gradient-to-r from-emerald-500 to-teal-500"    prefix="KSh " />
          <StatCard label="Net Profit"   value={stats.netProfit}   icon={<BarChart3    size={16} className="text-indigo-600"  />} accent="bg-gradient-to-r from-indigo-500 to-blue-500"      prefix="KSh " />
          <StatCard label="Credit Out"   value={stats.creditOut}   icon={<CreditCard   size={16} className="text-amber-600"   />} accent="bg-amber-500"                                       prefix="KSh " />
        </div>

        {/* Two-column: Daily revenue chart + payment breakdown */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">

          {/* Daily revenue sparkline */}
          <div className="lg:col-span-3 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-black text-gray-900 mb-4 flex items-center gap-2">
              <TrendingUp size={16} className="text-emerald-600" /> Daily Revenue
            </h2>
            <div className="space-y-2">
              {dailyData.slice(-14).map(d => (
                <div key={d.date} className="flex items-center gap-3">
                  <span className="text-[0.65rem] text-gray-400 w-16 shrink-0">{d.date.slice(5)}</span>
                  <div className="flex-1 flex gap-1 h-5 items-end">
                    <div className="bg-emerald-400 rounded-t-sm min-w-[2px]"
                      style={{ width: `${maxDaily > 0 ? (d.revenue / maxDaily) * 100 : 0}%`, height: "100%", transition: "width 0.5s ease" }} />
                  </div>
                  <span className="text-xs font-bold text-gray-700 tabular-nums w-24 text-right shrink-0">
                    KSh {d.revenue.toLocaleString()}
                  </span>
                  <span className="text-[0.65rem] text-gray-400 w-10 text-right shrink-0">{d.sales} sold</span>
                </div>
              ))}
              {dailyData.length === 0 && (
                <p className="text-xs text-gray-400 py-8 text-center">No sales data yet</p>
              )}
            </div>
          </div>

          {/* Payment breakdown */}
          <div className="lg:col-span-2 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-black text-gray-900 mb-4 flex items-center gap-2">
              <CreditCard size={16} className="text-indigo-600" /> Payment Methods
            </h2>
            {payBreakdown.length > 0 ? (
              <div className="space-y-4">
                {payBreakdown.map(p => (
                  <div key={p.method}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-gray-700 capitalize">{p.method.replace("_", " ")}</span>
                      <span className="text-xs text-gray-400">{p.count} txn{p.count !== 1 ? "s" : ""}</span>
                    </div>
                    <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${ACCENT_COLORS[p.method] ?? "bg-gray-400"}`}
                        style={{ width: `${maxPay > 0 ? (p.amount / maxPay) * 100 : 0}%`, transition: "width 0.6s ease" }}
                      />
                    </div>
                    <p className="text-xs font-black text-gray-800 tabular-nums mt-0.5">KSh {p.amount.toLocaleString()}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 py-8 text-center">No payment data yet</p>
            )}
          </div>
        </div>

        {/* Two-column: Top products + expense vs revenue */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">

          {/* Top products */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-black text-gray-900 mb-4 flex items-center gap-2">
              <Package size={16} className="text-sky-600" /> Top Products
            </h2>
            {topProducts.length > 0 ? (
              <div className="space-y-3">
                {topProducts.map((p, i) => (
                  <div key={p.name} className="flex items-center gap-3">
                    <span className="w-5 text-xs text-gray-300 font-bold text-center shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800 truncate">{p.name}</p>
                      <p className="text-[0.63rem] text-gray-400">{p.qty} units sold</p>
                    </div>
                    <MiniBar label="" value={p.revenue} max={maxProduct} color="bg-sky-400" />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 py-8 text-center">No sales data yet</p>
            )}
          </div>

          {/* Revenue vs Expenses comparison */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-black text-gray-900 mb-4 flex items-center gap-2">
              <BarChart3 size={16} className="text-violet-600" /> Revenue vs Expenses
            </h2>
            <div className="space-y-4">
              {[
                { label: "Total Revenue", value: stats.revenue,   color: "bg-emerald-400", icon: <TrendingUp  size={14} className="text-emerald-600" /> },
                { label: "Total Expenses",value: stats.expenses,  color: "bg-rose-400",    icon: <TrendingDown size={14} className="text-rose-500" /> },
                { label: "Gross Profit",  value: stats.grossProfit, color: "bg-indigo-400", icon: <BarChart3  size={14} className="text-indigo-600" /> },
                { label: "Net Profit",    value: stats.netProfit,  color: stats.netProfit >= 0 ? "bg-emerald-500" : "bg-red-500", icon: <Banknote size={14} className="text-gray-600" /> },
              ].map(row => {
                const maxVal = Math.max(stats.revenue, stats.expenses, 1);
                return (
                  <div key={row.label}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-700">{row.icon}{row.label}</span>
                      <span className={`text-xs font-black tabular-nums ${row.value < 0 ? "text-red-600" : "text-gray-800"}`}>
                        KSh {row.value.toLocaleString()}
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${row.color}`}
                        style={{ width: `${Math.abs(row.value) / maxVal * 100}%`, transition: "width 0.6s ease" }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Profit margin */}
            <div className="mt-5 pt-4 border-t border-gray-100">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500 font-semibold">Profit Margin</span>
                <span className={`text-sm font-black ${stats.revenue > 0 && stats.netProfit / stats.revenue >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                  {stats.revenue > 0 ? `${Math.round((stats.netProfit / stats.revenue) * 100)}%` : "—"}
                </span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
