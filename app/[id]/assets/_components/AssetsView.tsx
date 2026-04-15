"use client";

import { useState, useCallback, useRef, useEffect, useTransition } from "react";
import { Search, Loader2, MoreVertical, Boxes, Plus, X, Pencil, Trash2, Upload, ImageIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createPortal } from "react-dom";
import { createAssetAction, updateAssetAction, deleteAssetAction } from "./actions";

type Asset = { id: string; itemName: string; cost: number; imageUrl: string | null; date: string };
type ActiveShop = { id: string; name: string; location: string };
type Props = {
  activeShop: ActiveShop; isAdmin: boolean; isManager: boolean;
  assets: Asset[];
  stats: { total: number; totalCost: number };
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
    const dw = 156, gap = 6, dh = 110;
    let top = r.bottom + gap, left = r.right - dw;
    if (top + dh > window.innerHeight - gap) top = r.top - dh - gap;
    if (left < gap) left = gap;
    if (left + dw > window.innerWidth - gap) left = window.innerWidth - dw - gap;
    setDd({ id, top, left });
  }, [dd.id, close]);
  return { dd, open, close, menuRef };
}

type ModalMode = "add" | "edit" | null;

function AssetModal({ shopId, mode, asset, onClose }: { shopId: string; mode: ModalMode; asset?: Asset; onClose: () => void }) {
  const router = useRouter();
  const [name,     setName]    = useState(asset?.itemName ?? "");
  const [cost,     setCost]    = useState(asset?.cost?.toString() ?? "0");
  const [preview,  setPreview] = useState<string | null>(asset?.imageUrl ?? null);
  const [file,     setFile]    = useState<File | null>(null);
  const [loading,  setLoading] = useState(false);
  const [error,    setError]   = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  async function submit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim()) { setError("Asset name required"); return; }
    const c = parseFloat(cost);
    if (isNaN(c) || c < 0) { setError("Enter a valid cost"); return; }
    setLoading(true); setError("");

    let imageUrl: string | undefined = asset?.imageUrl ?? undefined;
    if (file) {
      const fd = new FormData();
      fd.append("file", file);
      const up = await fetch("/api/upload", { method: "POST", body: fd });
      const json = await up.json() as { url?: string; error?: string };
      if (!up.ok || !json.url) { setError(json.error ?? "Image upload failed"); setLoading(false); return; }
      imageUrl = json.url;
    }

    const data = { itemName: name, cost: c, imageUrl };
    const res = mode === "edit" && asset
      ? await updateAssetAction(asset.id, data)
      : await createAssetAction(shopId, data);
    setLoading(false);
    if (res.success) { router.refresh(); onClose(); }
    else setError(res.error ?? "Failed");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm border border-gray-100">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-black text-gray-900">{mode === "edit" ? "Edit" : "Add"} Asset</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition"><X size={15} /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Asset Name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Delivery Motorcycle" required
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-teal-400 outline-none" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Cost (KSh)</label>
            <input type="number" min="0" step="0.01" value={cost} onChange={e => setCost(e.target.value)}
              placeholder="0" required
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-teal-400 outline-none" />
          </div>
          {/* Image upload */}
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Photo <span className="text-gray-400 font-normal">(optional)</span></label>
            <input ref={fileRef} type="file" accept="image/*" onChange={onFileChange} className="hidden" />
            {preview ? (
              <div className="relative h-32 w-full rounded-xl overflow-hidden border border-gray-200 group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview} alt="preview" className="w-full h-full object-cover" />
                <button type="button" onClick={() => { setFile(null); setPreview(null); if (fileRef.current) fileRef.current.value = ""; }}
                  className="absolute top-1.5 right-1.5 bg-white/90 hover:bg-white rounded-full p-1 shadow transition opacity-0 group-hover:opacity-100">
                  <X size={12} className="text-red-500" />
                </button>
                <button type="button" onClick={() => fileRef.current?.click()}
                  className="absolute bottom-1.5 right-1.5 bg-white/90 hover:bg-white rounded-lg px-2 py-1 text-[0.65rem] font-semibold shadow transition flex items-center gap-1 opacity-0 group-hover:opacity-100">
                  <Upload size={10} /> Change
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => fileRef.current?.click()}
                className="w-full h-24 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-teal-400 hover:text-teal-500 transition">
                <ImageIcon size={22} />
                <span className="text-xs font-medium">Click to upload image</span>
              </button>
            )}
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-200 rounded-xl py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition">Cancel</button>
            <button type="submit" disabled={loading}
              className="flex-1 bg-teal-600 text-white rounded-xl py-2 text-xs font-semibold hover:bg-teal-700 transition disabled:opacity-60 flex items-center justify-center gap-1.5">
              {loading ? <Loader2 size={11} className="animate-spin" /> : null}
              {loading ? "Saving…" : mode === "edit" ? "Update" : "Add Asset"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AssetsView({ activeShop, isAdmin, isManager, assets, stats }: Props) {
  const router = useRouter();
  const [search, setSearch]         = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [mounted, setMounted]       = useState(false);
  const [modal, setModal]           = useState<{ mode: ModalMode; asset?: Asset }>({ mode: null });
  const [, startTransition]         = useTransition();
  const { dd, open, close, menuRef } = usePortalDD();

  useEffect(() => setMounted(true), []);

  const handleDelete = (id: string) => {
    close();
    if (!confirm("Delete this asset?")) return;
    setDeletingId(id);
    startTransition(async () => {
      const res = await deleteAssetAction(id);
      setDeletingId(null);
      if (res.success) router.refresh(); else alert(res.error ?? "Delete failed");
    });
  };

  const filtered = assets.filter(a =>
    a.itemName.toLowerCase().includes(search.toLowerCase())
  );

  const ddAsset = dd.id ? assets.find(a => a.id === dd.id) : null;

  return (
    <>
      <style>{`
        @keyframes cardIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        .asset-card{animation:cardIn 0.18s ease both}
        @keyframes ddIn{from{opacity:0;transform:scale(0.95) translateY(-4px)}to{opacity:1;transform:scale(1) translateY(0)}}
        .dd-menu{animation:ddIn 0.12s ease both;transform-origin:top right}
      `}</style>

      <div className="min-h-screen bg-slate-50/80 px-3 py-5 md:px-6">
        <div className="mx-auto max-w-screen-xl space-y-5">

          {/* Header */}
          <div className="flex items-center justify-between rounded-xl border bg-white px-5 py-4 shadow-sm">
            <div>
              <h1 className="text-xl font-black text-gray-900 flex items-center gap-2">
                <Boxes size={22} className="text-teal-600" /> Assets
              </h1>
              <p className="text-xs text-gray-400 mt-0.5">{activeShop.name} · {activeShop.location}</p>
            </div>
            {isManager && (
              <button onClick={() => setModal({ mode: "add" })}
                className="flex items-center gap-1.5 bg-teal-600 text-white px-3 py-2 rounded-xl text-xs font-bold hover:bg-teal-700 transition">
                <Plus size={14} /> Add Asset
              </button>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="relative overflow-hidden rounded-xl border border-gray-100 bg-white px-4 pt-4 pb-3 shadow-sm">
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-teal-500" />
              <p className="text-[0.63rem] font-bold uppercase tracking-widest text-gray-400 mb-1">Total Assets</p>
              <p className="text-3xl font-black tabular-nums text-gray-900">{stats.total}</p>
            </div>
            <div className="relative overflow-hidden rounded-xl border border-gray-100 bg-white px-4 pt-4 pb-3 shadow-sm">
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-cyan-500" />
              <p className="text-[0.63rem] font-bold uppercase tracking-widest text-gray-400 mb-1">Total Value</p>
              <p className="text-3xl font-black tabular-nums text-gray-900">KSh {stats.totalCost.toLocaleString()}</p>
            </div>
          </div>

          {/* Search */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search assets…"
              className="w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 py-2 text-xs focus:border-teal-400 outline-none shadow-sm transition" />
          </div>

          {/* Grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((a, i) => (
              <div key={a.id} style={{ animationDelay: `${i * 0.04}s` }}
                className="asset-card rounded-2xl border border-gray-200 bg-white shadow-sm hover:shadow-md hover:border-teal-200 transition-all overflow-hidden relative">
                {isManager && (
                  <button onClick={e => open(a.id, e)}
                    className={`absolute top-3 right-3 z-10 rounded-lg p-1.5 transition-colors ${dd.id === a.id ? "bg-gray-200" : "bg-white/80 hover:bg-gray-100 text-gray-400"}`}>
                    <MoreVertical size={14} />
                  </button>
                )}
                {/* Image */}
                <div className="h-36 bg-teal-50 flex items-center justify-center overflow-hidden">
                  {a.imageUrl ? (
                    <Image src={a.imageUrl} alt={a.itemName} fill className="object-cover" sizes="(max-width: 640px) 100vw, 25vw" />
                  ) : (
                    <Boxes size={40} className="text-teal-200" strokeWidth={1} />
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-black text-gray-900 text-sm truncate">{a.itemName}</h3>
                  <p className="text-lg font-black text-teal-700 tabular-nums mt-1">KSh {a.cost.toLocaleString()}</p>
                  <p className="text-[0.65rem] text-gray-400 mt-1">Added {a.date}</p>
                </div>
              </div>
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="rounded-2xl border border-gray-200 bg-white py-24 text-center">
              <div className="flex flex-col items-center gap-3 text-gray-300">
                <Boxes size={38} strokeWidth={1} />
                <p className="text-sm font-semibold text-gray-400">No assets found</p>
              </div>
            </div>
          )}

        </div>
      </div>

      {modal.mode && (
        <AssetModal shopId={activeShop.id} mode={modal.mode} asset={modal.asset} onClose={() => setModal({ mode: null })} />
      )}

      {mounted && dd.id && ddAsset && createPortal(
        <div ref={menuRef} className="dd-menu fixed z-[99999] w-[156px] bg-white rounded-2xl shadow-2xl border border-gray-100 py-1.5" style={{ top: dd.top, left: dd.left }}>
          <button onClick={() => { close(); setModal({ mode: "edit", asset: ddAsset }); }}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-gray-100"><Pencil size={11} /></span>Edit
          </button>
          {isAdmin && (
            <button onClick={() => handleDelete(ddAsset.id)} disabled={deletingId === ddAsset.id}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-red-50 text-red-500">
                {deletingId === ddAsset.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
              </span>Delete
            </button>
          )}
        </div>,
        document.body
      )}
    </>
  );
}
