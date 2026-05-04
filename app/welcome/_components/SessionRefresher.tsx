"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { Loader2 }    from "lucide-react";

// Refreshes the JWT then hard-navigates to target so the server re-reads
// the freshly written cookie (router.push reuses the RSC cache).
export default function SessionRefresher({ target }: { target: string }) {
  const { update } = useSession();

  useEffect(() => {
    update().then(() => {
      // Hard-navigate so the server re-reads the freshly written JWT cookie.
      // router.push reuses the RSC cache and may serve the stale render.
      window.location.href = target;
    });
  }, []); // eslint-disable-line

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 to-blue-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-gray-500">
        <Loader2 size={28} className="animate-spin text-blue-500" />
        <p className="text-sm font-medium">Loading your workspace…</p>
      </div>
    </div>
  );
}
