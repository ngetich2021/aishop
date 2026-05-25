"use client";

import { useState } from "react";
import { CreditCard, Store, BarChart3 } from "lucide-react";

interface SubPayment {
  id:        string;
  plan:      string;
  amount:    number;
  phone:     string;
  mpesaRef:  string;
  status:    string;
  createdAt: string;
  userName:  string;
  userEmail: string;
}

interface BillingLog {
  id:       string;
  shopName: string;
  amount:   number;
  type:     string;
  status:   string;
  reason:   string;
  billedAt: string;
}

interface PlanDist {
  demo:         number;
  demoPlusUsers: number;
  pro:          number;
}

interface MonthRevenue {
  label: string;
  total: number;
}

interface Props {
  subscriptionPayments: SubPayment[];
  shopBillingLogs:      BillingLog[];
  planDist:             PlanDist;
  monthlyRevenue:       MonthRevenue[];
}

type Tab = "subscriptions" | "shop_logs" | "overview";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric" });
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    completed: "bg-green-100 text-green-700 border-green-200",
    failed:    "bg-red-100 text-red-700 border-red-200",
    pending:   "bg-yellow-100 text-yellow-700 border-yellow-200",
    paid:      "bg-green-100 text-green-700 border-green-200",
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${map[status] ?? "bg-gray-100 text-gray-600 border-gray-200"}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function PlanBadge({ plan }: { plan: string }) {
  const map: Record<string, string> = {
    pro:       "bg-yellow-100 text-yellow-800 border-yellow-200",
    demo_plus: "bg-teal-100 text-teal-800 border-teal-200",
    demo:      "bg-gray-100 text-gray-600 border-gray-200",
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${map[plan] ?? map.demo}`}>
      {plan === "demo_plus" ? "Demo+" : plan.charAt(0).toUpperCase() + plan.slice(1)}
    </span>
  );
}

function TypeBadge({ type }: { type: string }) {
  const map: Record<string, string> = {
    creation:   "bg-blue-100 text-blue-700 border-blue-200",
    daily:      "bg-purple-100 text-purple-700 border-purple-200",
    suspension: "bg-orange-100 text-orange-700 border-orange-200",
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${map[type] ?? "bg-gray-100 text-gray-600 border-gray-200"}`}>
      {type.charAt(0).toUpperCase() + type.slice(1)}
    </span>
  );
}

export default function BillingView({ subscriptionPayments, shopBillingLogs, planDist, monthlyRevenue }: Props) {
  const [tab, setTab] = useState<Tab>("subscriptions");

  const totalRevenue = subscriptionPayments
    .filter(p => p.status === "completed")
    .reduce((sum, p) => sum + p.amount, 0);

  const maxMonthly = Math.max(...monthlyRevenue.map(m => m.total), 1);
  const planTotal  = planDist.demo + planDist.demoPlusUsers + planDist.pro;

  const TABS: { key: Tab; label: string; icon: typeof CreditCard }[] = [
    { key: "subscriptions", label: "Subscription Payments", icon: CreditCard },
    { key: "shop_logs",     label: "Shop Billing Logs",     icon: Store       },
    { key: "overview",      label: "Revenue Overview",      icon: BarChart3   },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Billing</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Total collected: <strong className="text-gray-700">KES {totalRevenue.toLocaleString()}</strong>
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-white rounded-xl border border-gray-200 shadow-sm w-fit">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              tab === t.key
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-gray-500 hover:bg-gray-50"
            }`}
          >
            <t.icon size={13} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Subscription Payments */}
      {tab === "subscriptions" && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100">
                  <th className="text-left px-5 py-3 font-medium">User</th>
                  <th className="text-left px-3 py-3 font-medium">Plan</th>
                  <th className="text-left px-3 py-3 font-medium">Amount</th>
                  <th className="text-left px-3 py-3 font-medium">M-Pesa Ref</th>
                  <th className="text-left px-3 py-3 font-medium">Phone</th>
                  <th className="text-left px-3 py-3 font-medium">Status</th>
                  <th className="text-left px-3 py-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {subscriptionPayments.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-8 text-gray-400 text-sm">No payments found</td></tr>
                )}
                {subscriptionPayments.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3">
                      <p className="font-medium text-gray-800 text-xs">{p.userName}</p>
                      <p className="text-gray-400 text-[0.65rem]">{p.userEmail}</p>
                    </td>
                    <td className="px-3 py-3"><PlanBadge plan={p.plan} /></td>
                    <td className="px-3 py-3 font-semibold text-gray-800 text-xs">KES {p.amount.toLocaleString()}</td>
                    <td className="px-3 py-3 text-xs font-mono text-gray-500">{p.mpesaRef || "—"}</td>
                    <td className="px-3 py-3 text-xs text-gray-600">{p.phone || "—"}</td>
                    <td className="px-3 py-3"><StatusBadge status={p.status} /></td>
                    <td className="px-3 py-3 text-xs text-gray-400">{fmtDate(p.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Shop Billing Logs */}
      {tab === "shop_logs" && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100">
                  <th className="text-left px-5 py-3 font-medium">Shop</th>
                  <th className="text-left px-3 py-3 font-medium">Amount</th>
                  <th className="text-left px-3 py-3 font-medium">Type</th>
                  <th className="text-left px-3 py-3 font-medium">Status</th>
                  <th className="text-left px-3 py-3 font-medium">Reason</th>
                  <th className="text-left px-3 py-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {shopBillingLogs.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-8 text-gray-400 text-sm">No billing logs found</td></tr>
                )}
                {shopBillingLogs.map(l => (
                  <tr key={l.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3">
                      <p className="font-medium text-gray-800 text-xs">{l.shopName}</p>
                    </td>
                    <td className="px-3 py-3 font-semibold text-gray-800 text-xs">KES {l.amount.toLocaleString()}</td>
                    <td className="px-3 py-3"><TypeBadge type={l.type} /></td>
                    <td className="px-3 py-3"><StatusBadge status={l.status} /></td>
                    <td className="px-3 py-3 text-xs text-gray-500">{l.reason || "—"}</td>
                    <td className="px-3 py-3 text-xs text-gray-400">{fmtDate(l.billedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Revenue Overview */}
      {tab === "overview" && (
        <div className="space-y-5">
          {/* Plan distribution */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-800 text-sm mb-4">Plan Distribution</h2>
            <div className="space-y-3">
              {[
                { label: "Pro",    count: planDist.pro,           color: "bg-yellow-400", pct: planTotal ? (planDist.pro / planTotal * 100) : 0 },
                { label: "Demo+",  count: planDist.demoPlusUsers, color: "bg-teal-400",   pct: planTotal ? (planDist.demoPlusUsers / planTotal * 100) : 0 },
                { label: "Demo",   count: planDist.demo,          color: "bg-gray-300",   pct: planTotal ? (planDist.demo / planTotal * 100) : 0 },
              ].map(row => (
                <div key={row.label} className="flex items-center gap-3">
                  <span className="text-xs font-medium text-gray-600 w-14">{row.label}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2.5">
                    <div className={`${row.color} h-2.5 rounded-full`} style={{ width: `${row.pct}%` }} />
                  </div>
                  <span className="text-xs text-gray-500 w-8 text-right">{row.count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Monthly revenue bars */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-800 text-sm mb-4">Monthly Revenue (Last 6 Months)</h2>
            <div className="flex items-end gap-3 h-32">
              {monthlyRevenue.map(m => (
                <div key={m.label} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[0.6rem] text-gray-500 font-medium">
                    {m.total > 0 ? `KES ${(m.total / 1000).toFixed(0)}K` : "—"}
                  </span>
                  <div className="w-full bg-gray-100 rounded-t-lg" style={{ height: "80px" }}>
                    <div
                      className="bg-indigo-500 rounded-t-lg w-full transition-all"
                      style={{ height: `${(m.total / maxMonthly) * 80}px` }}
                    />
                  </div>
                  <span className="text-[0.6rem] text-gray-400 text-center">{m.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
