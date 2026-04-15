"use client";

import React, { useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface LogUser {
  id: string; name: string; email: string; image: string | null;
}
interface LoginLog {
  id: string; userId: string; loginTime: string; lastSeen: string; duration: number; user: LogUser;
}
interface ActivityLog {
  id: string; userId: string; action: string; path: string; method: string; createdAt: string; user: LogUser;
}
interface Stats { totalSessions: number; longSessions: number; avgDuration: number; }
interface Props {
  activeShop: { name: string } | null;
  stats: Stats;
  logs: LoginLog[];
  activityLogs: ActivityLog[];
}

type Tier = "flash" | "short" | "medium" | "long";
type LoginFilter = "all" | Tier;
type Tab = "login" | "activity";

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
}

function formatDate(iso: string) {
  const date      = new Date(iso);
  const today     = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === today.toDateString())     return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function formatDuration(seconds: number): { label: string; tier: Tier } {
  if (!seconds) return { label: "—", tier: "flash" };
  if (seconds < 60) return { label: `${seconds}s`, tier: "flash" };
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60), s = seconds % 60;
    return { label: s > 0 ? `${m}m ${s}s` : `${m}m`, tier: "short" };
  }
  const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60);
  return { label: m > 0 ? `${h}h ${m}m` : `${h}h`, tier: h >= 3 ? "long" : "medium" };
}

function getInitials(name: string) {
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
}

const SHADES = ["#3f3f46", "#52525b", "#71717a", "#a1a1aa", "#d4d4d8", "#27272a", "#18181b"];
const DARK   = new Set(["#3f3f46", "#52525b", "#27272a", "#18181b"]);
const avatarBg = (id: string) => SHADES[id.charCodeAt(id.length - 1) % SHADES.length];
const avatarFg = (id: string) => DARK.has(avatarBg(id)) ? "#f4f4f5" : "#18181b";

const METHOD_STYLES: Record<string, string> = {
  GET:    "bg-zinc-100 text-zinc-600 border-zinc-200",
  POST:   "bg-zinc-800 text-zinc-100 border-zinc-800",
  PUT:    "bg-zinc-200 text-zinc-700 border-zinc-300",
  PATCH:  "bg-zinc-200 text-zinc-700 border-zinc-300",
  DELETE: "bg-zinc-900 text-zinc-50  border-zinc-900",
};
const methodStyle = (m: string) => METHOD_STYLES[m.toUpperCase()] ?? "bg-zinc-100 text-zinc-500 border-zinc-200";

// ── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({ user }: { user: LogUser }) {
  return (
    <div
      className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 overflow-hidden"
      style={{ background: avatarBg(user.id), color: avatarFg(user.id) }}
    >
      {user.image
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={user.image} alt={user.name} className="w-full h-full object-cover" />
        : getInitials(user.name)
      }
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function LogsClient({ activeShop, stats, logs, activityLogs }: Props) {
  const [tab, setTab]               = useState<Tab>("login");
  const [loginFilter, setLoginFilter] = useState<LoginFilter>("all");
  const [loginSearch, setLoginSearch] = useState("");
  const [activitySearch, setActivitySearch] = useState("");
  const [methodFilter, setMethodFilter]     = useState<string>("all");

  const filteredLogin = logs.filter(log => {
    const { tier } = formatDuration(log.duration);
    const q = loginSearch.toLowerCase();
    return (
      (loginFilter === "all" || tier === loginFilter) &&
      (q === "" || log.user.name.toLowerCase().includes(q) || log.user.email.toLowerCase().includes(q))
    );
  });

  const methods          = ["all", ...Array.from(new Set(activityLogs.map(a => a.method.toUpperCase())))];
  const filteredActivity = activityLogs.filter(a => {
    const q = activitySearch.toLowerCase();
    return (
      (methodFilter === "all" || a.method.toUpperCase() === methodFilter) &&
      (q === "" || a.user.name.toLowerCase().includes(q) || a.path.toLowerCase().includes(q) || a.action.toLowerCase().includes(q))
    );
  });

  const avgLabel = formatDuration(stats.avgDuration).label;

  return (
    <div className="p-4 md:p-6 lg:p-8 min-h-screen bg-zinc-100">

      {/* Header */}
      <div className="mb-6">
        <p className="text-[10px] tracking-[0.2em] uppercase text-zinc-400 mb-1 font-mono">system access records</p>
        <h1 className="font-black text-3xl md:text-4xl tracking-tight text-zinc-900 font-mono">
          Login<span className="text-zinc-400">_</span>Logs
        </h1>
        <p className="mt-1 text-xs text-zinc-400 font-mono tracking-wide">
          {activeShop?.name ?? "All Shops"} ·{" "}
          {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: "Total sessions", value: stats.totalSessions, dim: false },
          { label: "Long sessions",  value: stats.longSessions,  dim: true  },
          { label: "Avg duration",   value: avgLabel,             dim: true  },
        ].map(s => (
          <div key={s.label} className="bg-white border border-zinc-200 rounded-xl p-4 relative overflow-hidden shadow-sm">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-zinc-300 to-transparent" />
            <p className="text-[9px] tracking-[0.18em] uppercase text-zinc-400 mb-1 font-mono">{s.label}</p>
            <p className={`font-black text-2xl md:text-3xl font-mono tracking-tight ${s.dim ? "text-zinc-500" : "text-zinc-900"}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-white border border-zinc-200 rounded-xl p-1 w-fit shadow-sm">
        {([
          { key: "login",    label: "Login Sessions", count: logs.length },
          { key: "activity", label: "Activity",       count: activityLogs.length },
        ] as { key: Tab; label: string; count: number }[]).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-mono font-semibold tracking-wide transition-all ${
              tab === t.key ? "bg-zinc-900 text-zinc-50 shadow" : "text-zinc-400 hover:text-zinc-700"
            }`}
          >
            {t.label}
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${tab === t.key ? "bg-zinc-700 text-zinc-200" : "bg-zinc-100 text-zinc-400"}`}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* ══ LOGIN SESSIONS ══ */}
      {tab === "login" && (
        <>
          <div className="flex flex-wrap gap-2 mb-4 items-center">
            <input
              type="text"
              placeholder="search by name or email…"
              value={loginSearch}
              onChange={e => setLoginSearch(e.target.value)}
              className="flex-1 min-w-[180px] bg-white border border-zinc-200 rounded-lg px-3 py-2 text-xs font-mono text-zinc-900 placeholder-zinc-300 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 shadow-sm transition"
            />
            <div className="flex gap-1.5 flex-wrap">
              {(["all", "flash", "short", "medium", "long"] as LoginFilter[]).map(f => (
                <button key={f} onClick={() => setLoginFilter(f)}
                  className={`px-3 py-1.5 rounded-full text-[10px] font-mono tracking-widest uppercase border transition ${
                    loginFilter === f
                      ? "bg-zinc-900 text-zinc-50 border-zinc-900 font-bold shadow-md"
                      : "bg-white text-zinc-400 border-zinc-200 hover:text-zinc-600 hover:border-zinc-400"
                  }`}
                >{f}</button>
              ))}
            </div>
          </div>

          <p className="text-[11px] font-mono text-zinc-400 mb-3 tracking-wide">
            Showing <span className="text-zinc-600 font-bold">{filteredLogin.length}</span> of {logs.length} records
          </p>

          <div className="flex flex-col gap-2">
            {filteredLogin.length === 0 ? (
              <div className="text-center py-16 text-zinc-300 text-xs font-mono tracking-widest uppercase">No records found</div>
            ) : filteredLogin.map(log => {
              const dur = formatDuration(log.duration);
              return (
                <div key={log.id} className="bg-white border border-zinc-200 rounded-xl px-4 py-3.5 grid grid-cols-[auto_1fr_auto_auto] gap-x-4 gap-y-2 items-center shadow-sm hover:border-zinc-400 hover:shadow-md hover:translate-x-0.5 transition-all duration-150">
                  <Avatar user={log.user} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-zinc-900 truncate">{log.user.name}</p>
                    <p className="text-[10px] text-zinc-400 font-mono truncate">{log.user.email}</p>
                  </div>
                  <div className="text-right whitespace-nowrap hidden sm:block">
                    <p className="text-xs font-mono">
                      <span className="text-zinc-700 font-medium">{formatTime(log.loginTime)}</span>
                      <span className="text-zinc-300 mx-1.5">→</span>
                      <span className="text-zinc-400">{formatTime(log.lastSeen)}</span>
                    </p>
                    <p className="text-[9px] font-mono text-zinc-300 mt-0.5 tracking-widest uppercase">{formatDate(log.loginTime)}</p>
                  </div>
                  <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono font-medium tracking-wide whitespace-nowrap min-w-[60px] justify-center border ${
                    dur.tier === "flash"  ? "bg-zinc-50  text-zinc-400 border-zinc-200" :
                    dur.tier === "short"  ? "bg-zinc-100 text-zinc-600 border-zinc-300" :
                    dur.tier === "medium" ? "bg-zinc-200 text-zinc-700 border-zinc-300" :
                                           "bg-zinc-900 text-zinc-100 border-zinc-900"
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dur.tier === "long" ? "bg-zinc-500" : dur.tier === "medium" ? "bg-zinc-500" : dur.tier === "short" ? "bg-zinc-400" : "bg-zinc-300"}`} />
                    {dur.label}
                  </div>
                  <div className="col-span-4 sm:hidden text-[10px] font-mono text-zinc-400">
                    {formatTime(log.loginTime)}<span className="mx-1.5 text-zinc-300">→</span>{formatTime(log.lastSeen)}
                    <span className="ml-2 text-zinc-300 uppercase tracking-widest">{formatDate(log.loginTime)}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-8 pt-5 border-t border-zinc-200 flex gap-4 flex-wrap">
            {[
              { color: "#d4d4d8", label: "Flash  < 1 min" },
              { color: "#a1a1aa", label: "Short  1–60 min" },
              { color: "#71717a", label: "Medium  1–3 hrs" },
              { color: "#18181b", label: "Long  3+ hrs" },
            ].map((l, i) => (
              <div key={i} className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-400">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: l.color }} />{l.label}
              </div>
            ))}
          </div>
        </>
      )}

      {/* ══ ACTIVITY LOG ══ */}
      {tab === "activity" && (
        <>
          <div className="flex flex-wrap gap-2 mb-4 items-center">
            <input
              type="text"
              placeholder="search by name, path or action…"
              value={activitySearch}
              onChange={e => setActivitySearch(e.target.value)}
              className="flex-1 min-w-[180px] bg-white border border-zinc-200 rounded-lg px-3 py-2 text-xs font-mono text-zinc-900 placeholder-zinc-300 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 shadow-sm transition"
            />
            <div className="flex gap-1.5 flex-wrap">
              {methods.map(m => (
                <button key={m} onClick={() => setMethodFilter(m)}
                  className={`px-3 py-1.5 rounded-full text-[10px] font-mono tracking-widest uppercase border transition ${
                    methodFilter === m
                      ? "bg-zinc-900 text-zinc-50 border-zinc-900 font-bold shadow-md"
                      : "bg-white text-zinc-400 border-zinc-200 hover:text-zinc-600 hover:border-zinc-400"
                  }`}
                >{m}</button>
              ))}
            </div>
          </div>

          <p className="text-[11px] font-mono text-zinc-400 mb-3 tracking-wide">
            Showing <span className="text-zinc-600 font-bold">{filteredActivity.length}</span> of {activityLogs.length} events
          </p>

          <div className="flex flex-col gap-2">
            {filteredActivity.length === 0 ? (
              <div className="text-center py-16 text-zinc-300 text-xs font-mono tracking-widest uppercase">No activity found</div>
            ) : filteredActivity.map(a => (
              <div key={a.id} className="bg-white border border-zinc-200 rounded-xl px-4 py-3.5 grid grid-cols-[auto_1fr_auto_auto] gap-x-4 gap-y-2 items-center shadow-sm hover:border-zinc-400 hover:shadow-md hover:translate-x-0.5 transition-all duration-150">
                <Avatar user={a.user} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-zinc-900 truncate">{a.user.name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
                    <span className="text-[10px] font-mono text-zinc-500 truncate">{a.action}</span>
                    <span className="text-zinc-300 text-[10px]">·</span>
                    <span className="text-[10px] font-mono text-zinc-400 truncate">{a.path}</span>
                  </div>
                </div>
                <div className="text-right whitespace-nowrap hidden sm:block">
                  <p className="text-xs font-mono text-zinc-700 font-medium">{formatTime(a.createdAt)}</p>
                  <p className="text-[9px] font-mono text-zinc-300 mt-0.5 tracking-widest uppercase">{formatDate(a.createdAt)}</p>
                </div>
                <div className={`inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-mono font-bold tracking-widest uppercase whitespace-nowrap border ${methodStyle(a.method)}`}>
                  {a.method.toUpperCase()}
                </div>
                <div className="col-span-4 sm:hidden text-[10px] font-mono text-zinc-400">
                  {formatTime(a.createdAt)}<span className="ml-2 text-zinc-300 uppercase tracking-widest">{formatDate(a.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 pt-5 border-t border-zinc-200 flex gap-4 flex-wrap">
            {[
              { m: "GET",    s: "bg-zinc-100 text-zinc-600 border-zinc-200" },
              { m: "POST",   s: "bg-zinc-800 text-zinc-100 border-zinc-800" },
              { m: "PUT",    s: "bg-zinc-200 text-zinc-700 border-zinc-300" },
              { m: "PATCH",  s: "bg-zinc-200 text-zinc-700 border-zinc-300" },
              { m: "DELETE", s: "bg-zinc-900 text-zinc-50  border-zinc-900" },
            ].map(l => (
              <div key={l.m} className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-mono font-bold tracking-widest border ${l.s}`}>{l.m}</div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
