"use client";

import { useState } from "react";
import { X, ArrowRightCircle, Loader2, User, Phone, PlusCircle } from "lucide-react";

type Quote = {
  id: string;
  items: { id: string; productName: string; quantity: number; price: number; discount: number }[];
  amount: number;
  customerName: string;
  customerContact?: string;
};

export type ConvertPayload = {
  paymentMethod: string;
  downPayment: number;
  dueDate?: string;
  customerName?: string;
  customerContact?: string;
  splits: { method: string; amount: number }[];
};

type Props = {
  quote: Quote;
  onConfirm: (payload: ConvertPayload) => void;
  onClose: () => void;
  loading: boolean;
};

type SplitLine = { id: string; method: string; amount: number };

const PAYMENT_METHODS = [
  { value: "cash",   label: "Cash",   emoji: "💵" },
  { value: "mpesa",  label: "M-Pesa", emoji: "📱" },
  { value: "bank",   label: "Bank",   emoji: "🏦" },
  { value: "card",   label: "Card",   emoji: "💳" },
  { value: "credit", label: "Credit", emoji: "🤝" },
];

function genId() { return Math.random().toString(36).slice(2, 9); }

export default function ConvertModal({ quote, onConfirm, onClose, loading }: Props) {
  const [splits, setSplits]               = useState<SplitLine[]>([{ id: genId(), method: "", amount: quote.amount }]);
  const [dueDate, setDueDate]             = useState("");
  const [customerName, setCustomerName]   = useState(quote.customerName ?? "");
  const [customerContact, setCustomerContact] = useState(quote.customerContact ?? "");

  const hasCredit   = splits.some(s => s.method === "credit");
  const totalSplits = splits.reduce((s, l) => s + (l.amount || 0), 0);
  const balance     = quote.amount - totalSplits;
  const isBalanced  = Math.abs(balance) < 0.01;

  const creditAmount  = splits.find(s => s.method === "credit")?.amount ?? 0;
  const nonCreditPaid = splits.filter(s => s.method !== "credit").reduce((s, l) => s + l.amount, 0);
  const primaryMethod = splits.length === 1 ? splits[0].method : (hasCredit ? "credit" : splits[0].method);

  const addSplit = () => {
    const leftover = Math.max(0, quote.amount - totalSplits);
    setSplits(prev => [...prev, { id: genId(), method: "", amount: leftover }]);
  };
  const removeSplit = (id: string) => setSplits(prev => prev.filter(l => l.id !== id));
  const updateSplit = (id: string, field: keyof Omit<SplitLine, "id">, value: string | number) => {
    setSplits(prev => prev.map(l => l.id === id ? { ...l, [field]: value } : l));
  };
  const autoFill = (id: string) => {
    const others = splits.filter(l => l.id !== id).reduce((s, l) => s + (l.amount || 0), 0);
    updateSplit(id, "amount", Math.max(0, quote.amount - others));
  };

  const canSubmit = splits.every(s => s.method) && (splits.length === 1 || isBalanced) && !loading;

  const handleConfirm = () => {
    if (!canSubmit) return;
    onConfirm({
      paymentMethod: primaryMethod,
      downPayment:   nonCreditPaid,
      dueDate:       dueDate || undefined,
      customerName:  customerName || undefined,
      customerContact: customerContact || undefined,
      splits: splits.map(s => ({ method: s.method, amount: s.amount })),
    });
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0 bg-gradient-to-r from-green-50 to-emerald-50">
          <div>
            <h2 className="font-bold text-gray-800">Convert to Sale</h2>
            <p className="text-xs text-gray-500 mt-0.5">Choose how payment was made</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/80 rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Items preview */}
          <div className="bg-gray-50 rounded-xl px-4 py-3 space-y-1">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Converting Items</p>
            <p className="text-sm text-gray-700 leading-relaxed">
              {quote.items.map(i => `${i.productName} ×${i.quantity}`).join(", ")}
            </p>
          </div>

          {/* Total */}
          <div className="flex justify-between items-center bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3">
            <span className="text-sm text-indigo-700 font-semibold">Total Amount</span>
            <span className="font-black text-indigo-900 text-xl">KSh {quote.amount.toLocaleString()}</span>
          </div>

          {/* Customer Info */}
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 space-y-2">
            <p className="text-xs font-bold text-blue-700 flex items-center gap-1.5">
              <User size={12} /> Customer Info
            </p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <User size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  placeholder="Customer name (optional)"
                  className="w-full pl-7 pr-2 py-2 border border-gray-300 rounded-lg text-xs focus:border-blue-400 outline-none bg-white"
                />
              </div>
              <div className="relative flex-1">
                <Phone size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={customerContact}
                  onChange={e => setCustomerContact(e.target.value)}
                  placeholder="Phone (optional)"
                  className="w-full pl-7 pr-2 py-2 border border-gray-300 rounded-lg text-xs focus:border-blue-400 outline-none bg-white"
                />
              </div>
            </div>
          </div>

          {/* Payment Splits */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-gray-700">Payment Method(s)</label>
              {splits.length < 4 && (
                <button
                  type="button"
                  onClick={addSplit}
                  className="flex items-center gap-1 text-xs text-green-700 font-semibold hover:text-green-800 transition-colors"
                >
                  <PlusCircle size={13} /> Split payment
                </button>
              )}
            </div>

            {splits.map((sp) => (
              <div key={sp.id} className="flex gap-2 items-center">
                <select
                  value={sp.method}
                  onChange={e => updateSplit(sp.id, "method", e.target.value)}
                  className="flex-1 border border-gray-300 rounded-xl px-3 py-2.5 text-sm bg-white focus:border-blue-400 outline-none"
                >
                  <option value="">Select method…</option>
                  {PAYMENT_METHODS.map(m => (
                    <option key={m.value} value={m.value}>{m.emoji} {m.label}</option>
                  ))}
                </select>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    max={quote.amount}
                    value={sp.amount || ""}
                    onChange={e => updateSplit(sp.id, "amount", Number(e.target.value))}
                    onFocus={() => { if (!sp.amount) autoFill(sp.id); }}
                    className="w-28 border border-gray-300 rounded-xl px-2 py-2.5 text-sm text-right pr-6 focus:border-blue-400 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => autoFill(sp.id)}
                    title="Auto-fill remaining"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-500 text-xs transition-colors"
                  >↺</button>
                </div>
                {splits.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeSplit(sp.id)}
                    className="w-8 h-8 rounded-full bg-red-50 hover:bg-red-100 text-red-400 flex items-center justify-center shrink-0 transition-colors"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            ))}

            {/* Balance indicator */}
            {splits.length > 1 && (
              <div className={`flex justify-between text-xs px-3 py-2 rounded-lg font-semibold transition-colors ${
                isBalanced ? "bg-green-50 text-green-700 border border-green-200" :
                balance > 0 ? "bg-amber-50 text-amber-700 border border-amber-200" :
                "bg-red-50 text-red-700 border border-red-200"
              }`}>
                <span>Total allocated: KSh {totalSplits.toLocaleString()}</span>
                <span>
                  {isBalanced
                    ? "✓ Balanced"
                    : balance > 0
                    ? `KSh ${balance.toLocaleString()} short`
                    : `Over by KSh ${Math.abs(balance).toLocaleString()}`}
                </span>
              </div>
            )}
          </div>

          {/* Credit-specific fields */}
          {hasCredit && (
            <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 space-y-3">
              <p className="text-xs font-bold text-orange-700 uppercase tracking-wide">🏦 Credit Terms</p>
              <div>
                <label className="block mb-1 text-xs font-medium text-gray-700">Due Date (optional)</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-orange-400 outline-none"
                />
              </div>
              <div className="bg-white rounded-lg px-3 py-2.5 text-sm space-y-1.5">
                <div className="flex justify-between text-gray-600">
                  <span>Paid now:</span>
                  <span className="text-green-700 font-semibold">KSh {nonCreditPaid.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Credit balance:</span>
                  <span className="text-orange-600 font-bold">KSh {creditAmount.toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={handleConfirm}
            disabled={!canSubmit}
            className="w-full bg-green-600 hover:bg-green-700 active:bg-green-800 disabled:bg-green-200 disabled:cursor-not-allowed text-white py-3 font-bold rounded-xl flex items-center justify-center gap-2 transition-colors text-sm"
          >
            {loading
              ? <Loader2 size={18} className="animate-spin" />
              : <>
                  <ArrowRightCircle size={18} />
                  {hasCredit ? "Record Credit Sale" : "Confirm Sale — KSh " + quote.amount.toLocaleString()}
                </>
            }
          </button>
        </div>
      </div>
    </div>
  );
}
