"use client";

import { signOut } from "next-auth/react";
import { Lock, CreditCard, LogOut, AlertTriangle } from "lucide-react";
import Link from "next/link";

interface Props {
  shopName:  string;
  userName:  string;
  isOwner?:  boolean;
  reason:    "demo" | "expired";
}

export default function SuspendedPage({ shopName, userName, isOwner, reason }: Props) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-orange-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-sm border-2 border-orange-200 max-w-md w-full p-10 text-center space-y-5">

        <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center mx-auto">
          <Lock className="w-8 h-8 text-orange-500" />
        </div>

        <div>
          <h1 className="text-xl font-black text-gray-900">Shop Access Restricted</h1>
          <p className="mt-2 text-sm text-gray-500 leading-relaxed">
            <span className="font-semibold text-gray-700">{shopName}</span>{" "}
            {reason === "expired"
              ? "subscription has expired."
              : "is on the free Demo plan."}
            {" "}
            {isOwner
              ? "Upgrade your subscription to restore full access for you and your staff."
              : "The shop owner needs to upgrade their plan to restore access."}
          </p>
        </div>

        <div className="flex items-start gap-2.5 bg-orange-50 border border-orange-100 rounded-xl px-4 py-3 text-left">
          <AlertTriangle size={14} className="text-orange-500 mt-0.5 shrink-0" />
          <p className="text-xs text-orange-700 font-medium leading-snug">
            {isOwner
              ? "Go to Billing and choose Demo+ or Pro to unlock all features."
              : "Owner should visit Settings → Billing to upgrade their plan."}
          </p>
        </div>

        {isOwner && (
          <Link
            href="/billing"
            className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold px-6 py-2.5 rounded-xl text-sm transition shadow-sm"
          >
            <CreditCard size={15} /> Pay Now
          </Link>
        )}

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
