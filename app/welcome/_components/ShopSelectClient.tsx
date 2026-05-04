"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  Store,
  MapPin,
  Phone,
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  Eye,
  Loader2,
  Search,
  LogOut,
  AlertTriangle,
  CreditCard,
  CheckCircle2,
  Zap,
  Crown,
} from "lucide-react";
import Link from "next/link";
import ShopFormModal, { ShopData } from "./ShopFormModal";
import { deleteShopAction } from "./actions";

interface Shop {
  id: string;
  name: string;
  tel: string;
  location: string;
}

interface Props {
  shops:        Shop[];
  canManage:    boolean;
  userName:     string;
  plan:         string;
  planExpiry?:  string;
}

// ── Plan helpers ──────────────────────────────────────────────────────────────

type PlanStatus = "pro" | "demo_plus" | "expired" | "demo";

function getPlanStatus(plan: string, planExpiry?: string): PlanStatus {
  if (plan === "pro") return "pro";
  if (plan === "demo_plus") {
    if (planExpiry && Date.now() < new Date(planExpiry).getTime()) return "demo_plus";
    return "expired";
  }
  return "demo";
}

const PLAN_LABEL: Record<PlanStatus, string> = {
  pro:       "Pro",
  demo_plus: "Demo+",
  expired:   "Expired",
  demo:      "Demo (Free)",
};

const PLAN_BADGE: Record<PlanStatus, string> = {
  pro:       "bg-yellow-400 text-yellow-900",
  demo_plus: "bg-green-400 text-green-900",
  expired:   "bg-red-400 text-white",
  demo:      "bg-blue-200 text-blue-900",
};

// ── Shop context menu ─────────────────────────────────────────────────────────

function ShopMenu({
  shop, top, left, deletingId, onView, onEdit, onDelete,
}: {
  shop: Shop; top: number; left: number; deletingId: string | null;
  onView: () => void; onEdit: () => void; onDelete: () => void;
}) {
  return createPortal(
    <div
      className="fixed w-44 bg-white border border-gray-100 rounded-2xl shadow-2xl py-1.5 overflow-hidden"
      style={{ top, left, zIndex: 20000 }}
      onClick={(e) => e.stopPropagation()}
    >
      <button onClick={onView} className="flex items-center gap-2.5 w-full px-4 py-2.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition">
        <Eye size={13} className="text-gray-400" /> View details
      </button>
      <button onClick={onEdit} className="flex items-center gap-2.5 w-full px-4 py-2.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition">
        <Pencil size={13} className="text-blue-400" /> Edit shop
      </button>
      <div className="my-1 border-t border-gray-100" />
      <button
        onClick={onDelete}
        disabled={deletingId === shop.id}
        className="flex items-center gap-2.5 w-full px-4 py-2.5 text-xs font-medium text-red-600 hover:bg-red-50 transition disabled:opacity-50"
      >
        {deletingId === shop.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
        Delete shop
      </button>
    </div>,
    document.body
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ShopSelectClient({ shops, canManage, userName, plan, planExpiry }: Props) {
  const router      = useRouter();
  const { update }  = useSession();

  const [modalOpen, setModalOpen]   = useState(false);
  const [modalMode, setModalMode]   = useState<"add" | "edit" | "view">("add");
  const [activeShop, setActiveShop] = useState<ShopData | undefined>();
  const [search, setSearch]         = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuTop, setMenuTop]       = useState(0);
  const [menuLeft, setMenuLeft]     = useState(0);
  const openShopRef                 = useRef<Shop | null>(null);

  const planStatus = getPlanStatus(plan, planExpiry);
  const isActive   = planStatus === "pro" || planStatus === "demo_plus" || planStatus === "demo";

  // Auto-open "Add Shop" modal for owners with no shops yet
  useEffect(() => {
    if (canManage && shops.length === 0) {
      setModalMode("add");
      setActiveShop(undefined);
      setModalOpen(true);
    }
  }, [canManage, shops.length]);

  useEffect(() => {
    if (!openMenuId) return;
    const close = () => setOpenMenuId(null);
    document.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [openMenuId]);

  const toggleMenu = (shop: Shop, e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (openMenuId === shop.id) { setOpenMenuId(null); return; }
    const rect = e.currentTarget.getBoundingClientRect();
    const dw = 176, dh = 130, gap = 8;
    let top  = rect.bottom + gap;
    let left = rect.right - dw;
    if (top + dh > window.innerHeight - gap) top = rect.top - dh - gap;
    if (left < gap) left = gap;
    if (left + dw > window.innerWidth - gap) left = window.innerWidth - dw - gap;
    setMenuTop(top); setMenuLeft(left);
    openShopRef.current = shop;
    setOpenMenuId(shop.id);
  };

  const openModal = (mode: "add" | "edit" | "view", shop?: Shop) => {
    setModalMode(mode); setActiveShop(shop); setModalOpen(true); setOpenMenuId(null);
  };

  const handleClose = () => setModalOpen(false);

  const handleSuccess = async (shopId?: string) => {
    setModalOpen(false);
    await update(); // re-read role + plan from DB into JWT
    // On first shop creation go directly into the shop so the user doesn't
    // have to click again. On edits, stay on welcome to refresh the list.
    if (shopId && shops.length === 0) {
      window.location.href = `/${shopId}/dashboard`;
    } else {
      window.location.href = "/welcome";
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this shop? This cannot be undone.")) return;
    setOpenMenuId(null); setDeletingId(id);
    try { await deleteShopAction(id); router.refresh(); }
    catch { alert("Failed to delete shop."); }
    finally { setDeletingId(null); }
  };

  const filtered = shops.filter((s) =>
    `${s.name} ${s.location}`.toLowerCase().includes(search.toLowerCase())
  );

  const hour     = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  // Count suspended shops (all share the same sub, so it's all-or-nothing)
  const suspendedCount = !isActive ? shops.length : 0;

  return (
    <>
      <div className="min-h-screen bg-linear-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">

        {/* ── Suspension alert banner ── */}
        {canManage && shops.length > 0 && !isActive && (
          <div className="bg-orange-500 text-white px-4 py-3 flex items-center gap-3 shadow-md">
            <AlertTriangle size={16} className="shrink-0" />
            <p className="flex-1 text-xs font-semibold leading-snug">
              {planStatus === "expired"
                ? `Your Demo+ subscription has expired — ${suspendedCount} shop${suspendedCount > 1 ? "s are" : " is"} currently suspended for staff.`
                : `You are on the free Demo plan — ${suspendedCount} shop${suspendedCount > 1 ? "s are" : " is"} view-only and staff cannot access.`}
            </p>
            <Link
              href="/billing"
              className="shrink-0 flex items-center gap-1.5 bg-white text-orange-600 font-black text-xs px-3 py-1.5 rounded-lg hover:bg-orange-50 transition"
            >
              <CreditCard size={12} /> Pay Now
            </Link>
          </div>
        )}

        {/* ── Header ── */}
        <div className="bg-linear-to-r from-blue-700 via-blue-600 to-indigo-600 text-white px-6 py-10 shadow-lg">
          <div className="max-w-5xl mx-auto flex items-end justify-between gap-4 flex-wrap">
            <div>
              <p className="text-blue-200 text-sm font-medium mb-1">{greeting}</p>
              <h1 className="text-3xl font-bold tracking-tight">
                Hey, <span className="text-yellow-300">{userName}</span>!
              </h1>
              <p className="mt-1.5 text-blue-100 text-sm">
                {canManage ? "Manage your shops or click one to enter." : "Select the shop you want to work in today."}
              </p>

              {/* Plan badge — only show when there are shops */}
              {shops.length > 0 && (
                <span className={`mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${PLAN_BADGE[planStatus]}`}>
                  {planStatus === "pro"       && <Crown   size={11} />}
                  {planStatus === "demo_plus" && <CheckCircle2 size={11} />}
                  {planStatus === "expired"   && <AlertTriangle size={11} />}
                  {planStatus === "demo"      && <Zap     size={11} />}
                  {PLAN_LABEL[planStatus]}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              {canManage && (
                <button
                  onClick={() => openModal("add")}
                  className="flex items-center gap-2 bg-white text-blue-700 hover:bg-blue-50 font-semibold px-5 py-2.5 rounded-xl text-sm shadow transition"
                >
                  <Plus size={16} /> Add Shop
                </button>
              )}
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white font-semibold px-4 py-2.5 rounded-xl text-sm border border-white/20 transition"
              >
                <LogOut size={15} /> Sign out
              </button>
            </div>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="bg-white border border-gray-200 rounded-xl px-5 py-3.5 shadow-sm">
              <p className="text-[0.65rem] uppercase tracking-widest text-gray-400 font-semibold">
                {canManage ? "Your shops" : "Assigned shop(s)"}
              </p>
              <p className="text-3xl font-bold text-gray-900 leading-none mt-0.5">
                {shops.length}
              </p>
            </div>

            <div className="flex-1 min-w-50 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="Search shops…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm shadow-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition"
              />
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4 text-gray-300">
              <Store size={52} strokeWidth={1} />
              <p className="text-sm font-semibold text-gray-400">
                {search ? "No shops match your search." : "No shops found."}
              </p>
              {canManage && !search && (
                <button
                  onClick={() => openModal("add")}
                  className="mt-2 flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 transition shadow"
                >
                  <Plus size={15} /> Add your first shop
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((shop, i) => (
                <div
                  key={shop.id}
                  className="group relative bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 overflow-hidden cursor-pointer"
                  style={{ animationDelay: `${i * 0.04}s` }}
                  onClick={() => router.push(`/${shop.id}/dashboard`)}
                >
                  {/* Top stripe — green if active, orange if suspended */}
                  <div className={`h-1 w-full ${isActive ? "bg-linear-to-r from-blue-500 to-indigo-500" : "bg-linear-to-r from-orange-400 to-red-400"}`} />

                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`h-11 w-11 shrink-0 rounded-xl flex items-center justify-center shadow-sm ${isActive ? "bg-blue-100" : "bg-orange-100"}`}>
                          <Store size={20} className={isActive ? "text-blue-600" : "text-orange-500"} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-gray-900 truncate leading-tight">{shop.name}</p>
                          <p className="text-[0.7rem] text-gray-400 font-medium mt-0.5">
                            Shop #{shop.id.slice(-4).toUpperCase()}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {!isActive && (
                          <span className="text-[0.65rem] font-bold text-orange-600 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full">
                            {planStatus === "expired" ? "Expired" : "Unpaid"}
                          </span>
                        )}
                        {canManage && (
                          <button
                            onClick={(e) => toggleMenu(shop, e)}
                            className={`p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition ${openMenuId === shop.id ? "bg-gray-100 text-gray-600" : ""}`}
                          >
                            <MoreVertical size={16} />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <MapPin size={12} className="text-gray-400 shrink-0" />
                        <span className="truncate">{shop.location}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Phone size={12} className="text-gray-400 shrink-0" />
                        <span>{shop.tel}</span>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <div className="flex items-center justify-between">
                        {isActive ? (
                          <span className="text-xs font-semibold text-blue-600 group-hover:text-blue-700 transition">
                            Click to enter →
                          </span>
                        ) : (
                          <Link
                            href="/billing"
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs font-semibold text-orange-500 hover:text-orange-700 transition flex items-center gap-1"
                          >
                            <CreditCard size={11} /> Upgrade to unlock
                          </Link>
                        )}
                        {isActive && (
                          <div className="h-7 w-7 rounded-full bg-blue-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all scale-75 group-hover:scale-100">
                            <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                            </svg>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {openMenuId && openShopRef.current && (
        <ShopMenu
          shop={openShopRef.current}
          top={menuTop}
          left={menuLeft}
          deletingId={deletingId}
          onView={() => openModal("view", openShopRef.current!)}
          onEdit={() => openModal("edit", openShopRef.current!)}
          onDelete={() => handleDelete(openShopRef.current!.id)}
        />
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-10000 flex justify-end">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />
          <div className="relative w-full md:w-110 bg-white h-full shadow-2xl flex flex-col rounded-l-3xl overflow-hidden">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  {modalMode === "add" ? "Add New Shop" : modalMode === "edit" ? "Edit Shop" : "Shop Details"}
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {modalMode === "add" ? "Fill in the details to create a new shop."
                    : modalMode === "edit" ? "Update the shop information below."
                    : "Read-only view of this shop."}
                </p>
              </div>
              <button onClick={handleClose} className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <ShopFormModal mode={modalMode} shop={activeShop} onSuccess={handleSuccess} onClose={handleClose} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
