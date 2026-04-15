"use client";

// Signs the user out after IDLE_MS of inactivity (no mouse, keyboard, touch,
// or scroll events). A warning toast appears 30 s before sign-out so the user
// can stay by moving the mouse.

import { useEffect, useRef, useCallback, useState } from "react";
import { signOut } from "next-auth/react";
import { AlertTriangle, X } from "lucide-react";

const IDLE_MS    = 3 * 60 * 1000;  // 3 minutes
const WARN_MS    = 30 * 1000;       // warn 30 s before sign-out
const EVENTS     = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"] as const;

export default function IdleTimer() {
  const idleRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warnRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [warn, setWarn] = useState(false);
  const [secs,  setSecs] = useState(30);
  const secsRef = useRef(30);
  const countRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimers = useCallback(() => {
    if (idleRef.current)  clearTimeout(idleRef.current);
    if (warnRef.current)  clearTimeout(warnRef.current);
    if (countRef.current) clearInterval(countRef.current);
  }, []);

  const startCountdown = useCallback(() => {
    secsRef.current = 30;
    setSecs(30);
    countRef.current = setInterval(() => {
      secsRef.current -= 1;
      setSecs(secsRef.current);
      if (secsRef.current <= 0) {
        if (countRef.current) clearInterval(countRef.current);
      }
    }, 1000);
  }, []);

  const reset = useCallback(() => {
    clearTimers();
    setWarn(false);

    warnRef.current = setTimeout(() => {
      setWarn(true);
      startCountdown();
    }, IDLE_MS - WARN_MS);

    idleRef.current = setTimeout(() => {
      signOut({ callbackUrl: "/" });
    }, IDLE_MS);
  }, [clearTimers, startCountdown]);

  // Dismiss warning & reset timer when user acknowledges
  const stayActive = useCallback(() => {
    setWarn(false);
    reset();
  }, [reset]);

  useEffect(() => {
    reset();
    EVENTS.forEach(ev => window.addEventListener(ev, reset, { passive: true }));
    return () => {
      clearTimers();
      EVENTS.forEach(ev => window.removeEventListener(ev, reset));
    };
  }, [reset, clearTimers]);

  if (!warn) return null;

  return (
    <div className="fixed inset-0 z-[99999] flex items-end justify-center pb-8 px-4 pointer-events-none">
      <div className="pointer-events-auto w-full max-w-sm bg-white border border-amber-200 rounded-2xl shadow-2xl px-5 py-4 flex items-start gap-3">
        <div className="mt-0.5 flex-shrink-0 w-9 h-9 rounded-full bg-amber-50 flex items-center justify-center">
          <AlertTriangle size={18} className="text-amber-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900">Session expiring soon</p>
          <p className="text-xs text-gray-500 mt-0.5">
            You&apos;ll be signed out due to inactivity in{" "}
            <span className="font-bold text-amber-600">{secs}s</span>.
          </p>
          <button
            onClick={stayActive}
            className="mt-2.5 w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2 rounded-xl transition"
          >
            Keep me signed in
          </button>
        </div>
        <button onClick={stayActive} className="text-gray-400 hover:text-gray-600 mt-0.5 flex-shrink-0">
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
