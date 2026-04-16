"use client";

import React, { useState, useCallback, useRef, useEffect, useTransition } from "react";
import {
  Search, Loader2, MoreVertical, ShoppingCart, Plus, X, Trash2,
  CheckCircle2, XCircle, Package, UserPlus,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { createBuyAction, updateBuyStatusAction, deleteBuyAction, type BuyItem } from "./actions";
import { createSupplierAction } from "@/app/[id]/suppliers/_components/actions";

type Buy = {
  id: string; supplierId: string; supplierName: string;
  items: BuyItem[]; totalAmount: number; transportCost: number;
  status: string; authorizedBy: string | null; date: string;
};
type Supplier   = { id: string; name: string };
type ActiveShop = { id: string; name: string; location: string };
type Props = {
  activeShop: ActiveShop; isAdmin: boolean; isManager: boolean;
  buys: Buy[]; suppliers: Supplier[];
  stats: { total: number; totalAmount: number; pendingCount: number; receivedCount: number };
};

const STATUS_COLORS: Record<string, string> = {
  pending:   "bg-amber-50 text-amber-700 border-amber-200",
  received:  "bg-emerald-50 text-emerald-700 border-emerald-200",
  cancelled: "bg-red-50 text-red-600 border-red-200",
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
    const dw = 180, gap = 6, dh = 150;
    let top = r.bottom + gap, left = r.right - dw;
    if (top + dh > window.innerHeight - gap) top = r.top - dh - gap;
    if (left < gap) left = gap;
    if (left + dw > window.innerWidth - gap) left = window.innerWidth - dw - gap;
    setDd({ id, top, left });
  }, [dd.id, close]);
  return { dd, open, close, menuRef };
}

// ── New Supplier inline mini-form ─────────────────────────────────────────────
function NewSupplierForm({
  shopId, onCreated, onCancel,
}: { shopId: string; onCreated: (id: string, name: string) => void; onCancel: () => void }) {
  const [name, setName]       = useState("");
  const [contact, setContact] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  async function save() {
    if (!name.trim())    { setError("Name required"); return; }
    if (!contact.trim()) { setError("Contact required"); return; }
    setLoading(true); setError("");
    const res = await createSupplierAction(shopId, { name, contact1: contact });
    setLoading(false);
    if (res.success && res.id) onCreated(res.id, name.trim());
    else setError(res.error ?? "Failed to create supplier");
  }

  return (
    <div className="mt-2 rounded-xl border border-orange-200 bg-orange-50 p-3 space-y-2">
      <p className="text-xs font-bold text-orange-700 flex items-center gap-1.5"><UserPlus size={12} /> New Supplier</p>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <input value={name} onChange={e => setName(e.target.value)} placeholder="Supplier name *"
        className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:border-orange-400 outline-none bg-white" />
      <input value={contact} onChange={e => setContact(e.target.value)} placeholder="Phone / email *"
        className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:border-orange-400 outline-none bg-white" />
      <div className="flex gap-2">
        <button type="button" onClick={onCancel}
          className="flex-1 border border-gray-200 rounded-lg py-1.5 text-xs font-semibold text-gray-600 hover:bg-white transition">Cancel</button>
        <button type="button" onClick={save} disabled={loading}
          className="flex-1 bg-orange-600 text-white rounded-lg py-1.5 text-xs font-semibold hover:bg-orange-700 transition disabled:opacity-60 flex items-center justify-center gap-1">
          {loading && <Loader2 size={10} className="animate-spin" />} Save
        </button>
      </div>
    </div>
  );
}

// ── Create Order modal ────────────────────────────────────────────────────────
function BuyModal({ shopId, suppliers: initialSuppliers, onClose }: {
  shopId: string; suppliers: Supplier[]; onClose: () => void;
}) {
  const router = useRouter();
  const [localSuppliers, setLocalSuppliers] = useState<Supplier[]>(initialSuppliers);
  const [supplierId, setSupplierId]         = useState(initialSuppliers[0]?.id ?? "");
  const [showNewSupplier, setShowNewSupplier] = useState(initialSuppliers.length === 0);
  const [items, setItems]                   = useState<BuyItem[]>([{ name: "", qty: 1, price: 0 }]);
  const [transport, setTransport]           = useState("0");
  const [loading, setLoading]               = useState(false);
  const [error, setError]                   = useState("");

  const addItem    = () => setItems(p => [...p, { name: "", qty: 1, price: 0 }]);
  const removeItem = (i: number) => setItems(p => p.filter((_, idx) => idx !== i));
  const updateItem = (i: number, field: keyof BuyItem, value: string | number) =>
    setItems(p => p.map((it, idx) => idx === i ? { ...it, [field]: value } : it));

  const subtotal = items.reduce((s, i) => s + i.qty * i.price, 0);
  const total    = subtotal + (parseFloat(transport) || 0);

  function handleSupplierCreated(id: string, name: string) {
    setLocalSuppliers(prev => [...prev, { id, name }]);
    setSupplierId(id);
    setShowNewSupplier(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!supplierId) { setError("Select or create a supplier"); return; }
    const valid = items.filter(i => i.name.trim() && i.qty > 0 && i.price >= 0);
    if (valid.length === 0) { setError("Add at least one valid item"); return; }
    setLoading(true); setError("");
    const res = await createBuyAction(shopId, {
      supplierId,
      items:         valid,
      transportCost: parseFloat(transport) || 0,
    });
    setLoading(false);
    if (res.success) { router.refresh(); onClose(); }
    else setError(res.error ?? "Failed");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-gray-100 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <h2 className="text-sm font-black text-gray-900">New Purchase Order</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition"><X size={15} /></button>
        </div>
        <form onSubmit={submit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          {/* Supplier */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-gray-600">Supplier</label>
              {!showNewSupplier && (
                <button type="button" onClick={() => setShowNewSupplier(true)}
                  className="flex items-center gap-1 text-xs text-orange-600 hover:text-orange-700 font-semibold">
                  <UserPlus size={11} /> New Supplier
                </button>
              )}
            </div>
            {!showNewSupplier ? (
              <select value={supplierId} onChange={e => setSupplierId(e.target.value)} required
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-orange-400 outline-none bg-white">
                <option value="">Select supplier…</option>
                {localSuppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            ) : (
              <NewSupplierForm shopId={shopId} onCreated={handleSupplierCreated}
                onCancel={() => { if (localSuppliers.length > 0) setShowNewSupplier(false); }} />
            )}
          </div>

          {/* Items table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-gray-600">Items</label>
              <button type="button" onClick={addItem}
                className="flex items-center gap-1 text-xs text-orange-600 hover:text-orange-700 font-semibold">
                <Plus size={12} /> Add row
              </button>
            </div>
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-gray-200">
                    <th className="px-3 py-2 text-left font-bold uppercase tracking-widest text-gray-400">Item</th>
                    <th className="px-3 py-2 text-center font-bold uppercase tracking-widest text-gray-400 w-16">Qty</th>
                    <th className="px-3 py-2 text-right font-bold uppercase tracking-widest text-gray-400 w-24">Price</th>
                    <th className="px-3 py-2 text-right font-bold uppercase tracking-widest text-gray-400 w-24">Total</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map((item, i) => (
                    <tr key={i}>
                      <td className="px-2 py-1.5">
                        <input value={item.name} onChange={e => updateItem(i, "name", e.target.value)}
                          placeholder="Item name"
                          className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:border-orange-400 outline-none" />
                      </td>
                      <td className="px-2 py-1.5">
                        <input type="number" min="1" value={item.qty}
                          onChange={e => updateItem(i, "qty", parseInt(e.target.value) || 1)}
                          className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:border-orange-400 outline-none text-center" />
                      </td>
                      <td className="px-2 py-1.5">
                        <input type="number" min="0" step="0.01" value={item.price}
                          onChange={e => updateItem(i, "price", parseFloat(e.target.value) || 0)}
                          className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:border-orange-400 outline-none text-right" />
                      </td>
                      <td className="px-2 py-1.5 text-right font-semibold text-gray-700">
                        {(item.qty * item.price).toLocaleString()}
                      </td>
                      <td className="px-1 py-1.5 text-center">
                        <button type="button" onClick={() => removeItem(i)} disabled={items.length === 1}
                          className="text-gray-300 hover:text-red-500 disabled:opacity-30 transition">
                          <X size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Transport Cost (KSh)</label>
            <input type="number" min="0" step="0.01" value={transport} onChange={e => setTransport(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-orange-400 outline-none" />
          </div>

          <div className="bg-orange-50 rounded-xl px-4 py-3 flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-600">Grand Total</span>
            <span className="text-lg font-black text-orange-700 tabular-nums">KSh {total.toLocaleString()}</span>
          </div>
        </form>
        <div className="px-5 pb-5 pt-3 border-t border-gray-100 shrink-0 flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 border border-gray-200 rounded-xl py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition">Cancel</button>
          <button onClick={submit} disabled={loading}
            className="flex-1 bg-orange-600 text-white rounded-xl py-2 text-xs font-semibold hover:bg-orange-700 transition disabled:opacity-60 flex items-center justify-center gap-1">
            {loading && <Loader2 size={11} className="animate-spin" />} Create Order
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────
export default function BuyView({ activeShop, isAdmin, buys, suppliers, stats }: Props) {
  const router = useRouter();
  const [search, setSearch]         = useState("");
  const [filterStatus, setStatus]   = useState("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [mounted, setMounted]       = useState(false);
  const [showAdd, setShowAdd]       = useState(false);
  const [, startTransition]         = useTransition();
  const { dd, open, close, menuRef } = usePortalDD();

  useEffect(() => setMounted(true), []);

  const handleStatus = (id: string, status: "pending" | "received" | "cancelled") => {
    close();
    setUpdatingId(id);
    startTransition(async () => {
      const res = await updateBuyStatusAction(id, status);
      setUpdatingId(null);
      if (res.success) router.refresh(); else alert(res.error ?? "Failed");
    });
  };

  const handleDelete = (id: string) => {
    close();
    if (!confirm("Delete this purchase order?")) return;
    setDeletingId(id);
    startTransition(async () => {
      const res = await deleteBuyAction(id);
      setDeletingId(null);
      if (res.success) router.refresh(); else alert(res.error ?? "Delete failed");
    });
  };

  const filtered = buys.filter(b => {
    const q = search.toLowerCase();
    const matchSearch = `${b.supplierName} ${b.status} ${b.authorizedBy ?? ""}`.toLowerCase().includes(q);
    const matchStatus = filterStatus === "all" || b.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const ddBuy = dd.id ? buys.find(b => b.id === dd.id) : null;

  return (
    <>
      <style>{`
        @keyframes cardIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        .buy-card{animation:cardIn 0.18s ease both}
        @keyframes ddIn{from{opacity:0;transform:scale(0.95) translateY(-4px)}to{opacity:1;transform:scale(1) translateY(0)}}
        .dd-menu{animation:ddIn 0.12s ease both;transform-origin:top right}
      `}</style>

      <div className="min-h-screen bg-slate-50/80 px-3 py-5 md:px-6">
        <div className="mx-auto max-w-screen-xl space-y-5">

          {/* Header */}
          <div className="flex items-center justify-between rounded-xl border bg-white px-5 py-4 shadow-sm">
            <div>
              <h1 className="text-xl font-black text-gray-900 flex items-center gap-2">
                <ShoppingCart size={22} className="text-orange-600" /> Purchase Orders
              </h1>
              <p className="text-xs text-gray-400 mt-0.5">{activeShop.name} · {activeShop.location}</p>
            </div>
            <button onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 bg-orange-600 text-white px-3 py-2 rounded-xl text-xs font-bold hover:bg-orange-700 transition">
              <Plus size={14} /> New Order
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: "Total Orders",  value: stats.total,                                  accent: "bg-orange-500" },
              { label: "Total Value",   value: `KSh ${stats.totalAmount.toLocaleString()}`,  accent: "bg-amber-500"  },
              { label: "Pending",       value: stats.pendingCount,                           accent: "bg-yellow-500" },
              { label: "Received",      value: stats.receivedCount,                          accent: "bg-emerald-500" },
            ].map(s => (
              <div key={s.label} className="relative overflow-hidden rounded-xl border border-gray-100 bg-white px-4 pt-4 pb-3 shadow-sm">
                <div className={`absolute top-0 left-0 right-0 h-0.5 ${s.accent}`} />
                <p className="text-[0.63rem] font-bold uppercase tracking-widest text-gray-400 mb-1">{s.label}</p>
                <p className="text-2xl font-black tabular-nums text-gray-900">{s.value}</p>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search orders…"
                className="w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 py-2 text-xs focus:border-orange-400 outline-none shadow-sm transition" />
            </div>
            <div className="flex items-center gap-2">
              {["all", "pending", "received", "cancelled"].map(s => (
                <button key={s} onClick={() => setStatus(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all capitalize ${filterStatus === s ? "bg-orange-600 text-white border-orange-600" : "bg-white text-gray-600 border-gray-300 hover:border-orange-400"}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Orders list */}
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            {filtered.length === 0 ? (
              <div className="py-24 text-center">
                <ShoppingCart size={38} className="mx-auto mb-3 text-gray-200" strokeWidth={1} />
                <p className="text-sm font-semibold text-gray-400">No purchase orders found</p>
                {suppliers.length === 0 && (
                  <p className="text-xs text-gray-400 mt-1">Add a supplier first — use the "New Order" button and create one inline</p>
                )}
              </div>
            ) : (
              <>
                {/* ── Mobile cards (< md) ─────────────────────────────── */}
                <div className="divide-y divide-gray-100 md:hidden">
                  {filtered.map((b, i) => (
                    <div key={b.id} style={{ animationDelay: `${i * 0.03}s` }}
                      className="buy-card p-4 space-y-3">
                      {/* Top row: avatar + name + status */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center text-orange-700 font-black text-sm shrink-0">
                            {b.supplierName.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-800 text-sm truncate">{b.supplierName}</p>
                            {b.authorizedBy && <p className="text-[0.65rem] text-gray-400 truncate">By {b.authorizedBy}</p>}
                          </div>
                        </div>
                        <span className={`shrink-0 inline-block rounded-full border px-2.5 py-0.5 text-[0.68rem] font-bold capitalize ${STATUS_COLORS[b.status] ?? "bg-gray-50 text-gray-600 border-gray-200"}`}>
                          {b.status}
                        </span>
                      </div>
                      {/* Items */}
                      <div className="flex flex-wrap gap-x-3 gap-y-1">
                        {b.items.map((item, j) => (
                          <span key={j} className="flex items-center gap-1 text-[0.7rem] text-gray-600">
                            <Package size={10} className="text-orange-400 shrink-0" />
                            <span className="font-medium">{item.name}</span>
                            <span className="text-gray-400">×{item.qty}</span>
                            <span className="text-gray-500">@ KSh {item.price.toLocaleString()}</span>
                          </span>
                        ))}
                      </div>
                      {/* Bottom row: total + date + actions */}
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-base font-black text-orange-700 tabular-nums">KSh {(b.totalAmount + b.transportCost).toLocaleString()}</p>
                          <p className="text-[0.65rem] text-gray-400">{b.date}{b.transportCost > 0 && ` · KSh ${b.transportCost.toLocaleString()} transport`}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {b.status === "pending" && (
                            <button
                              onClick={() => handleStatus(b.id, "received")}
                              disabled={updatingId === b.id}
                              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white px-3 py-1.5 rounded-lg text-xs font-black transition">
                              {updatingId === b.id ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />}
                              Buy
                            </button>
                          )}
                          <button onClick={e => open(b.id, e)}
                            className={`rounded-lg p-1.5 transition-colors ${dd.id === b.id ? "bg-gray-200" : "hover:bg-gray-100 text-gray-400"}`}>
                            <MoreVertical size={15} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* ── Desktop table (≥ md) ────────────────────────────── */}
                <table className="hidden md:table w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-gray-200">
                      <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-gray-400">Supplier</th>
                      <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-gray-400">Total</th>
                      <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-gray-400">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-gray-400">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-gray-400">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((b, i) => (
                      <React.Fragment key={b.id}>
                        <tr style={{ animationDelay: `${i * 0.03}s` }}
                          className="buy-card bg-white hover:bg-slate-50 transition-colors border-b border-gray-100">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-xl bg-orange-100 flex items-center justify-center text-orange-700 font-black text-sm shrink-0">
                                {b.supplierName.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-semibold text-gray-800 text-xs">{b.supplierName}</p>
                                {b.authorizedBy && <p className="text-[0.65rem] text-gray-400">By {b.authorizedBy}</p>}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-sm font-black text-orange-700 tabular-nums">KSh {(b.totalAmount + b.transportCost).toLocaleString()}</p>
                            {b.transportCost > 0 && <p className="text-[0.65rem] text-gray-400">incl. KSh {b.transportCost.toLocaleString()} transport</p>}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[0.68rem] font-bold capitalize ${STATUS_COLORS[b.status] ?? "bg-gray-50 text-gray-600 border-gray-200"}`}>
                              {b.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{b.date}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {b.status === "pending" && (
                                <button
                                  onClick={() => handleStatus(b.id, "received")}
                                  disabled={updatingId === b.id}
                                  className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white px-3 py-1.5 rounded-lg text-xs font-black transition whitespace-nowrap">
                                  {updatingId === b.id
                                    ? <Loader2 size={11} className="animate-spin" />
                                    : <CheckCircle2 size={11} />}
                                  Buy
                                </button>
                              )}
                              <button onClick={e => open(b.id, e)}
                                className={`rounded-lg p-1.5 transition-colors ${dd.id === b.id ? "bg-gray-200" : "hover:bg-gray-100 text-gray-400"}`}>
                                <MoreVertical size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                        <tr className="bg-slate-50/60 border-b border-gray-100">
                          <td colSpan={5} className="px-6 pb-3 pt-1">
                            <div className="flex flex-wrap gap-x-4 gap-y-1">
                              {b.items.map((item, j) => (
                                <span key={j} className="flex items-center gap-1 text-[0.7rem] text-gray-600">
                                  <Package size={10} className="text-orange-400 shrink-0" />
                                  <span className="font-medium">{item.name}</span>
                                  <span className="text-gray-400">×{item.qty}</span>
                                  <span className="text-gray-500">@ KSh {item.price.toLocaleString()}</span>
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>

        </div>
      </div>

      {showAdd && <BuyModal shopId={activeShop.id} suppliers={suppliers} onClose={() => setShowAdd(false)} />}

      {mounted && dd.id && ddBuy && createPortal(
        <div ref={menuRef} className="dd-menu fixed z-[99999] w-[180px] bg-white rounded-2xl shadow-2xl border border-gray-100 py-1.5" style={{ top: dd.top, left: dd.left }}>
          <div className="px-3 py-1.5 border-b border-gray-50 mb-1">
            <p className="text-[0.63rem] font-bold uppercase tracking-widest text-gray-400">Update Status</p>
          </div>
          {ddBuy.status !== "received" && (
            <button onClick={() => handleStatus(ddBuy.id, "received")} disabled={updatingId === ddBuy.id}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors disabled:opacity-50">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                {updatingId === ddBuy.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
              </span>Mark Received
            </button>
          )}
          {ddBuy.status === "pending" && (
            <button onClick={() => handleStatus(ddBuy.id, "cancelled")} disabled={updatingId === ddBuy.id}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-amber-50 transition-colors disabled:opacity-50">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-50 text-amber-600"><XCircle size={12} /></span>
              Cancel Order
            </button>
          )}
          {isAdmin && (
            <>
              <div className="my-1 border-t border-gray-100" />
              <button onClick={() => handleDelete(ddBuy.id)} disabled={deletingId === ddBuy.id}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-red-50 text-red-500">
                  {deletingId === ddBuy.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                </span>Delete
              </button>
            </>
          )}
        </div>,
        document.body
      )}
    </>
  );
}
