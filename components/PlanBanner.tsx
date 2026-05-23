"use client";

import Link from "next/link";
import { AlertTriangle, X, Zap } from "lucide-react";
import { useState } from "react";

interface Props {
  plan: string;
  planExpiry?: string;
}

export default function PlanBanner({ plan, planExpiry }: Props) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  if (plan === "pro") return null;

  const isExpired =
    plan === "demo_plus" && planExpiry && Date.now() > new Date(planExpiry).getTime();

  if (plan === "demo_plus" && !isExpired) return null;

  const message =
    isExpired
      ? "Your Demo+ plan has expired. Renew at /billing to resume data entry."
      : "Free Demo — full view access, no data entry. Upgrade to Demo+ (KES 50/24 h) or Pro to start adding records.";

  const urgent = plan === "demo" || isExpired;

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-[99999] flex items-center gap-3 px-4 py-2.5 text-sm font-semibold shadow-lg ${
        urgent
          ? "bg-amber-500 text-white"
          : "bg-blue-600 text-white"
      }`}
      style={{ paddingTop: "env(safe-area-inset-top, 10px)" }}
    >
      <AlertTriangle size={16} className="shrink-0" />
      <span className="flex-1 text-xs leading-snug">{message}</span>
      <Link
        href="/billing"
        className="shrink-0 flex items-center gap-1 bg-white text-amber-700 hover:bg-amber-50 font-black text-xs px-3 py-1.5 rounded-lg transition"
      >
        <Zap size={12} /> Upgrade Now
      </Link>
      <button onClick={() => setDismissed(true)} className="shrink-0 opacity-80 hover:opacity-100">
        <X size={15} />
      </button>
    </div>
  );
}
