"use client";

import { useState, useTransition, useActionState, useEffect } from "react";
import { useRouter }      from "next/navigation";
import Image              from "next/image";
import {
  Plus, X, Loader2, Search, Edit2, Trash2,
  Phone, Banknote, Users, TrendingDown, ShieldCheck,
  ShieldOff, Tags, CreditCard, CheckCircle2, Clock, XCircle, Mail, Send,
} from "lucide-react";
import { NAV_SECTIONS }          from "@/lib/permissions";
import { saveStaffAction, deleteStaffAction, deleteRoleAction, sendStaffInviteAction, cancelStaffInviteAction, findUserByEmailAction } from "./actions";
import { requestAdvanceAction }   from "../../advance/_components/actions";
import AssignDesignationModal from "./AssignDesignationModal";
import RoleFormModal          from "./RoleFormModal";
import { usePlan }            from "@/components/PlanProvider";

// ── Types ─────────────────────────────────────────────────────────────────────
type StaffMember = {
  id: string; userId: string; fullName: string;
  tel1: string | null; tel2: string | null;
  mpesaNo: string | null; baseSalary: number; shopId: string;
  email: string | null; image: string | null;
  designation: string | null; allowedRoutes: string[]; profileRole: string;
  totalAdvances: number; paidSalaries: number; createdAt: string;
};
type RoleRecord    = { id: string; name: string; description: string; allowedRoutes: string[] };
type PendingInvite = { id: string; email: string; role: string; fullName: string | null; createdAt: string; expiresAt: string };
type ActiveShop    = { id: string; name: string; location: string };
type Profile       = { role: string; fullName: string };

type MyAdvance = {
  id: string; amount: number; date: string;
  reason: string | null; status: string; createdAt: string;
};

type Props = {
  shopId:         string;
  activeShop:     ActiveShop;
  isManager:      boolean;
  isAdmin:        boolean;
  profile:        Profile;
  staffList:      StaffMember[];
  rolesList:      RoleRecord[];
  pendingInvites: PendingInvite[];
  stats: { total: number; totalSalaryBill: number; totalAdvances: number };
  myStaff:    { id: string; baseSalary: number; shopId: string } | null;
  myAdvances: MyAdvance[];
};

function initials(name: string) {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

function roleBadge(role: string) {
  const map: Record<string, { label: string; cls: string }> = {
    admin:   { label: "Admin",   cls: "bg-amber-100  text-amber-700"  },
    manager: { label: "Manager", cls: "bg-violet-100 text-violet-700" },
    staff:   { label: "Staff",   cls: "bg-blue-100   text-blue-700"   },
    user:    { label: "User",    cls: "bg-gray-100   text-gray-600"   },
  };
  const m = map[role.toLowerCase()] ?? map.user;
  return (
    <span className={`text-[0.6rem] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide ${m.cls}`}>
      {m.label}
    </span>
  );
}

// ── Add Staff Modal (Direct Add + Invite tabs) ────────────────────────────────
function AddStaffModal({
  shopId, rolesList, onClose, onDone,
}: { shopId: string; rolesList: RoleRecord[]; onClose: () => void; onDone: () => void }) {
  const [tab, setTab] = useState<"direct"|"invite">("direct");

  return (
    <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        {/* Tab header */}
        <div className="flex items-center justify-between px-5 py-4 border-b bg-gradient-to-r from-indigo-50 to-white">
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
            <button
              onClick={() => setTab("direct")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${tab === "direct" ? "bg-white text-indigo-700 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              Direct Add
            </button>
            <button
              onClick={() => setTab("invite")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${tab === "invite" ? "bg-white text-indigo-700 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              Send Invite
            </button>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>
        {tab === "direct"
          ? <DirectAddForm shopId={shopId} rolesList={rolesList} onClose={onClose} onDone={onDone} />
          : <InviteForm    shopId={shopId} rolesList={rolesList} onClose={onClose} onDone={onDone} />}
      </div>
    </div>
  );
}

// ── Direct Add Form ───────────────────────────────────────────────────────────
function DirectAddForm({
  shopId, rolesList, onClose, onDone,
}: { shopId: string; rolesList: RoleRecord[]; onClose: () => void; onDone: () => void }) {
  const [email,       setEmail]       = useState("");
  const [foundUser,   setFoundUser]   = useState<{ userId: string; name: string; email: string; image: string | null } | null>(null);
  const [searching,   setSearching]   = useState(false);
  const [notFound,    setNotFound]    = useState(false);
  const [fullName,    setFullName]    = useState("");
  const [salary,      setSalary]      = useState("");
  const [tel1,        setTel1]        = useState("");
  const [designation, setDesignation] = useState("");
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  const handleLookup = async () => {
    if (!email.trim()) return;
    setSearching(true); setNotFound(false); setFoundUser(null); setError(null);
    const res = await findUserByEmailAction(email.trim());
    setSearching(false);
    if (!res) { setNotFound(true); return; }
    if (res.alreadyStaff) { setError("This user is already a staff member."); return; }
    setFoundUser(res);
    setFullName(res.name || "");
  };

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!foundUser) return;
    setError(null); setLoading(true);
    const fd = new FormData();
    fd.set("userId",      foundUser.userId);
    fd.set("shopId",      shopId);
    fd.set("fullName",    fullName || foundUser.name);
    fd.set("baseSalary",  salary || "0");
    fd.set("tel1",        tel1);
    fd.set("tel2",        "");
    fd.set("mpesaNo",     "");
    if (designation) fd.set("designation", designation);
    const res = await saveStaffAction({ success: false }, fd);
    setLoading(false);
    if (res.success) onDone(); else setError(res.error ?? "Failed to add staff.");
  };

  return (
    <div className="p-5 space-y-4">
      <p className="text-xs text-gray-500">Staff must already have a Kwenik account (signed in with Google at least once).</p>

      {/* Email lookup */}
      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1.5">Staff Email *</label>
        <div className="flex gap-2">
          <input
            type="email" value={email} onChange={e => { setEmail(e.target.value); setFoundUser(null); setNotFound(false); }}
            placeholder="staff@example.com"
            className="flex-1 border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-400"
            onKeyDown={e => e.key === "Enter" && (e.preventDefault(), handleLookup())}
          />
          <button type="button" onClick={handleLookup} disabled={searching || !email.trim()}
            className="px-3 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition-colors">
            {searching ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
          </button>
        </div>
        {notFound && <p className="text-xs text-amber-600 mt-1.5">No account found with this email. Use &quot;Send Invite&quot; instead.</p>}
      </div>

      {foundUser && (
        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Found user badge */}
          <div className="flex items-center gap-2.5 bg-green-50 border border-green-200 rounded-xl px-3 py-2.5">
            {foundUser.image
              ? <div className="relative w-8 h-8 rounded-full overflow-hidden shrink-0"><Image src={foundUser.image} alt="" fill sizes="32px" className="object-cover"/></div>
              : <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-black shrink-0">{foundUser.name.slice(0,2).toUpperCase()}</div>}
            <div className="min-w-0">
              <p className="text-sm font-bold text-gray-900 truncate">{foundUser.name || "—"}</p>
              <p className="text-xs text-gray-500 truncate">{foundUser.email}</p>
            </div>
            <CheckCircle2 size={16} className="text-green-600 shrink-0 ml-auto" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Full Name</label>
            <input value={fullName} onChange={e => setFullName(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-400" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Base Salary (KSh)</label>
              <input value={salary} onChange={e => setSalary(e.target.value)} type="number" min={0} placeholder="25000"
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-400" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Phone</label>
              <input value={tel1} onChange={e => setTel1(e.target.value)} placeholder="0700 000 000"
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-400" />
            </div>
          </div>

          {/* Designation — auto-applies allowed routes */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Designation <span className="text-indigo-500 font-normal">(sets access routes instantly)</span>
            </label>
            <select value={designation} onChange={e => setDesignation(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-400 bg-white">
              <option value="">None — assign later</option>
              {rolesList.map(r => (
                <option key={r.id} value={r.name}>
                  {r.name}{r.allowedRoutes.length > 0 ? ` (${r.allowedRoutes.length} sections)` : ""}
                </option>
              ))}
            </select>
            {designation && rolesList.find(r => r.name === designation) && (
              <p className="text-xs text-indigo-600 mt-1">
                ✓ Staff will immediately access {rolesList.find(r => r.name === designation)!.allowedRoutes.length} section(s)
              </p>
            )}
            {!designation && <p className="text-xs text-amber-600 mt-1">Without a designation staff won't have route access until assigned.</p>}
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors">
              {loading ? <Loader2 size={16} className="animate-spin" /> : <><Users size={14} /> Add Staff</>}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

// ── Invite Form (was InviteStaffModal body) ───────────────────────────────────
function InviteForm({
  shopId, rolesList, onClose, onDone,
}: { shopId: string; rolesList: RoleRecord[]; onClose: () => void; onDone: () => void }) {
  const [email,       setEmail]       = useState("");
  const [fullName,    setFullName]    = useState("");
  const [salary,      setSalary]      = useState("");
  const [tel1,        setTel1]        = useState("");
  const [designation, setDesignation] = useState("");
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [inviteUrl,   setInviteUrl]   = useState<string | null>(null);
  const [emailFailed, setEmailFailed] = useState(false);
  const [copied,      setCopied]      = useState(false);

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await sendStaffInviteAction({
      shopId,
      email,
      fullName:    fullName    || undefined,
      baseSalary:  salary ? Number(salary) : undefined,
      tel1:        tel1        || undefined,
      designation: designation || undefined,
    });
    setLoading(false);
    if (res.success) {
      setInviteUrl(res.inviteUrl ?? null);
      setEmailFailed(!!res.emailError);
    } else {
      setError(res.error ?? "Failed to send invite.");
    }
  };

  const handleCopy = () => {
    if (!inviteUrl) return;
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (inviteUrl) {
    return (
      <div className="p-7 space-y-4">
        <div className="flex flex-col items-center text-center gap-2">
          <div className={`w-14 h-14 rounded-full flex items-center justify-center ${emailFailed ? "bg-amber-100" : "bg-green-100"}`}>
            {emailFailed ? <Mail size={26} className="text-amber-500" /> : <CheckCircle2 size={26} className="text-green-600" />}
          </div>
          <h2 className="font-bold text-gray-900 text-lg">{emailFailed ? "Invite created" : "Invite sent!"}</h2>
          <p className="text-sm text-gray-500">
            {emailFailed
              ? <>Email delivery failed — share this link with <strong>{email}</strong> directly:</>
              : <>Email sent to <strong>{email}</strong>. Also copy the link as a backup:</>}
          </p>
        </div>
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5">
          <span className="text-xs text-gray-600 truncate flex-1 font-mono">{inviteUrl}</span>
          <button onClick={handleCopy} className="shrink-0 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors">
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
        <button onClick={onDone} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl text-sm font-bold transition-colors">
          Done
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="p-5 space-y-4">
      <p className="text-xs text-gray-500 flex items-center gap-1"><Mail size={12}/> An email invite link will be sent to their inbox.</p>
      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1.5">Email Address *</label>
        <div className="relative">
          <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="staff@example.com"
            className="w-full pl-9 pr-3 border border-gray-300 rounded-xl py-2.5 text-sm outline-none focus:border-indigo-400" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1.5">Full Name</label>
        <input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="e.g. Jane Wanjiku"
          className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-400" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">Base Salary (KSh)</label>
          <input value={salary} onChange={e => setSalary(e.target.value)} type="number" min={0} placeholder="25000"
            className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-400" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">Phone</label>
          <input value={tel1} onChange={e => setTel1(e.target.value)} placeholder="0700 000 000"
            className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-400" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1.5">Designation</label>
        <select value={designation} onChange={e => setDesignation(e.target.value)}
          className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-400 bg-white">
          <option value="">None — assign later</option>
          {rolesList.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
        </select>
      </div>
      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>}
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onClose}
          className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors">
          Cancel
        </button>
        <button type="submit" disabled={loading}
          className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors">
          {loading ? <Loader2 size={16} className="animate-spin" /> : <><Send size={14} /> Send Invite</>}
        </button>
      </div>
    </form>
  );
}

// ── Edit Staff Modal ──────────────────────────────────────────────────────────
function EditStaffModal({
  staff, rolesList, onClose, onDone,
}: { staff: StaffMember; rolesList: RoleRecord[]; onClose: () => void; onDone: () => void }) {
  const [state, action, pending] = useActionState(saveStaffAction, { success: false });

  useEffect(() => { if (state?.success) onDone(); }, [state?.success]); // eslint-disable-line

  return (
    <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4">
      <form
        action={action}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
      >
        <input type="hidden" name="staffId" value={staff.id} />
        <input type="hidden" name="userId"  value={staff.userId} />
        <input type="hidden" name="shopId"  value={staff.shopId} />

        <div className="flex items-center justify-between px-5 py-4 border-b bg-gradient-to-r from-blue-50 to-white">
          <div>
            <h2 className="font-bold text-gray-800 flex items-center gap-2">
              <Edit2 size={15} className="text-blue-600" /> Edit Staff
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">{staff.email}</p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Full Name *</label>
            <input name="fullName" defaultValue={staff.fullName}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-400" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Phone 1</label>
              <input name="tel1" defaultValue={staff.tel1 ?? ""} placeholder="0700 000 000"
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Phone 2</label>
              <input name="tel2" defaultValue={staff.tel2 ?? ""} placeholder="0711 000 000"
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-400" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">M-Pesa No.</label>
              <input name="mpesaNo" defaultValue={staff.mpesaNo ?? ""} placeholder="0700 000 000"
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Base Salary (KSh) *</label>
              <input name="baseSalary" type="number" min={0} defaultValue={staff.baseSalary}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-400" />
            </div>
          </div>
          {rolesList.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Designation <span className="text-indigo-500 font-normal">(updates access routes)</span>
              </label>
              <select name="designation" defaultValue={staff.designation ?? ""}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-400 bg-white">
                <option value="">None — no route change</option>
                {rolesList.map(r => (
                  <option key={r.id} value={r.name}>
                    {r.name}{r.allowedRoutes.length > 0 ? ` (${r.allowedRoutes.length} sections)` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
          {state?.error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{state.error}</p>
          )}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={pending}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors">
              {pending ? <Loader2 size={16} className="animate-spin" /> : "Save Changes"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

// ── Advance status badge ──────────────────────────────────────────────────────
function advBadge(status: string) {
  const map: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
    requested: { label: "Pending",  cls: "bg-amber-50  text-amber-700  border-amber-200",  icon: <Clock size={10} /> },
    approved:  { label: "Approved", cls: "bg-green-50  text-green-700  border-green-200",  icon: <CheckCircle2 size={10} /> },
    paid:      { label: "Paid",     cls: "bg-indigo-50 text-indigo-700 border-indigo-200", icon: <CheckCircle2 size={10} /> },
    rejected:  { label: "Rejected", cls: "bg-red-50    text-red-600    border-red-200",    icon: <XCircle size={10} /> },
  };
  const m = map[status] ?? map.requested;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[0.65rem] font-bold ${m.cls}`}>
      {m.icon} {m.label}
    </span>
  );
}

// ── My Advance Panel (self-service for the logged-in staff member) ─────────────
function MyAdvancePanel({
  shopId, myStaff, myAdvances, onRefresh,
}: {
  shopId:     string;
  myStaff:    { id: string; baseSalary: number; shopId: string };
  myAdvances: MyAdvance[];
  onRefresh:  () => void;
}) {
  const [open,    setOpen]    = useState(false);
  const [amount,  setAmount]  = useState("");
  const [date,    setDate]    = useState(() => new Date().toISOString().split("T")[0]);
  const [reason,  setReason]  = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const pending  = myAdvances.filter(a => a.status === "requested").length;
  const totalAdv = myAdvances.filter(a => ["approved","paid"].includes(a.status))
                             .reduce((s, a) => s + a.amount, 0);

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    setError(null);
    const amt = Number(amount);
    if (!amt || amt <= 0) { setError("Enter a valid amount."); return; }
    setLoading(true);
    const res = await requestAdvanceAction(shopId, amt, date, reason || undefined);
    setLoading(false);
    if (res.success) {
      setSuccess(true);
      setAmount(""); setReason("");
      setTimeout(() => { setSuccess(false); setOpen(false); onRefresh(); }, 1500);
    } else {
      setError(res.error ?? "Request failed.");
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-indigo-100 shadow-sm overflow-hidden">
      {/* Header row */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center">
            <CreditCard size={17} className="text-indigo-600" />
          </div>
          <div>
            <p className="font-bold text-gray-900 text-sm">My Advances</p>
            <p className="text-xs text-gray-400">
              KSh {totalAdv.toLocaleString()} received
              {pending > 0 && <span className="ml-1.5 text-amber-600 font-semibold">· {pending} pending</span>}
            </p>
          </div>
        </div>
        <button
          onClick={() => setOpen(v => !v)}
          className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-2 rounded-xl transition-colors"
        >
          <Plus size={13} /> Request Advance
        </button>
      </div>

      {/* Request form */}
      {open && (
        <form onSubmit={handleSubmit} className="px-5 py-4 border-b border-gray-100 bg-indigo-50/40 space-y-3">
          <p className="text-xs font-semibold text-gray-600">
            Max: <span className="text-indigo-700">KSh {myStaff.baseSalary.toLocaleString()}</span> (base salary)
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Amount (KSh) *</label>
              <input
                type="number" min="1" max={myStaff.baseSalary}
                value={amount} onChange={e => setAmount(e.target.value)}
                placeholder="e.g. 5000"
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Date *</label>
              <input
                type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-500"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Reason (optional)</label>
            <input
              type="text" value={reason} onChange={e => setReason(e.target.value)}
              placeholder="Brief reason for advance…"
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-500"
            />
          </div>
          {error   && <p className="text-xs text-red-600 font-medium">{error}</p>}
          {success && <p className="text-xs text-green-600 font-medium">Request submitted!</p>}
          <div className="flex gap-2">
            <button
              type="submit" disabled={loading}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors disabled:opacity-60"
            >
              {loading ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
              Submit Request
            </button>
            <button type="button" onClick={() => setOpen(false)} className="text-xs text-gray-500 hover:text-gray-700 px-3 py-2">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* History list */}
      {myAdvances.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">No advance requests yet.</p>
      ) : (
        <div className="divide-y divide-gray-50">
          {myAdvances.map(a => (
            <div key={a.id} className="flex items-center justify-between px-5 py-3">
              <div>
                <p className="text-sm font-bold text-gray-900">KSh {a.amount.toLocaleString()}</p>
                <p className="text-xs text-gray-400">{a.date}{a.reason && ` · ${a.reason}`}</p>
              </div>
              {advBadge(a.status)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function StaffView({
  shopId, activeShop, isManager, isAdmin,
  staffList, rolesList, pendingInvites, stats,
  myStaff, myAdvances,
}: Props) {
  const router = useRouter();
  const { isDemo } = usePlan();
  const [search,       setSearch]       = useState("");
  const [showAdd,      setShowAdd]      = useState(false);
  const [editMember,   setEditMember]   = useState<StaffMember | null>(null);
  const [accessMember, setAccessMember] = useState<StaffMember | null>(null);
  const [roleForm,     setRoleForm]     = useState<RoleRecord | null | "new">(null);
  const [removingId,   setRemovingId]   = useState<string | null>(null);
  const [cancelingInvId, setCancelingInvId] = useState<string | null>(null);
  const [isPending,    startTransition] = useTransition();
  const [tab,          setTab]          = useState<"staff"|"designations">("staff");

  const handleRemove = (member: StaffMember) => {
    if (!confirm(`Remove ${member.fullName} from this shop?\nThis deletes their staff record but not their account.`)) return;
    setRemovingId(member.id);
    startTransition(async () => {
      const res = await deleteStaffAction(member.id, member.shopId);
      setRemovingId(null);
      if (res.success) router.refresh(); else alert(res.error ?? "Remove failed");
    });
  };

  const handleDeleteRole = (role: RoleRecord) => {
    if (!confirm(`Delete designation "${role.name}"?\nAll staff assigned this designation will have it cleared.`)) return;
    startTransition(async () => {
      const res = await deleteRoleAction({ roleId: role.id, shopId });
      if (res.success) router.refresh(); else alert(res.error ?? "Delete failed");
    });
  };

  const handleCancelInvite = (inviteId: string) => {
    if (!confirm("Cancel this invite?")) return;
    setCancelingInvId(inviteId);
    startTransition(async () => {
      const res = await cancelStaffInviteAction({ inviteId, shopId });
      setCancelingInvId(null);
      if (res.success) router.refresh(); else alert(res.error ?? "Cancel failed");
    });
  };

  const filtered = staffList.filter(s =>
    `${s.fullName} ${s.email ?? ""} ${s.tel1 ?? ""} ${s.designation ?? ""}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <div className="min-h-screen bg-slate-50/80 px-3 py-5 md:px-6">
        <div className="mx-auto max-w-screen-2xl space-y-5">

          {/* Header */}
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
                <Users size={24} className="text-indigo-600" /> Staff
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">
                {activeShop.name}
                {activeShop.location && <span className="text-gray-400"> · {activeShop.location}</span>}
              </p>
            </div>
            {isAdmin && (
              <button
                onClick={() => setShowAdd(true)}
                disabled={isDemo}
                title={isDemo ? "Upgrade your plan to add staff" : undefined}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-semibold text-sm shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Plus size={17} /> Add Staff
              </button>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: <Users size={18} className="text-indigo-600" />,  label: "Total Staff",    value: stats.total,                                  accent: "border-indigo-100" },
              { icon: <Banknote size={18} className="text-emerald-600"/>, label: "Monthly Bill",  value: `KSh ${stats.totalSalaryBill.toLocaleString()}`, accent: "border-emerald-100" },
              { icon: <TrendingDown size={18} className="text-rose-600"/>, label: "Advances",     value: `KSh ${stats.totalAdvances.toLocaleString()}`,   accent: "border-rose-100" },
            ].map(s => (
              <div key={s.label} className={`bg-white rounded-2xl border p-4 shadow-xs hover:shadow-sm transition-shadow ${s.accent}`}>
                <div className="flex items-center gap-2 mb-2">
                  {s.icon}
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{s.label}</span>
                </div>
                <div className="text-2xl font-black text-gray-900">{s.value}</div>
              </div>
            ))}
          </div>

          {/* Self-service advance panel — only shown to non-admin staff */}
          {myStaff && myStaff.shopId === shopId && !isAdmin && (
            <MyAdvancePanel
              shopId={shopId}
              myStaff={myStaff}
              myAdvances={myAdvances}
              onRefresh={() => router.refresh()}
            />
          )}

          {/* Tabs */}
          <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1 w-fit shadow-xs">
            {(["staff", "designations"] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors capitalize ${
                  tab === t
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {t === "staff"        ? <span className="flex items-center gap-1.5"><Users size={14}/> Staff</span>
                                      : <span className="flex items-center gap-1.5"><Tags  size={14}/> Designations</span>}
              </button>
            ))}
          </div>

          {/* ── Staff tab ──────────────────────────────────────────────────────── */}
          {tab === "staff" && (
            <>
              {/* Search */}
              <div className="relative max-w-md">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search by name, email, phone, designation…"
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-300 text-sm outline-none focus:border-indigo-500 bg-white shadow-xs"
                />
                {search && (
                  <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <X size={14} />
                  </button>
                )}
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
                {filtered.length === 0 ? (
                  <div className="py-20 text-center">
                    <Users size={48} className="mx-auto mb-3 text-gray-200" />
                    <p className="text-gray-500 font-medium">
                      {staffList.length === 0 ? "No staff members yet" : "No staff match your search"}
                    </p>
                    {isAdmin && staffList.length === 0 && (
                      <button onClick={() => setShowAdd(true)}
                        disabled={isDemo}
                        title={isDemo ? "Upgrade your plan to add staff" : undefined}
                        className="mt-4 inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                        <Plus size={15} /> Add First Staff Member
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] border-collapse text-sm">
                      <thead>
                        <tr className="bg-slate-50 border-b border-gray-200">
                          <th className="px-4 py-3.5 text-left text-xs font-bold uppercase tracking-widest text-gray-400 w-10">#</th>
                          <th className="px-4 py-3.5 text-left text-xs font-bold uppercase tracking-widest text-gray-400">Staff</th>
                          <th className="px-4 py-3.5 text-left text-xs font-bold uppercase tracking-widest text-gray-400">Designation</th>
                          <th className="px-4 py-3.5 text-left text-xs font-bold uppercase tracking-widest text-gray-400">Sections</th>
                          <th className="px-4 py-3.5 text-left text-xs font-bold uppercase tracking-widest text-gray-400">Salary</th>
                          <th className="px-4 py-3.5 text-left text-xs font-bold uppercase tracking-widest text-gray-400">Phone</th>
                          <th className="px-4 py-3.5 text-left text-xs font-bold uppercase tracking-widest text-gray-400">Advances</th>
                          <th className="px-4 py-3.5 text-left text-xs font-bold uppercase tracking-widest text-gray-400">Since</th>
                          {isManager && (
                            <th className="px-4 py-3.5 text-right text-xs font-bold uppercase tracking-widest text-gray-400">Actions</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {filtered.map((member, idx) => (
                          <tr key={member.id} className="hover:bg-slate-50/70 transition-colors group">
                            <td className="px-4 py-3 text-xs text-gray-400 font-bold">{idx + 1}</td>

                            {/* Staff col */}
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3 min-w-[160px]">
                                {member.image ? (
                                  <div className="relative w-9 h-9 rounded-full overflow-hidden border-2 border-indigo-100 shrink-0">
                                    <Image src={member.image} alt={member.fullName} fill className="object-cover" sizes="36px" />
                                  </div>
                                ) : (
                                  <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-black text-xs shrink-0">
                                    {initials(member.fullName)}
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <p className="font-bold text-gray-900 text-sm truncate leading-tight">{member.fullName}</p>
                                  <div className="flex items-center gap-1 mt-0.5">
                                    {roleBadge(member.profileRole)}
                                    {member.email && <span className="text-[0.65rem] text-gray-400 truncate max-w-[120px]">{member.email}</span>}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Designation */}
                            <td className="px-4 py-3">
                              {member.designation
                                ? <span className="inline-flex items-center gap-1 text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full font-semibold">
                                    <ShieldCheck size={10} />{member.designation}
                                  </span>
                                : <span className="text-gray-300 text-xs">—</span>}
                            </td>

                            {/* Sections */}
                            <td className="px-4 py-3">
                              {member.allowedRoutes.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {member.allowedRoutes.slice(0, 3).map(r => {
                                    const sec = NAV_SECTIONS.find(s => s.prefix === r);
                                    return sec ? (
                                      <span key={r} title={sec.label} className="text-[0.6rem] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full font-semibold">
                                        {sec.emoji}
                                      </span>
                                    ) : null;
                                  })}
                                  {member.allowedRoutes.length > 3 && (
                                    <span className="text-[0.6rem] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full font-semibold">
                                      +{member.allowedRoutes.length - 3}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[0.65rem] text-gray-400">
                                  <ShieldOff size={10} /> None
                                </span>
                              )}
                            </td>

                            {/* Salary */}
                            <td className="px-4 py-3">
                              <span className="font-black text-indigo-700 text-sm tabular-nums">
                                KSh {member.baseSalary.toLocaleString()}
                              </span>
                            </td>

                            {/* Phone */}
                            <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                              {member.tel1 ? (
                                <span className="flex items-center gap-1"><Phone size={10} className="text-gray-300" />{member.tel1}</span>
                              ) : <span className="text-gray-300">—</span>}
                            </td>

                            {/* Advances */}
                            <td className="px-4 py-3">
                              <span className={`text-sm font-bold tabular-nums ${member.totalAdvances > 0 ? "text-rose-600" : "text-gray-300"}`}>
                                {member.totalAdvances > 0 ? `KSh ${member.totalAdvances.toLocaleString()}` : "—"}
                              </span>
                            </td>

                            {/* Since */}
                            <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{member.createdAt}</td>

                            {/* Actions */}
                            {isManager && (
                              <td className="px-4 py-3">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() => setEditMember(member)}
                                    className="flex items-center gap-1 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors"
                                  >
                                    <Edit2 size={11} /> Edit
                                  </button>
                                  {isAdmin && (
                                    <>
                                      <button
                                        onClick={() => setAccessMember(member)}
                                        className="flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors"
                                      >
                                        <ShieldCheck size={11} /> Access
                                      </button>
                                      <button
                                        onClick={() => handleRemove(member)}
                                        disabled={removingId === member.id}
                                        className="flex items-center justify-center px-2 py-1.5 bg-red-50 hover:bg-red-100 text-red-500 rounded-lg transition-colors disabled:opacity-60"
                                      >
                                        {removingId === member.id
                                          ? <Loader2 size={11} className="animate-spin" />
                                          : <Trash2 size={11} />}
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── Pending invites ────────────────────────────────────────────────── */}
          {tab === "staff" && isAdmin && pendingInvites.length > 0 && (
            <div className="bg-white rounded-2xl border border-amber-200 shadow-xs overflow-hidden">
              <div className="px-5 py-3 border-b border-amber-100 bg-amber-50 flex items-center gap-2">
                <Mail size={14} className="text-amber-600" />
                <span className="text-xs font-bold text-amber-700 uppercase tracking-wide">
                  Pending Invites ({pendingInvites.length})
                </span>
              </div>
              <div className="divide-y divide-gray-50">
                {pendingInvites.map(inv => (
                  <div key={inv.id} className="flex items-center justify-between px-5 py-3 gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{inv.fullName ?? inv.email}</p>
                      <p className="text-xs text-gray-400 truncate">{inv.email} · {inv.role} · expires {inv.expiresAt}</p>
                    </div>
                    <button
                      onClick={() => handleCancelInvite(inv.id)}
                      disabled={cancelingInvId === inv.id}
                      className="shrink-0 flex items-center gap-1 text-xs text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {cancelingInvId === inv.id ? <Loader2 size={11} className="animate-spin" /> : <X size={11} />}
                      Cancel
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Designations tab ───────────────────────────────────────────────── */}
          {tab === "designations" && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  Designation templates define section access for a group of staff.
                </p>
                {isAdmin && (
                  <button
                    onClick={() => setRoleForm("new")}
                    disabled={isDemo}
                    title={isDemo ? "Upgrade your plan to create designations" : undefined}
                    className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Plus size={15} /> New Designation
                  </button>
                )}
              </div>

              {rolesList.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-200 py-20 text-center shadow-xs">
                  <Tags size={48} className="mx-auto mb-3 text-gray-200" />
                  <p className="text-gray-500 font-medium">No designations yet</p>
                  {isAdmin && (
                    <button onClick={() => setRoleForm("new")}
                      disabled={isDemo}
                      title={isDemo ? "Upgrade your plan to create designations" : undefined}
                      className="mt-4 inline-flex items-center gap-2 bg-violet-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-violet-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                      <Plus size={15} /> Create First Designation
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {rolesList.map(role => {
                    const usersCount = staffList.filter(s => s.designation === role.name).length;
                    return (
                      <div key={role.id}
                        className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs hover:shadow-sm transition-all">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="font-bold text-gray-900 flex items-center gap-2">
                              <ShieldCheck size={15} className="text-violet-600" />
                              {role.name}
                            </h3>
                            <p className="text-xs text-gray-500 mt-0.5">{role.description}</p>
                          </div>
                          <span className="text-xs bg-violet-100 text-violet-700 font-bold px-2 py-0.5 rounded-full shrink-0 ml-2">
                            {usersCount} staff
                          </span>
                        </div>

                        {/* Section pills */}
                        <div className="flex flex-wrap gap-1 mb-4 min-h-[1.5rem]">
                          {role.allowedRoutes.length === 0
                            ? <span className="text-xs text-gray-400 italic">No sections</span>
                            : role.allowedRoutes.map(r => {
                                const sec = NAV_SECTIONS.find(s => s.prefix === r);
                                return sec ? (
                                  <span key={r} className="text-[0.65rem] bg-violet-50 text-violet-700 px-1.5 py-0.5 rounded-full font-semibold">
                                    {sec.emoji} {sec.label}
                                  </span>
                                ) : null;
                              })
                          }
                        </div>

                        {isAdmin && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => setRoleForm(role)}
                              className="flex-1 flex items-center justify-center gap-1.5 bg-violet-50 hover:bg-violet-100 text-violet-700 text-xs font-semibold py-2 rounded-lg transition-colors"
                            >
                              <Edit2 size={12} /> Edit
                            </button>
                            <button
                              onClick={() => handleDeleteRole(role)}
                              disabled={isPending}
                              className="flex items-center justify-center px-3 py-2 bg-red-50 hover:bg-red-100 text-red-500 rounded-lg transition-colors disabled:opacity-60"
                            >
                              {isPending ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

        </div>
      </div>

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      {showAdd && (
        <AddStaffModal
          shopId={shopId}
          rolesList={rolesList}
          onClose={() => setShowAdd(false)}
          onDone={() => { setShowAdd(false); router.refresh(); }}
        />
      )}

      {editMember && (
        <EditStaffModal
          staff={editMember}
          rolesList={rolesList}
          onClose={() => setEditMember(null)}
          onDone={() => { setEditMember(null); router.refresh(); }}
        />
      )}

      {accessMember && (
        <AssignDesignationModal
          shopId={shopId}
          staffUserId={accessMember.userId}
          staffName={accessMember.fullName}
          currentDesignation={accessMember.designation}
          currentRoutes={accessMember.allowedRoutes}
          currentRole={accessMember.profileRole}
          rolesList={rolesList}
          onClose={() => setAccessMember(null)}
          onDone={() => { setAccessMember(null); router.refresh(); }}
        />
      )}

      {roleForm !== null && (
        <RoleFormModal
          shopId={shopId}
          existing={roleForm === "new" ? null : roleForm}
          onClose={() => setRoleForm(null)}
          onDone={() => { setRoleForm(null); router.refresh(); }}
        />
      )}
    </>
  );
}
