"use client";

import { useState, useTransition } from "react";
import { X, Loader2, ShieldCheck, LayoutGrid, Shield, CheckCircle2, Circle, ChevronRight } from "lucide-react";
import { NAV_SECTIONS } from "@/lib/permissions";
import {
  assignDesignationAction,
  removeDesignationAction,
  saveAllowedRoutesAction,
  assignStaffRoleAction,
} from "./actions";

type RoleRecord = { id: string; name: string; description: string; allowedRoutes: string[] };

type Props = {
  shopId:       string;
  staffUserId:  string;
  staffName:    string;
  currentDesignation: string | null;
  currentRoutes:      string[];
  currentRole:        string;
  rolesList:    RoleRecord[];
  onClose:      () => void;
  onDone:       () => void;
};

type Tab = "designation" | "sections" | "tier";

const ROLE_TIERS = [
  { value: "staff",   label: "Staff",   color: "blue",  desc: "Standard staff — access controlled by designation/sections." },
  { value: "manager", label: "Manager", color: "violet", desc: "Manager — broad access to all sections, can edit staff." },
  { value: "admin",   label: "Admin",   color: "amber", desc: "Admin — full access, can manage shop and all staff." },
];

export default function AssignDesignationModal({
  shopId, staffUserId, staffName,
  currentDesignation, currentRoutes, currentRole,
  rolesList, onClose, onDone,
}: Props) {
  const [tab,         setTab]         = useState<Tab>("designation");
  const [selDesig,    setSelDesig]    = useState(currentDesignation ?? "");
  const [selRoutes,   setSelRoutes]   = useState<string[]>(currentRoutes);
  const [selRole,     setSelRole]     = useState(currentRole);
  const [error,       setError]       = useState("");
  const [isPending,   startTransition] = useTransition();

  // ── Designation tab ────────────────────────────────────────────────────────
  const previewRoutes = rolesList.find(r => r.name === selDesig)?.allowedRoutes ?? [];

  const handleAssign = () => {
    if (!selDesig) { setError("Select a designation first."); return; }
    setError("");
    startTransition(async () => {
      const res = await assignDesignationAction({ staffUserId, designation: selDesig, shopId });
      if (res.success) onDone(); else setError(res.error ?? "Failed");
    });
  };

  const handleRemove = () => {
    setError("");
    startTransition(async () => {
      const res = await removeDesignationAction({ staffUserId, shopId });
      if (res.success) { setSelDesig(""); onDone(); } else setError(res.error ?? "Failed");
    });
  };

  // ── Sections tab ──────────────────────────────────────────────────────────
  const toggleSection = (prefix: string) => {
    setSelRoutes(prev =>
      prev.includes(prefix) ? prev.filter(r => r !== prefix) : [...prev, prefix]
    );
  };

  const handleSaveSections = () => {
    setError("");
    startTransition(async () => {
      const res = await saveAllowedRoutesAction({ staffUserId, allowedRoutes: selRoutes, shopId });
      if (res.success) onDone(); else setError(res.error ?? "Failed");
    });
  };

  // ── Role tier tab ─────────────────────────────────────────────────────────
  const handleSaveRole = () => {
    setError("");
    startTransition(async () => {
      const res = await assignStaffRoleAction({ staffUserId, roleName: selRole, shopId });
      if (res.success) onDone(); else setError(res.error ?? "Failed");
    });
  };

  return (
    <div className="fixed inset-0 z-[300] bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b bg-gradient-to-r from-indigo-50 to-white shrink-0">
          <div>
            <h2 className="font-bold text-gray-900 flex items-center gap-2">
              <ShieldCheck size={16} className="text-indigo-600" /> Manage Access
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">{staffName}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b shrink-0">
          {([
            { id: "designation", icon: <ShieldCheck size={14} />, label: "Designation" },
            { id: "sections",    icon: <LayoutGrid size={14} />,  label: "Sections"    },
            { id: "tier",        icon: <Shield size={14} />,      label: "Role Tier"   },
          ] as { id: Tab; icon: React.ReactNode; label: string }[]).map(t => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setError(""); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-semibold transition-colors border-b-2 ${
                tab === t.id
                  ? "border-indigo-600 text-indigo-700 bg-indigo-50/60"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
            >
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">

          {/* ── Designation tab ───────────────────────────────────── */}
          {tab === "designation" && (
            <>
              {currentDesignation && (
                <div className="flex items-center justify-between bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-2.5 text-sm">
                  <span className="text-indigo-700 font-semibold">Current: {currentDesignation}</span>
                  <button
                    onClick={handleRemove}
                    disabled={isPending}
                    className="text-xs text-red-500 hover:text-red-700 font-semibold transition-colors flex items-center gap-1 disabled:opacity-50"
                  >
                    {isPending ? <Loader2 size={12} className="animate-spin" /> : null} Remove
                  </button>
                </div>
              )}

              {rolesList.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <ShieldCheck size={36} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No designations created yet.</p>
                  <p className="text-xs mt-1">Create designations in the Designations section below.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {rolesList.map(role => (
                    <label
                      key={role.id}
                      className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                        selDesig === role.name
                          ? "border-indigo-400 bg-indigo-50 shadow-sm"
                          : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      <input
                        type="radio" name="designation" value={role.name}
                        checked={selDesig === role.name}
                        onChange={() => setSelDesig(role.name)}
                        className="mt-0.5 accent-indigo-600"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-900 text-sm">{role.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{role.description}</p>
                        {role.allowedRoutes.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {role.allowedRoutes.map(r => {
                              const sec = NAV_SECTIONS.find(s => s.prefix === r);
                              return sec ? (
                                <span key={r} className="text-[0.6rem] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full font-semibold">
                                  {sec.emoji} {sec.label}
                                </span>
                              ) : null;
                            })}
                          </div>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              )}

              {selDesig && selDesig !== currentDesignation && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
                  <p className="font-semibold mb-1">This will also update their section access:</p>
                  <div className="flex flex-wrap gap-1">
                    {previewRoutes.length === 0
                      ? <span className="text-amber-500 italic">No sections</span>
                      : previewRoutes.map(r => {
                          const sec = NAV_SECTIONS.find(s => s.prefix === r);
                          return sec ? (
                            <span key={r} className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-full font-semibold">
                              {sec.emoji} {sec.label}
                            </span>
                          ) : null;
                        })
                    }
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── Sections tab ────────────────────────────────────── */}
          {tab === "sections" && (
            <>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Toggle section access</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelRoutes(NAV_SECTIONS.map(s => s.prefix))}
                    className="text-xs text-indigo-600 hover:underline font-semibold"
                  >All</button>
                  <span className="text-gray-300">|</span>
                  <button
                    onClick={() => setSelRoutes([])}
                    className="text-xs text-gray-500 hover:underline font-semibold"
                  >None</button>
                </div>
              </div>
              <div className="space-y-2">
                {NAV_SECTIONS.map(sec => {
                  const active = selRoutes.includes(sec.prefix);
                  return (
                    <button
                      key={sec.key}
                      onClick={() => toggleSection(sec.prefix)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all ${
                        active
                          ? "border-indigo-400 bg-indigo-50 shadow-sm"
                          : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      {active
                        ? <CheckCircle2 size={16} className="text-indigo-600 shrink-0" />
                        : <Circle       size={16} className="text-gray-300 shrink-0" />}
                      <span className="text-lg leading-none">{sec.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-bold ${active ? "text-indigo-700" : "text-gray-700"}`}>{sec.label}</p>
                        <p className="text-[0.7rem] text-gray-400">{sec.description}</p>
                      </div>
                      <ChevronRight size={14} className={`shrink-0 ${active ? "text-indigo-400" : "text-gray-300"}`} />
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-gray-400 pt-1">
                {selRoutes.length} of {NAV_SECTIONS.length} sections enabled
              </p>
            </>
          )}

          {/* ── Role tier tab ─────────────────────────────────── */}
          {tab === "tier" && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">System role tier</p>
              {ROLE_TIERS.map(rt => (
                <label
                  key={rt.value}
                  className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                    selRole === rt.value
                      ? "border-indigo-400 bg-indigo-50 shadow-sm"
                      : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  <input
                    type="radio" name="roleTier" value={rt.value}
                    checked={selRole === rt.value}
                    onChange={() => setSelRole(rt.value)}
                    className="mt-0.5 accent-indigo-600"
                  />
                  <div>
                    <p className="font-bold text-gray-900 text-sm capitalize">{rt.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{rt.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t shrink-0 flex gap-2 bg-gray-50">
          <button
            onClick={onClose}
            className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-xl text-sm font-semibold hover:bg-white transition-colors"
          >
            Cancel
          </button>
          <button
            disabled={isPending}
            onClick={tab === "designation" ? handleAssign : tab === "sections" ? handleSaveSections : handleSaveRole}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors"
          >
            {isPending ? <Loader2 size={15} className="animate-spin" /> : null}
            {tab === "designation" ? "Assign" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
