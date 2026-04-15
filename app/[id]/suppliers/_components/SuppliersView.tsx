"use client";

import { useState, useCallback, useRef, useEffect, useTransition } from "react";
import { Search, Loader2, MoreVertical, Truck, Plus, X, Pencil, Trash2, Phone } from "lucide-react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { createSupplierAction, updateSupplierAction, deleteSupplierAction } from "./actions";

type Supplier = { id: string; name: string; contact1: string; contact2: string | null; goodsType: string | null; buyCount: number };
type ActiveShop = { id: string; name: string; location: string };
type Props = {
  activeShop: ActiveShop; isAdmin: boolean; isManager: boolean;
  suppliers: Supplier[];
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
    const dw = 160, gap = 6, dh = 120;
    let top = r.bottom + gap, left = r.right - dw;
    if (top + dh > window.innerHeight - gap) top = r.top - dh - gap;
    if (left < gap) left = gap;
    if (left + dw > window.innerWidth - gap) left = window.innerWidth - dw - gap;
    setDd({ id, top, left });
  }, [dd.id, close]);
  return { dd, open, close, menuRef };
}

type ModalMode = "add" | "edit" | null;

function SupplierModal({
  shopId, mode, supplier, onClose,
}: { shopId: string; mode: ModalMode; supplier?: Supplier; onClose: () => void }) {
  const router = useRouter();
  const [name, setName]           = useState(supplier?.name ?? "");
  const [contact1, setContact1]   = useState(supplier?.contact1 ?? "");
  const [contact2, setContact2]   = useState(supplier?.contact2 ?? "");
  const [goodsType, setGoodsType] = useState(supplier?.goodsType ?? "");
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Name required"); return; }
    if (!contact1.trim()) { setError("Primary contact required"); return; }
    setLoading(true); setError("");
    const data = { name, contact1, contact2: contact2 || undefined, goodsType: goodsType || undefined };
    const res = mode === "edit" && supplier
      ? await updateSupplierAction(supplier.id, data)
      : await createSupplierAction(shopId, data);
    setLoading(false);
    if (res.success) { router.refresh(); onClose(); }
    else setError(res.error ?? "Failed");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm border border-gray-100">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-black text-gray-900">{mode === "edit" ? "Edit" : "Add"} Supplier</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition"><X size={15} /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Supplier Name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Nairobi Distributors" required
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-sky-400 outline-none" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Primary Contact</label>
            <input value={contact1} onChange={e => setContact1(e.target.value)} placeholder="Phone or email" required
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-sky-400 outline-none" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Secondary Contact <span className="text-gray-400 font-normal">(optional)</span></label>
            <input value={contact2} onChange={e => setContact2(e.target.value)} placeholder="Phone or email"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-sky-400 outline-none" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Goods/Services Type <span className="text-gray-400 font-normal">(optional)</span></label>
            <input value={goodsType} onChange={e => setGoodsType(e.target.value)} placeholder="e.g. Electronics, Produce"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-sky-400 outline-none" />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-200 rounded-xl py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition">Cancel</button>
            <button type="submit" disabled={loading}
              className="flex-1 bg-sky-600 text-white rounded-xl py-2 text-xs font-semibold hover:bg-sky-700 transition disabled:opacity-60 flex items-center justify-center gap-1">
              {loading && <Loader2 size={11} className="animate-spin" />} {mode === "edit" ? "Update" : "Add"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function SuppliersView({ activeShop, isAdmin, isManager, suppliers }: Props) {
  const router = useRouter();
  const [search, setSearch]         = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [mounted, setMounted]       = useState(false);
  const [modal, setModal]           = useState<{ mode: ModalMode; supplier?: Supplier }>({ mode: null });
  const [, startTransition]         = useTransition();
  const { dd, open, close, menuRef } = usePortalDD();

  useEffect(() => setMounted(true), []);

  const handleDelete = (id: string) => {
    close();
    if (!confirm("Delete this supplier?")) return;
    setDeletingId(id);
    startTransition(async () => {
      const res = await deleteSupplierAction(id);
      setDeletingId(null);
      if (res.success) router.refresh(); else alert(res.error ?? "Delete failed");
    });
  };

  const filtered = suppliers.filter(s => {
    const q = search.toLowerCase();
    return `${s.name} ${s.contact1} ${s.contact2 ?? ""} ${s.goodsType ?? ""}`.toLowerCase().includes(q);
  });

  const ddSupplier = dd.id ? suppliers.find(s => s.id === dd.id) : null;

  return (
    <>
      <style>{`
        @keyframes cardIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        .sup-card{animation:cardIn 0.18s ease both}
        @keyframes ddIn{from{opacity:0;transform:scale(0.95) translateY(-4px)}to{opacity:1;transform:scale(1) translateY(0)}}
        .dd-menu{animation:ddIn 0.12s ease both;transform-origin:top right}
      `}</style>

      <div className="min-h-screen bg-slate-50/80 px-3 py-5 md:px-6">
        <div className="mx-auto max-w-screen-xl space-y-5">

          {/* Header */}
          <div className="flex items-center justify-between rounded-xl border bg-white px-5 py-4 shadow-sm">
            <div>
              <h1 className="text-xl font-black text-gray-900 flex items-center gap-2">
                <Truck size={22} className="text-sky-600" /> Suppliers
              </h1>
              <p className="text-xs text-gray-400 mt-0.5">{activeShop.name} · {activeShop.location} · {suppliers.length} supplier{suppliers.length !== 1 ? "s" : ""}</p>
            </div>
            {isManager && (
              <button onClick={() => setModal({ mode: "add" })}
                className="flex items-center gap-1.5 bg-sky-600 text-white px-3 py-2 rounded-xl text-xs font-bold hover:bg-sky-700 transition">
                <Plus size={14} /> Add Supplier
              </button>
            )}
          </div>

          {/* Search */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search suppliers…"
              className="w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 py-2 text-xs focus:border-sky-400 outline-none shadow-sm transition" />
          </div>

          {/* Table */}
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-gray-200">
                    {["#", "Supplier", "Goods / Services", "Primary Contact", "Secondary Contact", "Orders", ""].map(h => (
                      <th key={h} className="px-4 py-3.5 text-left text-xs font-bold uppercase tracking-widest text-gray-400 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((s, i) => (
                    <tr key={s.id} style={{ animationDelay: `${i * 0.025}s` }}
                      className="sup-card bg-white hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-xs text-gray-400 font-bold w-8">{i + 1}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-sky-100 flex items-center justify-center text-sky-700 font-black text-sm shrink-0">
                            {s.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-semibold text-gray-800 text-[0.82rem] truncate max-w-[160px]">{s.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {s.goodsType
                          ? <span className="bg-sky-50 text-sky-700 border border-sky-200 rounded-full px-2.5 py-0.5 text-[0.65rem] font-semibold">{s.goodsType}</span>
                          : <span className="text-gray-300 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5 text-xs text-gray-600">
                          <Phone size={11} className="shrink-0 text-gray-400" />{s.contact1}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {s.contact2
                          ? <span className="flex items-center gap-1.5 text-xs text-gray-500"><Phone size={11} className="shrink-0 text-gray-400" />{s.contact2}</span>
                          : <span className="text-gray-300 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center bg-gray-100 text-gray-600 rounded-full px-2.5 py-0.5 text-[0.7rem] font-bold">
                          {s.buyCount}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                        {isManager && (
                          <button onClick={e => open(s.id, e)}
                            className={`rounded-lg p-1.5 transition-colors ${dd.id === s.id ? "bg-gray-200" : "hover:bg-gray-100 text-gray-400"}`}>
                            <MoreVertical size={15} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={7} className="py-24 text-center">
                      <div className="flex flex-col items-center gap-3 text-gray-300">
                        <Truck size={38} strokeWidth={1} />
                        <p className="text-sm font-semibold text-gray-400">No suppliers found</p>
                      </div>
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>

      {modal.mode && (
        <SupplierModal shopId={activeShop.id} mode={modal.mode} supplier={modal.supplier} onClose={() => setModal({ mode: null })} />
      )}

      {mounted && dd.id && ddSupplier && createPortal(
        <div ref={menuRef} className="dd-menu fixed z-[99999] w-[156px] bg-white rounded-2xl shadow-2xl border border-gray-100 py-1.5" style={{ top: dd.top, left: dd.left }}>
          <button onClick={() => { close(); setModal({ mode: "edit", supplier: ddSupplier }); }}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-gray-100"><Pencil size={11} /></span>Edit
          </button>
          {isAdmin && (
            <button onClick={() => handleDelete(ddSupplier.id)} disabled={deletingId === ddSupplier.id}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-red-50 text-red-500">
                {deletingId === ddSupplier.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
              </span>Delete
            </button>
          )}
        </div>,
        document.body
      )}
    </>
  );
}
