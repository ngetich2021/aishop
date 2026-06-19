"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { Loader2, LogOut } from "lucide-react";

export default function WaitingPage({ userName }: { userName: string }) {
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    await signOut({ callbackUrl: "/" });
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 to-blue-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 max-w-md w-full p-10 text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center mx-auto">
          <svg className="w-7 h-7 text-blue-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
          </svg>
        </div>
        <h1 className="text-xl font-black text-gray-900">Waiting for shop access</h1>
        <p className="text-sm text-gray-500">
          You haven&apos;t been assigned to a shop yet. Ask your shop owner to send you an invite link.
        </p>
        <p className="text-xs text-gray-400">Signed in as <span className="font-semibold">{userName}</span></p>
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-red-600 transition disabled:opacity-60 disabled:pointer-events-none"
        >
          {signingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1" />
            </svg>
          )}
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
      </div>
    </div>
  );
}
