"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  X, Plus, Pencil, Trash2, Loader2, Search,
  FolderOpen, FolderTree, Check,
} from "lucide-react";
import {
  saveCategoryAction, deleteCategoryAction,
  saveSubCategoryAction, deleteSubCategoryAction,
} from "./actions";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  shopId: string;
  categories:    { id: string; name: string }[];
  subCategories: { id: string; name: string; categoryId: string; category?: { name: string } }[];
  onClose: () => void;
}

// ── Inline edit input ─────────────────────────────────────────────────────────

function InlineInput({
  defaultValue, onSave, onCancel, isPending,
}: { defaultValue: string; onSave: (v: string) => void; onCancel: () => void; isPending: boolean }) {
  const [val, setVal] = useState(defaultValue);
  return (
    <div className="flex items-center gap-2 flex-1">
      <input
        autoFocus
        value={val}
        onChange={(e) => setVal(e.target.value)}
        className="flex-1 rounded-lg border border-indigo-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 min-w-0"
        onKeyDown={(e) => { if (e.key === "Enter") onSave(val); if (e.key === "Escape") onCancel(); }}
      />
      <button
        onClick={() => onSave(val)}
        disabled={isPending || !val.trim()}
        className="p-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition"
      >
        {isPending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
      </button>
      <button onClick={onCancel} className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 transition">
        <X size={13} />
      </button>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function CategoryManager({ shopId, categories, subCategories, onClose }: Props) {
  const router = useRouter();

  const [catSearch,  setCatSearch]  = useState("");
  const [subSearch,  setSubSearch]  = useState("");
  const [filterCat,  setFilterCat]  = useState("all");

  // Editing state
  const [editingCatId,  setEditingCatId]  = useState<string | null>(null);
  const [editingSubId,  setEditingSubId]  = useState<string | null>(null);
  const [addingCat,     setAddingCat]     = useState(false);
  const [addingSubCat,  setAddingSubCat]  = useState(false);
  const [newCatName,    setNewCatName]    = useState("");
  const [newSubName,    setNewSubName]    = useState("");
  const [newSubCatId,   setNewSubCatId]   = useState("");

  // Loading states
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [globalBusy,   setGlobalBusy]   = useState(false);

  const filteredCats = categories.filter((c) =>
    c.name.toLowerCase().includes(catSearch.toLowerCase())
  );

  const filteredSubs = subCategories.filter((s) => {
    const matchSearch = s.name.toLowerCase().includes(subSearch.toLowerCase());
    const matchCat    = filterCat === "all" || s.categoryId === filterCat;
    return matchSearch && matchCat;
  });

  // ── Category CRUD ───────────────────────────────────────────────────────────

  const handleAddCategory = async () => {
    if (!newCatName.trim()) return;
    setGlobalBusy(true);
    const fd = new FormData();
    fd.set("name", newCatName.trim());
    fd.set("shopId", shopId);
    const res = await saveCategoryAction({ success: false }, fd);
    setGlobalBusy(false);
    if (res.success) { router.refresh(); setAddingCat(false); setNewCatName(""); }
    else alert(res.error ?? "Failed to add category");
  };

  const handleRenameCategory = async (id: string, name: string) => {
    if (!name.trim()) return;
    setProcessingId(id);
    const fd = new FormData();
    fd.set("id", id);
    fd.set("name", name.trim());
    fd.set("shopId", shopId);
    const res = await saveCategoryAction({ success: false }, fd);
    setProcessingId(null);
    if (res.success) { router.refresh(); setEditingCatId(null); }
    else alert(res.error ?? "Rename failed");
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm("Delete this category? Subcategories will also be deleted.")) return;
    setProcessingId(id);
    const res = await deleteCategoryAction(id, shopId);
    setProcessingId(null);
    if (res.success) router.refresh();
    else alert(res.error ?? "Delete failed");
  };

  // ── Subcategory CRUD ────────────────────────────────────────────────────────

  const handleAddSubCategory = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newSubName.trim() || !newSubCatId) return;
    setGlobalBusy(true);
    const fd = new FormData();
    fd.set("name", newSubName.trim());
    fd.set("categoryId", newSubCatId);
    fd.set("shopId", shopId);
    const res = await saveSubCategoryAction({ success: false }, fd);
    setGlobalBusy(false);
    if (res.success) { router.refresh(); setAddingSubCat(false); setNewSubName(""); setNewSubCatId(""); }
    else alert(res.error ?? "Failed to add subcategory");
  };

  const handleRenameSubCategory = async (id: string, name: string, categoryId: string) => {
    if (!name.trim()) return;
    setProcessingId(id);
    const fd = new FormData();
    fd.set("id", id);
    fd.set("name", name.trim());
    fd.set("categoryId", categoryId);
    fd.set("shopId", shopId);
    const res = await saveSubCategoryAction({ success: false }, fd);
    setProcessingId(null);
    if (res.success) { router.refresh(); setEditingSubId(null); }
    else alert(res.error ?? "Rename failed");
  };

  const handleDeleteSubCategory = async (id: string) => {
    if (!confirm("Delete this subcategory?")) return;
    setProcessingId(id);
    const res = await deleteSubCategoryAction(id, shopId);
    setProcessingId(null);
    if (res.success) router.refresh();
    else alert(res.error ?? "Delete failed");
  };

  return (
    <div className="fixed inset-0 z-[150] flex justify-end">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 flex flex-col bg-white shadow-2xl w-full max-w-2xl h-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 shrink-0 bg-gradient-to-r from-indigo-50 to-violet-50">
          <div>
            <h2 className="font-bold text-gray-900 text-lg">Catalogue Manager</h2>
            <p className="text-xs text-gray-400 mt-0.5">Manage categories and subcategories</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/80 text-gray-500 transition shadow-sm">
            <X size={18} />
          </button>
        </div>

        {/* Two-panel body */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-100">

          {/* ── LEFT: Categories ─────────────────────────────────────────── */}
          <div className="flex flex-col overflow-hidden">
            <div className="px-4 pt-4 pb-3 shrink-0">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <FolderOpen size={15} className="text-indigo-500" />
                  <h3 className="font-bold text-sm text-gray-800">Categories</h3>
                  <span className="text-[0.65rem] rounded-full bg-indigo-100 text-indigo-600 font-bold px-2 py-0.5">
                    {categories.length}
                  </span>
                </div>
                <button
                  onClick={() => { setAddingCat(true); setNewCatName(""); }}
                  disabled={globalBusy}
                  className="flex items-center gap-1 rounded-lg bg-indigo-600 text-white px-3 py-1.5 text-xs font-semibold hover:bg-indigo-700 disabled:opacity-60 transition"
                >
                  <Plus size={13} /> Add
                </button>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={13} />
                <input
                  value={catSearch}
                  onChange={(e) => setCatSearch(e.target.value)}
                  placeholder="Search categories…"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-3 py-2 text-xs focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition"
                />
              </div>
            </div>

            {/* Add new category inline */}
            {addingCat && (
              <div className="mx-4 mb-3 flex items-center gap-2">
                <input
                  autoFocus
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="Category name"
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddCategory(); if (e.key === "Escape") setAddingCat(false); }}
                  className="flex-1 rounded-lg border border-indigo-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                />
                <button
                  onClick={handleAddCategory}
                  disabled={globalBusy || !newCatName.trim()}
                  className="p-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition"
                >
                  {globalBusy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                </button>
                <button onClick={() => setAddingCat(false)} className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 transition">
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Category list */}
            <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-1.5">
              {filteredCats.length === 0 ? (
                <div className="py-12 text-center text-gray-400 text-xs">No categories found</div>
              ) : filteredCats.map((c) => (
                <div
                  key={c.id}
                  className={`flex items-center gap-2 rounded-xl px-3 py-2.5 border transition ${
                    filterCat === c.id
                      ? "border-indigo-200 bg-indigo-50"
                      : "border-transparent bg-gray-50 hover:bg-gray-100"
                  }`}
                >
                  {editingCatId === c.id ? (
                    <InlineInput
                      defaultValue={c.name}
                      onSave={(v) => handleRenameCategory(c.id, v)}
                      onCancel={() => setEditingCatId(null)}
                      isPending={processingId === c.id}
                    />
                  ) : (
                    <>
                      <button
                        onClick={() => setFilterCat(filterCat === c.id ? "all" : c.id)}
                        className="flex-1 text-left text-sm font-medium text-gray-800 truncate"
                      >
                        {c.name}
                      </button>
                      <span className="text-[0.6rem] text-gray-400 shrink-0">
                        {subCategories.filter((s) => s.categoryId === c.id).length} subs
                      </span>
                      <button
                        onClick={() => setEditingCatId(c.id)}
                        disabled={processingId === c.id}
                        className="p-1.5 rounded-lg text-gray-400 hover:bg-white hover:text-indigo-600 transition disabled:opacity-40 shrink-0"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => handleDeleteCategory(c.id)}
                        disabled={processingId === c.id}
                        className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 transition disabled:opacity-40 shrink-0"
                      >
                        {processingId === c.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ── RIGHT: Subcategories ──────────────────────────────────────── */}
          <div className="flex flex-col overflow-hidden">
            <div className="px-4 pt-4 pb-3 shrink-0">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <FolderTree size={15} className="text-violet-500" />
                  <h3 className="font-bold text-sm text-gray-800">Subcategories</h3>
                  <span className="text-[0.65rem] rounded-full bg-violet-100 text-violet-600 font-bold px-2 py-0.5">
                    {filteredSubs.length}
                  </span>
                </div>
                <button
                  onClick={() => { setAddingSubCat(true); setNewSubName(""); setNewSubCatId(""); }}
                  disabled={globalBusy}
                  className="flex items-center gap-1 rounded-lg bg-violet-600 text-white px-3 py-1.5 text-xs font-semibold hover:bg-violet-700 disabled:opacity-60 transition"
                >
                  <Plus size={13} /> Add
                </button>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={13} />
                <input
                  value={subSearch}
                  onChange={(e) => setSubSearch(e.target.value)}
                  placeholder="Search subcategories…"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-3 py-2 text-xs focus:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-100 transition"
                />
              </div>

              {filterCat !== "all" && (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-indigo-600 font-medium">
                  <FolderOpen size={12} />
                  Filtered by: {categories.find((c) => c.id === filterCat)?.name}
                  <button onClick={() => setFilterCat("all")} className="ml-1 text-gray-400 hover:text-red-500 transition">
                    <X size={12} />
                  </button>
                </div>
              )}
            </div>

            {/* Add new subcategory */}
            {addingSubCat && (
              <form onSubmit={handleAddSubCategory} className="mx-4 mb-3 flex flex-col gap-2">
                <select
                  value={newSubCatId}
                  onChange={(e) => setNewSubCatId(e.target.value)}
                  required
                  className="rounded-lg border border-violet-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-violet-200"
                >
                  <option value="">Select parent category</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <div className="flex gap-2">
                  <input
                    autoFocus
                    value={newSubName}
                    onChange={(e) => setNewSubName(e.target.value)}
                    placeholder="Subcategory name"
                    required
                    className="flex-1 rounded-lg border border-violet-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
                  />
                  <button
                    type="submit"
                    disabled={globalBusy || !newSubName.trim() || !newSubCatId}
                    className="p-2 rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 transition"
                  >
                    {globalBusy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  </button>
                  <button type="button" onClick={() => setAddingSubCat(false)} className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 transition">
                    <X size={14} />
                  </button>
                </div>
              </form>
            )}

            {/* Subcategory list */}
            <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-1.5">
              {filteredSubs.length === 0 ? (
                <div className="py-12 text-center text-gray-400 text-xs">
                  {filterCat !== "all" ? "No subcategories in this category" : "No subcategories found"}
                </div>
              ) : filteredSubs.map((s) => (
                <div key={s.id} className="flex items-center gap-2 rounded-xl px-3 py-2.5 bg-gray-50 hover:bg-gray-100 border border-transparent transition">
                  {editingSubId === s.id ? (
                    <InlineInput
                      defaultValue={s.name}
                      onSave={(v) => handleRenameSubCategory(s.id, v, s.categoryId)}
                      onCancel={() => setEditingSubId(null)}
                      isPending={processingId === s.id}
                    />
                  ) : (
                    <>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{s.name}</p>
                        <p className="text-[0.63rem] text-gray-400 truncate">
                          {s.category?.name ?? categories.find((c) => c.id === s.categoryId)?.name ?? "—"}
                        </p>
                      </div>
                      <button
                        onClick={() => setEditingSubId(s.id)}
                        disabled={processingId === s.id}
                        className="p-1.5 rounded-lg text-gray-400 hover:bg-white hover:text-indigo-600 transition disabled:opacity-40 shrink-0"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => handleDeleteSubCategory(s.id)}
                        disabled={processingId === s.id}
                        className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 transition disabled:opacity-40 shrink-0"
                      >
                        {processingId === s.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
