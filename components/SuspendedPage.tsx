"use client";

import { signOut } from "next-auth/react";
import { Lock, CreditCard, LogOut, AlertTriangle, ShieldOff, Layers } from "lucide-react";
import Link from "next/link";

type Reason = "demo" | "expired" | "unpaid" | "demo_limit";

interface Props {
  shopName:  string;
  userName:  string;
  isOwner?:  boolean;
  reason:    Reason;
  plan?:     string;
  error?:    string;
}

const CONFIG: Record<Reason, {
  icon:    React.ReactNode;
  title:   string;
  color:   string;
  ring:    string;
  iconBg:  string;
}> = {
  demo: {
    icon:   <Lock className="w-8 h-8 text-orange-500" />,
    title:  "Shop Access Restricted",
    color:  "border-orange-200",
    ring:   "bg-orange-100",
    iconBg: "bg-orange-100",
  },
  expired: {
    icon:   <ShieldOff className="w-8 h-8 text-red-500" />,
    title:  "Subscription Expired",
    color:  "border-red-200",
    ring:   "bg-red-50",
    iconBg: "bg-red-100",
  },
  unpaid: {
    icon:   <CreditCard className="w-8 h-8 text-amber-500" />,
    title:  "Shop Not Funded for Today",
    color:  "border-amber-200",
    ring:   "bg-amber-50",
    iconBg: "bg-amber-100",
  },
  demo_limit: {
    icon:   <Layers className="w-8 h-8 text-blue-500" />,
    title:  "Shop Limit Reached",
    color:  "border-blue-200",
    ring:   "bg-blue-50",
    iconBg: "bg-blue-100",
  },
};

export default function SuspendedPage({ shopName, userName, isOwner, reason, plan, error }: Props) {
  const cfg = CONFIG[reason];

  const body = (() => {
    switch (reason) {
      case "demo":
        return isOwner
          ? `"${shopName}" is on the free Demo plan. Upgrade to Demo+ (KES 50 / 24 h) or Pro to keep access.`
          : `"${shopName}" is on the free Demo plan. The shop owner needs to upgrade to restore access.`;

      case "expired":
        return isOwner
          ? `Your Demo+ subscription for "${shopName}" has expired. Re-subscribe or upgrade to Pro to continue.`
          : `The Demo+ subscription for "${shopName}" has expired. The shop owner needs to renew.`;

      case "unpaid":
        return isOwner
          ? `"${shopName}" hasn't been funded for today. Each shop costs KES 30/day — top up your Pro balance to unlock it.`
          : `"${shopName}" has no active funding for today. The shop owner needs to top up their Pro balance.`;

      case "demo_limit":
        const limit = plan === "demo" ? 1 : 2;
        return isOwner
          ? `Your ${plan === "demo" ? "Free Demo" : "Demo+"} plan only covers ${limit} shop${limit > 1 ? "s" : ""} (oldest first). "${shopName}" is beyond that limit — upgrade to Pro for unlimited shops at KES 30/day each.`
          : `"${shopName}" is beyond the owner's plan limit. The owner needs to upgrade to Pro.`;
    }
  })();

  const hint = (() => {
    switch (reason) {
      case "demo":        return "Upgrade to Demo+ (KES 50) for 24-hour access, or go Pro for unlimited, permanent access.";
      case "expired":     return "Choose Demo+ for another 24-hour window, or Pro for permanent access at KES 30/day per shop.";
      case "unpaid":      return error ?? "Top up your Pro balance at /billing. KES 30 is deducted per shop on first visit each day.";
      case "demo_limit":  return plan === "demo"
        ? "Free Demo supports 1 shop. Demo+ supports 2 shops. Pro gives you unlimited shops — each billed at KES 30/day."
        : "Demo+ supports 2 shops. Upgrade to Pro for unlimited shops — each billed independently at KES 30/day.";
    }
  })();

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 to-orange-50 flex items-center justify-center px-4">
      <div className={`bg-white rounded-2xl shadow-sm border-2 ${cfg.color} max-w-md w-full p-10 text-center space-y-5`}>

        <div className={`w-16 h-16 rounded-full ${cfg.iconBg} flex items-center justify-center mx-auto`}>
          {cfg.icon}
        </div>

        <div>
          <h1 className="text-xl font-black text-gray-900">{cfg.title}</h1>
          <p className="mt-2 text-sm text-gray-500 leading-relaxed">{body}</p>
        </div>

        <div className={`flex items-start gap-2.5 ${cfg.ring} border rounded-xl px-4 py-3 text-left`} style={{ borderColor: "inherit" }}>
          <AlertTriangle size={14} className="text-orange-500 mt-0.5 shrink-0" />
          <p className="text-xs text-gray-700 font-medium leading-snug">{hint}</p>
        </div>

        {isOwner && (
          <Link
            href="/billing"
            className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold px-6 py-2.5 rounded-xl text-sm transition shadow-sm"
          >
            <CreditCard size={15} />
            {reason === "unpaid" ? "Top Up Balance" : "Upgrade Plan"}
          </Link>
        )}

        {/* Plan capability summary */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-100 text-xs text-gray-500">
          {[
            { label: "Free Demo", detail: "1 shop · 5 h" },
            { label: "Demo+",     detail: "2 shops · 24 h · KES 50" },
            { label: "Pro",       detail: "Unlimited · KES 30/shop/day" },
          ].map(({ label, detail }) => (
            <div key={label} className="bg-gray-50 rounded-lg px-2 py-2">
              <p className="font-bold text-gray-700">{label}</p>
              <p className="mt-0.5 leading-tight">{detail}</p>
            </div>
          ))}
        </div>

        <p className="text-xs text-gray-400">
          Signed in as <span className="font-semibold">{userName}</span>
        </p>

        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="inline-flex items-center gap-2 text-sm font-semibold text-gray-400 hover:text-red-600 transition"
        >
          <LogOut size={14} /> Sign out
        </button>
      </div>
    </div>
  );
}
