"use client";

import { useState } from "react";
import {
  BarChart3, TrendingUp, TrendingDown, Minus,
  DollarSign, ShoppingCart, Package, ArrowUpRight, ArrowDownRight,
  Sparkles, Calendar, Target,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
type ActiveShop = { id: string; name: string; location: string };

type KPI = {
  thisRevenue:    number; thisExpenses:  number; thisCogs:   number;
  thisGross:      number; thisNet:       number;
  prevRevenue:    number; prevExpenses:  number; prevNet:    number;
  revenueChange:  number | null; netChange: number | null;
  ytdRevenue:     number; ytdExpenses:   number; ytdNet:     number; ytdGross: number;
  grossMarginPct: number; netMarginPct:  number;
};

type MonthRow = {
  month: string; label: string; revenue: number; expenses: number;
  cogs: number; grossProfit: number; netProfit: number;
  grossMarginPct: number; netMarginPct: number;
};

type DayRow = {
  date: string; label: string; revenue: number; expenses: number;
  cogs: number; grossProfit: number; netProfit: number;
};

type Props = {
  activeShop:  ActiveShop;
  kpi:         KPI;
  monthlyData: MonthRow[];
  dailyData:   DayRow[];
  bestMonth:   MonthRow | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(n: number) { return `KSh ${Math.round(n).toLocaleString()}`; }
function pct(n: number) { return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`; }

function ChangePill({ value }: { value: number | null }) {
  if (value === null) return <span className="text-xs text-gray-400 italic">—</span>;
  const up = value >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-full ${up ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>
      {up ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
      {Math.abs(value).toFixed(1)}%
    </span>
  );
}

// ── SVG Bar Chart ─────────────────────────────────────────────────────────────
function BarChart({
  data, valueKey, color, height = 96,
}: {
  data:     { label: string; [k: string]: number | string }[];
  valueKey: string;
  color:    string;
  height?:  number;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const values  = data.map(d => d[valueKey] as number);
  const maxVal  = Math.max(...values, 1);
  const barW    = 100 / data.length;

  return (
    <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
      {data.map((d, i) => {
        const val    = d[valueKey] as number;
        const barH   = (Math.max(val, 0) / maxVal) * (height - 12);
        const x      = i * barW + barW * 0.15;
        const w      = barW * 0.7;
        const y      = height - barH;
        const active = hovered === i;
        return (
          <g key={i} onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}>
            <rect x={x} y={y} width={w} height={barH} rx="1.5"
              fill={active ? color.replace("0.7", "1") : color}
              className="transition-all duration-100 cursor-pointer" />
            {active && (
              <>
                <rect x={Math.min(x + w / 2 - 18, 82)} y={y - 18} width={36} height={14} rx="3" fill="#1e293b" />
                <text x={Math.min(x + w / 2, 100)} y={y - 8} textAnchor="middle" fontSize="3.5" fill="white" fontWeight="700">
                  {fmt(val)}
                </text>
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ── SVG Line Sparkline ────────────────────────────────────────────────────────
function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const w = 100, h = 32;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-8" preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Margin Gauge ──────────────────────────────────────────────────────────────
function MarginGauge({ pct: value, label, color }: { pct: number; label: string; color: string }) {
  const clamped  = Math.max(0, Math.min(100, value));
  const r        = 36;
  const circ     = 2 * Math.PI * r;
  const dash     = (clamped / 100) * circ;
  const negative = value < 0;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-24 h-24">
        <svg viewBox="0 0 88 88" className="w-full h-full -rotate-90">
          <circle cx="44" cy="44" r={r} fill="none" stroke="#f1f5f9" strokeWidth="8" />
          <circle cx="44" cy="44" r={r} fill="none"
            stroke={negative ? "#ef4444" : color}
            strokeWidth="8"
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
            className="transition-all duration-700" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-xl font-black tabular-nums ${negative ? "text-red-500" : "text-gray-900"}`}>
            {value.toFixed(1)}<span className="text-sm font-bold">%</span>
          </span>
        </div>
      </div>
      <span className="text-xs font-semibold text-gray-500">{label}</span>
    </div>
  );
}

// ── Main View ─────────────────────────────────────────────────────────────────
export default function MarginsView({ activeShop, kpi, monthlyData, dailyData, bestMonth }: Props) {
  const [chartView, setChartView] = useState<"monthly" | "daily">("monthly");
  const [metric,    setMetric]    = useState<"net" | "gross" | "revenue">("net");

  const chartData = chartView === "monthly" ? monthlyData : dailyData;
  const valueKey  = metric === "net" ? "netProfit" : metric === "gross" ? "grossProfit" : "revenue";
  const chartColor = metric === "net"
    ? (kpi.thisNet >= 0 ? "rgba(16,185,129,0.75)" : "rgba(239,68,68,0.75)")
    : metric === "gross" ? "rgba(139,92,246,0.75)" : "rgba(99,102,241,0.75)";

  // Trend: last 6 months net profit
  const trend6     = monthlyData.slice(-6).map(m => m.netProfit);
  const trendUp    = trend6.length > 1 && trend6[trend6.length - 1] > trend6[0];
  const trendFlat  = trend6.length > 1 && trend6[trend6.length - 1] === trend6[0];

  const profitableMonths = monthlyData.filter(m => m.netProfit > 0).length;

  return (
    <div className="min-h-screen bg-slate-50/80 px-3 py-5 md:px-6">
      <div className="mx-auto max-w-screen-xl space-y-5">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-black text-gray-900 flex items-center gap-2">
              <BarChart3 size={22} className="text-violet-600" /> Margin Analysis
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">
              {activeShop.name} · {activeShop.location}
              <span className="ml-2 text-gray-300">·</span>
              <span className="ml-2 text-gray-500 font-medium">System-computed · auto-updated</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            {trendFlat
              ? <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full"><Minus size={13} /> Flat trend</span>
              : trendUp
                ? <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-100 px-3 py-1.5 rounded-full"><TrendingUp size={13} /> Improving</span>
                : <span className="flex items-center gap-1.5 text-xs font-semibold text-red-600 bg-red-100 px-3 py-1.5 rounded-full"><TrendingDown size={13} /> Declining</span>
            }
            <span className="text-xs font-semibold text-violet-700 bg-violet-100 px-3 py-1.5 rounded-full flex items-center gap-1.5">
              <Sparkles size={12} /> {profitableMonths}/12 months profitable
            </span>
          </div>
        </div>

        {/* ── This Month KPIs ──────────────────────────────────────────────── */}
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">This Month</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { icon: <ShoppingCart size={17} className="text-indigo-500" />,  label: "Revenue",       value: kpi.thisRevenue,  prev: kpi.prevRevenue,  change: kpi.revenueChange, accent: "border-indigo-100 hover:border-indigo-200" },
              { icon: <Package      size={17} className="text-rose-500"   />,  label: "Total Expenses", value: kpi.thisExpenses, prev: kpi.prevExpenses, change: null,              accent: "border-rose-100   hover:border-rose-200"   },
              { icon: <DollarSign   size={17} className="text-emerald-500"/>,  label: "Gross Profit",  value: kpi.thisGross,    prev: null,             change: null,              accent: "border-emerald-100 hover:border-emerald-200" },
              { icon: <Target       size={17} className="text-violet-500" />,  label: "Net Profit",     value: kpi.thisNet,      prev: kpi.prevNet,      change: kpi.netChange,     accent: "border-violet-100 hover:border-violet-200"  },
            ].map(s => (
              <div key={s.label} className={`relative bg-white rounded-2xl border p-4 shadow-xs transition-shadow ${s.accent}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 rounded-xl bg-gray-50">{s.icon}</div>
                  {s.change !== null && <ChangePill value={s.change} />}
                </div>
                <p className="text-[0.68rem] font-bold text-gray-400 uppercase tracking-wide mb-1">{s.label}</p>
                <p className={`text-xl font-black tabular-nums leading-tight ${s.value < 0 ? "text-red-600" : "text-gray-900"}`}>
                  {fmt(s.value)}
                </p>
                {s.prev !== null && (
                  <p className="text-[0.65rem] text-gray-400 mt-1">
                    prev: {fmt(s.prev)}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── Gauges + Sparkline row ───────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* Margin gauges */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-5 flex items-center justify-around">
            <MarginGauge pct={kpi.grossMarginPct} label="Gross Margin"  color="#8b5cf6" />
            <div className="w-px h-16 bg-gray-100" />
            <MarginGauge pct={kpi.netMarginPct}   label="Net Margin"    color="#10b981" />
          </div>

          {/* YTD summary */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-5">
            <div className="flex items-center gap-2 mb-4">
              <Calendar size={15} className="text-gray-400" />
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Year-to-Date (12 months)</span>
            </div>
            <div className="space-y-3">
              {[
                { label: "Total Revenue",   value: kpi.ytdRevenue,   color: "bg-indigo-500" },
                { label: "Total Expenses",  value: kpi.ytdExpenses,  color: "bg-rose-500"   },
                { label: "Gross Profit",    value: kpi.ytdGross,     color: "bg-violet-500" },
                { label: "Net Profit",      value: kpi.ytdNet,       color: "bg-emerald-500" },
              ].map(r => (
                <div key={r.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${r.color}`} />
                    <span className="text-xs text-gray-600">{r.label}</span>
                  </div>
                  <span className={`text-sm font-black tabular-nums ${r.value < 0 ? "text-red-500" : "text-gray-900"}`}>
                    {fmt(r.value)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Best month + trend */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-5 flex flex-col gap-4">
            {bestMonth && bestMonth.netProfit > 0 && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                <p className="text-[0.65rem] font-bold text-emerald-600 uppercase tracking-wide mb-1 flex items-center gap-1">
                  <Sparkles size={10} /> Best Month
                </p>
                <p className="text-lg font-black text-emerald-700">{bestMonth.label}</p>
                <p className="text-xs text-emerald-600 font-semibold mt-0.5">
                  {fmt(bestMonth.netProfit)} net · {bestMonth.netMarginPct.toFixed(1)}% margin
                </p>
              </div>
            )}
            <div>
              <p className="text-[0.65rem] font-bold text-gray-400 uppercase tracking-wide mb-2">6-Month Net Profit Trend</p>
              <Sparkline data={trend6} color={trendUp ? "#10b981" : "#ef4444"} />
              <div className="flex justify-between text-[0.6rem] text-gray-400 mt-1">
                <span>{monthlyData[monthlyData.length - 6]?.label}</span>
                <span>{monthlyData[monthlyData.length - 1]?.label}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Chart ───────────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-sm font-black text-gray-800 flex items-center gap-2">
              <BarChart3 size={16} className="text-violet-500" />
              {chartView === "monthly" ? "12-Month Overview" : "Last 30 Days"}
            </h2>
            <div className="flex items-center gap-2">
              {/* Metric picker */}
              <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
                {(["net","gross","revenue"] as const).map(m => (
                  <button key={m} onClick={() => setMetric(m)}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors capitalize ${metric === m ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>
                    {m === "net" ? "Net" : m === "gross" ? "Gross" : "Revenue"}
                  </button>
                ))}
              </div>
              {/* Period toggle */}
              <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
                {(["monthly","daily"] as const).map(v => (
                  <button key={v} onClick={() => setChartView(v)}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors capitalize ${chartView === v ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>
                    {v === "monthly" ? "12 Months" : "30 Days"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="px-5 pt-3 pb-4">
            {/* X-axis labels */}
            <div className="flex justify-between mb-1">
              {(chartView === "monthly" ? monthlyData : dailyData)
                .filter((_, i, arr) => i === 0 || i === arr.length - 1 || i % Math.floor(arr.length / 5) === 0)
                .map((d, i) => (
                  <span key={i} className="text-[0.6rem] text-gray-400 font-medium">{d.label}</span>
                ))
              }
            </div>
            <BarChart data={chartData} valueKey={valueKey} color={chartColor} height={120} />
          </div>
        </div>

        {/* ── Monthly table ───────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-black text-gray-800">Monthly Breakdown</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-gray-200">
                  {["Month","Revenue","Cost of Sales","Gross Profit","Gross %","Expenses","Net Profit","Net %"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-gray-400 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {[...monthlyData].reverse().map((m) => {
                  const isCurrentMonth = m.month === `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,"0")}`;
                  return (
                    <tr key={m.month} className={`hover:bg-slate-50/70 transition-colors ${isCurrentMonth ? "bg-violet-50/40" : ""}`}>
                      <td className="px-4 py-3 font-bold text-gray-900 whitespace-nowrap">
                        {m.label}
                        {isCurrentMonth && <span className="ml-1.5 text-[0.6rem] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full font-bold">now</span>}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-indigo-700 font-semibold">{fmt(m.revenue)}</td>
                      <td className="px-4 py-3 tabular-nums text-gray-600">{fmt(m.cogs)}</td>
                      <td className={`px-4 py-3 tabular-nums font-bold ${m.grossProfit >= 0 ? "text-violet-700" : "text-red-600"}`}>{fmt(m.grossProfit)}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${m.grossMarginPct >= 30 ? "bg-violet-100 text-violet-700" : m.grossMarginPct >= 0 ? "bg-gray-100 text-gray-600" : "bg-red-100 text-red-600"}`}>
                          {m.grossMarginPct.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-4 py-3 tabular-nums text-rose-600">{fmt(m.expenses)}</td>
                      <td className={`px-4 py-3 tabular-nums font-black ${m.netProfit >= 0 ? "text-emerald-700" : "text-red-600"}`}>{fmt(m.netProfit)}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${m.netMarginPct >= 20 ? "bg-emerald-100 text-emerald-700" : m.netMarginPct >= 0 ? "bg-gray-100 text-gray-600" : "bg-red-100 text-red-600"}`}>
                          {m.netMarginPct.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
