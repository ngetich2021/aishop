"use client";

import { useActionState, useEffect, useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  X, ArrowLeft, Plus, Loader2, Eye, Package,
  Tag, Hash, DollarSign, Archive, BarChart3, Image as ImageIcon,
} from "lucide-react";
import { saveProductAction, saveCategoryAction, saveSubCategoryAction } from "./actions";
import type { ActionResult } from "./actions";

// ── Types ─────────────────────────────────────────────────────────────────────

type Mode = "add" | "edit" | "view";

export type ProductToEdit = {
  id: string;
  name: string;
  serialNo: string | null;
  price: number;
  discount: number;
  buyingPrice: number;
  quantity: number;
  outOfStockLimit: number;
  subCategoryId: string;
  categoryId: string;
  image: string | null;
};

interface Props {
  shopId: string;
  mode: Mode;
  productToEdit?: ProductToEdit;
  categories: { id: string; name: string }[];
  subCategories: { id: string; name: string; categoryId: string }[];
  onSuccess: () => void;
  onClose: () => void;
}

// ── Field styles ──────────────────────────────────────────────────────────────

const field = (readonly?: boolean) =>
  `w-full rounded-xl border px-4 py-2.5 text-sm transition focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 ${
    readonly ? "bg-gray-50 text-gray-600 cursor-not-allowed border-gray-200" : "bg-white border-gray-300"
  }`;

// ── Quick-add mini modal ───────────────────────────────────────────────────────

function QuickAdd({
  title, onClose, onSubmit, isPending, children,
}: { title: string; onClose: () => void; onSubmit: (e: React.FormEvent<HTMLFormElement>) => void; isPending: boolean; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition">
            <X size={16} />
          </button>
        </div>
        <form onSubmit={onSubmit} className="p-5 space-y-4">
          {children}
          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 transition flex items-center justify-center gap-2"
          >
            {isPending ? <><Loader2 size={15} className="animate-spin" /> Saving…</> : "Add"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ProductFormModal({
  shopId, mode, productToEdit, categories, subCategories, onSuccess, onClose,
}: Props) {
  const router   = useRouter();
  const formRef  = useRef<HTMLFormElement>(null);
  const fileRef  = useRef<HTMLInputElement>(null);

  const isView = mode === "view";
  const isEdit = mode === "edit";

  const [catId,    setCatId]    = useState(productToEdit?.categoryId   ?? "");
  const [subId,    setSubId]    = useState(productToEdit?.subCategoryId ?? "");
  const [preview,  setPreview]  = useState<string | null>(productToEdit?.image ?? null);

  // Live margin preview
  const [buying,   setBuying]   = useState(productToEdit?.buyingPrice  ?? 0);
  const [selling,  setSelling]  = useState(productToEdit?.price        ?? 0);
  const margin    = selling - buying;
  const marginPct = buying > 0 ? Math.round((margin / buying) * 100) : 0;

  const [showCatModal, setShowCatModal] = useState(false);
  const [showSubModal, setShowSubModal] = useState(false);
  const [quickPending, setQuickPending] = useState(false);

  const matchingSubs = subCategories.filter((s) => s.categoryId === catId);

  const [state, submitAction, isPending] = useActionState<ActionResult, FormData>(
    (_, fd) => saveProductAction(_, fd),
    { success: false }
  );

  useEffect(() => { if (state.success) onSuccess(); }, [state.success, onSuccess]);

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setPreview(URL.createObjectURL(f));
  };

  const handleQuickCategory = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setQuickPending(true);
    const fd = new FormData(e.currentTarget);
    fd.set("shopId", shopId);
    const res = await saveCategoryAction({ success: false }, fd);
    setQuickPending(false);
    if (res.success) { router.refresh(); setShowCatModal(false); }
  };

  const handleQuickSubcategory = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setQuickPending(true);
    const fd = new FormData(e.currentTarget);
    fd.set("shopId", shopId);
    const res = await saveSubCategoryAction({ success: false }, fd);
    setQuickPending(false);
    if (res.success) { router.refresh(); setShowSubModal(false); }
  };

  return (
    <>
      {/* ── Backdrop + Slide-in sheet ────────────────────────────────────── */}
      <div className="fixed inset-0 z-[100] flex justify-end">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

        <div className="relative z-10 flex flex-col bg-white shadow-2xl w-full max-w-xl h-full overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 shrink-0">
            <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-gray-100 text-gray-500 transition">
              <ArrowLeft size={18} />
            </button>
            <div className="flex-1 min-w-0">
              <h2 className="font-bold text-gray-900">
                {isView ? "Product Details" : isEdit ? "Edit Product" : "Add Product"}
              </h2>
              <p className="text-xs text-gray-400">
                {isView ? "Read-only view"
                  : isEdit ? "Update product information"
                  : "Fill in product details"}
              </p>
            </div>
            {isView && (
              <span className="flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-500">
                <Eye size={12} /> View
              </span>
            )}
          </div>

          {/* Form */}
          <form ref={formRef} action={submitAction} className="flex-1 overflow-y-auto">
            <div className="px-5 py-5 space-y-5">
              {/* Hidden fields */}
              {productToEdit?.id && <input type="hidden" name="productId" value={productToEdit.id} />}
              <input type="hidden" name="shopId" value={shopId} />

              {/* Error */}
              {state.error && (
                <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm font-medium">
                  {state.error}
                </div>
              )}

              {/* ── Product Name + Serial ── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    <Tag size={12} /> Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    name="productName"
                    defaultValue={productToEdit?.name ?? ""}
                    required
                    readOnly={isView}
                    placeholder="e.g. Samsung Galaxy A55"
                    className={field(isView)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    <Hash size={12} /> Serial No
                  </label>
                  <input
                    name="serialNo"
                    defaultValue={productToEdit?.serialNo ?? ""}
                    readOnly={isView}
                    placeholder="Optional"
                    className={field(isView)}
                  />
                </div>
              </div>

              {/* ── Category + Subcategory ── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    <Archive size={12} /> Category <span className="text-red-400">*</span>
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={catId}
                      onChange={(e) => { if (!isView) { setCatId(e.target.value); setSubId(""); } }}
                      required
                      disabled={isView}
                      className={`flex-1 ${field(isView)}`}
                    >
                      <option value="">Select…</option>
                      {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    {!isView && (
                      <button
                        type="button"
                        onClick={() => setShowCatModal(true)}
                        className="px-3 rounded-xl bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition border border-indigo-100"
                        title="Add category"
                      >
                        <Plus size={15} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    <Archive size={12} /> Subcategory <span className="text-red-400">*</span>
                  </label>
                  <div className="flex gap-2">
                    <select
                      name="subCategoryId"
                      value={subId}
                      onChange={(e) => { if (!isView) setSubId(e.target.value); }}
                      required
                      disabled={isView || !catId}
                      className={`flex-1 ${field(isView || !catId)}`}
                    >
                      <option value="">{catId ? "Select…" : "Pick category first"}</option>
                      {matchingSubs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    {!isView && (
                      <button
                        type="button"
                        onClick={() => setShowSubModal(true)}
                        className="px-3 rounded-xl bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition border border-indigo-100"
                        title="Add subcategory"
                      >
                        <Plus size={15} />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Prices ── */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    <DollarSign size={12} /> Buying <span className="text-red-400">*</span>
                  </label>
                  <input
                    name="buyingPrice"
                    type="number"
                    min="0"
                    value={isView ? buying : undefined}
                    defaultValue={!isView ? buying : undefined}
                    onChange={(e) => !isView && setBuying(Number(e.target.value))}
                    required
                    readOnly={isView}
                    className={field(isView)}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    <DollarSign size={12} /> Selling <span className="text-red-400">*</span>
                  </label>
                  <input
                    name="sellingPrice"
                    type="number"
                    min="1"
                    value={isView ? selling : undefined}
                    defaultValue={!isView ? selling : undefined}
                    onChange={(e) => !isView && setSelling(Number(e.target.value))}
                    required
                    readOnly={isView}
                    className={field(isView)}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Discount
                  </label>
                  <input
                    name="discount"
                    type="number"
                    min="0"
                    defaultValue={productToEdit?.discount ?? 0}
                    readOnly={isView}
                    className={field(isView)}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    <BarChart3 size={12} /> Margin
                  </label>
                  <div className={`flex items-center rounded-xl border px-4 py-2.5 text-sm font-bold bg-gray-50 border-gray-200 ${
                    marginPct >= 20 ? "text-emerald-600" : marginPct >= 10 ? "text-amber-600" : "text-red-500"
                  }`}>
                    {marginPct}%
                  </div>
                </div>
              </div>

              {/* ── Quantity + Out-of-stock limit ── */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Quantity {isEdit && <span className="text-[0.6rem] text-gray-400 normal-case">(locked on edit)</span>}
                  </label>
                  <input
                    name="quantity"
                    type="number"
                    min="0"
                    defaultValue={productToEdit?.quantity ?? 0}
                    readOnly={isView || isEdit}
                    className={field(isView || isEdit)}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Low-stock Alert At
                  </label>
                  <input
                    name="outOfStockLimit"
                    type="number"
                    min="0"
                    defaultValue={productToEdit?.outOfStockLimit ?? 5}
                    readOnly={isView}
                    className={field(isView)}
                  />
                </div>
              </div>

              {/* ── Image ── */}
              <div className="space-y-2">
                <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  <ImageIcon size={12} /> Product Image
                </label>

                {isView ? (
                  preview
                    ? <div className="relative h-48 rounded-2xl overflow-hidden bg-gray-50 border border-gray-200">
                        <Image src={preview} alt="product" fill className="object-contain" />
                      </div>
                    : <div className="h-24 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-400 text-xs">
                        No image
                      </div>
                ) : (
                  <div
                    onClick={() => fileRef.current?.click()}
                    className="relative h-48 rounded-2xl border-2 border-dashed border-indigo-200 bg-indigo-50/30 hover:border-indigo-400 hover:bg-indigo-50/60 cursor-pointer transition group overflow-hidden"
                  >
                    {preview ? (
                      <>
                        <Image src={preview} alt="preview" fill className="object-contain group-hover:opacity-90 transition" />
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setPreview(null); if (fileRef.current) fileRef.current.value = ""; }}
                          className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1 hover:bg-black/80 transition"
                        >
                          <X size={14} />
                        </button>
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full gap-2 text-indigo-400">
                        <Package size={32} strokeWidth={1.5} />
                        <p className="text-xs font-medium">Click to upload image</p>
                        <p className="text-[0.65rem] text-gray-400">JPG, PNG, WebP · max 5 MB</p>
                      </div>
                    )}
                    <input
                      ref={fileRef}
                      name="image"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={handleImageChange}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Footer actions */}
            {!isView && (
              <div className="sticky bottom-0 bg-white border-t border-gray-100 px-5 py-4 flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 rounded-xl border border-gray-200 bg-gray-50 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 transition flex items-center justify-center gap-2"
                >
                  {isPending
                    ? <><Loader2 size={15} className="animate-spin" /> Saving…</>
                    : isEdit ? "Save Changes" : "Add Product"}
                </button>
              </div>
            )}
          </form>
        </div>
      </div>

      {/* ── Quick-add Category ─────────────────────────────────────────── */}
      {showCatModal && (
        <QuickAdd title="New Category" onClose={() => setShowCatModal(false)} onSubmit={handleQuickCategory} isPending={quickPending}>
          <input
            name="name"
            required
            placeholder="Category name"
            className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />
        </QuickAdd>
      )}

      {/* ── Quick-add Subcategory ──────────────────────────────────────── */}
      {showSubModal && (
        <QuickAdd title="New Subcategory" onClose={() => setShowSubModal(false)} onSubmit={handleQuickSubcategory} isPending={quickPending}>
          <select
            name="categoryId"
            required
            className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          >
            <option value="">Select parent category</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input
            name="name"
            required
            placeholder="Subcategory name"
            className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />
        </QuickAdd>
      )}
    </>
  );
}
