"use client";

import { useActionState, useEffect, useState, useRef } from "react";
import {
  X, SlidersHorizontal, RotateCcw, Package, Plus, Trash2,
  TrendingUp, TrendingDown, Minus,
  ChevronDown, AlertCircle, Info,
} from "lucide-react";
import { saveAdjustmentAction, type ActionResult } from "./actions";
import { saveReturnAction } from "./returnactions";
import type { Adjustment, Return, ReturnItem } from "./AdjustStockView";

// ── Local types ───────────────────────────────────────────────────────────────

type ProductOption = { id: string; productName: string; quantity: number; sellingPrice: number };
type SaleOption   = { id: string; label: string };
type Profile      = { role: string; shopId: string; fullName: string };

interface Props {
  shopId:   string;
  mode:     "adjustment" | "return";
  viewAdj?: Adjustment;
  viewRet?: Return;
  products: ProductOption[];
  sales:    SaleOption[];
  profile:  Profile;
  onSuccess: () => void;
  onClose:   () => void;
}

// ── Line item for return form ─────────────────────────────────────────────────

type LineItem = {
  id:        string;
  productId: string;
  quantity:  number;
  price:     number;
  reason:    string;
};

const blank = (): LineItem => ({
  id:        crypto.randomUUID(),
  productId: "",
  quantity:  1,
  price:     0,
  reason:    "",
});

// ── Adjust type options ───────────────────────────────────────────────────────

const ADJ_OPTS = [
  { value: "increase", label: "Increase",    Icon: TrendingUp,   cls: "text-emerald-600 bg-emerald-50 border-emerald-200" },
  { value: "decrease", label: "Decrease",    Icon: TrendingDown, cls: "text-red-600 bg-red-50 border-red-200"             },
  { value: "set",      label: "Set to exact", Icon: Minus,        cls: "text-blue-600 bg-blue-50 border-blue-200"         },
] as const;

// ── Status display ────────────────────────────────────────────────────────────

const STATUS_META: Record<string, { bg: string; text: string; dot: string }> = {
  pending:  { bg: "bg-amber-50",   text: "text-amber-700",   dot: "bg-amber-400"  },
  approved: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  rejected: { bg: "bg-red-50",     text: "text-red-700",     dot: "bg-red-500"    },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) { return n.toLocaleString(); }

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[0.68rem] font-bold uppercase tracking-widest text-gray-400">
        {label}
      </label>
      {children}
    </div>
  );
}

function ReadRow({ label, value, accent }: { label: string; value: React.ReactNode; accent?: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2.5 border-b border-gray-100 last:border-0">
      <span className="text-xs text-gray-500 font-medium shrink-0">{label}</span>
      <span className={`text-xs font-semibold text-right ${accent ?? "text-gray-800"}`}>{value}</span>
    </div>
  );
}

// ── Adjustment Form ───────────────────────────────────────────────────────────

function AdjustmentForm({
  shopId, products, onSuccess, onClose,
}: {
  shopId: string; products: ProductOption[];
  onSuccess: () => void; onClose: () => void;
}) {
  const init: ActionResult = { success: false };
  const [state, dispatch, pending] = useActionState(saveAdjustmentAction, init);

  const [productId,  setProductId]  = useState("");
  const [adjustType, setAdjustType] = useState<"increase"|"decrease"|"set">("increase");
  const [quantity,   setQuantity]   = useState(1);
  const [typeOpen,   setTypeOpen]   = useState(false);
  const typeRef = useRef<HTMLDivElement>(null);

  const product = products.find((p) => p.id === productId);

  const preview = product
    ? adjustType === "increase" ? product.quantity + quantity
      : adjustType === "decrease" ? Math.max(0, product.quantity - quantity)
      : quantity
    : null;

  useEffect(() => {
    if (state.success) onSuccess();
  }, [state.success]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (typeRef.current && !typeRef.current.contains(e.target as Node)) setTypeOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const chosen = ADJ_OPTS.find((o) => o.value === adjustType)!;

  return (
    <form action={dispatch} className="flex flex-col gap-5 flex-1">
      <input type="hidden" name="shopId"    value={shopId} />
      <input type="hidden" name="adjustType" value={adjustType} />

      {/* Product */}
      <Field label="Product">
        <select
          name="productId"
          value={productId}
          onChange={(e) => { setProductId(e.target.value); }}
          required
          className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-800 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none"
        >
          <option value="">— select a product —</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.productName} (stock: {p.quantity})
            </option>
          ))}
        </select>
      </Field>

      {/* Current stock chip */}
      {product && (
        <div className="flex items-center gap-2 rounded-xl bg-gray-50 border border-gray-100 px-4 py-3">
          <Package size={14} className="text-gray-400 shrink-0" />
          <span className="text-xs text-gray-500">Current stock:</span>
          <span className="text-sm font-bold text-gray-800 tabular-nums">{fmt(product.quantity)}</span>
          <span className="ml-auto text-xs text-gray-400">@ KSh {fmt(product.sellingPrice)}</span>
        </div>
      )}

      {/* Adjust type */}
      <Field label="Adjustment type">
        <div className="relative" ref={typeRef}>
          <button
            type="button"
            onClick={() => setTypeOpen((v) => !v)}
            className={`w-full flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm font-semibold transition-all ${chosen.cls}`}
          >
            <chosen.Icon size={15} className="shrink-0" />
            {chosen.label}
            <ChevronDown size={14} className="ml-auto text-current opacity-60" />
          </button>
          {typeOpen && (
            <div className="absolute top-full left-0 mt-1.5 w-full rounded-xl border border-gray-200 bg-white shadow-lg z-50 overflow-hidden">
              {ADJ_OPTS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => { setAdjustType(o.value as typeof adjustType); setTypeOpen(false); }}
                  className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium hover:bg-gray-50 transition-colors ${adjustType === o.value ? "bg-gray-50 font-semibold" : ""}`}
                >
                  <o.Icon size={14} className="shrink-0 text-gray-400" />
                  {o.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </Field>

      {/* Quantity */}
      <Field label={adjustType === "set" ? "Set quantity to" : "Quantity"}>
        <input
          type="number"
          name="quantity"
          min={0}
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
          required
          className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-800 tabular-nums focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none"
        />
      </Field>

      {/* Preview */}
      {product && preview !== null && (
        <div className={`rounded-xl px-4 py-3 border flex items-center gap-3 ${
          adjustType === "increase" ? "bg-emerald-50 border-emerald-200"
          : adjustType === "decrease" ? "bg-red-50 border-red-200"
          : "bg-blue-50 border-blue-200"
        }`}>
          <Info size={15} className="shrink-0 text-gray-400" />
          <div className="flex-1 min-w-0">
            <span className="text-xs text-gray-600">Stock after adjustment: </span>
            <span className="text-sm font-bold text-gray-900 tabular-nums">{fmt(preview)}</span>
          </div>
          <div className="text-xs text-gray-500 tabular-nums">
            {adjustType === "increase" && <span className="text-emerald-600 font-semibold">+{fmt(quantity)}</span>}
            {adjustType === "decrease" && <span className="text-red-600 font-semibold">−{fmt(quantity)}</span>}
            {adjustType === "set"      && <span className="text-blue-600 font-semibold">→ {fmt(quantity)}</span>}
          </div>
        </div>
      )}

      {/* Error */}
      {state.error && !state.success && (
        <div className="flex items-center gap-2.5 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={15} className="shrink-0" />
          {state.error}
        </div>
      )}

      {/* Footer */}
      <div className="mt-auto pt-4 border-t border-gray-100 flex gap-3">
        <button
          type="button"
          onClick={onClose}
          disabled={pending}
          className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending || !productId}
          className="flex-1 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {pending ? "Saving…" : "Save Adjustment"}
        </button>
      </div>
    </form>
  );
}

// ── Return Form ───────────────────────────────────────────────────────────────

function ReturnForm({
  shopId, products, sales, onSuccess, onClose,
}: {
  shopId: string; products: ProductOption[]; sales: SaleOption[];
  onSuccess: () => void; onClose: () => void;
}) {
  const init: ActionResult = { success: false };
  const [state, dispatch, pending] = useActionState(saveReturnAction, init);

  const [lines,  setLines]  = useState<LineItem[]>([blank()]);
  const [saleId, setSaleId] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (state.success) onSuccess();
  }, [state.success]);

  const updateLine = (id: string, patch: Partial<LineItem>) => {
    setLines((prev) => prev.map((l) => l.id === id ? { ...l, ...patch } : l));
  };

  const addLine   = () => setLines((prev) => [...prev, blank()]);
  const removeLine = (id: string) => setLines((prev) => prev.length > 1 ? prev.filter((l) => l.id !== id) : prev);

  const autoFillPrice = (lineId: string, productId: string) => {
    const p = products.find((x) => x.id === productId);
    if (p) updateLine(lineId, { productId, price: p.sellingPrice });
    else    updateLine(lineId, { productId });
  };

  const totalValue = lines.reduce((s, l) => s + l.price * l.quantity, 0);
  const totalQty   = lines.reduce((s, l) => s + l.quantity, 0);
  const isValid    = lines.every((l) => l.productId && l.quantity >= 1);

  const items = lines.map((l) => ({
    productId: l.productId,
    quantity:  l.quantity,
    price:     l.price,
    reason:    l.reason || undefined,
  }));

  return (
    <form action={dispatch} className="flex flex-col gap-5 flex-1">
      <input type="hidden" name="shopId" value={shopId} />
      <input type="hidden" name="saleId" value={saleId} />
      <input type="hidden" name="reason" value={reason} />
      <input type="hidden" name="items"  value={JSON.stringify(items)} />

      {/* Optional sale reference */}
      <Field label="Linked sale (optional)">
        <select
          value={saleId}
          onChange={(e) => setSaleId(e.target.value)}
          className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-800 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none"
        >
          <option value="">— none —</option>
          {sales.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
      </Field>

      {/* Overall reason */}
      <Field label="Return reason (optional)">
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Damaged goods, customer complaint…"
          className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-800 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none"
        />
      </Field>

      {/* Line items */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[0.68rem] font-bold uppercase tracking-widest text-gray-400">Items</span>
          <button
            type="button"
            onClick={addLine}
            className="flex items-center gap-1 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-2.5 py-1 text-xs font-semibold transition-colors"
          >
            <Plus size={12} /> Add item
          </button>
        </div>

        <div className="space-y-3">
          {lines.map((line, idx) => {
            const prod = products.find((p) => p.id === line.productId);
            return (
              <div key={line.id} className="rounded-xl border border-gray-200 bg-gray-50 p-3 space-y-2.5">
                {/* Row header */}
                <div className="flex items-center justify-between">
                  <span className="text-[0.65rem] font-bold uppercase tracking-widest text-gray-400">Item {idx + 1}</span>
                  {lines.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeLine(line.id)}
                      className="rounded-lg p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>

                {/* Product */}
                <select
                  value={line.productId}
                  onChange={(e) => autoFillPrice(line.id, e.target.value)}
                  required
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-800 focus:border-indigo-400 outline-none"
                >
                  <option value="">— select product —</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.productName}</option>
                  ))}
                </select>

                {/* Qty + Price row */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[0.6rem] font-bold uppercase tracking-widest text-gray-400 mb-1">Qty</label>
                    <input
                      type="number"
                      min={1}
                      value={line.quantity}
                      onChange={(e) => updateLine(line.id, { quantity: Number(e.target.value) })}
                      required
                      className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs tabular-nums focus:border-indigo-400 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[0.6rem] font-bold uppercase tracking-widest text-gray-400 mb-1">Price (KSh)</label>
                    <input
                      type="number"
                      min={0}
                      value={line.price}
                      onChange={(e) => updateLine(line.id, { price: Number(e.target.value) })}
                      className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs tabular-nums focus:border-indigo-400 outline-none"
                    />
                  </div>
                </div>

                {/* Reason per item */}
                <input
                  type="text"
                  placeholder="Item reason (optional)"
                  value={line.reason}
                  onChange={(e) => updateLine(line.id, { reason: e.target.value })}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs focus:border-indigo-400 outline-none"
                />

                {/* Stock available */}
                {prod && (
                  <p className="text-[0.65rem] text-gray-400">
                    Stock in system: <span className="font-semibold text-gray-600">{prod.quantity}</span>
                    {" · "}Subtotal: <span className="font-semibold text-gray-700">KSh {fmt(line.price * line.quantity)}</span>
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Totals summary */}
      <div className="rounded-xl bg-violet-50 border border-violet-100 px-4 py-3 flex items-center gap-4">
        <div className="flex-1">
          <p className="text-[0.65rem] font-bold uppercase tracking-widest text-violet-400 mb-0.5">Total qty</p>
          <p className="text-lg font-bold text-violet-700 tabular-nums">{totalQty}</p>
        </div>
        <div className="w-px h-8 bg-violet-200" />
        <div className="flex-1">
          <p className="text-[0.65rem] font-bold uppercase tracking-widest text-violet-400 mb-0.5">Total value</p>
          <p className="text-lg font-bold text-violet-700 tabular-nums">KSh {fmt(totalValue)}</p>
        </div>
      </div>

      {/* Error */}
      {state.error && !state.success && (
        <div className="flex items-center gap-2.5 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={15} className="shrink-0" />
          {state.error}
        </div>
      )}

      {/* Footer */}
      <div className="mt-auto pt-4 border-t border-gray-100 flex gap-3">
        <button
          type="button"
          onClick={onClose}
          disabled={pending}
          className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending || !isValid}
          className="flex-1 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {pending ? "Saving…" : "Save Return"}
        </button>
      </div>
    </form>
  );
}

// ── View Adjustment (read-only) ───────────────────────────────────────────────

function ViewAdjustment({ adj, onClose }: { adj: Adjustment; onClose: () => void }) {
  const type  = adj.adjustType as "increase" | "decrease" | "set";
  const Icon  = type === "increase" ? TrendingUp : type === "decrease" ? TrendingDown : Minus;
  const color = type === "increase" ? "text-emerald-600" : type === "decrease" ? "text-red-600" : "text-blue-600";
  const bgCol = type === "increase" ? "bg-emerald-50 border-emerald-200" : type === "decrease" ? "bg-red-50 border-red-200" : "bg-blue-50 border-blue-200";

  return (
    <div className="flex flex-col gap-4 flex-1">
      {/* Type badge */}
      <div className={`flex items-center gap-2.5 rounded-xl border px-4 py-3 ${bgCol}`}>
        <Icon size={18} className={`shrink-0 ${color}`} />
        <div>
          <p className="text-[0.65rem] font-bold uppercase tracking-widest text-gray-400">Adjustment type</p>
          <p className={`text-sm font-bold capitalize ${color}`}>{adj.adjustType}</p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-[0.65rem] font-bold uppercase tracking-widest text-gray-400">Qty</p>
          <p className={`text-lg font-bold tabular-nums ${color}`}>
            {type === "increase" ? "+" : type === "decrease" ? "−" : ""}{adj.quantity}
          </p>
        </div>
      </div>

      {/* Details */}
      <div className="rounded-xl border border-gray-100 bg-white px-4 divide-y divide-gray-100">
        <ReadRow label="Product"       value={adj.productName} />
        <ReadRow label="Shop"          value={adj.shop} />
        <ReadRow label="Stock before"  value={<span className="tabular-nums">{fmt(adj.originalStock)}</span>} />
        <ReadRow label="Stock after"   value={<span className="tabular-nums">{fmt(adj.newStockQty)}</span>} accent="text-indigo-700" />
        <ReadRow label="Value"         value={<span className="tabular-nums">KSh {fmt(adj.value)}</span>} />
        <ReadRow label="Adjusted by"   value={adj.adjustedBy} />
        <ReadRow label="Date"          value={adj.date} />
      </div>

      <div className="mt-auto pt-4 border-t border-gray-100">
        <button
          onClick={onClose}
          className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}

// ── View Return (read-only) ───────────────────────────────────────────────────

function ViewReturn({ ret, onClose }: { ret: Return; onClose: () => void }) {
  const sm = STATUS_META[ret.status] ?? STATUS_META.pending;

  return (
    <div className="flex flex-col gap-4 flex-1">
      {/* Status chip */}
      <div className={`flex items-center gap-2.5 rounded-xl border px-4 py-3 ${sm.bg}`}>
        <span className={`h-2 w-2 rounded-full ${sm.dot} shrink-0`} />
        <p className={`text-sm font-bold capitalize ${sm.text}`}>{ret.status}</p>
        <div className="ml-auto text-right">
          <p className="text-[0.65rem] font-bold uppercase tracking-widest text-gray-400">Return ID</p>
          <p className="text-xs font-mono font-semibold text-gray-700">{ret.id.slice(0, 8).toUpperCase()}</p>
        </div>
      </div>

      {/* Meta */}
      <div className="rounded-xl border border-gray-100 bg-white px-4 divide-y divide-gray-100">
        <ReadRow label="Shop"      value={ret.shopName} />
        <ReadRow label="Date"      value={ret.date} />
        {ret.saleId && <ReadRow label="Linked sale" value={<span className="font-mono">{ret.saleId.slice(0, 8).toUpperCase()}</span>} />}
        {ret.reason && <ReadRow label="Reason"  value={ret.reason} />}
        <ReadRow label="Total qty"   value={<span className="tabular-nums">{fmt(ret.totalQty)}</span>} />
        <ReadRow label="Total value" value={<span className="tabular-nums">KSh {fmt(ret.totalValue)}</span>} accent="text-violet-700" />
      </div>

      {/* Items table */}
      <div>
        <p className="text-[0.68rem] font-bold uppercase tracking-widest text-gray-400 mb-2">Items</p>
        <div className="rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-3 py-2 text-left font-bold uppercase tracking-widest text-gray-400">Product</th>
                <th className="px-3 py-2 text-right font-bold uppercase tracking-widest text-gray-400">Qty</th>
                <th className="px-3 py-2 text-right font-bold uppercase tracking-widest text-gray-400">Price</th>
                <th className="px-3 py-2 text-right font-bold uppercase tracking-widest text-gray-400">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {ret.items.map((item: ReturnItem) => (
                <tr key={item.id} className="hover:bg-gray-50/50">
                  <td className="px-3 py-2.5 font-medium text-gray-800">
                    {item.productName}
                    {item.reason && (
                      <span className="block text-[0.65rem] text-gray-400 font-normal">{item.reason}</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-gray-700">{item.quantity}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-gray-700">{fmt(item.price)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-gray-800">{fmt(item.price * item.quantity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-auto pt-4 border-t border-gray-100">
        <button
          onClick={onClose}
          className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}

// ── Main Side Sheet ───────────────────────────────────────────────────────────

export default function AdjustmentFormSideSheet({
  shopId, mode, viewAdj, viewRet, products, sales, onSuccess, onClose,
}: Props) {
  const isView = !!(viewAdj || viewRet);

  const title = isView
    ? (viewAdj ? "Adjustment Details" : "Return Details")
    : (mode === "adjustment" ? "New Stock Adjustment" : "New Return");

  const Icon = mode === "adjustment"
    ? (isView ? SlidersHorizontal : SlidersHorizontal)
    : RotateCcw;

  const iconBg = mode === "adjustment" ? "bg-indigo-100" : "bg-violet-100";
  const iconCl = mode === "adjustment" ? "text-indigo-600" : "text-violet-600";

  // Trap focus inside panel
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
        onClick={onClose}
        aria-hidden
      />

      {/* Panel */}
      <div
        ref={panelRef}
        tabIndex={-1}
        className="fixed right-0 top-0 h-full w-full max-w-md bg-white z-50 flex flex-col shadow-2xl outline-none"
        style={{ animation: "slideInRight 0.22s cubic-bezier(.22,.87,.36,1) both" }}
      >
        {/* Header */}
        <div className={`px-5 py-4 border-b border-gray-100 flex items-center gap-3 shrink-0 ${
          mode === "adjustment" ? "bg-linear-to-r from-indigo-50 to-white" : "bg-linear-to-r from-violet-50 to-white"
        }`}>
          <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
            <Icon size={17} className={iconCl} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900 text-sm leading-tight">{title}</p>
            {!isView && (
              <p className="text-[0.65rem] text-gray-400 mt-0.5">
                {mode === "adjustment" ? "Update product stock levels" : "Record a product return + restore stock"}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors shrink-0"
            aria-label="Close"
          >
            <X size={17} />
          </button>
        </div>

        {/* Success toast (transient) */}
        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-0">
          {/* View modes */}
          {viewAdj && <ViewAdjustment adj={viewAdj} onClose={onClose} />}
          {viewRet && <ViewReturn ret={viewRet} onClose={onClose} />}

          {/* Create modes */}
          {!isView && mode === "adjustment" && (
            <AdjustmentForm
              shopId={shopId}
              products={products}
              onSuccess={onSuccess}
              onClose={onClose}
            />
          )}
          {!isView && mode === "return" && (
            <ReturnForm
              shopId={shopId}
              products={products}
              sales={sales}
              onSuccess={onSuccess}
              onClose={onClose}
            />
          )}
        </div>
      </div>

      {/* Slide-in keyframe */}
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </>
  );
}
