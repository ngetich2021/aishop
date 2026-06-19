"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { Loader2 } from "lucide-react";

export const SignOutButton = () => {
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    await signOut({ callbackUrl: "/" });
  }

  return (
    <button
      onClick={handleSignOut}
      disabled={signingOut}
      className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-60 disabled:pointer-events-none transition"
    >
      {signingOut && <Loader2 size={14} className="animate-spin" />}
      {signingOut ? "Signing out…" : "Sign Out"}
    </button>
  );
};
