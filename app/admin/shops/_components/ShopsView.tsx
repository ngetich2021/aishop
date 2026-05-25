"use client";

import { useState, useMemo, useTransition } from "react";
import { Search, Store, Package, Users, MoreVertical } from "lucide-react";
import { suspendShop, unsuspendShop } from "@/app/admin/_actions";

interface Shop {
  id:            string;
  name:          string;
  tel:           string;
  location:      string;
  createdAt:     string;
  ownerName:     string;
  ownerEmail:    string;
  plan:          string;
  billingStatus: string | null;
  dailyRate:     number | null;
  lastBilledAt:  string | null;
  productCount:  number;
  staffCount:    number;
  salesCount:    number;
}

interface Props { shops: Shop[] }

type Filter = "all" | "active" | "suspended" | "pro" | "demo_plus";

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric" });
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

function BillingBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-gray-400 text-xs">—</span>;
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${
      status === "active"
        ? "bg-green-100 text-green-700 border-green-200"
        : "bg-red-100 text-red-700 border-red-200"
    }`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all",       label: "All"       },
  { key: "active",    label: "Active"    },
  { key: "suspended", label: "Suspended" },
  { key: "pro",       label: "Pro"       },
  { key: "demo_plus", label: "Demo+"     },
];

export default function ShopsView({ shops }: Props) {
  const [search,    setSearch]    = useState("");
  const [filter,    setFilter]    = useState<Filter>("all");
  const [openMenu,  setOpenMenu]  = useState<string | null>(null);
  const [feedback,  setFeedback]  = useState<{ id: string; ok: boolean; msg: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return shops.filter(s => {
      const matchSearch = !q ||
        s.name.toLowerCase().includes(q) ||
        s.ownerName.toLowerCase().includes(q) ||
        s.location.toLowerCase().includes(q);

      const matchFilter =
        filter === "all"       ? true :
        filter === "active"    ? s.billingStatus === "active" :
        filter === "suspended" ? s.billingStatus === "suspended" :
        filter === "pro"       ? s.plan === "pro" :
        filter === "demo_plus" ? s.plan === "demo_plus" : true;

      return matchSearch && matchFilter;
    });
  }, [search, filter, shops]);

  function handleSuspend(shopId: string, suspend: boolean) {
    startTransition(async () => {
      try {
        await (suspend ? suspendShop(shopId) : unsuspendShop(shopId));
        setFeedback({ id: shopId, ok: true, msg: suspend ? "Shop suspended" : "Shop reactivated" });
      } catch {
        setFeedback({ id: shopId, ok: false, msg: "Action failed" });
      }
      setTimeout(() => setFeedback(null), 2500);
      setOpenMenu(null);
    });
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Shops</h1>
        <p className="text-sm text-gray-500 mt-0.5">{shops.length.toLocaleString()} total shops</p>
      </div>

      {/* Filter + Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-1 p-1 bg-white rounded-xl border border-gray-200 shadow-sm">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filter === f.key
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-gray-500 hover:bg-gray-50"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 sm:max-w-64">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search shops…"
            className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>
      </div>

      {/* Feedback toast */}
      {feedback && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${
          feedback.ok ? "bg-green-600 text-white" : "bg-red-600 text-white"
        }`}>
          {feedback.msg}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100">
                <th className="text-left px-5 py-3 font-medium">Shop</th>
                <th className="text-left px-3 py-3 font-medium">Owner</th>
                <th className="text-left px-3 py-3 font-medium">Location</th>
                <th className="text-left px-3 py-3 font-medium">Plan</th>
                <th className="text-left px-3 py-3 font-medium">Billing</th>
                <th className="text-left px-3 py-3 font-medium">Stats</th>
                <th className="text-left px-3 py-3 font-medium">Daily Rate</th>
                <th className="text-left px-3 py-3 font-medium">Created</th>
                <th className="text-right px-5 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center py-10 text-gray-400 text-sm">
                    No shops found
                  </td>
                </tr>
              )}
              {filtered.map(s => (
                <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                        <Store size={14} className="text-indigo-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800 text-xs">{s.name}</p>
                        <p className="text-gray-400 text-[0.65rem]">{s.tel}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <p className="text-gray-800 text-xs font-medium">{s.ownerName}</p>
                    <p className="text-gray-400 text-[0.65rem] truncate max-w-[120px]">{s.ownerEmail}</p>
                  </td>
                  <td className="px-3 py-3 text-gray-600 text-xs">{s.location}</td>
                  <td className="px-3 py-3"><PlanBadge plan={s.plan} /></td>
                  <td className="px-3 py-3"><BillingBadge status={s.billingStatus} /></td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span className="flex items-center gap-1"><Package size={11} />{s.productCount}</span>
                      <span className="flex items-center gap-1"><Users size={11} />{s.staffCount}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-gray-700 text-xs font-medium">
                    {s.dailyRate != null ? `KES ${s.dailyRate}` : "—"}
                  </td>
                  <td className="px-3 py-3 text-gray-400 text-xs">{fmtDate(s.createdAt)}</td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end">
                      <div className="relative">
                        <button
                          onClick={() => setOpenMenu(openMenu === s.id ? null : s.id)}
                          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition"
                          disabled={isPending}
                        >
                          <MoreVertical size={15} />
                        </button>
                        {openMenu === s.id && (
                          <div className="absolute right-0 top-full mt-1 w-40 bg-white rounded-xl shadow-lg border border-gray-100 z-20 py-1">
                            {s.billingStatus !== "suspended" ? (
                              <button
                                onClick={() => handleSuspend(s.id, true)}
                                className="w-full text-left px-4 py-2 text-xs text-red-600 hover:bg-red-50 transition"
                              >
                                Suspend Shop
                              </button>
                            ) : (
                              <button
                                onClick={() => handleSuspend(s.id, false)}
                                className="w-full text-left px-4 py-2 text-xs text-green-700 hover:bg-green-50 transition"
                              >
                                Unsuspend Shop
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50">
          <p className="text-xs text-gray-400">
            Showing {filtered.length} of {shops.length} shops
          </p>
        </div>
      </div>

      {openMenu && (
        <div className="fixed inset-0 z-10" onClick={() => setOpenMenu(null)} />
      )}
    </div>
  );
}
