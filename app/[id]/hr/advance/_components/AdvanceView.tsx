"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search, Plus, X, Loader2, MoreVertical, CheckCircle2,
  XCircle, Banknote, Clock, Users, TrendingDown, Send,
} from "lucide-react";
import { createPortal } from "react-dom";
import {
  requestAdvanceAction,
  createAdvanceForStaffAction,
  updateAdvanceStatusAction,
  deleteAdvanceAction,
} from "./actions";

type Advance = {
  id: string; staffId: string; staffName: string; baseSalary: number;
  amount: number; date: string; reason: string | null;
  status: string; transactionCode: string | null;
  shopId: string; shop: string; createdAt: string;
};
type StaffOption  = { id: string; fullName: string; baseSalary: number };
type ActiveShop   = { id: string; name: string; location: string };
type CurrentStaff = { id: string; fullName: string; baseSalary: number } | null;

type Props = {
  shopId: string;
  activeShop: ActiveShop;
  isStaff: boolean;
  isAdmin: boolean;
  isManager: boolean;
  currentStaff: CurrentStaff;
  stats: { totalAdvances: number; totalAdvance: number; pendingAdvance: number; approvedCount: number };
  advances: Advance[];
  staffList: StaffOption[];
};

type DDState = { id: string | null; top: number; left: number };

function usePortalDD() {
  const [dd, setDd] = useState<DDState>({ id: null, top: 0, left: 0 });
  const menuRef = useRef<HTMLDivElement | null>(null);
  const close = useCallback(() => setDd({ id: null, top: 0, left: 0 }), []);
  useEffect(() => {
    if (!dd.id) return;
    const h = (e: MouseEvent) => { if (menuRef.current?.contains(e.target as Node)) return; close(); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [dd.id, close]);
  const open = useCallback((id: string, e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (dd.id === id) { close(); return; }
    const r = e.currentTarget.getBoundingClientRect();
    const dw = 192, gap = 6, dh = menuRef.current?.offsetHeight ?? 180;
    let top = r.bottom + gap, left = r.right - dw;
    if (top + dh > window.innerHeight - gap) top = r.top - dh - gap;
    if (top < gap) top = gap;
    if (left < gap) left = gap;
    if (left + dw > window.innerWidth - gap) left = window.innerWidth - dw - gap;
    setDd({ id, top, left });
  }, [dd.id, close]);
  return { dd, open, close, menuRef };
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    requested: "bg-amber-50 text-amber-700 border-amber-200",
    approved:  "bg-blue-50 text-blue-700 border-blue-200",
    paid:      "bg-green-50 text-green-700 border-green-200",
    rejected:  "bg-red-50 text-red-700 border-red-200",
  };
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border capitalize ${map[status] ?? "bg-gray-100 text-gray-600 border-gray-200"}`}>
      {status === "paid"     && <CheckCircle2 size={10} />}
      {status === "rejected" && <XCircle size={10} />}
      {status}
    </span>
  );
}

// ── Staff-only: simple request form ──────────────────────────────────────────
function StaffAdvanceView({
  shopId, currentStaff, advances,
}: { shopId: string; currentStaff: CurrentStaff; advances: Advance[] }) {
  const router = useRouter();
  const [amount, setAmount]   = useState("");
  const [date, setDate]       = useState(new Date().toISOString().split("T")[0]);
  const [reason, setReason]   = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [success, setSuccess] = useState(false);

  const maxAdvance = currentStaff ? Math.floor(currentStaff.baseSalary * 0.30) : 0;

  const handleSubmit = async () => {
    setError(""); setSuccess(false);
    const amt = Number(amount);
    if (!amt || amt <= 0) { setError("Enter a valid amount."); return; }
    if (!date)            { setError("Select a date."); return; }
    setLoading(true);
    const res = await requestAdvanceAction(shopId, amt, date, reason);
    setLoading(false);
    if (res.success) {
      setSuccess(true);
      setAmount(""); setReason("");
      router.refresh();
    } else {
      setError(res.error ?? "Failed to submit request.");
    }
  };

  const myAdvances = advances.slice(0, 5);

  return (
    <div className="min-h-screen bg-slate-50/80 px-3 py-5 md:px-6">
      <div className="mx-auto max-w-lg space-y-5">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
            <Banknote size={24} className="text-indigo-600" /> Request Advance
          </h1>
          {currentStaff && (
            <p className="text-sm text-gray-500 mt-0.5">
              {currentStaff.fullName} · Salary: KSh {currentStaff.baseSalary.toLocaleString()} · Max advance: KSh {maxAdvance.toLocaleString()}
            </p>
          )}
        </div>

        {/* Request form */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
          <h2 className="font-bold text-gray-800 flex items-center gap-2">
            <Send size={16} className="text-indigo-500" /> New Request
          </h2>

          {success && (
            <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700 flex items-center gap-2">
              <CheckCircle2 size={16} /> Request submitted! Your manager will review it.
            </div>
          )}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Amount (KSh) <span className="text-gray-400 font-normal">— max KSh {maxAdvance.toLocaleString()}</span>
            </label>
            <input
              type="number" min={1} max={maxAdvance} value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder={`Up to KSh ${maxAdvance.toLocaleString()}`}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-400"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Date Needed</label>
            <input
              type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-400"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Reason <span className="text-gray-400 font-normal">(optional)</span></label>
            <textarea
              value={reason} onChange={e => setReason(e.target.value)}
              placeholder="e.g. Emergency, school fees, medical…"
              rows={2}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm resize-none outline-none focus:border-indigo-400"
            />
          </div>

          <button
            onClick={handleSubmit} disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={15} />}
            Submit Request
          </button>
        </div>

        {/* Own request history */}
        {myAdvances.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <h2 className="font-bold text-gray-800 text-sm">My Recent Requests</h2>
            </div>
            <div className="divide-y divide-gray-100">
              {myAdvances.map(adv => (
                <div key={adv.id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-indigo-700">KSh {adv.amount.toLocaleString()}</p>
                    <p className="text-xs text-gray-400">{adv.date}{adv.reason ? ` · ${adv.reason}` : ""}</p>
                  </div>
                  <StatusBadge status={adv.status} />
                </div>
              ))}
            </div>
          </div>
        )}

        {myAdvances.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 py-10 text-center">
            <Banknote size={32} className="mx-auto mb-2 text-gray-200" />
            <p className="text-sm text-gray-400">No advance requests yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Manager modal ─────────────────────────────────────────────────────────────
function AdvanceModal({
  shopId, isManager, staffList, currentStaff, onClose, onDone,
}: {
  shopId: string; isManager: boolean;
  staffList: StaffOption[]; currentStaff: CurrentStaff;
  onClose: () => void; onDone: () => void;
}) {
  const [staffId, setStaffId] = useState("");
  const [amount, setAmount]   = useState("");
  const [date, setDate]       = useState(new Date().toISOString().split("T")[0]);
  const [reason, setReason]   = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  const selectedStaff = staffList.find(s => s.id === staffId);
  const maxAdvance    = selectedStaff ? Math.floor(selectedStaff.baseSalary * 0.30) : null;

  const handleSubmit = async () => {
    setError("");
    const amt = Number(amount);
    if (!amt || amt <= 0)   { setError("Enter a valid amount."); return; }
    if (!date)              { setError("Select a date."); return; }
    if (!staffId)           { setError("Select a staff member."); return; }
    setLoading(true);
    const res = await createAdvanceForStaffAction(shopId, staffId, amt, date, reason);
    setLoading(false);
    if (res.success) onDone();
    else setError(res.error ?? "Failed");
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b bg-gradient-to-r from-indigo-50 to-white">
          <h2 className="font-bold text-gray-800">Create Advance</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Staff Member</label>
            <select value={staffId} onChange={e => setStaffId(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm bg-white outline-none focus:border-indigo-400">
              <option value="">Select staff…</option>
              {staffList.map(s => (
                <option key={s.id} value={s.id}>{s.fullName} (KSh {s.baseSalary.toLocaleString()})</option>
              ))}
            </select>
          </div>
          {maxAdvance !== null && (
            <p className="text-xs text-indigo-600 bg-indigo-50 rounded-lg px-3 py-2">
              Max 30% of salary: <strong>KSh {maxAdvance.toLocaleString()}</strong>
            </p>
          )}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Amount (KSh)</label>
            <input type="number" min={1} max={maxAdvance ?? undefined} value={amount} onChange={e => setAmount(e.target.value)}
              placeholder="Enter amount…"
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-400" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-400" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Reason <span className="text-gray-400 font-normal">(optional)</span></label>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2}
              placeholder="e.g. Emergency, school fees…"
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm resize-none outline-none focus:border-indigo-400" />
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>}
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors">Cancel</button>
            <button onClick={handleSubmit} disabled={loading}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors">
              {loading ? <Loader2 size={16} className="animate-spin" /> : "Create"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function AdvanceView({
  shopId, activeShop, isStaff, isAdmin, isManager, currentStaff,
  stats, advances, staffList,
}: Props) {
  const router = useRouter();
  const [search, setSearch]             = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showModal, setShowModal]       = useState(false);
  const [actioningId, setActioningId]   = useState<string | null>(null);
  const [mounted, setMounted]           = useState(false);
  useEffect(() => setMounted(true), []);

  const { dd, open, close, menuRef } = usePortalDD();
  const ddAdv = dd.id ? advances.find(a => a.id === dd.id) : null;

  // Staff get the simple form view
  if (isStaff && !isManager) {
    return <StaffAdvanceView shopId={shopId} currentStaff={currentStaff} advances={advances} />;
  }

  const handleStatus = async (id: string, status: string) => {
    close();
    setActioningId(id);
    const res = await updateAdvanceStatusAction(id, status);
    setActioningId(null);
    if (res.success) router.refresh();
    else alert(res.error ?? "Failed");
  };

  const handleDelete = async (id: string) => {
    close();
    if (!confirm("Delete this advance record?")) return;
    setActioningId(id);
    const res = await deleteAdvanceAction(id);
    setActioningId(null);
    if (res.success) router.refresh();
    else alert(res.error ?? "Delete failed");
  };

  const filtered = advances.filter(a => {
    const q = search.toLowerCase();
    const matchSearch = `${a.staffName} ${a.reason ?? ""} ${a.status}`.toLowerCase().includes(q);
    const matchStatus = statusFilter === "all" || a.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const STATUS_FILTERS = ["all", "requested", "approved", "paid", "rejected"];

  return (
    <>
      <style>{`
        @keyframes rowIn{from{opacity:0;transform:translateX(-5px)}to{opacity:1;transform:translateX(0)}}
        .adv-table tbody tr{animation:rowIn 0.18s ease both}
        @keyframes ddIn{from{opacity:0;transform:scale(0.95) translateY(-4px)}to{opacity:1;transform:scale(1) translateY(0)}}
        .dd-menu{animation:ddIn 0.12s ease both;transform-origin:top right}
      `}</style>

      <div className="min-h-screen bg-slate-50/80 px-3 py-5 md:px-6">
        <div className="mx-auto max-w-screen-2xl space-y-5">

          {/* Header */}
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
                <Banknote size={24} className="text-indigo-600" /> Advances
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">
                {activeShop.name}{activeShop.location && <span className="text-gray-400"> · {activeShop.location}</span>}
              </p>
            </div>
            <button onClick={() => setShowModal(true)}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-semibold text-sm shadow-sm transition-all">
              <Plus size={17} /> New Advance
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { icon: <Users size={16} className="text-indigo-600" />, label: "Total", value: stats.totalAdvances, sub: "advances", accent: "border-indigo-100" },
              { icon: <TrendingDown size={16} className="text-rose-600" />, label: "Total Amount", value: `KSh ${stats.totalAdvance.toLocaleString()}`, sub: "all time", accent: "border-rose-100" },
              { icon: <Clock size={16} className="text-amber-600" />, label: "Pending", value: `KSh ${stats.pendingAdvance.toLocaleString()}`, sub: "requested / approved", accent: "border-amber-100" },
              { icon: <CheckCircle2 size={16} className="text-green-600" />, label: "Approved", value: stats.approvedCount, sub: "advances", accent: "border-green-100" },
            ].map(s => (
              <div key={s.label} className={`bg-white rounded-2xl border p-4 shadow-xs ${s.accent}`}>
                <div className="flex items-center gap-2 mb-2">{s.icon}<span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{s.label}</span></div>
                <div className="text-2xl font-black text-gray-900">{s.value}</div>
                <div className="text-xs text-gray-400 mt-0.5">{s.sub}</div>
              </div>
            ))}
          </div>

          {/* Controls */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search by name, reason, status…"
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-300 text-sm outline-none focus:border-indigo-500 bg-white shadow-xs" />
              {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"><X size={14} /></button>}
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {STATUS_FILTERS.map(f => (
                <button key={f} onClick={() => setStatusFilter(f)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors capitalize ${statusFilter === f ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-600 border-gray-300 hover:border-indigo-400"}`}>
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
            {filtered.length === 0 ? (
              <div className="py-20 text-center">
                <Banknote size={48} className="mx-auto mb-3 text-gray-200" />
                <p className="text-gray-500 font-medium">No advances found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="adv-table w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      {["Staff", "Amount", "Date", "Reason", "Status", ""].map(h => (
                        <th key={h} className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filtered.map((adv, idx) => (
                      <tr key={adv.id} style={{ animationDelay: `${idx * 0.03}s` }} className="hover:bg-indigo-50/40 transition-colors group">
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-black shrink-0">
                              {adv.staffName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-semibold text-gray-800 text-sm">{adv.staffName}</p>
                              <p className="text-xs text-gray-400">Salary: KSh {adv.baseSalary.toLocaleString()} · Max: KSh {Math.floor(adv.baseSalary * 0.3).toLocaleString()}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span className="font-black text-indigo-700 text-base">KSh {adv.amount.toLocaleString()}</span>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-600">{adv.date}</td>
                        <td className="px-4 py-3.5 max-w-[200px]">
                          <p className="text-sm text-gray-600 truncate">{adv.reason ?? <span className="text-gray-300 italic">—</span>}</p>
                          {adv.transactionCode && <p className="text-xs text-gray-400 mt-0.5 font-mono">Ref: {adv.transactionCode}</p>}
                        </td>
                        <td className="px-4 py-3.5"><StatusBadge status={adv.status} /></td>
                        <td className="px-3 py-3.5 text-right">
                          <button onClick={e => open(adv.id, e)}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                            {actioningId === adv.id ? <Loader2 size={15} className="animate-spin" /> : <MoreVertical size={15} />}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Dropdown portal */}
      {mounted && dd.id && ddAdv && createPortal(
        <div ref={menuRef} className="dd-menu fixed z-[500] w-48 bg-white rounded-2xl shadow-xl border border-gray-100 py-1.5" style={{ top: dd.top, left: dd.left }}>
          <div className="px-3 py-2 border-b border-gray-50 mb-1">
            <p className="text-xs font-bold text-gray-800 truncate">{ddAdv.staffName}</p>
            <p className="text-[0.65rem] text-gray-400">KSh {ddAdv.amount.toLocaleString()} · {ddAdv.status}</p>
          </div>
          {ddAdv.status === "requested" && (
            <button onClick={() => handleStatus(ddAdv.id, "approved")}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-medium text-blue-700 hover:bg-blue-50 transition-colors">
              <CheckCircle2 size={13} className="text-blue-500" /> Approve
            </button>
          )}
          {ddAdv.status === "approved" && (
            <button onClick={() => handleStatus(ddAdv.id, "paid")}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-medium text-green-700 hover:bg-green-50 transition-colors">
              <Banknote size={13} className="text-green-500" /> Mark Paid
            </button>
          )}
          {ddAdv.status === "requested" && (
            <button onClick={() => handleStatus(ddAdv.id, "rejected")}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-medium text-orange-700 hover:bg-orange-50 transition-colors">
              <XCircle size={13} className="text-orange-500" /> Reject
            </button>
          )}
          <div className="mx-3 my-1 border-t border-gray-100" />
          <button onClick={() => handleDelete(ddAdv.id)}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors">
            <X size={13} /> Delete
          </button>
        </div>,
        document.body
      )}

      {showModal && (
        <AdvanceModal shopId={shopId} isManager={isManager} staffList={staffList} currentStaff={currentStaff}
          onClose={() => setShowModal(false)}
          onDone={() => { setShowModal(false); router.refresh(); }} />
      )}
    </>
  );
}
