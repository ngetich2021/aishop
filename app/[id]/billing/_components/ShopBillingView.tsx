"use client";

import { useState, useTransition } from "react";
import {
  Wallet, CreditCard, Calendar, AlertTriangle, CheckCircle2,
  Clock, Mail, UserPlus, Trash2, X, ChevronDown, ChevronUp,
  TrendingDown, Building2, AlertCircle,
} from "lucide-react";
import { sendInviteAction, cancelInviteAction } from "../actions";

// ─── Types ────────────────────────────────────────────────────────────────────

interface BillingLog {
  id:       string;
  amount:   number;
  type:     string;
  status:   string;
  reason:   string | null;
  billedAt: string;
}

interface ShopBillingData {
  id:           string;
  status:       string;
  dailyRate:    number;
  creationFee:  number;
  lastBilledAt: string | null;
  history:      BillingLog[];
}

interface ShopData {
  id:            string;
  name:          string;
  location:      string;
  walletBalance: number;
  billing:       ShopBillingData | null;
}

interface Subscription {
  plan:          string;
  status:        string;
  expiresAt:     string | null;
  demoStartedAt: string;
}

interface Props {
  userId:       string;
  shops:        ShopData[];
  subscription: Subscription | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return `KES ${Math.round(n).toLocaleString()}`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-KE", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function daysUntilExhausted(balance: number, dailyRate: number): number | null {
  if (dailyRate <= 0) return null;
  return Math.floor(balance / dailyRate);
}

function planLabel(plan: string) {
  if (plan === "demo_plus") return "Demo+";
  if (plan === "pro")       return "Pro";
  return "Demo";
}

function planColor(plan: string) {
  if (plan === "pro")       return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (plan === "demo_plus") return "bg-blue-100 text-blue-800 border-blue-200";
  return "bg-gray-100 text-gray-700 border-gray-200";
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ msg, ok, onClose }: { msg: string; ok: boolean; onClose: () => void }) {
  return (
    <div className={`fixed bottom-6 right-6 z-[99999] flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl border text-sm font-semibold ${ok ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-red-50 border-red-200 text-red-700"}`}>
      {ok ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
      {msg}
      <button onClick={onClose} className="ml-2 opacity-60 hover:opacity-100"><X size={14} /></button>
    </div>
  );
}

// ─── Shop Card ────────────────────────────────────────────────────────────────

function ShopBillingCard({
  shop,
  onInvite,
}: {
  shop: ShopData;
  onInvite: (shopId: string) => void;
}) {
  const [showHistory, setShowHistory] = useState(false);
  const billing = shop.billing;
  const days    = billing ? daysUntilExhausted(shop.walletBalance, billing.dailyRate) : null;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center">
            <Building2 size={18} className="text-orange-600" />
          </div>
          <div>
            <p className="font-bold text-gray-900 text-sm">{shop.name}</p>
            <p className="text-xs text-gray-500">{shop.location}</p>
          </div>
        </div>
        {billing && (
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
            billing.status === "active"
              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : "bg-red-50 text-red-700 border-red-200"
          }`}>
            {billing.status === "active" ? "Active" : "Suspended"}
          </span>
        )}
        {!billing && (
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full border bg-gray-50 text-gray-600 border-gray-200">
            No billing
          </span>
        )}
      </div>

      {/* Stats */}
      <div className="px-5 py-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div>
          <p className="text-xs text-gray-500 mb-0.5">Wallet Balance</p>
          <p className="text-base font-black text-gray-900">{fmt(shop.walletBalance)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-0.5">Daily Rate</p>
          <p className="text-base font-black text-gray-900">{billing ? fmt(billing.dailyRate) : "—"}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-0.5">Last Billed</p>
          <p className="text-base font-black text-gray-900">
            {billing?.lastBilledAt ? fmtDate(billing.lastBilledAt) : "Never"}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-0.5">Days Left</p>
          <p className={`text-base font-black ${days !== null && days <= 3 ? "text-red-600" : "text-gray-900"}`}>
            {days !== null ? (days === 0 ? "< 1 day" : `${days} days`) : "—"}
          </p>
        </div>
      </div>

      {/* Low balance warning */}
      {days !== null && days <= 3 && billing?.status === "active" && (
        <div className="mx-5 mb-4 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>
            Wallet balance is low — the shop will be suspended in {days === 0 ? "less than 1 day" : `${days} day${days !== 1 ? "s" : ""}`} if not topped up.
          </span>
        </div>
      )}

      {/* Actions */}
      <div className="px-5 pb-4 flex gap-2 flex-wrap">
        <button
          onClick={() => onInvite(shop.id)}
          className="flex items-center gap-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-xl transition"
        >
          <UserPlus size={13} /> Invite Staff
        </button>
        {billing && billing.history.length > 0 && (
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-1.5 text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-xl transition"
          >
            {showHistory ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            Billing History
          </button>
        )}
      </div>

      {/* History */}
      {showHistory && billing && billing.history.length > 0 && (
        <div className="px-5 pb-5">
          <div className="rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold text-gray-600">Date</th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-600">Type</th>
                  <th className="text-right px-3 py-2 font-semibold text-gray-600">Amount</th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {billing.history.map((log) => (
                  <tr key={log.id} className="bg-white">
                    <td className="px-3 py-2 text-gray-700">{fmtDate(log.billedAt)}</td>
                    <td className="px-3 py-2 capitalize text-gray-700">{log.type}</td>
                    <td className="px-3 py-2 text-right font-semibold text-gray-900">{fmt(log.amount)}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold border ${
                        log.status === "paid"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-red-50 text-red-700 border-red-200"
                      }`}>
                        {log.status === "paid" ? <CheckCircle2 size={11} /> : <AlertTriangle size={11} />}
                        {log.status}
                      </span>
                    </td>
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

// ─── Invite Modal ─────────────────────────────────────────────────────────────

function InviteModal({
  shopId,
  shopName,
  onClose,
}: {
  shopId:   string;
  shopName: string;
  onClose:  () => void;
}) {
  const [email,     setEmail]     = useState("");
  const [role,      setRole]      = useState("staff");
  const [result,    setResult]    = useState<{ url?: string; error?: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);
    startTransition(async () => {
      const res = await sendInviteAction(shopId, email, role);
      if (res.success) {
        setResult({ url: res.inviteUrl });
      } else {
        setResult({ error: res.error ?? "Failed" });
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-gray-100">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-black text-gray-900 flex items-center gap-2">
            <UserPlus size={16} className="text-indigo-600" />
            Invite Staff — {shopName}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {result?.error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
              {result.error}
            </div>
          )}
          {result?.url ? (
            <div className="space-y-3">
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl text-sm">
                Invite created! Share this link:
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-mono text-gray-700 break-all select-all">
                {result.url}
              </div>
              <button
                type="button"
                onClick={() => { navigator.clipboard.writeText(result.url!); }}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-xl text-sm transition"
              >
                Copy Link
              </button>
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Mail size={12} /> Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="staff@example.com"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Role
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition"
                >
                  <option value="staff">Staff</option>
                  <option value="cashier">Cashier</option>
                  <option value="manager">Manager</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 rounded-xl text-sm transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold py-3 rounded-xl text-sm transition"
                >
                  {isPending ? "Sending…" : "Send Invite"}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ShopBillingView({ userId, shops, subscription }: Props) {
  const [inviteShopId, setInviteShopId] = useState<string | null>(null);
  const [toast,        setToast]        = useState<{ msg: string; ok: boolean } | null>(null);

  const inviteShop = shops.find((s) => s.id === inviteShopId);

  const totalWalletBalance = shops.reduce((sum, s) => sum + s.walletBalance, 0);
  const activeShops        = shops.filter((s) => s.billing?.status === "active").length;
  const suspendedShops     = shops.filter((s) => s.billing?.status === "suspended").length;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      {toast && (
        <Toast msg={toast.msg} ok={toast.ok} onClose={() => setToast(null)} />
      )}

      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-gray-900">Billing &amp; Subscription</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage your shop billing, wallet balances, and invite staff members.
        </p>
      </div>

      {/* Subscription badge */}
      {subscription && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 px-5 py-4 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center">
              <CreditCard size={18} className="text-orange-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Current Plan</p>
              <p className="font-black text-gray-900">{planLabel(subscription.plan)}</p>
            </div>
          </div>
          <span className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${planColor(subscription.plan)}`}>
            {planLabel(subscription.plan)}
          </span>
          {subscription.plan === "demo_plus" && subscription.expiresAt && (
            <div className="flex items-center gap-1.5 text-xs text-blue-700">
              <Clock size={13} />
              Expires: {fmtDate(subscription.expiresAt)}
            </div>
          )}
          {subscription.plan === "demo" && (
            <div className="flex items-center gap-1.5 text-xs text-gray-600">
              <Clock size={13} />
              30-minute sessions
            </div>
          )}
          <a
            href="/billing"
            className="ml-auto text-xs font-semibold bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-xl transition"
          >
            Upgrade Plan
          </a>
        </div>
      )}

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 px-5 py-4">
          <div className="flex items-center gap-2 mb-2">
            <Wallet size={16} className="text-emerald-600" />
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Wallet</p>
          </div>
          <p className="text-xl font-black text-gray-900">{fmt(totalWalletBalance)}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 px-5 py-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 size={16} className="text-emerald-600" />
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Active Shops</p>
          </div>
          <p className="text-xl font-black text-gray-900">{activeShops}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 px-5 py-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown size={16} className="text-red-500" />
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Suspended</p>
          </div>
          <p className="text-xl font-black text-gray-900">{suspendedShops}</p>
        </div>
      </div>

      {/* Per-shop cards */}
      {shops.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 px-6 py-12 text-center">
          <Building2 size={32} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 text-sm">You have no shops yet.</p>
          <a href={`/${userId}/shop`} className="mt-3 inline-block text-sm font-semibold text-orange-600 hover:underline">
            Create your first shop
          </a>
        </div>
      ) : (
        <div className="space-y-4">
          <h2 className="text-sm font-black text-gray-700 uppercase tracking-wider">
            Your Shops ({shops.length})
          </h2>
          {shops.map((shop) => (
            <ShopBillingCard
              key={shop.id}
              shop={shop}
              onInvite={(id) => setInviteShopId(id)}
            />
          ))}
        </div>
      )}

      {/* Invite modal */}
      {inviteShopId && inviteShop && (
        <InviteModal
          shopId={inviteShopId}
          shopName={inviteShop.name}
          onClose={() => setInviteShopId(null)}
        />
      )}

      {/* How billing works */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl px-5 py-4">
        <h3 className="text-sm font-black text-blue-900 mb-2 flex items-center gap-2">
          <Calendar size={15} /> How Billing Works
        </h3>
        <ul className="text-xs text-blue-800 space-y-1 list-disc list-inside">
          <li>Each shop is charged <strong>KES 30/day</strong> from its wallet balance.</li>
          <li>A one-time <strong>KES 100 creation fee</strong> is charged when a new shop is created (Pro plan).</li>
          <li>Top up your shop wallet via the <strong>Finance → Wallet</strong> section.</li>
          <li>If the wallet runs out, the shop is <strong>suspended</strong> until funds are added.</li>
        </ul>
      </div>
    </div>
  );
}
