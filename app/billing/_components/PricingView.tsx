"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import {
  CheckCircle2, Zap, Crown, Eye, Clock, AlertTriangle,
  Phone, Loader2, X, ArrowRight, Star, RotateCcw, ShieldCheck,
  TrendingDown, Wallet, CalendarDays, History, Plus,
} from "lucide-react";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Payment {
  id:        string;
  plan:      string;
  amount:    number;
  mpesaRef:  string | null;
  phone:     string | null;
  createdAt: string;
}

interface Subscription {
  plan:            string;
  status:          string;
  expiresAt:       string | null;
  demoStartedAt:   string;
  proBalance:      number;
  proActivatedAt:  string | null;
  proLastBilledAt: string | null;
  payments:        Payment[];
}

interface Props {
  userId:          string | null;
  subscription:    Subscription | null;
  activeShopCount: number;
}

type PollStatus = "idle" | "polling" | "timedout" | "verifying" | "completed" | "failed";

const DEMO_LIMIT_MS  = 5 * 60 * 60 * 1000;
const POLL_TIMEOUT_S = 120;
const DEMO_PLUS_FEE  = 50;
const PRO_MIN_TOPUP  = 100;
const DAILY_RATE     = 30;
const LOW_BALANCE_DAYS = 5;

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-KE", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleDateString("en-KE", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function fmtDuration(ms: number) {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m} min`;
}

// ─── Payment form ─────────────────────────────────────────────────────────────

function PaymentForm({
  plan, userId, onSuccess, amountHint,
}: {
  plan:       "demo_plus" | "pro";
  userId:     string;
  onSuccess:  () => Promise<void>;
  amountHint?: string;
}) {
  const [phone,          setPhone]          = useState("");
  const [amount,         setAmount]         = useState("");
  const [loading,        setLoading]        = useState(false);
  const [error,          setError]          = useState<string | null>(null);
  const [pollStatus,     setPollStatus]     = useState<PollStatus>("idle");
  const [mpesaRef,       setMpesaRef]       = useState<string | null>(null);
  const [failReason,     setFailReason]     = useState<string | null>(null);
  const [receiptCode,    setReceiptCode]    = useState("");
  const [verifyLoading,  setVerifyLoading]  = useState(false);
  const [verifyError,    setVerifyError]    = useState<string | null>(null);
  const checkoutIdRef  = useRef<string | null>(null);
  const pollRef        = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const successCalled  = useRef(false);

  function stopAll() {
    if (pollRef.current)   clearInterval(pollRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    pollRef.current = timeoutRef.current = null;
  }

  useEffect(() => () => stopAll(), []);

  function startPolling(cid: string) {
    checkoutIdRef.current = cid;
    successCalled.current = false;
    setPollStatus("polling");

    timeoutRef.current = setTimeout(() => {
      stopAll();
      setPollStatus("timedout");
    }, POLL_TIMEOUT_S * 1000);

    async function doPoll() {
      try {
        const res  = await fetch(`/api/mpesa/status/${cid}`);
        const data = (await res.json()) as { status: string; mpesaRef?: string; reason?: string };
        if (data.status === "completed") {
          if (successCalled.current) return;
          successCalled.current = true;
          stopAll(); setMpesaRef(data.mpesaRef ?? null); setPollStatus("completed");
          await onSuccess();
        } else if (data.status === "failed") {
          stopAll(); setFailReason(data.reason ?? null); setPollStatus("failed");
        }
      } catch { /* keep polling */ }
    }

    // Poll immediately, then every 2 s
    doPoll();
    pollRef.current = setInterval(doPoll, 2000);
  }

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    if (pollStatus === "polling") return;
    setError(null); setLoading(true);
    try {
      const res  = await fetch("/api/mpesa/stk", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, plan, userId, ...(plan === "pro" ? { amount: Number(amount) } : {}) }),
      });
      const data = (await res.json()) as { success: boolean; checkoutRequestId?: string; message?: string };
      if (!data.success) { setError(data.message ?? "Failed to send M-Pesa prompt."); return; }
      if (data.checkoutRequestId) startPolling(data.checkoutRequestId);
    } catch { setError("Network error. Please try again."); }
    finally   { setLoading(false); }
  }

  async function handleVerify(e: React.SyntheticEvent) {
    e.preventDefault();
    if (!receiptCode.trim()) return;
    setVerifyError(null); setVerifyLoading(true);
    try {
      const res  = await fetch("/api/mpesa/verify", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiptCode: receiptCode.trim(), checkoutId: checkoutIdRef.current ?? undefined, userId, plan }),
      });
      const data = (await res.json()) as { success: boolean; mpesaRef?: string; error?: string };
      if (data.success) { setMpesaRef(data.mpesaRef ?? receiptCode.trim()); setPollStatus("completed"); await onSuccess(); }
      else { setVerifyError(data.error ?? "Could not verify. Check the code and try again."); }
    } catch { setVerifyError("Network error. Please try again."); }
    finally   { setVerifyLoading(false); }
  }

  if (pollStatus === "polling") {
    return (
      <div className="mt-4 space-y-3 text-center">
        <Loader2 size={32} className="mx-auto animate-spin text-orange-500" />
        <p className="text-sm font-semibold text-gray-700">Check your phone and enter your M-Pesa PIN…</p>
        <p className="text-xs text-gray-400">Waiting for confirmation from Safaricom</p>
        <button onClick={() => { stopAll(); setPollStatus("timedout"); }} className="text-xs text-gray-400 hover:text-gray-600 underline">
          I already paid — enter receipt code
        </button>
      </div>
    );
  }

  if (pollStatus === "timedout" || pollStatus === "verifying") {
    return (
      <div className="mt-4 space-y-3">
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-xs text-amber-800">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <p>Confirmation timed out. Enter your <strong>M-Pesa receipt code</strong> (e.g. <span className="font-mono">RCH1234XYZ</span>) to activate.</p>
        </div>
        <form onSubmit={handleVerify} className="space-y-2">
          {verifyError && <p className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-xl text-xs">{verifyError}</p>}
          <input type="text" required value={receiptCode} onChange={e => setReceiptCode(e.target.value.toUpperCase())}
            placeholder="e.g. RCH1234XYZ"
            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-mono uppercase focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition" />
          <button type="submit" disabled={verifyLoading}
            className="w-full flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white font-bold py-2.5 rounded-xl text-sm transition">
            {verifyLoading ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
            Verify Payment
          </button>
          <button type="button" onClick={() => { setPollStatus("idle"); setReceiptCode(""); setVerifyError(null); }}
            className="w-full text-xs text-gray-400 hover:text-gray-600 underline py-1">
            I didn&apos;t pay — send a new prompt
          </button>
        </form>
      </div>
    );
  }

  if (pollStatus === "completed") {
    return (
      <div className="mt-4 text-center space-y-2">
        <CheckCircle2 size={28} className="mx-auto text-emerald-500" />
        <p className="text-sm font-black text-emerald-700">Payment confirmed!</p>
        {mpesaRef && <p className="text-xs text-gray-500 font-mono">Ref: {mpesaRef}</p>}
        <p className="text-xs text-gray-400 animate-pulse">Updating your balance…</p>
      </div>
    );
  }

  if (pollStatus === "failed") {
    return (
      <div className="mt-4 space-y-2">
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-xs text-red-700">
          <AlertTriangle size={13} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Payment was cancelled or failed. No charge was made.</p>
            {failReason && <p className="mt-0.5 text-red-500 font-mono">{failReason}</p>}
          </div>
        </div>
        <button onClick={() => { setPollStatus("idle"); setFailReason(null); }}
          className="w-full flex items-center justify-center gap-2 text-xs font-semibold text-orange-600 hover:underline py-1">
          <RotateCcw size={12} /> Try again
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-3">
      {error && <p className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-xl text-xs">{error}</p>}
      {plan === "pro" && (
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
            Amount (KES)
          </label>
          <input type="number" required min={PRO_MIN_TOPUP} step={1} value={amount} onChange={e => setAmount(e.target.value)}
            placeholder={`Min KES ${PRO_MIN_TOPUP}`}
            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition" />
        </div>
      )}
      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
          <Phone size={11} /> M-Pesa Phone Number
        </label>
        <input type="tel" required value={phone} onChange={e => setPhone(e.target.value)} placeholder="07XXXXXXXX"
          className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition" />
      </div>
      <button type="submit" disabled={loading}
        className="w-full flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white font-bold py-3 rounded-xl text-sm transition">
        {loading
          ? <><Loader2 size={15} className="animate-spin" /> Sending prompt…</>
          : <>{amountHint ?? `Pay via M-Pesa`} <ArrowRight size={15} /></>}
      </button>
      <p className="text-center text-xs text-gray-400">
        {plan === "pro" ? `Min KES ${PRO_MIN_TOPUP} — KES ${DAILY_RATE}/shop/day, no creation fee` : "One-time payment · 2 shops · 24 hours"}
      </p>
    </form>
  );
}

// ─── Transaction History ──────────────────────────────────────────────────────

const PLAN_LABELS: Record<string, string> = {
  pro:       "Pro Top-up",
  demo_plus: "Demo+",
  demo:      "Demo",
};

function TransactionHistory({ payments }: { payments: Payment[] }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
        <History size={16} className="text-gray-500" />
        <p className="font-black text-sm text-gray-900">Transaction History</p>
        <span className="ml-auto text-xs text-gray-400">
          {payments.length} payment{payments.length !== 1 ? "s" : ""}
        </span>
      </div>
      {payments.length === 0 ? (
        <div className="px-5 py-8 text-center text-xs text-gray-400">No payments yet.</div>
      ) : (
        <div className="divide-y divide-gray-100">
          {payments.map((p, i) => (
            <div key={p.id} className="flex items-center gap-4 px-5 py-3.5">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                p.plan === "pro" ? "bg-orange-50" : "bg-blue-50"
              }`}>
                <Wallet size={14} className={p.plan === "pro" ? "text-orange-600" : "text-blue-600"} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-bold text-gray-900">KES {p.amount.toLocaleString()}</p>
                  <span className={`text-[0.65rem] font-bold px-2 py-0.5 rounded-full ${
                    p.plan === "pro" ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"
                  }`}>
                    {PLAN_LABELS[p.plan] ?? p.plan}
                  </span>
                  {i === 0 && (
                    <span className="text-[0.65rem] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Latest</span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-0.5">{fmtDateTime(p.createdAt)}</p>
                <div className="flex flex-wrap gap-2 mt-1">
                  {p.phone && (
                    <span className="text-xs font-mono text-gray-500 bg-gray-50 border border-gray-100 px-2 py-1 rounded-lg">
                      📱 {p.phone}
                    </span>
                  )}
                  {p.mpesaRef ? (
                    <span className="text-xs font-mono text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-1 rounded-lg font-bold">
                      M-Pesa: {p.mpesaRef}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400 bg-gray-50 border border-gray-100 px-2 py-1 rounded-lg">
                      Receipt pending — refresh to update
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Pro balance dashboard ────────────────────────────────────────────────────

function ProDashboard({
  subscription, userId, activeShopCount, onTopUpSuccess,
}: {
  subscription:    Subscription;
  userId:          string;
  activeShopCount: number;
  onTopUpSuccess:  () => Promise<void>;
}) {
  const [showTopUp, setShowTopUp] = useState(false);

  const balance       = subscription.proBalance ?? 0;
  const shopCount     = activeShopCount > 0 ? activeShopCount : 1;
  const effectiveRate = DAILY_RATE * Math.max(1, shopCount);
  const daysLeft      = Math.floor(balance / effectiveRate);
  const isLow         = daysLeft <= LOW_BALANCE_DAYS;
  const isSuspended = subscription.status === "suspended";
  const pct         = Math.min(100, (daysLeft / 30) * 100);

  const barColor = daysLeft <= 2 ? "bg-red-500" : daysLeft <= 5 ? "bg-amber-400" : "bg-emerald-500";
  const ringColor = daysLeft <= 2 ? "text-red-500" : daysLeft <= 5 ? "text-amber-500" : "text-emerald-500";

  async function handleTopUpSuccess() {
    setShowTopUp(false);
    await onTopUpSuccess();
  }

  return (
    <div className="space-y-5">

      {/* Suspended banner */}
      {isSuspended && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-300 rounded-2xl px-5 py-4 text-red-900">
          <AlertTriangle size={20} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-black text-sm">Pro plan suspended — balance depleted</p>
            <p className="text-xs mt-0.5">Top up your balance to reactivate full access.</p>
          </div>
        </div>
      )}

      {/* Low balance warning */}
      {!isSuspended && isLow && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-300 rounded-2xl px-5 py-4 text-amber-900">
          <AlertTriangle size={20} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-black text-sm">Low balance — {daysLeft} day{daysLeft !== 1 ? "s" : ""} remaining</p>
            <p className="text-xs mt-0.5">Top up now to avoid service interruption.</p>
          </div>
        </div>
      )}

      {/* Balance card */}
      <div className="bg-linear-to-br from-orange-600 to-orange-500 rounded-2xl p-6 text-white shadow-lg shadow-orange-200">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-orange-200">Pro Balance</p>
            <p className="text-5xl font-black mt-1">KES {balance.toLocaleString()}</p>
            <p className="text-sm text-orange-100 mt-1 flex items-center gap-1.5">
              <TrendingDown size={13} />
              KES {DAILY_RATE}/day per shop · {shopCount} active shop{shopCount !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold uppercase tracking-widest text-orange-200">Days Left</p>
            <p className={`text-4xl font-black mt-1 ${daysLeft <= 2 ? "text-red-200" : daysLeft <= 5 ? "text-yellow-200" : "text-white"}`}>
              {daysLeft}
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-5">
          <div className="h-2 bg-orange-400/40 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-700 ${barColor}`} style={{ width: `${pct}%` }} />
          </div>
          <div className="flex justify-between mt-1.5 text-xs text-orange-200">
            <span>0 days</span>
            <span>30 days</span>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 mt-5 pt-4 border-t border-orange-400/40">
          <div className="text-center">
            <p className="text-xs text-orange-200 font-semibold">Daily Rate</p>
            <p className="text-sm font-black mt-0.5">KES {DAILY_RATE}</p>
          </div>
          <div className="text-center border-x border-orange-400/40">
            <p className="text-xs text-orange-200 font-semibold">Expires</p>
            <p className="text-sm font-black mt-0.5">
              {daysLeft <= 0 ? "Today" : `~${daysLeft}d`}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-orange-200 font-semibold">Status</p>
            <p className={`text-sm font-black mt-0.5 ${isSuspended ? "text-red-200" : "text-emerald-200"}`}>
              {isSuspended ? "Suspended" : "Active"}
            </p>
          </div>
        </div>
      </div>

      {/* Days remaining visual */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CalendarDays size={16} className={ringColor} />
            <p className="font-black text-sm text-gray-900">Coverage Breakdown</p>
          </div>
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
            isSuspended ? "bg-red-100 text-red-700"
            : isLow     ? "bg-amber-100 text-amber-700"
            : "bg-emerald-100 text-emerald-700"
          }`}>
            {isSuspended ? "Suspended" : isLow ? "Low Balance" : "Healthy"}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Current balance", value: `KES ${balance.toLocaleString()}` },
            { label: "Daily per shop",  value: `KES ${DAILY_RATE} × ${shopCount} shop${shopCount !== 1 ? "s" : ""} = KES ${effectiveRate}` },
            { label: "Days covered",    value: `${daysLeft} day${daysLeft !== 1 ? "s" : ""}` },
            { label: "Last billed",     value: subscription.proLastBilledAt ? fmtDate(subscription.proLastBilledAt) : "Not yet" },
          ].map(({ label, value }) => (
            <div key={label} className="bg-gray-50 rounded-xl px-4 py-3">
              <p className="text-xs text-gray-500 font-semibold">{label}</p>
              <p className="text-sm font-black text-gray-900 mt-0.5">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Top-up section */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
        <button onClick={() => setShowTopUp(v => !v)}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-orange-100 rounded-xl flex items-center justify-center">
              <Plus size={16} className="text-orange-600" />
            </div>
            <div className="text-left">
              <p className="font-black text-sm text-gray-900">Top up balance</p>
              <p className="text-xs text-gray-500 mt-0.5">Add funds via M-Pesa to extend your coverage</p>
            </div>
          </div>
          <span className="text-gray-400 text-lg">{showTopUp ? "−" : "+"}</span>
        </button>
        {showTopUp && (
          <div className="px-5 pb-5 border-t border-gray-100">
            <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 mt-4 text-xs text-orange-800 space-y-1">
              <p className="font-bold">How top-ups work:</p>
              <p>• Full amount is credited to your balance instantly.</p>
              <p>• No shop creation fee — just KES {DAILY_RATE}/day per shop.</p>
              <p>• Each shop is billed KES {DAILY_RATE} on its first visit of the day.</p>
              <p>• Example: 3 shops visited today = KES {DAILY_RATE * 3} deducted.</p>
              <p>• Shops not visited that day are not charged.</p>
            </div>
            <PaymentForm plan="pro" userId={userId} onSuccess={handleTopUpSuccess} amountHint="Top up via M-Pesa" />
          </div>
        )}
      </div>

      <TransactionHistory payments={subscription.payments} />

    </div>
  );
}

// ─── Plan Card ────────────────────────────────────────────────────────────────

function PlanCard({
  title, price, description, features, note, icon, accentColor,
  isCurrent, isExpiredPlan, badge, paymentForm,
}: {
  title: string; price: string; description: string; features: string[];
  note?: string; icon: React.ReactNode; accentColor: string;
  isCurrent: boolean; isExpiredPlan?: boolean; badge?: string; paymentForm?: React.ReactNode;
}) {
  return (
    <div className={`relative bg-white rounded-2xl shadow-sm border-2 flex flex-col overflow-hidden transition ${
      isCurrent && !isExpiredPlan ? "border-orange-400 shadow-orange-100 shadow-md"
      : isCurrent ? "border-red-400 shadow-red-100 shadow-md"
      : "border-gray-200"
    }`}>
      {badge && (
        <div className="absolute top-3 right-3 text-xs font-black bg-orange-600 text-white px-2.5 py-1 rounded-full">
          {badge}
        </div>
      )}
      {isCurrent && !isExpiredPlan && (
        <div className="absolute top-3 left-3 text-xs font-black bg-emerald-600 text-white px-2.5 py-1 rounded-full">
          Current Plan
        </div>
      )}
      {isCurrent && isExpiredPlan && (
        <div className="absolute top-3 left-3 text-xs font-black bg-red-600 text-white px-2.5 py-1 rounded-full">
          EXPIRED
        </div>
      )}
      <div className={`px-6 pt-8 pb-4 ${isCurrent ? "pt-10" : ""}`}>
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${accentColor}`}>
          {icon}
        </div>
        <h3 className="text-xl font-black text-gray-900">{title}</h3>
        <p className="text-3xl font-black text-gray-900 mt-2">{price}</p>
        <p className="text-sm text-gray-500 mt-1">{description}</p>
      </div>
      <div className="px-6 pb-6 flex-1">
        <ul className="space-y-2.5">
          {features.map((f, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
              <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-500" />
              {f}
            </li>
          ))}
        </ul>
        {note && (
          <p className="mt-4 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
            {note}
          </p>
        )}
        {paymentForm}
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function PricingView({ userId, subscription, activeShopCount }: Props) {
  const { update } = useSession();
  const [paused,         setPaused]         = useState(false);
  const [expired,        setExpired]        = useState(false);
  const [returnTo,       setReturnTo]       = useState<string | null>(null);
  const [showRecover,    setShowRecover]    = useState(false);
  const [recoverCode,    setRecoverCode]    = useState("");
  const [recoverPlan,    setRecoverPlan]    = useState<"demo_plus" | "pro">("pro");
  const [recoverLoading, setRecoverLoading] = useState(false);
  const [recoverError,   setRecoverError]   = useState<string | null>(null);
  const [recoverDone,    setRecoverDone]    = useState(false);

  const [justPaid, setJustPaid] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setPaused(params.has("paused"));
    setExpired(params.has("expired"));
    setReturnTo(params.get("returnTo"));
    setJustPaid(params.has("paid"));
  }, []);

  const currentPlan     = subscription?.plan ?? "demo";
  const demoStartedAt   = subscription?.demoStartedAt ? new Date(subscription.demoStartedAt) : null;
  const demoElapsedMs   = demoStartedAt ? Date.now() - demoStartedAt.getTime() : DEMO_LIMIT_MS;
  const demoRemainingMs = Math.max(0, DEMO_LIMIT_MS - demoElapsedMs);
  const demoStillActive = currentPlan === "demo" && demoRemainingMs > 0;
  const demoPlusExpired = currentPlan === "demo_plus" && (
    !subscription?.expiresAt || new Date(subscription.expiresAt) <= new Date()
  );
  const isPro = currentPlan === "pro";

  const planIsActive =
    isPro ||
    (currentPlan === "demo_plus" && !demoPlusExpired) ||
    demoStillActive;

  async function handlePaymentSuccess() {
    await update();
    window.location.href = "/billing?paid=1";
  }

  async function handleProTopUpSuccess() {
    await update();
    window.location.reload();
  }

  async function handleRecover(e: React.SyntheticEvent) {
    e.preventDefault();
    if (!userId || !recoverCode.trim()) return;
    setRecoverError(null); setRecoverLoading(true);
    try {
      const res  = await fetch("/api/mpesa/verify", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiptCode: recoverCode.trim().toUpperCase(), userId, plan: recoverPlan }),
      });
      const data = (await res.json()) as { success: boolean; mpesaRef?: string; error?: string };
      if (data.success) { setRecoverDone(true); await handlePaymentSuccess(); }
      else { setRecoverError(data.error ?? "Could not verify. Check the code and try again."); }
    } catch { setRecoverError("Network error. Please try again."); }
    finally   { setRecoverLoading(false); }
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-50 to-orange-50 px-4 py-12">
      <div className="max-w-5xl mx-auto space-y-10">

        {/* Just-paid success banner */}
        {justPaid && (
          <div className="flex items-center gap-4 bg-emerald-600 text-white rounded-2xl px-5 py-4 shadow-md">
            <CheckCircle2 size={22} className="shrink-0" />
            <div className="flex-1">
              <p className="font-black text-sm">Payment successful — your plan is now active.</p>
              <p className="text-xs text-emerald-100 mt-0.5">Your transaction is recorded below.</p>
            </div>
            <Link href="/welcome"
              className="shrink-0 flex items-center gap-2 bg-white text-emerald-700 hover:bg-emerald-50 font-black text-sm px-5 py-2.5 rounded-xl transition">
              Go to App <ArrowRight size={15} />
            </Link>
          </div>
        )}

        {/* Active plan banner */}
        {planIsActive && !paused && !expired && !isPro && (
          <div className="flex items-center gap-4 bg-emerald-600 text-white rounded-2xl px-5 py-4 shadow-md">
            <CheckCircle2 size={22} className="shrink-0" />
            <div className="flex-1">
              <p className="font-black text-sm">
                {currentPlan === "demo_plus" ? "Demo+ active" : "Free demo active"}{" — your account is ready."}
              </p>
              <p className="text-xs text-emerald-100 mt-0.5">You can now access all your shops.</p>
            </div>
            <Link href={returnTo ?? "/welcome"}
              className="shrink-0 flex items-center gap-2 bg-white text-emerald-700 hover:bg-emerald-50 font-black text-sm px-5 py-2.5 rounded-xl transition">
              Go to App <ArrowRight size={15} />
            </Link>
          </div>
        )}

        {paused && (
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-300 rounded-2xl px-5 py-4 text-amber-900">
            <Clock size={20} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-black text-sm">Free demo ended</p>
              <p className="text-xs mt-0.5">Your 5-hour free demo has ended. Choose a plan below to keep using Kwenik.</p>
            </div>
            <button onClick={() => setPaused(false)} className="ml-auto text-amber-600 hover:text-amber-900"><X size={16} /></button>
          </div>
        )}

        {expired && (
          <div className="flex items-start gap-3 bg-red-50 border border-red-300 rounded-2xl px-5 py-4 text-red-900">
            <AlertTriangle size={20} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-black text-sm">Demo+ plan expired</p>
              <p className="text-xs mt-0.5">Your 24-hour Demo+ period has ended. Upgrade to Pro for permanent access.</p>
            </div>
            <button onClick={() => setExpired(false)} className="ml-auto text-red-600 hover:text-red-900"><X size={16} /></button>
          </div>
        )}

        {/* Recovery panel */}
        {userId && !recoverDone && !isPro && (
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
            <button onClick={() => setShowRecover(v => !v)}
              className="w-full flex items-center justify-between px-5 py-4 text-left">
              <div className="flex items-center gap-3">
                <ShieldCheck size={18} className="text-emerald-600 shrink-0" />
                <div>
                  <p className="font-black text-sm text-gray-900">Already paid? Activate your plan now</p>
                  <p className="text-xs text-gray-500 mt-0.5">M-Pesa was deducted but app didn&apos;t update? Enter your receipt code here.</p>
                </div>
              </div>
              <span className="text-gray-400 text-lg">{showRecover ? "−" : "+"}</span>
            </button>
            {showRecover && (
              <form onSubmit={handleRecover} className="px-5 pb-5 space-y-3 border-t border-gray-100 pt-4">
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">M-Pesa Receipt Code</label>
                    <input type="text" required value={recoverCode} onChange={e => setRecoverCode(e.target.value.toUpperCase())}
                      placeholder="e.g. RCH1234XYZ"
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-mono uppercase focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition" />
                  </div>
                  <div className="w-32">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">Plan</label>
                    <select value={recoverPlan} onChange={e => setRecoverPlan(e.target.value as "demo_plus" | "pro")}
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-emerald-400 transition">
                      <option value="pro">Pro</option>
                      <option value="demo_plus">Demo+</option>
                    </select>
                  </div>
                </div>
                {recoverError && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{recoverError}</p>}
                <button type="submit" disabled={recoverLoading}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold px-6 py-2.5 rounded-xl text-sm transition">
                  {recoverLoading ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                  Activate Plan
                </button>
                <p className="text-xs text-gray-400">The receipt code is in the M-Pesa SMS confirmation message you received.</p>
              </form>
            )}
          </div>
        )}

        {/* Demo time remaining */}
        {demoStillActive && !paused && (
          <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-2xl px-5 py-3.5 text-emerald-900">
            <Clock size={18} className="shrink-0" />
            <p className="flex-1 text-sm font-semibold">
              You still have <strong>{fmtDuration(demoRemainingMs)}</strong> left on your free demo.
            </p>
            <Link href={returnTo ?? "/welcome"}
              className="shrink-0 flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition">
              Continue <ArrowRight size={13} />
            </Link>
          </div>
        )}

        {/* Header */}
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-orange-600 bg-orange-50 border border-orange-200 px-3 py-1.5 rounded-full mb-4">
            <Star size={12} /> Kwenik Plans
          </span>
          <h1 className="text-4xl font-black text-gray-900">
            {isPro ? "Your Pro Dashboard" : "Choose your plan"}
          </h1>
          <p className="text-gray-500 mt-2 text-base max-w-xl mx-auto">
            {isPro
              ? "Monitor your balance, daily usage, and payment history."
              : "Start free with a 5-hour trial, extend with Demo+, or go Pro for your real business."}
          </p>
        </div>

        {/* Pro dashboard or plan cards */}
        {isPro && userId && subscription ? (
          <ProDashboard subscription={subscription} userId={userId} activeShopCount={activeShopCount} onTopUpSuccess={handleProTopUpSuccess} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">

            {/* Free Demo */}
            <PlanCard
              title="Free Demo" price="FREE" description="Try Kwenik at no cost"
              icon={<Eye size={22} className="text-gray-600" />} accentColor="bg-gray-100"
              isCurrent={currentPlan === "demo"}
              features={["Full app access","5-hour trial session","Create shops & add products","Record sales & expenses","No payment required"]}
              note={demoStillActive ? `You have ${fmtDuration(demoRemainingMs)} remaining on your free demo.` : "Your free demo has ended. Choose a paid plan to continue."}
              paymentForm={
                demoStillActive ? (
                  <Link href={returnTo ?? "/welcome"}
                    className="mt-4 w-full flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-900 text-white font-bold py-3 rounded-xl text-sm transition">
                    Back to App <ArrowRight size={14} />
                  </Link>
                ) : null
              }
            />

            {/* Demo+ */}
            <PlanCard
              title="Demo+" price="KES 50" description="2 shops · full access · 24 hours"
              icon={<Zap size={22} className="text-blue-600" />} accentColor="bg-blue-50"
              isCurrent={currentPlan === "demo_plus"} isExpiredPlan={demoPlusExpired} badge="Popular"
              features={[
                "Access up to 2 shops for 24 hours",
                "Full app — sales, expenses, products",
                "One-time KES 50 M-Pesa payment",
                "Re-subscribe anytime for a new 24-hour window",
              ]}
              note="Shop data is cleared on re-subscription. Upgrade to Pro to keep data permanently."
              paymentForm={
                (currentPlan !== "demo_plus" || demoPlusExpired) && userId ? (
                  <>
                    {demoPlusExpired && subscription?.expiresAt && (
                      <div className="mt-4 text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                        Expired: {fmtDate(subscription.expiresAt)}. Re-subscribe for a fresh 24-hour window.
                      </div>
                    )}
                    <PaymentForm plan="demo_plus" userId={userId} onSuccess={handlePaymentSuccess} amountHint={`Pay KES ${DEMO_PLUS_FEE} via M-Pesa`} />
                  </>
                ) : currentPlan === "demo_plus" && !demoPlusExpired && subscription?.expiresAt ? (
                  <div className="mt-4 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2">
                    Active until: {fmtDateTime(subscription.expiresAt)}
                  </div>
                ) : null
              }
            />

            {/* Pro */}
            <PlanCard
              title="Pro" price={`KES ${DAILY_RATE}/shop/day`} description="Unlimited shops · pay as you go"
              icon={<Crown size={22} className="text-orange-600" />} accentColor="bg-orange-50"
              isCurrent={isPro} badge="Best Value"
              features={[
                `No shop creation fee`,
                `KES ${DAILY_RATE}/day per shop — billed on first visit of the day`,
                "Shops not visited that day are not charged",
                `Top up any amount (min KES ${PRO_MIN_TOPUP}) via M-Pesa`,
                "Unlimited shops · full app access · no expiry",
                "Invite unlimited staff per shop",
              ]}
              note={`Deposit KES ${PRO_MIN_TOPUP}+. Each shop you visit costs KES ${DAILY_RATE} that day. 3 shops visited = KES ${DAILY_RATE * 3}/day.`}
              paymentForm={
                !isPro && userId ? (
                  <PaymentForm plan="pro" userId={userId} onSuccess={handlePaymentSuccess} amountHint="Activate Pro via M-Pesa" />
                ) : null
              }
            />
          </div>
        )}

        {!userId && (
          <div className="text-center bg-white rounded-2xl shadow-sm border border-gray-200 px-6 py-8">
            <p className="text-gray-600 text-sm mb-4">Sign in to purchase a plan and unlock full access.</p>
            <a href="/" className="inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white font-bold px-6 py-3 rounded-xl text-sm transition">
              Sign in with Google <ArrowRight size={15} />
            </a>
          </div>
        )}

        {/* Transaction history for all non-Pro users */}
        {!isPro && subscription && (
          <TransactionHistory payments={subscription.payments} />
        )}

        {/* FAQ */}
        {!isPro && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            {[
              { q: "What can I do on the free demo?", a: "Full access to all features for 5 hours with 1 shop — create products, record sales, and more. No payment needed." },
              { q: "What does Demo+ give me?", a: `KES ${DEMO_PLUS_FEE} unlocks 2 shops for 24 hours. Data is cleared on re-subscription. Upgrade to Pro to keep data permanently.` },
              { q: "How does Pro billing work?", a: `Top up any amount (min KES ${PRO_MIN_TOPUP}). No creation fee — each shop you visit costs KES ${DAILY_RATE} for that day. Shops not visited aren't charged.` },
            ].map((item, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4">
                <p className="font-black text-gray-900 mb-1.5">{item.q}</p>
                <p className="text-gray-500 text-xs">{item.a}</p>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
