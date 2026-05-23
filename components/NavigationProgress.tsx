"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";

function Bar() {
  const pathname    = useSearchParams(); // eslint-disable-line @typescript-eslint/no-unused-vars
  const path        = usePathname();
  const [w, setW]   = useState(0);
  const [on, setOn] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const doneRef     = useRef(false);
  const prevPath    = useRef(path);

  function start() {
    if (doneRef.current) return;
    doneRef.current = false;
    setOn(true);
    setW(12);
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setW(p => {
        if (p >= 82) { clearInterval(intervalRef.current!); return 82; }
        return p + Math.random() * 9;
      });
    }, 280);
  }

  function finish() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setW(100);
    doneRef.current = true;
    setTimeout(() => { setOn(false); setW(0); doneRef.current = false; }, 350);
  }

  // Complete on route change
  useEffect(() => {
    if (prevPath.current !== path) {
      prevPath.current = path;
      finish();
    }
  }, [path]);

  // Start on link/button click
  useEffect(() => {
    function onClick(e: MouseEvent) {
      const anchor = (e.target as HTMLElement).closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = anchor.getAttribute("href") ?? "";
      if (!href.startsWith("/") && !href.startsWith(window.location.origin)) return;
      if (href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
      if (anchor.target === "_blank") return;
      const destPath = href.split("?")[0].split("#")[0];
      if (destPath === path) return;
      start();
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [path]);

  if (!on && w === 0) return null;

  return (
    <div
      className="fixed top-0 left-0 z-[999999] h-[3px] bg-indigo-500 transition-[width] duration-300 ease-out pointer-events-none"
      style={{
        width:      `${w}%`,
        opacity:    on ? 1 : 0,
        boxShadow:  "0 0 10px 2px rgba(99,102,241,0.55)",
        transition: `width 280ms ease-out, opacity 350ms ease`,
      }}
    />
  );
}

export default function NavigationProgress() {
  return (
    <Suspense fallback={null}>
      <Bar />
    </Suspense>
  );
}
