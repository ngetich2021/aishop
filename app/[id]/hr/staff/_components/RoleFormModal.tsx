"use client";

import { useState, useTransition } from "react";
import { X, Loader2, ShieldCheck, CheckCircle2, Circle } from "lucide-react";
import { NAV_SECTIONS } from "@/lib/permissions";
import { saveRoleAction } from "./actions";

type RoleRecord = { id: string; name: string; description: string; allowedRoutes: string[] };

type Props = {
  shopId:   string;
  existing: RoleRecord | null;   // null → create mode
  onClose:  () => void;
  onDone:   () => void;
};

const RESERVED = new Set(["user", "staff", "admin", "owner", "manager"]);

export default function RoleFormModal({ shopId, existing, onClose, onDone }: Props) {
  const [name,        setName]        = useState(existing?.name        ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [routes,      setRoutes]      = useState<string[]>(existing?.allowedRoutes ?? []);
  const [error,       setError]       = useState("");
  const [isPending,   startTransition] = useTransition();

  const toggle = (prefix: string) =>
    setRoutes(prev => prev.includes(prefix) ? prev.filter(r => r !== prefix) : [...prev, prefix]);

  const handleSubmit = () => {
    setError("");
    if (!name.trim())        { setError("Name is required.");        return; }
    if (!description.trim()) { setError("Description is required."); return; }
    if (RESERVED.has(name.toLowerCase().trim())) {
      setError(`"${name}" is reserved and cannot be used as a designation name.`);
      return;
    }

    startTransition(async () => {
      const res = await saveRoleAction({
        roleId:        existing?.id,
        name:          name.trim(),
        description:   description.trim(),
        allowedRoutes: routes,
        shopId,
      });
      if (res.success) onDone(); else setError(res.error ?? "Failed");
    });
  };

  return (
    <div className="fixed inset-0 z-[400] bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b bg-gradient-to-r from-violet-50 to-white shrink-0">
          <div>
            <h2 className="font-bold text-gray-900 flex items-center gap-2">
              <ShieldCheck size={16} className="text-violet-600" />
              {existing ? "Edit Designation" : "New Designation"}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">Define a role template with section access</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Designation Name *</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Cashier, Store Manager, Accountant"
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-400"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Description *</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              placeholder="Brief description of this role's responsibilities"
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-400 resize-none"
            />
          </div>

          {/* Section picker */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Section Access</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setRoutes(NAV_SECTIONS.map(s => s.prefix))}
                  className="text-xs text-violet-600 hover:underline font-semibold"
                >All</button>
                <span className="text-gray-300">|</span>
                <button
                  onClick={() => setRoutes([])}
                  className="text-xs text-gray-400 hover:underline font-semibold"
                >None</button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {NAV_SECTIONS.map(sec => {
                const active = routes.includes(sec.prefix);
                return (
                  <button
                    key={sec.key}
                    onClick={() => toggle(sec.prefix)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left transition-all ${
                      active
                        ? "border-violet-400 bg-violet-50 shadow-sm"
                        : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    {active
                      ? <CheckCircle2 size={13} className="text-violet-600 shrink-0" />
                      : <Circle       size={13} className="text-gray-300 shrink-0" />}
                    <span className="text-sm leading-none">{sec.emoji}</span>
                    <span className={`text-xs font-semibold truncate ${active ? "text-violet-700" : "text-gray-600"}`}>
                      {sec.label}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="text-[0.7rem] text-gray-400 mt-2">
              {routes.length} section{routes.length !== 1 ? "s" : ""} selected
            </p>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>
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
            onClick={handleSubmit}
            disabled={isPending}
            className="flex-1 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300 text-white py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors"
          >
            {isPending ? <Loader2 size={15} className="animate-spin" /> : null}
            {existing ? "Save Changes" : "Create Designation"}
          </button>
        </div>
      </div>
    </div>
  );
}
