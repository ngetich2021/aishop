"use client";

import {
  Users, Store, DollarSign, Star, TrendingUp, UserPlus,
  CheckCircle, XCircle, Activity, CreditCard,
} from "lucide-react";

interface Stats {
  totalUsers:       number;
  totalShops:       number;
  proUsers:         number;
  demoPlusUsers:    number;
  demoUsers:        number;
  totalRevenue:     number;
  revenueThisMonth: number;
  newUsersThisWeek: number;
  activeShops:      number;
  suspendedShops:   number;
}

interface RecentPayment {
  id:        string;
  phone:     string;
  amount:    number;
  plan:      string;
  mpesaRef:  string;
  createdAt: string;
  userName:  string;
  userEmail: string;
}

interface RecentUser {
  id:        string;
  name:      string;
  email:     string;
  role:      string;
  plan:      string;
  shopCount: number;
  createdAt: string;
}

interface MpesaCallback {
  id:                string;
  checkoutRequestId: string;
  resultCode:        number;
  mpesaReceiptNo:    string;
  amount:            number;
  phoneNumber:       string;
  processed:         boolean;
  createdAt:         string;
}

interface Props {
  stats:           Stats;
  recentPayments:  RecentPayment[];
  recentUsers:     RecentUser[];
  mpesaCallbacks:  MpesaCallback[];
}

function fmtKES(n: number) {
  return `KES ${n.toLocaleString()}`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-KE", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function PlanBadge({ plan }: { plan: string }) {
  const map: Record<string, string> = {
    pro:       "bg-yellow-100 text-yellow-800 border-yellow-200",
    demo_plus: "bg-teal-100 text-teal-800 border-teal-200",
    demo:      "bg-gray-100 text-gray-600 border-gray-200",
  };
  const cls = map[plan] ?? map.demo;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${cls}`}>
      {plan === "demo_plus" ? "Demo+" : plan.charAt(0).toUpperCase() + plan.slice(1)}
    </span>
  );
}

function RoleBadge({ role }: { role: string }) {
  const map: Record<string, string> = {
    system_admin: "bg-red-100 text-red-700 border-red-200",
    owner:        "bg-blue-100 text-blue-700 border-blue-200",
    manager:      "bg-yellow-100 text-yellow-700 border-yellow-200",
    staff:        "bg-green-100 text-green-700 border-green-200",
    user:         "bg-gray-100 text-gray-600 border-gray-200",
  };
  const cls = map[role] ?? map.user;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${cls} capitalize`}>
      {role.replace("_", " ")}
    </span>
  );
}

const STAT_CARDS = (s: Stats) => [
  {
    label:   "Total Users",
    value:   s.totalUsers.toLocaleString(),
    icon:    Users,
    color:   "bg-blue-500",
    bgLight: "bg-blue-50",
    border:  "border-l-blue-500",
  },
  {
    label:   "Total Shops",
    value:   s.totalShops.toLocaleString(),
    icon:    Store,
    color:   "bg-green-500",
    bgLight: "bg-green-50",
    border:  "border-l-green-500",
  },
  {
    label:   "Total Revenue",
    value:   fmtKES(s.totalRevenue),
    icon:    DollarSign,
    color:   "bg-yellow-500",
    bgLight: "bg-yellow-50",
    border:  "border-l-yellow-500",
    sub:     `${fmtKES(s.revenueThisMonth)} this month`,
  },
  {
    label:   "Pro Subscribers",
    value:   s.proUsers.toLocaleString(),
    icon:    Star,
    color:   "bg-purple-500",
    bgLight: "bg-purple-50",
    border:  "border-l-purple-500",
  },
  {
    label:   "Demo+ Subscribers",
    value:   s.demoPlusUsers.toLocaleString(),
    icon:    TrendingUp,
    color:   "bg-teal-500",
    bgLight: "bg-teal-50",
    border:  "border-l-teal-500",
  },
  {
    label:   "New Users (7d)",
    value:   s.newUsersThisWeek.toLocaleString(),
    icon:    UserPlus,
    color:   "bg-orange-500",
    bgLight: "bg-orange-50",
    border:  "border-l-orange-500",
  },
  {
    label:   "Active Shops",
    value:   s.activeShops.toLocaleString(),
    icon:    CheckCircle,
    color:   "bg-emerald-500",
    bgLight: "bg-emerald-50",
    border:  "border-l-emerald-500",
  },
  {
    label:   "Suspended Shops",
    value:   s.suspendedShops.toLocaleString(),
    icon:    XCircle,
    color:   "bg-red-500",
    bgLight: "bg-red-50",
    border:  "border-l-red-500",
  },
];

export default function AdminOverview({ stats, recentPayments, recentUsers, mpesaCallbacks }: Props) {
  const cards = STAT_CARDS(stats);
  const total  = stats.proUsers + stats.demoPlusUsers + stats.demoUsers;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard Overview</h1>
        <p className="text-sm text-gray-500 mt-0.5">System-wide metrics and recent activity</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(card => (
          <div
            key={card.label}
            className={`bg-white rounded-2xl shadow-sm border border-gray-100 border-l-4 ${card.border} p-4`}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-gray-500 font-medium">{card.label}</p>
                <p className="text-xl font-bold text-gray-900 mt-1">{card.value}</p>
                {card.sub && <p className="text-[0.7rem] text-gray-400 mt-0.5">{card.sub}</p>}
              </div>
              <div className={`w-9 h-9 rounded-xl ${card.color} flex items-center justify-center shrink-0`}>
                <card.icon size={17} className="text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Plan distribution */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Activity size={17} className="text-indigo-600" />
          <h2 className="font-semibold text-gray-800 text-sm">Plan Distribution</h2>
        </div>
        <div className="space-y-3">
          {[
            { label: "Pro",      count: stats.proUsers,      color: "bg-yellow-400", pct: total ? (stats.proUsers / total * 100) : 0 },
            { label: "Demo+",    count: stats.demoPlusUsers, color: "bg-teal-400",   pct: total ? (stats.demoPlusUsers / total * 100) : 0 },
            { label: "Demo",     count: stats.demoUsers,     color: "bg-gray-300",   pct: total ? (stats.demoUsers / total * 100) : 0 },
          ].map(row => (
            <div key={row.label} className="flex items-center gap-3">
              <span className="text-xs font-medium text-gray-600 w-12">{row.label}</span>
              <div className="flex-1 bg-gray-100 rounded-full h-2.5">
                <div
                  className={`${row.color} h-2.5 rounded-full transition-all`}
                  style={{ width: `${row.pct}%` }}
                />
              </div>
              <span className="text-xs text-gray-500 w-8 text-right">{row.count}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-3">Total: {total} subscriptions</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Recent Payments */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
            <CreditCard size={17} className="text-green-600" />
            <h2 className="font-semibold text-gray-800 text-sm">Recent Payments</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  <th className="text-left px-5 py-3 font-medium">User</th>
                  <th className="text-left px-3 py-3 font-medium">Plan</th>
                  <th className="text-left px-3 py-3 font-medium">Amount</th>
                  <th className="text-left px-3 py-3 font-medium">M-Pesa Ref</th>
                  <th className="text-left px-3 py-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recentPayments.length === 0 && (
                  <tr><td colSpan={5} className="text-center text-gray-400 py-6 text-xs">No payments yet</td></tr>
                )}
                {recentPayments.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3">
                      <p className="font-medium text-gray-800 text-xs">{p.userName}</p>
                      <p className="text-gray-400 text-[0.65rem]">{p.phone}</p>
                    </td>
                    <td className="px-3 py-3"><PlanBadge plan={p.plan} /></td>
                    <td className="px-3 py-3 font-semibold text-gray-800 text-xs">{fmtKES(p.amount)}</td>
                    <td className="px-3 py-3 text-gray-500 text-xs font-mono">{p.mpesaRef || "—"}</td>
                    <td className="px-3 py-3 text-gray-400 text-xs">{fmtDate(p.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Sign-ups */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
            <UserPlus size={17} className="text-blue-600" />
            <h2 className="font-semibold text-gray-800 text-sm">Recent Sign-ups</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  <th className="text-left px-5 py-3 font-medium">User</th>
                  <th className="text-left px-3 py-3 font-medium">Role</th>
                  <th className="text-left px-3 py-3 font-medium">Plan</th>
                  <th className="text-left px-3 py-3 font-medium">Shops</th>
                  <th className="text-left px-3 py-3 font-medium">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recentUsers.length === 0 && (
                  <tr><td colSpan={5} className="text-center text-gray-400 py-6 text-xs">No users yet</td></tr>
                )}
                {recentUsers.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3">
                      <p className="font-medium text-gray-800 text-xs">{u.name}</p>
                      <p className="text-gray-400 text-[0.65rem] truncate max-w-[140px]">{u.email}</p>
                    </td>
                    <td className="px-3 py-3"><RoleBadge role={u.role} /></td>
                    <td className="px-3 py-3"><PlanBadge plan={u.plan} /></td>
                    <td className="px-3 py-3 text-gray-600 text-xs font-medium">{u.shopCount}</td>
                    <td className="px-3 py-3 text-gray-400 text-xs">{fmtDate(u.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Recent M-Pesa Callbacks */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
          <Activity size={17} className="text-purple-600" />
          <h2 className="font-semibold text-gray-800 text-sm">Recent M-Pesa Callbacks</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <th className="text-left px-5 py-3 font-medium">Checkout ID</th>
                <th className="text-left px-3 py-3 font-medium">Receipt</th>
                <th className="text-left px-3 py-3 font-medium">Amount</th>
                <th className="text-left px-3 py-3 font-medium">Phone</th>
                <th className="text-left px-3 py-3 font-medium">Status</th>
                <th className="text-left px-3 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {mpesaCallbacks.length === 0 && (
                <tr><td colSpan={6} className="text-center text-gray-400 py-6 text-xs">No callbacks yet</td></tr>
              )}
              {mpesaCallbacks.map(c => (
                <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3 text-xs font-mono text-gray-500 truncate max-w-[160px]">{c.checkoutRequestId}</td>
                  <td className="px-3 py-3 text-xs font-mono text-gray-700">{c.mpesaReceiptNo || "—"}</td>
                  <td className="px-3 py-3 text-xs font-semibold text-gray-800">{fmtKES(c.amount)}</td>
                  <td className="px-3 py-3 text-xs text-gray-600">{c.phoneNumber}</td>
                  <td className="px-3 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                      c.resultCode === 0
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}>
                      {c.resultCode === 0 ? "Success" : `Code ${c.resultCode}`}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-xs text-gray-400">{fmtDate(c.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
