"use client";

import { useState, useMemo, useTransition } from "react";
import Image from "next/image";
import Link  from "next/link";
import { Search, ChevronLeft, ChevronRight, MoreVertical, X } from "lucide-react";
import {
  updateUserPlan,
  addProBalance,
  updateUserRole,
} from "@/app/admin/_actions";

interface User {
  id:         string;
  name:       string;
  email:      string;
  image:      string | null;
  createdAt:  string;
  role:       string;
  fullName:   string | null;
  plan:       string;
  subStatus:  string;
  proBalance: number;
  shopCount:  number;
}

interface Props {
  users:   User[];
  page:    number;
  total:   number;
  perPage: number;
}

function initials(name: string) {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2) || "?";
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric" });
}

function PlanBadge({ plan }: { plan: string }) {
  const map: Record<string, string> = {
    pro:       "bg-yellow-100 text-yellow-800 border-yellow-200",
    demo_plus: "bg-teal-100 text-teal-800 border-teal-200",
    demo:      "bg-gray-100 text-gray-600 border-gray-200",
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${map[plan] ?? map.demo}`}>
      {plan === "demo_plus" ? "Demo+" : plan.charAt(0).toUpperCase() + plan.slice(1)}
    </span>
  );
}

function RoleBadge({ role }: { role: string }) {
  const map: Record<string, string> = {
    system_admin: "bg-red-100 text-red-700 border-red-200",
    owner:        "bg-blue-100 text-blue-700 border-blue-200",
    manager:      "bg-yellow-100 text-yellow-700 border-yellow-200",
    staff:        "bg-green-100 text-green-700 border-green-200",
    user:         "bg-gray-100 text-gray-600 border-gray-200",
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border capitalize ${map[role] ?? map.user}`}>
      {role.replace("_", " ")}
    </span>
  );
}

type ModalType = "plan" | "balance" | "role" | null;

interface ModalState {
  type:   ModalType;
  userId: string;
  current: string;
}

export default function UsersView({ users, page, total, perPage }: Props) {
  const [search,    setSearch]    = useState("");
  const [modal,     setModal]     = useState<ModalState | null>(null);
  const [openMenu,  setOpenMenu]  = useState<string | null>(null);
  const [feedback,  setFeedback]  = useState<{ ok: boolean; msg: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  // Form state
  const [planVal,    setPlanVal]    = useState("demo");
  const [balanceVal, setBalanceVal] = useState("");
  const [roleVal,    setRoleVal]    = useState("user");

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return users;
    return users.filter(u =>
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q)
    );
  }, [search, users]);

  const totalPages = Math.ceil(total / perPage);

  function openModal(type: ModalType, userId: string, current: string) {
    setModal({ type, userId, current });
    setOpenMenu(null);
    if (type === "plan")    setPlanVal(current);
    if (type === "role")    setRoleVal(current);
    if (type === "balance") setBalanceVal("");
    setFeedback(null);
  }

  function closeModal() {
    setModal(null);
    setFeedback(null);
  }

  function showFeedback(ok: boolean, msg: string) {
    setFeedback({ ok, msg });
    setTimeout(() => { setFeedback(null); closeModal(); }, 1800);
  }

  function handlePlanSave() {
    if (!modal) return;
    startTransition(async () => {
      try {
        await updateUserPlan(modal.userId, planVal);
        showFeedback(true, "Plan updated successfully");
      } catch { showFeedback(false, "Failed to update plan"); }
    });
  }

  function handleBalanceSave() {
    if (!modal) return;
    const amt = parseInt(balanceVal, 10);
    if (isNaN(amt) || amt <= 0) { setFeedback({ ok: false, msg: "Enter a valid amount" }); return; }
    startTransition(async () => {
      try {
        await addProBalance(modal.userId, amt);
        showFeedback(true, `Added KES ${amt.toLocaleString()} to pro balance`);
      } catch { showFeedback(false, "Failed to add balance"); }
    });
  }

  function handleRoleSave() {
    if (!modal) return;
    startTransition(async () => {
      try {
        await updateUserRole(modal.userId, roleVal);
        showFeedback(true, "Role updated successfully");
      } catch { showFeedback(false, "Failed to update role"); }
    });
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Users</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total.toLocaleString()} total users</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100">
                <th className="text-left px-5 py-3 font-medium">User</th>
                <th className="text-left px-3 py-3 font-medium">Role</th>
                <th className="text-left px-3 py-3 font-medium">Plan</th>
                <th className="text-left px-3 py-3 font-medium">Shops</th>
                <th className="text-left px-3 py-3 font-medium">Pro Balance</th>
                <th className="text-left px-3 py-3 font-medium">Joined</th>
                <th className="text-right px-5 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-gray-400 text-sm">
                    No users found
                  </td>
                </tr>
              )}
              {filtered.map(u => (
                <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                  {/* Avatar + name/email */}
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full overflow-hidden bg-indigo-100 shrink-0 relative">
                        {u.image ? (
                          <Image src={u.image} alt={u.name} fill sizes="32px" className="object-cover" />
                        ) : (
                          <span className="flex h-full items-center justify-center text-indigo-700 font-bold text-xs">
                            {initials(u.name)}
                          </span>
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-gray-800 text-xs">{u.fullName || u.name}</p>
                        <p className="text-gray-400 text-[0.65rem]">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3"><RoleBadge role={u.role} /></td>
                  <td className="px-3 py-3"><PlanBadge plan={u.plan} /></td>
                  <td className="px-3 py-3 text-gray-600 text-xs font-medium">{u.shopCount}</td>
                  <td className="px-3 py-3 text-gray-700 text-xs font-semibold">
                    KES {u.proBalance.toLocaleString()}
                  </td>
                  <td className="px-3 py-3 text-gray-400 text-xs">{fmtDate(u.createdAt)}</td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end">
                      <div className="relative">
                        <button
                          onClick={() => setOpenMenu(openMenu === u.id ? null : u.id)}
                          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition"
                        >
                          <MoreVertical size={15} />
                        </button>
                        {openMenu === u.id && (
                          <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl shadow-lg border border-gray-100 z-20 py-1">
                            <button
                              onClick={() => openModal("plan", u.id, u.plan)}
                              className="w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 transition"
                            >
                              Change Plan
                            </button>
                            <button
                              onClick={() => openModal("balance", u.id, String(u.proBalance))}
                              className="w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 transition"
                            >
                              Add Pro Balance
                            </button>
                            <button
                              onClick={() => openModal("role", u.id, u.role)}
                              className="w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 transition"
                            >
                              Change Role
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50 flex-wrap gap-2">
          <p className="text-xs text-gray-500">
            {total === 0
              ? "0 users"
              : `${(page - 1) * perPage + 1}–${Math.min(page * perPage, total)} of ${total.toLocaleString()} users`}
          </p>
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <Link
                href={`/admin/users?page=${page - 1}`}
                className={`p-1.5 rounded-lg border border-gray-200 text-gray-500 transition ${page <= 1 ? "opacity-40 pointer-events-none" : "hover:bg-white hover:border-gray-300"}`}
              >
                <ChevronLeft size={13} />
              </Link>
              {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                let p: number;
                if (totalPages <= 7)           p = i + 1;
                else if (page <= 4)            p = i + 1;
                else if (page >= totalPages-3) p = totalPages - 6 + i;
                else                           p = page - 3 + i;
                if (p < 1 || p > totalPages) return null;
                return (
                  <Link
                    key={p}
                    href={`/admin/users?page=${p}`}
                    className={[
                      "w-7 h-7 flex items-center justify-center rounded-lg text-xs font-medium border transition",
                      p === page
                        ? "bg-indigo-600 text-white border-indigo-600"
                        : "border-gray-200 text-gray-600 hover:bg-white hover:border-gray-300",
                    ].join(" ")}
                  >
                    {p}
                  </Link>
                );
              })}
              <Link
                href={`/admin/users?page=${page + 1}`}
                className={`p-1.5 rounded-lg border border-gray-200 text-gray-500 transition ${page >= totalPages ? "opacity-40 pointer-events-none" : "hover:bg-white hover:border-gray-300"}`}
              >
                <ChevronRight size={13} />
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 z-10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">
                {modal.type === "plan"    && "Change Plan"}
                {modal.type === "balance" && "Add Pro Balance"}
                {modal.type === "role"    && "Change Role"}
              </h3>
              <button onClick={closeModal} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition">
                <X size={16} />
              </button>
            </div>

            {feedback && (
              <div className={`mb-4 px-3 py-2 rounded-lg text-sm font-medium ${feedback.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                {feedback.msg}
              </div>
            )}

            {modal.type === "plan" && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">New Plan</label>
                  <select
                    value={planVal}
                    onChange={e => setPlanVal(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  >
                    <option value="demo">Demo</option>
                    <option value="demo_plus">Demo+</option>
                    <option value="pro">Pro</option>
                  </select>
                </div>
                <button
                  onClick={handlePlanSave}
                  disabled={isPending}
                  className="w-full bg-indigo-600 text-white rounded-xl py-2 text-sm font-semibold hover:bg-indigo-700 transition disabled:opacity-60"
                >
                  {isPending ? "Saving…" : "Save Plan"}
                </button>
              </div>
            )}

            {modal.type === "balance" && (
              <div className="space-y-4">
                <p className="text-xs text-gray-500">Current balance: <strong>KES {parseInt(modal.current).toLocaleString()}</strong></p>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Amount to Add (KES)</label>
                  <input
                    type="number"
                    min="1"
                    value={balanceVal}
                    onChange={e => setBalanceVal(e.target.value)}
                    placeholder="e.g. 1000"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                </div>
                <button
                  onClick={handleBalanceSave}
                  disabled={isPending}
                  className="w-full bg-indigo-600 text-white rounded-xl py-2 text-sm font-semibold hover:bg-indigo-700 transition disabled:opacity-60"
                >
                  {isPending ? "Adding…" : "Add Balance"}
                </button>
              </div>
            )}

            {modal.type === "role" && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">New Role</label>
                  <select
                    value={roleVal}
                    onChange={e => setRoleVal(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  >
                    <option value="user">User</option>
                    <option value="owner">Owner</option>
                    <option value="manager">Manager</option>
                    <option value="staff">Staff</option>
                    <option value="system_admin">System Admin</option>
                  </select>
                </div>
                <button
                  onClick={handleRoleSave}
                  disabled={isPending}
                  className="w-full bg-indigo-600 text-white rounded-xl py-2 text-sm font-semibold hover:bg-indigo-700 transition disabled:opacity-60"
                >
                  {isPending ? "Saving…" : "Save Role"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Close menus on outside click overlay */}
      {openMenu && (
        <div className="fixed inset-0 z-10" onClick={() => setOpenMenu(null)} />
      )}
    </div>
  );
}
