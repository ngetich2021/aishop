"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { Loader2 }    from "lucide-react";

/**
 * Refreshes the JWT then hard-navigates to `target`.
 *
 * WHY hard-navigate: router.push reuses the RSC cache and may serve a stale
 * render.  window.location.href forces a full server round-trip so the freshly
 * written JWT cookie is always picked up.
 *
 * RESILIENCE: update() is a network request (POST /api/auth/session).
 * On slow connections or when the PWA is in the background, this request can
 * hang indefinitely — if we gate the navigation on update() completing, the
 * user gets stuck on "Loading workspace…" forever.
 *
 * Fix: we race update() against a 4-second fallback timer.  Whichever fires
 * first triggers the navigation.  The server-side [id]/layout reads role
 * directly from the DB, so a slightly-stale JWT is harmless — SessionSync
 * will fix it silently once the page renders.
 */
export default function SessionRefresher({ target }: { target: string }) {
  const { update } = useSession();

  useEffect(() => {
    let navigated = false;

    const go = () => {
      if (navigated) return;
      navigated = true;
      window.location.href = target;
    };

    // Hard ceiling: navigate after 4 s no matter what
    const fallback = setTimeout(go, 4000);

    // Best-effort JWT refresh — errors are silently ignored
    update()
      .catch(() => {})
      .finally(() => {
        clearTimeout(fallback);
        go();
      });

    return () => {
      navigated = true; // prevent navigation after unmount
      clearTimeout(fallback);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 to-blue-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-gray-500">
        <Loader2 size={28} className="animate-spin text-blue-500" />
        <p className="text-sm font-medium">Loading your workspace…</p>
      </div>
    </div>
  );
}
