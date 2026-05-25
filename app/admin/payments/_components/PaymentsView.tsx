"use client";

import { useState, useMemo, useTransition } from "react";
import { Smartphone, CreditCard, CheckCircle } from "lucide-react";
import { markCallbackProcessed }              from "@/app/admin/_actions";

interface MpesaCallback {
  id:                string;
  checkoutRequestId: string;
  merchantRequestId: string;
  resultCode:        number;
  resultDesc:        string;
  mpesaReceiptNo:    string;
  amount:            number;
  phoneNumber:       string;
  processed:         boolean;
  createdAt:         string;
}

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

interface Props {
  mpesaCallbacks:      MpesaCallback[];
  subscriptionPayments: SubPayment[];
}

type Tab    = "callbacks" | "subscriptions";
type CbFilter = "all" | "processed" | "unprocessed";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    completed: "bg-green-100 text-green-700 border-green-200",
    failed:    "bg-red-100 text-red-700 border-red-200",
    pending:   "bg-yellow-100 text-yellow-700 border-yellow-200",
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

export default function PaymentsView({ mpesaCallbacks, subscriptionPayments }: Props) {
  const [tab,       setTab]       = useState<Tab>("callbacks");
  const [cbFilter,  setCbFilter]  = useState<CbFilter>("all");
  const [localCbs,  setLocalCbs]  = useState(mpesaCallbacks);
  const [feedback,  setFeedback]  = useState<{ ok: boolean; msg: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const filteredCbs = useMemo(() => {
    if (cbFilter === "processed")   return localCbs.filter(c => c.processed);
    if (cbFilter === "unprocessed") return localCbs.filter(c => !c.processed);
    return localCbs;
  }, [localCbs, cbFilter]);

  function handleMarkProcessed(id: string) {
    startTransition(async () => {
      try {
        await markCallbackProcessed(id);
        setLocalCbs(prev => prev.map(c => c.id === id ? { ...c, processed: true } : c));
        setFeedback({ ok: true, msg: "Marked as processed" });
      } catch {
        setFeedback({ ok: false, msg: "Failed to update" });
      }
      setTimeout(() => setFeedback(null), 2000);
    });
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Payments</h1>
        <p className="text-sm text-gray-500 mt-0.5">M-Pesa callbacks and subscription payments</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-white rounded-xl border border-gray-200 shadow-sm w-fit">
        {[
          { key: "callbacks",     label: "M-Pesa Callbacks",      icon: Smartphone  },
          { key: "subscriptions", label: "Subscription Payments",  icon: CreditCard  },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as Tab)}
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

      {/* Feedback */}
      {feedback && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${
          feedback.ok ? "bg-green-600 text-white" : "bg-red-600 text-white"
        }`}>
          {feedback.msg}
        </div>
      )}

      {/* M-Pesa Callbacks */}
      {tab === "callbacks" && (
        <div className="space-y-3">
          {/* Filter */}
          <div className="flex items-center gap-1 p-1 bg-white rounded-xl border border-gray-200 shadow-sm w-fit">
            {(["all", "processed", "unprocessed"] as CbFilter[]).map(f => (
              <button
                key={f}
                onClick={() => setCbFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize ${
                  cbFilter === f
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-gray-500 hover:bg-gray-50"
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100">
                    <th className="text-left px-5 py-3 font-medium">Checkout ID</th>
                    <th className="text-left px-3 py-3 font-medium">Receipt</th>
                    <th className="text-left px-3 py-3 font-medium">Amount</th>
                    <th className="text-left px-3 py-3 font-medium">Phone</th>
                    <th className="text-left px-3 py-3 font-medium">Result</th>
                    <th className="text-left px-3 py-3 font-medium">Processed</th>
                    <th className="text-left px-3 py-3 font-medium">Date</th>
                    <th className="text-right px-5 py-3 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredCbs.length === 0 && (
                    <tr><td colSpan={8} className="text-center py-8 text-gray-400 text-sm">No callbacks found</td></tr>
                  )}
                  {filteredCbs.map(c => (
                    <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3 text-xs font-mono text-gray-500 max-w-[160px] truncate">{c.checkoutRequestId}</td>
                      <td className="px-3 py-3 text-xs font-mono text-gray-700">{c.mpesaReceiptNo || "—"}</td>
                      <td className="px-3 py-3 text-xs font-semibold text-gray-800">
                        {c.amount > 0 ? `KES ${c.amount.toLocaleString()}` : "—"}
                      </td>
                      <td className="px-3 py-3 text-xs text-gray-600">{c.phoneNumber || "—"}</td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${
                          c.resultCode === 0
                            ? "bg-green-100 text-green-700 border-green-200"
                            : "bg-red-100 text-red-700 border-red-200"
                        }`}>
                          {c.resultCode === 0 ? "Success" : `Code ${c.resultCode}`}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${
                          c.processed
                            ? "bg-green-100 text-green-700 border-green-200"
                            : "bg-gray-100 text-gray-500 border-gray-200"
                        }`}>
                          {c.processed ? <><CheckCircle size={10} /> Yes</> : "No"}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs text-gray-400 whitespace-nowrap">{fmtDate(c.createdAt)}</td>
                      <td className="px-5 py-3 text-right">
                        {!c.processed && (
                          <button
                            onClick={() => handleMarkProcessed(c.id)}
                            disabled={isPending}
                            className="px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-semibold hover:bg-indigo-100 transition disabled:opacity-50"
                          >
                            Mark Processed
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

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
                    <td className="px-3 py-3 text-xs text-gray-400 whitespace-nowrap">{fmtDate(p.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
