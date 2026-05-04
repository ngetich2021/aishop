"use client";

import { useState, useCallback, useRef, useEffect, useTransition } from "react";
import { Search, Loader2, Boxes, Plus, X, Pencil, Trash2, Upload, ImageIcon } from "lucide-react";
import { usePlan } from "@/components/PlanProvider";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createAssetAction, updateAssetAction, deleteAssetAction } from "./actions";

type Asset = { id: string; itemName: string; cost: number; imageUrl: string | null; date: string };
type ActiveShop = { id: string; name: string; location: string };
type Props = {
  activeShop: ActiveShop; isAdmin: boolean; isManager: boolean;
  assets: Asset[];
  stats: { total: number; totalCost: number };
};

type ModalMode = "add" | "edit" | null;

function AssetModal({ shopId, mode, asset, onClose }: { shopId: string; mode: ModalMode; asset?: Asset; onClose: () => void }) {
  const router = useRouter();
  const [name,    setName]    = useState(asset?.itemName ?? "");
  const [cost,    setCost]    = useState(asset?.cost?.toString() ?? "0");
  const [preview, setPreview] = useState<string | null>(asset?.imageUrl ?? null);
  const [file,    setFile]    = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-gray-100">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-black text-gray-900">{mode === "edit" ? "Edit" : "Add"} Asset</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition"><X size={15} /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Asset Name *</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Delivery Motorcycle" required
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:border-teal-400 outline-none" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Cost (KSh) *</label>
              <input type="number" min="0" step="0.01" value={cost} onChange={e => setCost(e.target.value)} required
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:border-teal-400 outline-none" />
            </div>
          </div>

          {/* Image upload — correctly positioned for Next/Image fill */}
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1.5 block">
              Photo <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input ref={fileRef} type="file" accept="image/*" onChange={onFileChange} className="hidden" />
            {preview ? (
              <div className="relative h-40 w-full rounded-xl overflow-hidden border border-gray-200 group bg-gray-50">
                <Image src={preview} alt="preview" fill className="object-cover" sizes="448px" unoptimized={preview.startsWith("blob:")} />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                <button type="button" onClick={() => { setFile(null); setPreview(null); if (fileRef.current) fileRef.current.value = ""; }}
                  className="absolute top-2 right-2 bg-white/90 hover:bg-white rounded-full p-1.5 shadow-md transition opacity-0 group-hover:opacity-100">
                  <X size={13} className="text-red-500" />
                </button>
                <button type="button" onClick={() => fileRef.current?.click()}
                  className="absolute bottom-2 right-2 bg-white/90 hover:bg-white rounded-lg px-2.5 py-1.5 text-[0.65rem] font-semibold shadow-md transition flex items-center gap-1 opacity-0 group-hover:opacity-100">
                  <Upload size={10} /> Change
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => fileRef.current?.click()}
                className="w-full h-32 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-teal-400 hover:text-teal-500 hover:bg-teal-50/30 transition">
                <div className="p-3 rounded-full bg-gray-100">
                  <ImageIcon size={20} />
                </div>
                <div className="text-center">
                  <p className="text-xs font-semibold">Click to upload photo</p>
                  <p className="text-[0.65rem] text-gray-400 mt-0.5">JPG, PNG, WEBP up to 5MB</p>
                </div>
              </button>
            )}
          </div>

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 border border-gray-200 rounded-xl py-2.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 bg-teal-600 text-white rounded-xl py-2.5 text-xs font-semibold hover:bg-teal-700 transition disabled:opacity-60 flex items-center justify-center gap-1.5">
              {loading ? <Loader2 size={11} className="animate-spin" /> : null}
              {loading ? "Saving…" : mode === "edit" ? "Update Asset" : "Add Asset"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AssetsView({ activeShop, isAdmin, isManager, assets, stats }: Props) {
  const router = useRouter();
  const { isDemo } = usePlan();
  const [search,     setSearch]     = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [modal,      setModal]      = useState<{ mode: ModalMode; asset?: Asset }>({ mode: null });
  const [, startTransition]         = useTransition();

  const handleDelete = useCallback((asset: Asset) => {
    if (!confirm(`Delete "${asset.itemName}"? This cannot be undone.`)) return;
    setDeletingId(asset.id);
    startTransition(async () => {
      const res = await deleteAssetAction(asset.id);
      setDeletingId(null);
      if (res.success) router.refresh(); else alert(res.error ?? "Delete failed");
    });
  }, [router, startTransition]);

  const filtered = assets.filter(a =>
    a.itemName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
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
                disabled={isDemo}
                title={isDemo ? "Upgrade your plan to add assets" : undefined}
                className="flex items-center gap-1.5 bg-teal-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-teal-700 transition disabled:opacity-40 disabled:cursor-not-allowed">
                <Plus size={15} /> Add Asset
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
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search assets…"
              className="w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 py-2 text-xs focus:border-teal-400 outline-none shadow-sm transition" />
          </div>

          {/* Table */}
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            {filtered.length === 0 ? (
              <div className="py-24 text-center">
                <Boxes size={38} strokeWidth={1} className="mx-auto mb-3 text-gray-200" />
                <p className="text-sm font-semibold text-gray-400">
                  {assets.length === 0 ? "No assets yet" : "No assets match your search"}
                </p>
                {isManager && assets.length === 0 && (
                  <button onClick={() => setModal({ mode: "add" })}
                    disabled={isDemo}
                    title={isDemo ? "Upgrade to add assets" : undefined}
                    className="mt-4 inline-flex items-center gap-2 bg-teal-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-teal-700 transition disabled:opacity-40 disabled:cursor-not-allowed">
                    <Plus size={14} /> Add First Asset
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px] border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-gray-200">
                      <th className="px-4 py-3.5 text-left text-xs font-bold uppercase tracking-widest text-gray-400 w-10">#</th>
                      <th className="px-4 py-3.5 text-left text-xs font-bold uppercase tracking-widest text-gray-400 w-16">Photo</th>
                      <th className="px-4 py-3.5 text-left text-xs font-bold uppercase tracking-widest text-gray-400">Asset Name</th>
                      <th className="px-4 py-3.5 text-right text-xs font-bold uppercase tracking-widest text-gray-400">Cost</th>
                      <th className="px-4 py-3.5 text-left text-xs font-bold uppercase tracking-widest text-gray-400">Date Added</th>
                      {isManager && (
                        <th className="px-4 py-3.5 text-right text-xs font-bold uppercase tracking-widest text-gray-400">Actions</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filtered.map((a, i) => (
                      <tr key={a.id} className="hover:bg-slate-50/70 transition-colors group">
                        <td className="px-4 py-3 text-xs text-gray-400 font-medium">{i + 1}</td>
                        <td className="px-4 py-3">
                          <div className="relative h-10 w-10 rounded-lg overflow-hidden bg-teal-50 shrink-0">
                            {a.imageUrl ? (
                              <Image
                                src={a.imageUrl}
                                alt={a.itemName}
                                fill
                                className="object-cover"
                                sizes="40px"
                              />
                            ) : (
                              <div className="h-full w-full flex items-center justify-center">
                                <Boxes size={18} className="text-teal-200" strokeWidth={1.5} />
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-semibold text-gray-900">{a.itemName}</td>
                        <td className="px-4 py-3 text-right font-black text-teal-700 tabular-nums">
                          KSh {a.cost.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">{a.date}</td>
                        {isManager && (
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => setModal({ mode: "edit", asset: a })}
                                className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition"
                                title="Edit"
                              >
                                <Pencil size={13} />
                              </button>
                              {isAdmin && (
                                <button
                                  onClick={() => handleDelete(a)}
                                  disabled={deletingId === a.id}
                                  className="p-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition disabled:opacity-50"
                                  title="Delete"
                                >
                                  {deletingId === a.id
                                    ? <Loader2 size={13} className="animate-spin" />
                                    : <Trash2 size={13} />}
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-teal-50 border-t-2 border-teal-100">
                      <td colSpan={3} className="px-4 py-3 text-xs font-bold text-teal-700 uppercase tracking-wide">
                        Total ({filtered.length} asset{filtered.length !== 1 ? "s" : ""})
                      </td>
                      <td className="px-4 py-3 text-right font-black text-teal-800 tabular-nums">
                        KSh {filtered.reduce((s, a) => s + a.cost, 0).toLocaleString()}
                      </td>
                      <td colSpan={isManager ? 2 : 1} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

        </div>
      </div>

      {modal.mode && (
        <AssetModal
          shopId={activeShop.id}
          mode={modal.mode}
          asset={modal.asset}
          onClose={() => setModal({ mode: null })}
        />
      )}
    </>
  );
}
