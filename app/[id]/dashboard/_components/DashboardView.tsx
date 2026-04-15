"use client";

import { useState } from "react";
import Link         from "next/link";
import {
  TrendingUp, TrendingDown, ShoppingCart, Package, Users, AlertCircle,
  ArrowUpRight, BarChart3, Star, DollarSign, Activity, ShoppingBag,
  Building2, ArrowRightLeft, Banknote, Store, Wallet, Zap, CreditCard, Lock,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type StatPair = { count: number; amount: number };

type Permissions = {
  canSales:     boolean;
  canFinance:   boolean;
  canInventory: boolean;
  canHR:        boolean;
  canReports:   boolean;
};

type Props = {
  shopId:            string;
  userName:          string;
  isAdmin:           boolean;
  selectedShopName?: string;
  shops:             { id: string; name: string; location: string }[];
  stats: {
    sales:    { today: StatPair; week: StatPair; month: StatPair; total: StatPair };
    expenses: { today: StatPair; total: StatPair };
    totalProducts: number; totalStaff: number;
    netProfit: number; creditDue: number; totalBalance: number;
    advances: StatPair; paymentsToday: StatPair;
  };
  recentSales:    { id: string; productName: string; totalItems: number; amount: number; method: string; shop: string; date: string; time: string }[];
  recentExpenses: { id: string; description: string; amount: number; category: string; shop: string; date: string }[];
  monthlyData:    { month: string; label: string; sales: number; expenses: number; profit: number }[];
  wallets:        { balance: number; shopName: string; shopId: string }[];
  blocked?:       boolean;
  noShopAssigned?: boolean;
  permissions:    Permissions;
};

type ChartView = "comparison" | "sales" | "expenses" | "profit";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

const METHOD_COLORS: Record<string, string> = {
  cash:   "bg-emerald-900/60 text-emerald-300",
  mpesa:  "bg-green-900/60 text-green-300",
  bank:   "bg-sky-900/60 text-sky-300",
  card:   "bg-violet-900/60 text-violet-300",
  credit: "bg-rose-900/60 text-rose-300",
};

const METHOD_BAR_COLOR: Record<string, string> = {
  cash: "#10b981", mpesa: "#22c55e", bank: "#0ea5e9", card: "#8b5cf6", credit: "#f43f5e",
};

// ── No-permission placeholder ─────────────────────────────────────────────────

function NoPermission({ section }: { section: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
      <div className="w-10 h-10 rounded-xl bg-gray-800/60 flex items-center justify-center">
        <Lock size={18} className="text-gray-500" />
      </div>
      <div>
        <p className="text-sm font-semibold text-gray-500">No data available</p>
        <p className="text-xs text-gray-600 mt-1">
          You don&apos;t have access to{" "}
          <span className="text-gray-400 font-medium">{section}</span>.
          Ask your admin for more permissions.
        </p>
      </div>
    </div>
  );
}

// ── Spark line ────────────────────────────────────────────────────────────────

function SparkLine({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const W = 72, H = 24;
  const points = data
    .map((v, i) =>
      `${((i / (data.length - 1)) * W).toFixed(1)},${(H - ((v - min) / range) * H).toFixed(1)}`
    )
    .join(" ");
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="flex-shrink-0">
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Bar chart ─────────────────────────────────────────────────────────────────

function BarChart({ data, view }: { data: Props["monthlyData"]; view: ChartView }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  function getValues(m: Props["monthlyData"][0]) {
    if (view === "sales")    return { a: m.sales,    b: 0 };
    if (view === "expenses") return { a: m.expenses, b: 0 };
    if (view === "profit")   return { a: m.profit,   b: 0 };
    return { a: m.sales, b: m.expenses };
  }

  const allAbs = data.flatMap(m => { const { a, b } = getValues(m); return [Math.abs(a), Math.abs(b)]; });
  const maxVal = Math.max(...allAbs, 1);

  const colorA =
    view === "expenses" ? "bg-rose-500"  :
    view === "profit"   ? "bg-amber-500" : "bg-emerald-500";

  return (
    <div className="relative">
      {/* Y-axis labels */}
      <div className="absolute left-0 top-0 h-36 flex flex-col justify-between pointer-events-none">
        {[1, 0.75, 0.5, 0.25, 0].map(f => (
          <span key={f} className="text-[9px] text-gray-700 leading-none">{fmt(maxVal * f)}</span>
        ))}
      </div>
      <div className="pl-8 overflow-x-auto pb-1">
        <div className="flex items-end gap-1.5 h-36 min-w-0">
          {data.map((m, i) => {
            const { a, b } = getValues(m);
            const isNegA   = a < 0;
            const hA = Math.max((Math.abs(a) / maxVal) * 100, a !== 0 ? 2 : 0);
            const hB = Math.max((Math.abs(b) / maxVal) * 100, b !== 0 ? 2 : 0);
            const isHov = hoveredIdx === i;
            return (
              <div
                key={m.month}
                className="relative flex flex-col items-center gap-1 flex-1 min-w-[28px] cursor-pointer"
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                {isHov && (
                  <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-xs whitespace-nowrap z-30 shadow-xl pointer-events-none">
                    <div className="font-bold text-white mb-1">{m.label}</div>
                    {view === "comparison" ? (
                      <>
                        <div className="text-emerald-400">Sales: KSh {m.sales.toLocaleString()}</div>
                        <div className="text-rose-400">Exp: KSh {m.expenses.toLocaleString()}</div>
                        <div className={m.profit >= 0 ? "text-amber-400" : "text-rose-400"}>
                          Profit: KSh {m.profit.toLocaleString()}
                        </div>
                      </>
                    ) : (
                      <div className={isNegA ? "text-rose-400" : "text-white"}>
                        KSh {Math.abs(a).toLocaleString()}
                      </div>
                    )}
                  </div>
                )}
                <div className="w-full flex items-end justify-center gap-0.5 h-32">
                  <div
                    style={{ height: `${hA}%` }}
                    className={`flex-1 rounded-t-md transition-all ${isNegA ? "bg-rose-500" : colorA} ${isHov ? "opacity-100" : "opacity-75"}`}
                  />
                  {view === "comparison" && (
                    <div
                      style={{ height: `${hB}%` }}
                      className={`flex-1 rounded-t-md transition-all bg-rose-500 ${isHov ? "opacity-100" : "opacity-55"}`}
                    />
                  )}
                </div>
                <span className="text-[9px] text-gray-600 truncate w-full text-center leading-none">{m.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── KPI card ──────────────────────────────────────────────────────────────────

type PaletteEntry = { bg: string; border: string; iconCls: string; text: string; badge: string };
const KPI_PALETTE: Record<string, PaletteEntry> = {
  emerald: { bg: "bg-emerald-950/40", border: "border-emerald-900/30", iconCls: "bg-emerald-900/50 text-emerald-400", text: "text-emerald-400", badge: "bg-emerald-900/40 text-emerald-400" },
  rose:    { bg: "bg-rose-950/40",    border: "border-rose-900/30",    iconCls: "bg-rose-900/50 text-rose-400",       text: "text-rose-400",    badge: "bg-rose-900/40 text-rose-400"    },
  amber:   { bg: "bg-amber-950/40",   border: "border-amber-900/30",   iconCls: "bg-amber-900/50 text-amber-400",     text: "text-amber-400",   badge: "bg-amber-900/40 text-amber-400"  },
  sky:     { bg: "bg-sky-950/40",     border: "border-sky-900/30",     iconCls: "bg-sky-900/50 text-sky-400",         text: "text-sky-400",     badge: "bg-sky-900/40 text-sky-400"      },
  violet:  { bg: "bg-violet-950/40",  border: "border-violet-900/30",  iconCls: "bg-violet-900/50 text-violet-400",   text: "text-violet-400",  badge: "bg-violet-900/40 text-violet-400"},
  orange:  { bg: "bg-orange-950/40",  border: "border-orange-900/30",  iconCls: "bg-orange-900/50 text-orange-400",   text: "text-orange-400",  badge: "bg-orange-900/40 text-orange-400"},
};

function KpiCard({ label, value, fullValue, sub, spark, icon, color, trend, negative, locked, lockedMsg }: {
  label: string; value: string; fullValue: string; sub: string;
  spark?: React.ReactNode; icon: React.ReactNode; color: string;
  trend?: string; negative?: boolean; locked?: boolean; lockedMsg?: string;
}) {
  const c = KPI_PALETTE[color] ?? KPI_PALETTE["emerald"];
  if (locked) {
    return (
      <div className={`rounded-2xl border ${c.bg} ${c.border} p-4 flex flex-col gap-2 opacity-50`}>
        <div className="flex items-center justify-between">
          <div className={`p-2 rounded-xl ${c.iconCls}`}>{icon}</div>
          <Lock size={13} className="text-gray-600" />
        </div>
        <div>
          <div className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">{label}</div>
          <div className="text-xs text-gray-600 italic">{lockedMsg ?? "No permission"}</div>
        </div>
      </div>
    );
  }
  return (
    <div title={fullValue} className={`rounded-2xl border ${c.bg} ${c.border} p-4 flex flex-col gap-3 hover:border-opacity-70 transition-all cursor-default`}>
      <div className="flex items-center justify-between">
        <div className={`p-2 rounded-xl ${c.iconCls}`}>{icon}</div>
        {spark}
      </div>
      <div>
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{label}</div>
        <div className={`text-lg sm:text-xl font-bold ${c.text} leading-tight`}>{value}</div>
        <div className="text-xs text-gray-600 mt-0.5">{sub}</div>
      </div>
      {trend && (
        <div className={`text-xs font-semibold px-2 py-1 rounded-lg self-start ${c.badge}`}>
          {negative ? "▼" : "▲"} {trend}
        </div>
      )}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function DashboardView({
  shopId, userName, isAdmin, selectedShopName, shops, stats,
  recentSales, recentExpenses, monthlyData, wallets,
  blocked = false, noShopAssigned = false, permissions,
}: Props) {
  const [chartView, setChartView] = useState<ChartView>("comparison");
  const { canSales, canFinance, canInventory, canHR } = permissions;

  // ── Blocked screen ────────────────────────────────────────────────────────
  if (blocked) {
    return (
      <div className="min-h-screen bg-[#0a0c10] text-white flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-rose-900/30 flex items-center justify-center mb-8">
            <AlertCircle size={48} className="text-rose-400" />
          </div>
          <h1 className="text-4xl font-bold text-rose-400">Not Allowed</h1>
          <p className="mt-4 text-lg text-gray-400">You do not have permission to access this section.</p>
          <Link href={`/${shopId}/dashboard`}
            className="mt-10 inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-8 py-4 rounded-2xl text-sm transition-colors">
            <Store size={18} /> Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  // ── No shop screen ────────────────────────────────────────────────────────
  if (noShopAssigned) {
    return (
      <div className="min-h-screen bg-[#0a0c10] text-white flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-900/30 flex items-center justify-center mb-8">
            <Store size={48} className="text-amber-400" />
          </div>
          <h1 className="text-4xl font-bold text-amber-400">No Shop Assigned</h1>
          <p className="mt-4 text-lg text-gray-400">Your account is not linked to any shop yet.</p>
          <p className="mt-2 text-sm text-gray-500">Please contact your administrator.</p>
        </div>
      </div>
    );
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const salesSparkData  = monthlyData.map(m => m.sales);
  const expSparkData    = monthlyData.map(m => m.expenses);
  const profitSparkData = monthlyData.map(m => m.profit);

  const methodMap: Record<string, number> = {};
  recentSales.forEach(s => { methodMap[s.method] = (methodMap[s.method] ?? 0) + s.amount; });
  const methodTotal   = Object.values(methodMap).reduce((a, b) => a + b, 0);
  const methodEntries = Object.entries(methodMap).sort((a, b) => b[1] - a[1]);

  const chartOptions: { key: ChartView; label: string }[] = [
    { key: "comparison", label: "Both"     },
    { key: "sales",      label: "Sales"    },
    { key: "expenses",   label: "Expenses" },
    { key: "profit",     label: "Profit"   },
  ];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0a0c10] text-white">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-950/40 via-[#0a0c10] to-gray-950 pointer-events-none" />
        <div className="relative mx-auto max-w-screen-2xl px-4 pt-6 pb-8 md:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">

            {/* Left: greeting */}
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="inline-flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold px-3 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                  Live · {new Date().toLocaleDateString("en-KE", { weekday: "short", month: "short", day: "numeric" })}
                </span>
                {isAdmin && (
                  <span className="bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-semibold px-3 py-1 rounded-full">
                    Admin
                  </span>
                )}
                {selectedShopName && (
                  <span className="inline-flex items-center gap-1.5 bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-semibold px-3 py-1 rounded-full">
                    <Store size={11} /> {selectedShopName}
                  </span>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                {getGreeting()},{" "}
                <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                  {userName.split(" ")[0]}
                </span>{" "}
                👋
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                {selectedShopName
                  ? <><span className="text-sky-400 font-semibold">{selectedShopName}</span> · {canHR ? `${stats.totalStaff} staff` : "—"} · {canInventory ? `${stats.totalProducts} products` : "—"}</>
                  : <>{shops.length} shop{shops.length !== 1 ? "s" : ""} · {canHR ? `${stats.totalStaff} staff` : "—"} · {canInventory ? `${stats.totalProducts} products` : "—"}</>
                }
              </p>
            </div>

            {/* Right: wallet balance hero */}
            {canFinance && (
              <div className="shrink-0">
                <div className="inline-flex flex-col items-start sm:items-end bg-gradient-to-br from-emerald-600/20 to-emerald-800/10 border border-emerald-600/20 rounded-2xl px-5 py-4">
                  <span className="text-xs font-semibold text-emerald-400/70 uppercase tracking-wider flex items-center gap-1.5 mb-1">
                    <Wallet size={11} /> Wallet Balance
                  </span>
                  <span className="text-2xl sm:text-3xl font-bold text-white">
                    KSh {stats.totalBalance.toLocaleString()}
                  </span>
                  {canSales && (
                    <span className="text-xs text-emerald-400/60 mt-1">
                      {stats.sales.today.count} sales today · KSh {stats.sales.today.amount.toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-screen-2xl px-4 pb-12 md:px-6 space-y-5">

        {/* KPI cards row */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          <KpiCard
            label="Total Revenue" icon={<TrendingUp size={16} />} color="emerald"
            value={canSales ? `KSh ${fmt(stats.sales.total.amount)}` : "—"}
            fullValue={canSales ? `KSh ${stats.sales.total.amount.toLocaleString()}` : ""}
            sub={canSales ? `${stats.sales.total.count} sales` : ""}
            spark={canSales ? <SparkLine data={salesSparkData} color="#10b981" /> : undefined}
            locked={!canSales} lockedMsg="Sales not permitted"
          />
          <KpiCard
            label="Total Expenses" icon={<TrendingDown size={16} />} color="rose"
            value={canFinance ? `KSh ${fmt(stats.expenses.total.amount)}` : "—"}
            fullValue={canFinance ? `KSh ${stats.expenses.total.amount.toLocaleString()}` : ""}
            sub={canFinance ? `${stats.expenses.total.count} records` : ""}
            spark={canFinance ? <SparkLine data={expSparkData} color="#f43f5e" /> : undefined}
            locked={!canFinance} lockedMsg="Finance not permitted"
          />
          <KpiCard
            label="Net Profit" icon={<Star size={16} />}
            color={(canSales && canFinance) ? (stats.netProfit >= 0 ? "amber" : "rose") : "amber"}
            value={(canSales && canFinance) ? `KSh ${fmt(Math.abs(stats.netProfit))}` : "—"}
            fullValue={(canSales && canFinance) ? `KSh ${stats.netProfit.toLocaleString()}` : ""}
            sub={(canSales && canFinance) ? (stats.netProfit >= 0 ? "Positive" : "Loss") : ""}
            spark={(canSales && canFinance) ? <SparkLine data={profitSparkData} color="#f59e0b" /> : undefined}
            locked={!canSales || !canFinance} lockedMsg="Requires sales + finance"
          />
          <KpiCard
            label="Products" icon={<Package size={16} />} color="sky"
            value={canInventory ? stats.totalProducts.toLocaleString() : "—"}
            fullValue={canInventory ? `${stats.totalProducts} SKUs` : ""}
            sub={canInventory ? "in inventory" : ""}
            locked={!canInventory} lockedMsg="Inventory not permitted"
          />
          <KpiCard
            label="Staff" icon={<Users size={16} />} color="violet"
            value={canHR ? stats.totalStaff.toLocaleString() : "—"}
            fullValue={canHR ? `${stats.totalStaff} team members` : ""}
            sub={canHR ? "team members" : ""}
            locked={!canHR} lockedMsg="HR not permitted"
          />
          <KpiCard
            label="Credit Due" icon={<AlertCircle size={16} />} color="orange"
            value={canFinance ? `KSh ${fmt(stats.creditDue)}` : "—"}
            fullValue={canFinance ? `KSh ${stats.creditDue.toLocaleString()}` : ""}
            sub={canFinance ? "outstanding" : ""}
            locked={!canFinance} lockedMsg="Finance not permitted"
            negative
          />
        </div>

        {/* Sales period row */}
        {canSales ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Today",      emoji: "⚡", ...stats.sales.today },
              { label: "This Week",  emoji: "📅", ...stats.sales.week  },
              { label: "This Month", emoji: "🗓️", ...stats.sales.month },
              { label: "All Time",   emoji: "🏆", ...stats.sales.total },
            ].map(s => (
              <div key={s.label} className="rounded-2xl bg-gray-900/80 border border-gray-800 p-4 hover:border-emerald-800/50 transition-all">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-base">{s.emoji}</span>
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{s.label}</span>
                </div>
                <div className="text-lg sm:text-xl font-bold text-white">KSh {s.amount.toLocaleString()}</div>
                <div className="flex items-center gap-1 mt-1.5">
                  <ShoppingCart size={11} className="text-emerald-400" />
                  <span className="text-xs text-emerald-400 font-semibold">{s.count} sales</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl bg-gray-900/80 border border-gray-800 p-6">
            <NoPermission section="Sales" />
          </div>
        )}

        {/* Chart + today's activity */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">

          {/* Bar chart */}
          <div className="lg:col-span-2 rounded-2xl bg-gray-900/80 border border-gray-800 p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-5">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Activity size={16} className="text-emerald-400" /> Performance — Last 12 Months
              </h2>
              {(canSales || canFinance) && (
                <div className="flex gap-1 bg-gray-800 rounded-xl p-1 flex-wrap">
                  {chartOptions.map(v => {
                    const active = chartView === v.key;
                    const cls =
                      v.key === "expenses" ? "bg-rose-600 text-white"  :
                      v.key === "profit"   ? "bg-amber-600 text-white" : "bg-emerald-600 text-white";
                    return (
                      <button key={v.key} onClick={() => setChartView(v.key)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${active ? cls : "text-gray-500 hover:text-gray-300"}`}>
                        {v.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            {(canSales || canFinance)
              ? <BarChart data={monthlyData} view={chartView} />
              : <NoPermission section="Sales / Finance" />}
          </div>

          {/* Today's activity */}
          <div className="rounded-2xl bg-gray-900/80 border border-gray-800 p-5">
            <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <Zap size={15} className="text-amber-400" /> Today&apos;s Activity
            </h2>
            <div className="space-y-2.5">
              {[
                { label: "Sales Revenue",  value: canSales   ? `KSh ${stats.sales.today.amount.toLocaleString()}`    : null, icon: <TrendingUp   size={14} />, cls: "text-emerald-400", bg: "bg-emerald-900/30" },
                { label: "Expenses",       value: canFinance ? `KSh ${stats.expenses.today.amount.toLocaleString()}` : null, icon: <TrendingDown size={14} />, cls: "text-rose-400",    bg: "bg-rose-900/30"    },
                { label: "Payments In",    value: canFinance ? `KSh ${stats.paymentsToday.amount.toLocaleString()}`  : null, icon: <CreditCard   size={14} />, cls: "text-sky-400",     bg: "bg-sky-900/30"     },
                { label: "Transactions",   value: canFinance ? `${stats.paymentsToday.count}`                        : null, icon: <Activity     size={14} />, cls: "text-amber-400",   bg: "bg-amber-900/30"   },
              ].map(item => (
                <div key={item.label}
                  className={`flex items-center gap-3 rounded-xl p-3 ${item.bg} ${item.value === null ? "opacity-40" : ""}`}>
                  <div className={item.cls}>{item.icon}</div>
                  <div className="flex-1 text-xs text-gray-400">{item.label}</div>
                  <div className={`text-sm font-bold ${item.cls}`}>
                    {item.value ?? <Lock size={12} />}
                  </div>
                </div>
              ))}
            </div>

            {/* Quick nav links */}
            <div className="mt-5 pt-4 border-t border-gray-800 grid grid-cols-2 gap-2">
              {[
                { label: "Sales",     href: `/${shopId}/sales/sold`,         ok: canSales,     icon: <ShoppingBag size={12} /> },
                { label: "Finance",   href: `/${shopId}/finance/payments`,   ok: canFinance,   icon: <BarChart3   size={12} /> },
                { label: "Inventory", href: `/${shopId}/inventory/products`, ok: canInventory, icon: <Package     size={12} /> },
                { label: "HR",        href: `/${shopId}/hr/staff`,           ok: canHR,        icon: <Users       size={12} /> },
              ].map(link => (
                link.ok
                  ? <Link key={link.label} href={link.href}
                      className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-white bg-gray-800/60 hover:bg-gray-700/60 rounded-xl px-3 py-2 transition-all">
                      {link.icon} {link.label} <ArrowUpRight size={10} className="ml-auto" />
                    </Link>
                  : <div key={link.label}
                      className="flex items-center gap-1.5 text-xs text-gray-700 bg-gray-800/20 rounded-xl px-3 py-2 cursor-not-allowed">
                      <Lock size={11} /> {link.label}
                    </div>
              ))}
            </div>
          </div>
        </div>

        {/* Wallet + payment methods */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">

          {/* Wallets */}
          <div className="rounded-2xl bg-gray-900/80 border border-gray-700/80 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Wallet size={15} className="text-emerald-400" /> Wallets
              </h2>
              {canFinance && (
                <Link href={`/${shopId}/finance/wallet`}
                  className="text-xs text-gray-500 hover:text-emerald-400 flex items-center gap-1 transition-colors">
                  Manage <ArrowUpRight size={12} />
                </Link>
              )}
            </div>
            {canFinance ? (
              <>
                <div className="space-y-3 mb-4">
                  {wallets.length === 0
                    ? <p className="text-xs text-gray-600 py-4 text-center">No wallets configured yet</p>
                    : wallets.map(w => {
                      const pct = stats.totalBalance > 0 ? (w.balance / stats.totalBalance) * 100 : 0;
                      return (
                        <div key={w.shopId} className="space-y-1.5">
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-400 font-semibold">{w.shopName}</span>
                            <span className="text-emerald-400 font-bold">KSh {w.balance.toLocaleString()}</span>
                          </div>
                          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all"
                              style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })
                  }
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-gray-800">
                  <span className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Total</span>
                  <span className="text-xl font-bold text-white">KSh {stats.totalBalance.toLocaleString()}</span>
                </div>
              </>
            ) : <NoPermission section="Finance" />}
          </div>

          {/* Payment methods */}
          <div className="rounded-2xl bg-gray-900/80 border border-gray-800 p-5">
            <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <ArrowRightLeft size={15} className="text-sky-400" /> Payment Methods
            </h2>
            {canSales ? (
              methodEntries.length === 0
                ? <div className="text-xs text-gray-600 text-center py-8">No recent sales data</div>
                : (
                  <div className="space-y-3">
                    {methodEntries.map(([method, amount]) => {
                      const pct      = methodTotal > 0 ? Math.round((amount / methodTotal) * 100) : 0;
                      const barColor = METHOD_BAR_COLOR[method] ?? "#6b7280";
                      const badgeCls = METHOD_COLORS[method]    ?? "bg-gray-800 text-gray-300";
                      return (
                        <div key={method} className="space-y-1.5">
                          <div className="flex justify-between items-center text-xs">
                            <span className={`capitalize font-semibold px-2 py-0.5 rounded-full ${badgeCls}`}>
                              {method.replace("_", " ")}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-gray-500">KSh {amount.toLocaleString()}</span>
                              <span className="text-white font-bold w-8 text-right">{pct}%</span>
                            </div>
                          </div>
                          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all"
                              style={{ width: `${pct}%`, backgroundColor: barColor }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )
            ) : <NoPermission section="Sales" />}
          </div>
        </div>

        {/* Shop list (admin multi-shop overview) */}
        {shops.length > 1 && !selectedShopName && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-sm font-bold text-gray-300 flex items-center gap-2">
                <Building2 size={15} className="text-sky-400" /> Your Shops
              </h2>
              <span className="text-xs bg-gray-800 text-gray-500 px-2 py-0.5 rounded-full">{shops.length}</span>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {shops.map(shop => (
                <Link key={shop.id} href={`/${shop.id}/dashboard`}
                  className="rounded-2xl bg-gray-900/80 border border-gray-800 p-4 hover:border-sky-800/50 hover:bg-gray-800/60 transition-all">
                  <div className="w-8 h-8 rounded-xl bg-sky-900/40 flex items-center justify-center mb-3">
                    <Building2 size={16} className="text-sky-400" />
                  </div>
                  <div className="text-sm font-bold text-white leading-tight truncate">{shop.name}</div>
                  <div className="text-xs text-gray-600 mt-0.5 truncate">{shop.location || "—"}</div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Recent activity: sales + expenses */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">

          {/* Recent sales */}
          <div className="rounded-2xl bg-gray-900/80 border border-gray-800 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <ShoppingCart size={15} className="text-emerald-400" /> Recent Sales
              </h2>
              {canSales && (
                <Link href={`/${shopId}/sales/sold`}
                  className="text-xs text-gray-500 hover:text-emerald-400 flex items-center gap-1 transition-colors">
                  View all <ArrowUpRight size={12} />
                </Link>
              )}
            </div>
            {canSales ? (
              <div className="divide-y divide-gray-800/60">
                {recentSales.length === 0
                  ? (
                    <div className="py-12 text-center text-gray-600 text-sm">
                      <ShoppingCart size={28} className="mx-auto mb-2 opacity-20" />
                      No recent sales
                    </div>
                  )
                  : recentSales.map(sale => {
                    const mCls = METHOD_COLORS[sale.method] ?? "bg-gray-800 text-gray-400";
                    return (
                      <div key={sale.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-800/30 transition-colors">
                        <div className="w-9 h-9 rounded-xl bg-emerald-900/30 flex items-center justify-center shrink-0">
                          <ShoppingCart size={15} className="text-emerald-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-white truncate">{sale.productName}</div>
                          <div className="text-xs text-gray-500 mt-0.5 flex flex-wrap items-center gap-1">
                            <span>{sale.shop}</span>
                            <span className="text-gray-700">·</span>
                            <span>{sale.time}</span>
                            <span className="text-gray-700">·</span>
                            <span>{sale.totalItems} item{sale.totalItems !== 1 ? "s" : ""}</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0 space-y-1">
                          <div className="text-sm font-bold text-emerald-400">KSh {sale.amount.toLocaleString()}</div>
                          <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${mCls}`}>{sale.method}</span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            ) : <NoPermission section="Sales" />}
          </div>

          {/* Recent expenses */}
          <div className="rounded-2xl bg-gray-900/80 border border-gray-800 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <TrendingDown size={15} className="text-rose-400" /> Recent Expenses
              </h2>
              {canFinance && (
                <Link href={`/${shopId}/finance/expenses`}
                  className="text-xs text-gray-500 hover:text-rose-400 flex items-center gap-1 transition-colors">
                  View all <ArrowUpRight size={12} />
                </Link>
              )}
            </div>
            {canFinance ? (
              <div className="divide-y divide-gray-800/60">
                {recentExpenses.length === 0
                  ? (
                    <div className="py-12 text-center text-gray-600 text-sm">
                      <DollarSign size={28} className="mx-auto mb-2 opacity-20" />
                      No recent expenses
                    </div>
                  )
                  : recentExpenses.map(exp => (
                    <div key={exp.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-800/30 transition-colors">
                      <div className="w-9 h-9 rounded-xl bg-rose-900/30 flex items-center justify-center shrink-0">
                        <DollarSign size={15} className="text-rose-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-white truncate">{exp.description}</div>
                        <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                          <span>{exp.shop}</span>
                          <span className="text-gray-700">·</span>
                          <span className="bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded text-xs">{exp.category}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0 space-y-1">
                        <div className="text-sm font-bold text-rose-400">KSh {exp.amount.toLocaleString()}</div>
                        <div className="text-xs text-gray-600">{exp.date}</div>
                      </div>
                    </div>
                  ))}
              </div>
            ) : <NoPermission section="Finance" />}
          </div>
        </div>

        {/* Staff advances — HR gated */}
        {canHR && (
          <div className="rounded-2xl bg-gray-900/80 border border-gray-800 p-5 max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Banknote size={15} className="text-violet-400" /> Staff Advances
              </h2>
              <Link href={`/${shopId}/hr/advance`}
                className="text-xs text-gray-500 hover:text-violet-400 flex items-center gap-1 transition-colors">
                View <ArrowUpRight size={12} />
              </Link>
            </div>
            <div className="flex flex-col gap-3">
              <div className="rounded-xl bg-violet-900/20 border border-violet-800/30 p-4 text-center">
                <div className="text-xs text-violet-300/60 uppercase tracking-wider mb-1">Total Advanced</div>
                <div className="text-2xl font-bold text-violet-300">KSh {stats.advances.amount.toLocaleString()}</div>
              </div>
              <div className="rounded-xl bg-gray-800/50 p-3 flex justify-between items-center">
                <span className="text-xs text-gray-400">Requests</span>
                <span className="text-sm font-bold text-white">{stats.advances.count}</span>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
