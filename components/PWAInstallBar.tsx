"use client";

import { useState, useEffect } from "react";
import { Download, Share2 } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function PWAInstallBar() {
  const [prompt, setPrompt]       = useState<BeforeInstallPromptEvent | null>(null);
  const [installing, setInstalling] = useState(false);
  const [installed, setInstalled]   = useState(false);
  const [shared, setShared]         = useState(false);

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setInstalled(true);
    }
    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setInstalled(true));
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function download() {
    if (prompt) {
      setInstalling(true);
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;
      setInstalling(false);
      if (outcome === "accepted") setInstalled(true);
    } else {
      // Fallback: open install instructions in a new tab / alert
      alert(
        "To install Kwenik on your device:\n\n" +
        "• Chrome / Android: tap the menu (⋮) → \"Add to Home Screen\"\n" +
        "• iPhone / iPad: tap the Share button in Safari → \"Add to Home Screen\"\n" +
        "• Desktop Chrome: click the ⊕ icon in the address bar"
      );
    }
  }

  async function share() {
    try {
      if (navigator.share) {
        await navigator.share({ title: "Kwenik", text: "Business management app", url: window.location.origin });
      } else {
        await navigator.clipboard.writeText(window.location.origin);
      }
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    } catch { /* cancelled */ }
  }

  if (installed) return null;

  return (
    <div className="flex gap-2">
      <button
        onClick={download}
        disabled={installing}
        className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white py-2.5 rounded-xl text-sm font-bold transition"
      >
        <Download size={15} />
        {installing ? "Installing…" : "Download App"}
      </button>

      <button
        onClick={share}
        title="Share app link"
        className="flex items-center justify-center gap-2 border border-gray-200 text-gray-600 hover:bg-gray-50 px-4 py-2.5 rounded-xl text-sm font-semibold transition"
      >
        <Share2 size={15} />
        {shared ? "Copied!" : "Share"}
      </button>
    </div>
  );
}
