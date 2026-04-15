"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  X, Search, Plus, Minus, Trash2, ShoppingCart, CreditCard,
  User, ChevronDown, Loader2, AlertCircle, CheckCircle2, Package,
} from "lucide-react";
import { createSaleAction } from "./actions";

// ── Types ─────────────────────────────────────────────────────────────────────
type Product = {
  id: string;
  productName: string;
  sellingPrice: number;
  buyingPrice: number;
  quantity: number;
  discount: number;
};

type CartItem = {
  productId: string;
  productName: string;
  price: number;
  discount: number;
  quantity: number;
  maxQty: number;
};

type PaymentLine = { method: string; amount: number };

export type NewSaleResult = {
  saleId:        string;
  totalAmount:   number;
  payments:      PaymentLine[];
  customerName:  string;
  customerPhone: string;
  items: { productName: string; quantity: number; price: number; discount: number }[];
  sellerName: string;
  date: string;
};

type Props = {
  shopId:     string;
  products:   Product[];
  sellerName: string;
  onClose:    () => void;
  onSuccess:  (result: NewSaleResult) => void;
};

const PAYMENT_METHODS = [
  { value: "cash",   label: "Cash",     emoji: "💵" },
  { value: "mpesa",  label: "M-Pesa",   emoji: "📱" },
  { value: "bank",   label: "Bank",     emoji: "🏦" },
  { value: "card",   label: "Card",     emoji: "💳" },
  { value: "credit", label: "Credit",   emoji: "🤝" },
];

// ── Product search dropdown ───────────────────────────────────────────────────
function ProductSearch({
  products,
  onAdd,
}: { products: Product[]; onAdd: (p: Product) => void }) {
  const [q, setQ]             = useState("");
  const [open, setOpen]       = useState(false);
  const ref                   = useRef<HTMLDivElement>(null);
  const inputRef              = useRef<HTMLInputElement>(null);

  const filtered = q.trim()
    ? products.filter(p =>
        p.productName.toLowerCase().includes(q.toLowerCase()) && p.quantity > 0
      ).slice(0, 8)
    : products.filter(p => p.quantity > 0).slice(0, 8);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const pick = (p: Product) => {
    onAdd(p);
    setQ("");
    setOpen(false);
    inputRef.current?.focus();
  };

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          ref={inputRef}
          value={q}
          onChange={e => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Search product to add…"
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-300 text-sm outline-none focus:border-indigo-500 bg-white"
        />
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
          {filtered.map(p => (
            <button
              key={p.id}
              type="button"
              onMouseDown={() => pick(p)}
              className="w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-indigo-50 transition-colors text-left"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Package size={13} className="text-indigo-400 shrink-0" />
                <span className="font-medium text-gray-800 truncate">{p.productName}</span>
              </div>
              <div className="flex items-center gap-3 shrink-0 ml-2 text-xs text-gray-500">
                <span className="text-indigo-700 font-semibold">
                  KSh {(p.sellingPrice - (p.discount ?? 0)).toLocaleString()}
                </span>
                <span className="bg-gray-100 px-1.5 py-0.5 rounded font-medium">{p.quantity} left</span>
              </div>
            </button>
          ))}
        </div>
      )}
      {open && q.trim() && filtered.length === 0 && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-xl px-4 py-3 text-sm text-gray-400 text-center">
          No products found
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function SellModal({ shopId, products, sellerName, onClose, onSuccess }: Props) {
  const [cart, setCart]               = useState<CartItem[]>([]);
  const [payments, setPayments]       = useState<PaymentLine[]>([{ method: "cash", amount: 0 }]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [creditDueDate, setCreditDueDate] = useState("");
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [step, setStep]               = useState<"cart" | "pay">("cart");

  const hasCredit = payments.some(p => p.method === "credit" && p.amount > 0);

  // ── Cart helpers ──────────────────────────────────────────────────────
  const addToCart = useCallback((p: Product) => {
    setCart(prev => {
      const existing = prev.find(c => c.productId === p.id);
      if (existing) {
        return prev.map(c =>
          c.productId === p.id
            ? { ...c, quantity: Math.min(c.quantity + 1, c.maxQty) }
            : c
        );
      }
      return [...prev, {
        productId:   p.id,
        productName: p.productName,
        price:       p.sellingPrice,
        discount:    p.discount ?? 0,
        quantity:    1,
        maxQty:      p.quantity,
      }];
    });
    setError(null);
  }, []);

  const removeFromCart = (productId: string) =>
    setCart(prev => prev.filter(c => c.productId !== productId));

  const updateQty = (productId: string, qty: number) =>
    setCart(prev =>
      prev.map(c =>
        c.productId === productId
          ? { ...c, quantity: Math.max(1, Math.min(qty, c.maxQty)) }
          : c
      )
    );

  const updatePrice = (productId: string, price: number) =>
    setCart(prev =>
      prev.map(c => c.productId === productId ? { ...c, price } : c)
    );

  const updateDiscount = (productId: string, discount: number) =>
    setCart(prev =>
      prev.map(c => c.productId === productId ? { ...c, discount } : c)
    );

  // ── Totals ────────────────────────────────────────────────────────────
  const totalAmount = cart.reduce(
    (s, i) => s + (i.price - i.discount) * i.quantity, 0
  );
  const totalPaid   = payments.reduce((s, p) => s + (p.amount || 0), 0);
  const remaining   = totalAmount - totalPaid;

  // ── Payment helpers ───────────────────────────────────────────────────
  const addPaymentLine = () => {
    const used = new Set(payments.map(p => p.method));
    const next = PAYMENT_METHODS.find(m => !used.has(m.value));
    if (next) setPayments(prev => [...prev, { method: next.value, amount: 0 }]);
  };

  const removePaymentLine = (idx: number) =>
    setPayments(prev => prev.filter((_, i) => i !== idx));

  const updatePaymentMethod = (idx: number, method: string) =>
    setPayments(prev => prev.map((p, i) => i === idx ? { ...p, method } : p));

  const updatePaymentAmount = (idx: number, amount: number) =>
    setPayments(prev => prev.map((p, i) => i === idx ? { ...p, amount } : p));

  // Auto-fill remaining amount into last payment line when moving to pay step
  useEffect(() => {
    if (step === "pay" && payments.length === 1 && payments[0].amount === 0) {
      setPayments([{ method: "cash", amount: totalAmount }]);
    }
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Submit ────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (cart.length === 0) { setError("Add at least one item."); return; }
    if (totalPaid < totalAmount) {
      setError(`Payment KSh ${totalPaid.toLocaleString()} is less than total KSh ${totalAmount.toLocaleString()}.`);
      return;
    }
    const validPayments = payments.filter(p => p.amount > 0);
    if (validPayments.length === 0) { setError("Enter at least one payment amount."); return; }

    if (hasCredit) {
      if (!customerName.trim()) { setError("Customer name is required for credit sales."); return; }
      if (!creditDueDate)        { setError("Due date is required for credit sales."); return; }
    }

    setLoading(true);
    setError(null);

    const res = await createSaleAction(shopId, {
      items: cart.map(c => ({
        productId: c.productId,
        quantity:  c.quantity,
        price:     c.price,
        discount:  c.discount,
      })),
      payments: validPayments,
      customerName:  customerName.trim() || undefined,
      customerPhone: customerPhone.trim() || undefined,
      creditDueDate: creditDueDate || undefined,
    });

    setLoading(false);

    if (!res.success) {
      setError(res.error ?? "Sale failed.");
      return;
    }

    onSuccess({
      saleId:        res.saleId!,
      totalAmount,
      payments:      validPayments,
      customerName:  customerName.trim(),
      customerPhone: customerPhone.trim(),
      items: cart.map(c => ({
        productName: c.productName,
        quantity:    c.quantity,
        price:       c.price,
        discount:    c.discount,
      })),
      sellerName,
      date: new Date().toLocaleString("en-GB", {
        day:    "2-digit",
        month:  "short",
        year:   "numeric",
        hour:   "2-digit",
        minute: "2-digit",
      }),
    });
  };

  // ── Escape key ────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const usedMethods = new Set(payments.map(p => p.method));
  const canAddMore  = usedMethods.size < PAYMENT_METHODS.length;

  return (
    <div className="fixed inset-0 z-[300] bg-black/60 flex items-center justify-center p-3">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b bg-gradient-to-r from-indigo-50 to-white shrink-0">
          <div>
            <h2 className="font-bold text-gray-800 flex items-center gap-2">
              <ShoppingCart size={18} className="text-indigo-600" /> New Sale
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {cart.length} item{cart.length !== 1 ? "s" : ""} · KSh {totalAmount.toLocaleString()}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Step tabs */}
        <div className="flex border-b shrink-0">
          {(["cart", "pay"] as const).map(s => (
            <button
              key={s}
              onClick={() => { if (s === "pay" && cart.length === 0) return; setStep(s); setError(null); }}
              className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                step === s
                  ? "border-b-2 border-indigo-600 text-indigo-700 bg-indigo-50/50"
                  : "text-gray-500 hover:text-gray-700"
              } ${s === "pay" && cart.length === 0 ? "opacity-40 cursor-not-allowed" : ""}`}
            >
              {s === "cart" ? "1. Items" : "2. Payment"}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* ── Step 1: Cart ─────────────────────────────────────────── */}
          {step === "cart" && (
            <div className="p-5 space-y-4">
              <ProductSearch products={products} onAdd={addToCart} />

              {cart.length === 0 ? (
                <div className="py-10 text-center">
                  <ShoppingCart size={40} className="mx-auto mb-3 text-gray-200" />
                  <p className="text-gray-400 text-sm">Search above to add products</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {cart.map(item => (
                    <div key={item.productId} className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                      <div className="flex items-start justify-between mb-2">
                        <div className="font-semibold text-sm text-gray-800 flex-1 pr-2">
                          {item.productName}
                          <span className="text-xs text-gray-400 font-normal ml-1">(max {item.maxQty})</span>
                        </div>
                        <button
                          onClick={() => removeFromCart(item.productId)}
                          className="text-red-400 hover:text-red-600 p-1 rounded transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        {/* Quantity */}
                        <div>
                          <label className="text-[0.65rem] text-gray-500 font-semibold uppercase tracking-wide block mb-1">Qty</label>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => updateQty(item.productId, item.quantity - 1)}
                              className="w-7 h-7 rounded-lg bg-gray-200 hover:bg-gray-300 flex items-center justify-center transition-colors"
                            >
                              <Minus size={12} />
                            </button>
                            <input
                              type="number"
                              min={1}
                              max={item.maxQty}
                              value={item.quantity}
                              onChange={e => updateQty(item.productId, parseInt(e.target.value) || 1)}
                              className="w-12 text-center text-sm font-bold border border-gray-300 rounded-lg py-1 outline-none focus:border-indigo-400"
                            />
                            <button
                              onClick={() => updateQty(item.productId, item.quantity + 1)}
                              className="w-7 h-7 rounded-lg bg-gray-200 hover:bg-gray-300 flex items-center justify-center transition-colors"
                            >
                              <Plus size={12} />
                            </button>
                          </div>
                        </div>

                        {/* Price */}
                        <div>
                          <label className="text-[0.65rem] text-gray-500 font-semibold uppercase tracking-wide block mb-1">Unit Price</label>
                          <input
                            type="number"
                            min={0}
                            value={item.price}
                            onChange={e => updatePrice(item.productId, parseFloat(e.target.value) || 0)}
                            className="w-full text-sm border border-gray-300 rounded-lg px-2 py-1.5 outline-none focus:border-indigo-400"
                          />
                        </div>

                        {/* Discount */}
                        <div>
                          <label className="text-[0.65rem] text-gray-500 font-semibold uppercase tracking-wide block mb-1">Discount</label>
                          <input
                            type="number"
                            min={0}
                            max={item.price}
                            value={item.discount}
                            onChange={e => updateDiscount(item.productId, parseFloat(e.target.value) || 0)}
                            className="w-full text-sm border border-gray-300 rounded-lg px-2 py-1.5 outline-none focus:border-indigo-400"
                          />
                        </div>
                      </div>

                      {/* Line total */}
                      <div className="text-right text-sm font-bold text-indigo-700 mt-2">
                        = KSh {((item.price - item.discount) * item.quantity).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Step 2: Payment ──────────────────────────────────────── */}
          {step === "pay" && (
            <div className="p-5 space-y-5">

              {/* Order summary */}
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
                <div className="text-xs font-semibold text-indigo-600 uppercase tracking-wide mb-2">Order Summary</div>
                <div className="space-y-1 mb-3">
                  {cart.map(item => (
                    <div key={item.productId} className="flex justify-between text-sm">
                      <span className="text-gray-700">
                        {item.productName}
                        <span className="text-gray-400 text-xs ml-1">×{item.quantity}</span>
                      </span>
                      <span className="font-semibold text-gray-800">
                        KSh {((item.price - item.discount) * item.quantity).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-indigo-200 pt-2 flex justify-between font-black text-base">
                  <span>Total</span>
                  <span className="text-indigo-700">KSh {totalAmount.toLocaleString()}</span>
                </div>
              </div>

              {/* Payment methods */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                    <CreditCard size={15} className="text-indigo-500" /> Payment Methods
                  </span>
                  {canAddMore && (
                    <button
                      onClick={addPaymentLine}
                      className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold flex items-center gap-1"
                    >
                      <Plus size={13} /> Add method
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  {payments.map((pmt, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <div className="relative">
                        <select
                          value={pmt.method}
                          onChange={e => updatePaymentMethod(idx, e.target.value)}
                          className="pl-3 pr-7 py-2.5 border border-gray-300 rounded-xl text-sm outline-none focus:border-indigo-400 bg-white appearance-none font-medium"
                        >
                          {PAYMENT_METHODS.map(m => (
                            <option
                              key={m.value}
                              value={m.value}
                              disabled={usedMethods.has(m.value) && m.value !== pmt.method}
                            >
                              {m.emoji} {m.label}
                            </option>
                          ))}
                        </select>
                        <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                      </div>
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">KSh</span>
                        <input
                          type="number"
                          min={0}
                          value={pmt.amount || ""}
                          onChange={e => updatePaymentAmount(idx, parseFloat(e.target.value) || 0)}
                          placeholder="0"
                          className="w-full pl-12 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm outline-none focus:border-indigo-400 font-semibold"
                        />
                      </div>
                      {payments.length > 1 && (
                        <button
                          onClick={() => removePaymentLine(idx)}
                          className="p-2.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Balance indicator */}
                <div className={`mt-3 flex items-center justify-between px-4 py-3 rounded-xl text-sm font-semibold border ${
                  remaining <= 0
                    ? "bg-green-50 border-green-200 text-green-700"
                    : "bg-amber-50 border-amber-200 text-amber-700"
                }`}>
                  <span>{remaining <= 0 ? (remaining < 0 ? "Change" : "Exact amount") : "Remaining"}</span>
                  <span className="font-black text-base">
                    KSh {Math.abs(remaining).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Customer info — required for credit, optional otherwise */}
              <div>
                <div className="text-sm font-semibold text-gray-700 flex items-center gap-1.5 mb-2">
                  <User size={15} className="text-indigo-500" /> Customer Info
                  {hasCredit
                    ? <span className="text-xs font-bold text-red-500">* required for credit</span>
                    : <span className="text-xs font-normal text-gray-400">(optional)</span>
                  }
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                    placeholder={hasCredit ? "Customer name *" : "Customer name"}
                    className={`border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-400 ${hasCredit && !customerName ? "border-red-300" : "border-gray-300"}`}
                  />
                  <input
                    value={customerPhone}
                    onChange={e => setCustomerPhone(e.target.value)}
                    placeholder="Phone number"
                    className="border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-400"
                  />
                </div>
              </div>

              {/* Due date — only shown when credit is selected */}
              {hasCredit && (
                <div>
                  <div className="text-sm font-semibold text-gray-700 flex items-center gap-1.5 mb-2">
                    <AlertCircle size={15} className="text-orange-500" /> Credit Due Date
                    <span className="text-xs font-bold text-red-500">* required</span>
                  </div>
                  <input
                    type="date"
                    value={creditDueDate}
                    onChange={e => setCreditDueDate(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                    className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-400 ${!creditDueDate ? "border-red-300" : "border-gray-300"}`}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mx-5 mb-1 flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
            <AlertCircle size={15} className="shrink-0" />
            {error}
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-4 border-t bg-gray-50/80 flex gap-3 shrink-0">
          {step === "cart" ? (
            <>
              <button
                onClick={onClose}
                className="flex-none px-4 py-2.5 border border-gray-300 text-gray-600 rounded-xl text-sm font-semibold hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (cart.length === 0) { setError("Add at least one item first."); return; }
                  setStep("pay");
                  setError(null);
                }}
                disabled={cart.length === 0}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors"
              >
                Next: Payment <ChevronDown size={15} className="-rotate-90" />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => { setStep("cart"); setError(null); }}
                className="flex-none px-4 py-2.5 border border-gray-300 text-gray-600 rounded-xl text-sm font-semibold hover:bg-gray-100 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading || remaining > 0}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors"
              >
                {loading
                  ? <><Loader2 size={15} className="animate-spin" /> Processing…</>
                  : <><CheckCircle2 size={15} /> Complete Sale · KSh {totalAmount.toLocaleString()}</>
                }
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
