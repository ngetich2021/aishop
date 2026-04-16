"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search, MoreVertical, Printer, X, TrendingUp, Calendar,
  Hash, Loader2, ShoppingBag, CheckCircle2, XCircle,
  AlertCircle, Filter, Download,
} from "lucide-react";
import { createPortal } from "react-dom";
import { cancelSaleAction, markSalePrintedAction } from "./actions";
import SellModal, { type NewSaleResult } from "./SellModal";

// ── Types ─────────────────────────────────────────────────────────────────────
type SaleItem = { id: string; productName: string; quantity: number; price: number; discount: number };
type Sale = {
  id: string; soldById: string; soldByName: string;
  totalAmount: number; paymentMethod: string; paymentMethodsJson?: string | null;
  isPrinted: boolean; status: string; cancelReason: string | null;
  customerName: string | null;
  date: string; createdAt: string;
  hasReturn: boolean;
  items: SaleItem[];
};
type Product = {
  id: string; productName: string; sellingPrice: number;
  buyingPrice: number; quantity: number; discount: number;
};
type StatPair = { count: number; amount: number };
type StaffOption = { id: string; fullName: string };
type Shop = { id: string; name: string; location: string; tel: string };
type Profile = { role: string; fullName: string };

type Props = {
  stats: { today: StatPair; week: StatPair; month: StatPair; year: StatPair; total: StatPair };
  sales: Sale[];
  staffList: StaffOption[];
  shop: Shop;
  profile: Profile;
  methodBreakdown: Record<string, { count: number; amount: number }>;
  canSell: boolean;
  products: Product[];
};

type DDState = { id: string | null; top: number; left: number };

// ── Payment meta ──────────────────────────────────────────────────────────────
const METHOD_META: Record<string, { label: string; color: string; emoji: string }> = {
  cash:                { label: "Cash",          color: "bg-green-100 text-green-700 border-green-200",     emoji: "💵" },
  mpesa:               { label: "M-Pesa",        color: "bg-emerald-100 text-emerald-700 border-emerald-200", emoji: "📱" },
  bank:                { label: "Bank",           color: "bg-blue-100 text-blue-700 border-blue-200",        emoji: "🏦" },
  card:                { label: "Card",           color: "bg-purple-100 text-purple-700 border-purple-200",   emoji: "💳" },
  credit:              { label: "Credit",         color: "bg-orange-100 text-orange-700 border-orange-200",   emoji: "🤝" },
  credit_downpayment:  { label: "Down Payment",   color: "bg-amber-100 text-amber-700 border-amber-200",     emoji: "📋" },
};

function methodMeta(m: string) {
  return METHOD_META[m] ?? { label: m, color: "bg-gray-100 text-gray-600 border-gray-200", emoji: "💰" };
}

// ── Dropdown hook ─────────────────────────────────────────────────────────────
function useTableDropdown() {
  const [dd, setDd]   = useState<DDState>({ id: null, top: 0, left: 0 });
  const menuRef       = useRef<HTMLDivElement | null>(null);
  const close         = useCallback(() => setDd({ id: null, top: 0, left: 0 }), []);

  useEffect(() => {
    if (!dd.id) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      close();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [dd.id, close]);

  const open = useCallback((id: string, e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (dd.id === id) { close(); return; }
    const r  = e.currentTarget.getBoundingClientRect();
    const dw = 192, gap = 6;
    const dh = menuRef.current?.offsetHeight ?? 160;
    let top  = r.bottom + gap;
    let left = r.right - dw;
    if (top + dh > window.innerHeight - gap) top  = r.top - dh - gap;
    if (top < gap) top = gap;
    if (left < gap) left = gap;
    if (left + dw > window.innerWidth - gap) left = window.innerWidth - dw - gap;
    setDd({ id, top, left });
  }, [dd.id, close]);

  return { dd, open, close, menuRef };
}

// ── Receipt Print Modal ───────────────────────────────────────────────────────
function ReceiptModal({
  sale, shop, onClose, onPrinted,
}: { sale: Sale; shop: Shop; onClose: () => void; onPrinted: () => void }) {
  const saleNo   = sale.id.slice(-8).toUpperCase();
  const meta     = methodMeta(sale.paymentMethod);

  const subtotal = sale.items.reduce((s, i) => s + i.price * i.quantity, 0);
  const discount = sale.items.reduce((s, i) => s + i.discount * i.quantity, 0);

  const copyBlock = (label: "CUSTOMER COPY" | "SHOP COPY") => `
    <div style="text-align:center;font-size:10px;border:1px dashed #999;padding:3px;margin-bottom:8px">${label}</div>
    <div style="text-align:center;font-weight:bold;font-size:14px;margin-bottom:2px">${shop.name}</div>
    <div style="text-align:center;font-size:11px;color:#555">${shop.location ?? ""}${shop.tel ? `<br/>Tel: ${shop.tel}` : ""}</div>
    <div style="border-top:1px dashed #000;margin:8px 0"></div>
    <div style="text-align:center;font-weight:bold;font-size:13px;margin-bottom:6px">OFFICIAL RECEIPT</div>
    <div style="display:flex;justify-content:space-between;font-size:11px;margin:3px 0"><span>Receipt No:</span><span style="font-weight:bold">${saleNo}</span></div>
    <div style="display:flex;justify-content:space-between;font-size:11px;margin:3px 0"><span>Date:</span><span>${sale.date}</span></div>
    <div style="display:flex;justify-content:space-between;font-size:11px;margin:3px 0"><span>Served by:</span><span>${sale.soldByName}</span></div>
    ${sale.customerName ? `<div style="display:flex;justify-content:space-between;font-size:11px;margin:3px 0"><span>Customer:</span><span>${sale.customerName}</span></div>` : ""}
    <div style="display:flex;justify-content:space-between;font-size:11px;margin:3px 0"><span>Payment:</span><span style="text-transform:capitalize">${meta.label}</span></div>
    <div style="border-top:1px dashed #000;margin:8px 0"></div>
    <div style="display:flex;justify-content:space-between;font-weight:bold;font-size:11px;margin-bottom:4px">
      <span style="flex:1">Item</span><span style="width:36px;text-align:center">Qty</span><span style="width:72px;text-align:right">Price</span><span style="width:72px;text-align:right">Total</span>
    </div>
    <div style="border-top:1px dashed #aaa;margin-bottom:4px"></div>
    ${sale.items.map((item, idx) => `
      <div style="display:flex;justify-content:space-between;font-size:10px;margin:2px 0">
        <span style="flex:1">${idx + 1}. ${item.productName}</span>
        <span style="width:36px;text-align:center">${item.quantity}</span>
        <span style="width:72px;text-align:right">KSh ${(item.price - item.discount).toLocaleString()}</span>
        <span style="width:72px;text-align:right;font-weight:bold">KSh ${((item.price - item.discount) * item.quantity).toLocaleString()}</span>
      </div>`).join("")}
    <div style="border-top:1px dashed #aaa;margin:6px 0"></div>
    ${discount > 0 ? `
      <div style="display:flex;justify-content:space-between;font-size:11px;margin:2px 0;color:#555"><span>Subtotal:</span><span>KSh ${subtotal.toLocaleString()}</span></div>
      <div style="display:flex;justify-content:space-between;font-size:11px;margin:2px 0;color:#c00"><span>Discount:</span><span>-KSh ${discount.toLocaleString()}</span></div>` : ""}
    <div style="display:flex;justify-content:space-between;font-weight:900;font-size:13px;margin:4px 0"><span>TOTAL PAID:</span><span>KSh ${sale.totalAmount.toLocaleString()}</span></div>
    <div style="border-top:1px dashed #000;margin:8px 0"></div>
    <div style="text-align:center;font-size:10px;color:#666">Thank you for your business! 🙏<br/>Goods sold are not returnable without receipt.</div>
  `;

  const handlePrint = async () => {
    const html = `<html><head><title>Receipt — ${saleNo}</title>
      <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:'Courier New',monospace;font-size:12px;padding:16px;max-width:360px}
        .page-break{page-break-after:always;border-top:2px dashed #000;margin:16px 0 8px}
      </style></head><body>
        ${copyBlock("CUSTOMER COPY")}
        <div class="page-break"></div>
        ${copyBlock("SHOP COPY")}
      </body></html>`;
    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0";
    iframe.srcdoc = html;
    iframe.onload = () => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => iframe.remove(), 1500);
    };
    document.body.appendChild(iframe);
    await markSalePrintedAction(sale.id, shop.id);
    onPrinted();
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b bg-gradient-to-r from-indigo-50 to-white">
          <div>
            <h2 className="font-bold text-gray-800">Receipt Preview</h2>
            <p className="text-xs text-gray-400 mt-0.5">Sale #{saleNo} · 2 copies will print</p>
          </div>
          <div className="flex gap-2">
            <button onClick={handlePrint}
              className="flex items-center gap-1.5 bg-indigo-600 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition-colors font-semibold">
              <Printer size={14} /> Print 2 Copies
            </button>
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="p-5 overflow-y-auto max-h-[70vh]">
          <div className="font-mono text-xs border border-dashed border-gray-300 rounded-xl p-4 bg-white space-y-3">
            <div className="text-center text-[0.6rem] font-bold text-gray-400 border border-dashed border-gray-300 rounded py-1">CUSTOMER COPY</div>
            <div className="text-center font-bold text-sm">{shop.name}</div>
            {shop.location && <div className="text-center text-xs text-gray-500">{shop.location}</div>}
            <div className="border-t border-dashed border-gray-300" />
            <div className="text-center font-bold text-xs">OFFICIAL RECEIPT</div>
            <div className="flex justify-between text-xs"><span>Receipt No:</span><span className="font-bold">{saleNo}</span></div>
            <div className="flex justify-between text-xs"><span>Date:</span><span>{sale.date}</span></div>
            <div className="flex justify-between text-xs"><span>Served by:</span><span>{sale.soldByName}</span></div>
            <div className="flex justify-between text-xs"><span>Payment:</span><span className="capitalize">{meta.label}</span></div>
            <div className="border-t border-dashed border-gray-300" />
            {sale.items.map((item, i) => (
              <div key={item.id} className="flex justify-between text-xs">
                <span className="flex-1 truncate">{i + 1}. {item.productName} ×{item.quantity}</span>
                <span className="font-bold ml-2">KSh {((item.price - item.discount) * item.quantity).toLocaleString()}</span>
              </div>
            ))}
            <div className="border-t border-dashed border-gray-300" />
            <div className="flex justify-between font-black text-sm">
              <span>TOTAL:</span><span>KSh {sale.totalAmount.toLocaleString()}</span>
            </div>
            <div className="text-center text-[0.6rem] text-gray-400 pt-1">Thank you! · Goods not returnable without receipt</div>
            <div className="mt-2 border-t-2 border-dashed border-gray-400 pt-2 text-center text-[0.6rem] font-bold text-gray-400">— SHOP COPY (identical) —</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Cancel Modal ──────────────────────────────────────────────────────────────
function CancelModal({
  sale, onConfirm, onClose, loading,
}: { sale: Sale; onConfirm: (reason: string) => void; onClose: () => void; loading: boolean }) {
  const [reason, setReason] = useState("");

  return (
    <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b bg-red-50">
          <div>
            <h2 className="font-bold text-gray-800 flex items-center gap-2">
              <AlertCircle size={16} className="text-red-500" /> Cancel Sale
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              #{sale.id.slice(-8).toUpperCase()} · KSh {sale.totalAmount.toLocaleString()}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/80 rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
            <p className="font-semibold mb-1">⚠ Stock will be restored</p>
            <p className="text-xs">
              Cancelling this sale will add back {sale.items.reduce((s, i) => s + i.quantity, 0)} unit(s)
              of stock for {sale.items.length} product{sale.items.length !== 1 ? "s" : ""}.
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Reason for cancellation
            </label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="e.g. Customer changed mind, wrong product, etc."
              rows={3}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm resize-none focus:border-red-400 outline-none"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors"
            >
              Keep Sale
            </button>
            <button
              onClick={() => onConfirm(reason)}
              disabled={loading}
              className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors"
            >
              {loading
                ? <Loader2 size={16} className="animate-spin" />
                : <><XCircle size={15} /> Cancel Sale</>
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── New Sale Receipt Modal ────────────────────────────────────────────────────
function NewSaleReceiptModal({
  result, shop, onClose,
}: { result: NewSaleResult; shop: Shop; onClose: () => void }) {
  const printRef = useRef<HTMLDivElement>(null);
  const saleNo   = result.saleId.slice(-8).toUpperCase();
  const subtotal = result.items.reduce((s, i) => s + i.price * i.quantity, 0);
  const discount = result.items.reduce((s, i) => s + i.discount * i.quantity, 0);
  const change   = result.payments.reduce((s, p) => s + p.amount, 0) - result.totalAmount;

  const handlePrint = () => {
    const content = printRef.current?.innerHTML;
    if (!content) return;
    const html = `<html><head><title>Receipt — ${saleNo}</title>
      <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:'Courier New',monospace;font-size:12px;padding:16px;max-width:360px}
        .center{text-align:center}.dashed{border-top:1px dashed #000;margin:8px 0}
        .row{display:flex;justify-content:space-between;margin:3px 0;font-size:11px}
        .bold{font-weight:bold}.total-row{font-size:14px;font-weight:900}
        .copy-header{text-align:center;font-size:10px;border:1px dashed #999;padding:3px;margin-bottom:8px}
        .page-break{page-break-after:always;border-top:2px dashed #000;margin:16px 0 8px}
      </style></head><body>${content}</body></html>`;
    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0";
    iframe.srcdoc = html;
    iframe.onload = () => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => iframe.remove(), 1500);
    };
    document.body.appendChild(iframe);
    onClose();
  };

  const receiptContent = (copy: "CUSTOMER COPY" | "SHOP COPY") => (
    <>
      <div className="copy-header">{copy}</div>
      <div className="text-center font-bold text-base mb-1">{shop.name}</div>
      <div className="text-center text-xs text-gray-600">
        {shop.location && <div>{shop.location}</div>}
        {shop.tel      && <div>Tel: {shop.tel}</div>}
      </div>
      <div className="border-t border-dashed border-gray-400 my-3" />
      <div className="font-bold text-center text-sm mb-2">OFFICIAL RECEIPT</div>
      <div className="flex justify-between text-xs mb-1"><span>Receipt No:</span><span className="font-bold">{saleNo}</span></div>
      <div className="flex justify-between text-xs mb-1"><span>Date:</span><span>{result.date}</span></div>
      <div className="flex justify-between text-xs mb-1"><span>Served by:</span><span>{result.sellerName}</span></div>
      {result.customerName  && <div className="flex justify-between text-xs mb-1"><span>Customer:</span><span>{result.customerName}</span></div>}
      {result.customerPhone && <div className="flex justify-between text-xs mb-1"><span>Phone:</span><span>{result.customerPhone}</span></div>}
      <div className="border-t border-dashed border-gray-400 my-3" />
      <div className="flex justify-between font-bold text-xs mb-1">
        <span className="flex-1">Item</span>
        <span className="w-8 text-center">Qty</span>
        <span className="w-16 text-right">Price</span>
        <span className="w-18 text-right">Total</span>
      </div>
      <div className="border-t border-dashed border-gray-300 mb-2" />
      {result.items.map((item, i) => (
        <div key={i} className="flex justify-between text-xs mb-1">
          <span className="flex-1 truncate pr-1">{i + 1}. {item.productName}</span>
          <span className="w-8 text-center">{item.quantity}</span>
          <span className="w-16 text-right">KSh {(item.price - item.discount).toLocaleString()}</span>
          <span className="w-18 text-right font-bold">KSh {((item.price - item.discount) * item.quantity).toLocaleString()}</span>
        </div>
      ))}
      <div className="border-t border-dashed border-gray-300 my-2" />
      {discount > 0 && (
        <>
          <div className="flex justify-between text-xs mb-1 text-gray-500"><span>Subtotal:</span><span>KSh {subtotal.toLocaleString()}</span></div>
          <div className="flex justify-between text-xs mb-1 text-red-600"><span>Discount:</span><span>-KSh {discount.toLocaleString()}</span></div>
        </>
      )}
      <div className="flex justify-between font-black text-sm mt-1"><span>TOTAL:</span><span>KSh {result.totalAmount.toLocaleString()}</span></div>
      <div className="border-t border-dashed border-gray-300 my-2" />
      {result.payments.map((p, i) => {
        const m = methodMeta(p.method);
        return (
          <div key={i} className="flex justify-between text-xs mb-1">
            <span>{m.emoji} {m.label}:</span>
            <span className="font-bold">KSh {p.amount.toLocaleString()}</span>
          </div>
        );
      })}
      {change > 0 && (
        <div className="flex justify-between text-xs mt-1 font-bold text-green-700"><span>Change:</span><span>KSh {change.toLocaleString()}</span></div>
      )}
      <div className="border-t border-dashed border-gray-300 my-3" />
      <div className="text-center text-xs text-gray-500">Thank you for your business! 🙏<br />Goods sold are not returnable without receipt.</div>
    </>
  );

  return (
    <div className="fixed inset-0 z-[400] bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b bg-gradient-to-r from-green-50 to-white">
          <div>
            <h2 className="font-bold text-gray-800 flex items-center gap-2">
              <CheckCircle2 size={16} className="text-green-600" /> Sale Complete!
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">#{saleNo} · KSh {result.totalAmount.toLocaleString()}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 bg-indigo-600 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition-colors font-semibold"
            >
              <Printer size={14} /> Print (×2)
            </button>
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="p-5 overflow-y-auto max-h-[70vh]">
          <div ref={printRef} className="font-mono text-xs border border-dashed border-gray-300 rounded-xl p-4 bg-white space-y-1">
            {receiptContent("CUSTOMER COPY")}
            <div className="page-break border-t-2 border-dashed border-gray-400 my-4" />
            {receiptContent("SHOP COPY")}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({
  label, count, amount, accent, icon,
}: { label: string; count: number; amount: number; accent: string; icon: React.ReactNode }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-white border p-4 shadow-xs hover:shadow-sm transition-all group ${accent}`}>
      <div className="flex items-start justify-between mb-2">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</span>
        <span className="text-gray-300 group-hover:text-gray-400 transition-colors">{icon}</span>
      </div>
      <div className="text-2xl font-black text-gray-900 leading-none">{count}</div>
      <div className="text-sm font-bold text-gray-600 mt-1">KSh {amount.toLocaleString()}</div>
    </div>
  );
}

// ── CSV Export ────────────────────────────────────────────────────────────────
function exportCSV(sales: Sale[], shopName: string) {
  const rows = [
    ["Sale ID", "Date", "Items", "Total (KSh)", "Payment Method", "Sold By", "Status"],
    ...sales.map(s => [
      s.id.slice(-8).toUpperCase(),
      s.date,
      s.items.map(i => `${i.productName}×${i.quantity}`).join("; "),
      s.totalAmount.toString(),
      s.paymentMethod,
      s.soldByName,
      s.status,
    ]),
  ];
  const csv = rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `sales-${shopName.replace(/\s+/g, "_")}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Date filter tabs ──────────────────────────────────────────────────────────
type DateFilter = "all" | "today" | "week" | "month" | "year";

// ── Main component ────────────────────────────────────────────────────────────
export default function SoldView({
  stats, sales, staffList, shop, profile, methodBreakdown, canSell, products,
}: Props) {
  const router = useRouter();

  const [search, setSearch]           = useState("");
  const [staffFilter, setStaffFilter] = useState("all");
  const [methodFilter, setMethodFilter] = useState("all");
  const [dateFilter, setDateFilter]   = useState<DateFilter>("all");
  const [showBreakdown, setShowBreakdown] = useState(false);

  const [printSale, setPrintSale]     = useState<Sale | null>(null);
  const [cancelSale, setCancelSale]   = useState<Sale | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [mounted, setMounted]         = useState(false);
  const [showSell, setShowSell]       = useState(false);
  const [newSaleReceipt, setNewSaleReceipt] = useState<NewSaleResult | null>(null);

  useEffect(() => setMounted(true), []);

  const { dd, open, close, menuRef } = useTableDropdown();
  const ddSale = dd.id ? sales.find(s => s.id === dd.id) : null;

  // ── cancel handler ────────────────────────────────────────────────────
  const handleCancel = async (reason: string) => {
    if (!cancelSale) return;
    setCancellingId(cancelSale.id);
    const res = await cancelSaleAction(cancelSale.id, reason, shop.id);
    setCancellingId(null);
    setCancelSale(null);
    if (res.success) router.refresh();
    else alert(res.error || "Cancel failed");
  };

  // ── date filter logic ─────────────────────────────────────────────────
  const now        = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart  = new Date(todayStart); weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearStart  = new Date(now.getFullYear(), 0, 1);

  // ── filter ────────────────────────────────────────────────────────────
  const filtered = sales.filter(s => {
    const matchSearch = `${s.soldByName} ${s.items.map(i => i.productName).join(" ")} ${s.paymentMethod}`
      .toLowerCase()
      .includes(search.toLowerCase());
    const matchStaff  = staffFilter  === "all" || s.soldById === staffFilter;
    const matchMethod = methodFilter === "all" || s.paymentMethod === methodFilter;

    let matchDate = true;
    if (dateFilter !== "all") {
      const d = new Date(s.createdAt);
      if (dateFilter === "today") matchDate = d >= todayStart;
      if (dateFilter === "week")  matchDate = d >= weekStart;
      if (dateFilter === "month") matchDate = d >= monthStart;
      if (dateFilter === "year")  matchDate = d >= yearStart;
    }

    return matchSearch && matchStaff && matchMethod && matchDate;
  });

  const filteredRevenue = filtered
    .filter(s => s.status === "completed")
    .reduce((s, sale) => s + sale.totalAmount, 0);

  const DATE_TABS: { key: DateFilter; label: string }[] = [
    { key: "all",   label: "All" },
    { key: "today", label: "Today" },
    { key: "week",  label: "Week" },
    { key: "month", label: "Month" },
    { key: "year",  label: "Year" },
  ];

  const uniqueMethods = Object.keys(methodBreakdown).sort(
    (a, b) => (methodBreakdown[b]?.amount ?? 0) - (methodBreakdown[a]?.amount ?? 0)
  );

  return (
    <>
      <style>{`
        .sold-table .col-sticky { position:sticky;left:0;z-index:10;box-shadow:6px 0 18px -6px rgba(0,0,0,0.06);clip-path:inset(0px -30px 0px 0px); }
        .sold-table thead .col-sticky { z-index:20; }
        .table-scroll-wrap { position:relative; }
        .table-scroll-wrap::after { content:'';position:absolute;top:0;right:0;bottom:0;width:48px;background:linear-gradient(to right,transparent,rgba(248,250,252,0.7));pointer-events:none;z-index:5;border-radius:0 16px 16px 0; }
        @keyframes rowIn { from{opacity:0;transform:translateX(-5px)} to{opacity:1;transform:translateX(0)} }
        .sold-table tbody tr { animation:rowIn 0.18s ease both; }
        @keyframes ddIn { from{opacity:0;transform:scale(0.95) translateY(-4px)} to{opacity:1;transform:scale(1) translateY(0)} }
        .dd-menu { animation:ddIn 0.12s ease both;transform-origin:top right; }
      `}</style>

      <div className="min-h-screen bg-slate-50/80 px-3 py-5 md:px-6">
        <div className="mx-auto max-w-screen-2xl space-y-5">

          {/* ── Page header ────────────────────────────────────────────── */}
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
                <ShoppingBag size={24} className="text-indigo-600" /> Sales
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">
                {shop.name}
                {shop.location && <span className="text-gray-400"> · {shop.location}</span>}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {canSell && (
                <button
                  onClick={() => setShowSell(true)}
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition-colors"
                >
                  <ShoppingBag size={15} /> New Sale
                </button>
              )}
              <button
                onClick={() => setShowBreakdown(p => !p)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                  showBreakdown
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-white text-gray-600 border-gray-300 hover:border-indigo-400"
                }`}
              >
                <Filter size={15} /> Breakdown
              </button>
              <button
                onClick={() => exportCSV(filtered, shop.name)}
                className="flex items-center gap-2 bg-white border border-gray-300 text-gray-600 hover:border-green-400 hover:text-green-700 px-3 py-2 rounded-xl text-sm font-semibold transition-colors"
              >
                <Download size={15} /> Export CSV
              </button>
            </div>
          </div>

          {/* ── Stats ──────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <StatCard label="Today"     count={stats.today.count} amount={stats.today.amount}  accent="border-green-100"  icon={<TrendingUp size={16} />} />
            <StatCard label="This week" count={stats.week.count}  amount={stats.week.amount}   accent="border-blue-100"   icon={<Calendar size={16} />} />
            <StatCard label="This month" count={stats.month.count} amount={stats.month.amount} accent="border-violet-100" icon={<ShoppingBag size={16} />} />
            <StatCard label="This year" count={stats.year.count}  amount={stats.year.amount}   accent="border-indigo-100" icon={<TrendingUp size={16} />} />
            <StatCard label="All time"  count={stats.total.count} amount={stats.total.amount}  accent="border-gray-200 col-span-2 sm:col-span-1" icon={<Hash size={16} />} />
          </div>

          {/* ── Payment breakdown ───────────────────────────────────────── */}
          {showBreakdown && uniqueMethods.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-5">
              <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                <Filter size={14} className="text-indigo-500" /> Payment Method Breakdown
              </h3>
              <div className="space-y-3">
                {uniqueMethods
                  .map(m => {
                    const meta = methodMeta(m);
                    const pct  = stats.total.amount > 0
                      ? Math.round(((methodBreakdown[m]?.amount ?? 0) / stats.total.amount) * 100)
                      : 0;
                    return (
                      <div key={m}>
                        <div className="flex items-center justify-between mb-1">
                          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${meta.color}`}>
                            {meta.emoji} {meta.label}
                          </span>
                          <div className="flex items-center gap-3 text-sm">
                            <span className="text-gray-500">{methodBreakdown[m]?.count ?? 0} sales</span>
                            <span className="font-bold text-gray-900">KSh {(methodBreakdown[m]?.amount ?? 0).toLocaleString()}</span>
                            <span className="text-gray-400 w-8 text-right">{pct}%</span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-indigo-500 rounded-full transition-all duration-700"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* ── Date filter tabs ────────────────────────────────────────── */}
          <div className="flex gap-2 flex-wrap">
            {DATE_TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setDateFilter(tab.key)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                  dateFilter === tab.key
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-white text-gray-600 border-gray-300 hover:border-indigo-400"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── Controls ───────────────────────────────────────────────── */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by product, staff, payment…"
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-300 text-sm outline-none focus:border-indigo-500 bg-white shadow-xs"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X size={14} />
                </button>
              )}
            </div>

            {staffList.length > 1 && (
              <select
                value={staffFilter}
                onChange={e => setStaffFilter(e.target.value)}
                className="border border-gray-300 rounded-xl px-3 py-2.5 text-sm bg-white outline-none focus:border-indigo-400 shadow-xs"
              >
                <option value="all">All staff</option>
                {staffList.map(s => (
                  <option key={s.id} value={s.id}>{s.fullName}</option>
                ))}
              </select>
            )}

            {uniqueMethods.length > 1 && (
              <select
                value={methodFilter}
                onChange={e => setMethodFilter(e.target.value)}
                className="border border-gray-300 rounded-xl px-3 py-2.5 text-sm bg-white outline-none focus:border-indigo-400 shadow-xs"
              >
                <option value="all">All methods</option>
                {uniqueMethods.map(m => {
                  const meta = methodMeta(m);
                  return <option key={m} value={m}>{meta.emoji} {meta.label}</option>;
                })}
              </select>
            )}

            <div className="text-sm text-gray-500 whitespace-nowrap">
              {filtered.length} sale{filtered.length !== 1 ? "s" : ""}
              {" · "}
              <span className="font-semibold text-gray-700">KSh {filteredRevenue.toLocaleString()}</span>
            </div>
          </div>

          {/* ── Table ──────────────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
            {filtered.length === 0 ? (
              <div className="py-20 text-center">
                <ShoppingBag size={48} className="mx-auto mb-3 text-gray-200" />
                <p className="text-gray-500 font-medium">
                  {sales.length === 0 ? "No sales recorded yet" : "No sales match your filters"}
                </p>
                {dateFilter !== "all" && (
                  <button
                    onClick={() => setDateFilter("all")}
                    className="mt-3 text-sm text-indigo-600 hover:text-indigo-700 font-semibold underline"
                  >
                    Clear date filter
                  </button>
                )}
              </div>
            ) : (
              <div className="table-scroll-wrap overflow-x-auto">
                <table className="sold-table w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="col-sticky bg-gray-50 text-left px-4 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wide whitespace-nowrap">
                        <div className="flex items-center gap-1.5"><Hash size={11} /> Sale / Date</div>
                      </th>
                      <th className="text-left px-4 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wide">Items</th>
                      <th className="text-right px-4 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wide whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5"><TrendingUp size={11} /> Total</div>
                      </th>
                      <th className="text-left px-4 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wide whitespace-nowrap">Payment</th>
                      <th className="text-left px-4 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wide whitespace-nowrap">
                        <div className="flex items-center gap-1.5"><Calendar size={11} /> Staff</div>
                      </th>
                      <th className="text-left px-4 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wide">Status</th>
                      <th className="px-4 py-3.5 w-12" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filtered.map((sale, idx) => {
                      const isCancelled = sale.status === "cancelled";
                      return (
                        <tr
                          key={sale.id}
                          style={{ animationDelay: `${idx * 0.03}s` }}
                          className={`hover:bg-indigo-50/50 transition-colors group ${isCancelled ? "opacity-60" : ""}`}
                        >
                          {/* ID + Date */}
                          <td className="col-sticky bg-white group-hover:bg-indigo-50/50 px-4 py-3.5 whitespace-nowrap transition-colors">
                            <div className="font-mono font-bold text-indigo-700 text-xs">
                              #{sale.id.slice(-8).toUpperCase()}
                            </div>
                            <div className="text-xs text-gray-400 mt-0.5">{sale.date}</div>
                            {sale.isPrinted && (
                              <div className="text-[0.6rem] text-green-600 mt-0.5 flex items-center gap-0.5">
                                <CheckCircle2 size={9} /> printed
                              </div>
                            )}
                          </td>

                          {/* Items */}
                          <td className="px-4 py-3.5">
                            <div className="max-w-[260px] space-y-0.5">
                              {sale.items.slice(0, 3).map(item => (
                                <div key={item.id} className="flex items-center gap-1.5 text-xs">
                                  <span className="inline-flex w-5 h-5 rounded-md bg-indigo-100 text-indigo-700 text-[0.65rem] font-bold items-center justify-center shrink-0">
                                    {item.quantity}
                                  </span>
                                  <span className="text-gray-700 truncate">{item.productName}</span>
                                </div>
                              ))}
                              {sale.items.length > 3 && (
                                <div className="text-xs text-gray-400 pl-1">
                                  +{sale.items.length - 3} more
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Total */}
                          <td className="px-4 py-3.5 text-right whitespace-nowrap">
                            <span className={`font-black text-base ${isCancelled ? "line-through text-gray-400" : "text-gray-900"}`}>
                              KSh {sale.totalAmount.toLocaleString()}
                            </span>
                          </td>

                          {/* Payment — stack all methods from paymentMethodsJson */}
                          <td className="px-4 py-3.5">
                            <div className="flex flex-wrap gap-1">
                              {(() => {
                                const lines: { method: string; amount: number }[] = sale.paymentMethodsJson
                                  ? (() => { try { return JSON.parse(sale.paymentMethodsJson); } catch { return []; } })()
                                  : [{ method: sale.paymentMethod, amount: sale.totalAmount }];
                                return lines.filter(l => l.amount > 0).map((l, i) => {
                                  const m = methodMeta(l.method);
                                  return (
                                    <div key={i} className="flex flex-col items-start">
                                      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${m.color}`}>
                                        {m.emoji} {m.label}
                                      </span>
                                      <span className="text-[0.6rem] text-gray-400 pl-1">KSh {l.amount.toLocaleString()}</span>
                                    </div>
                                  );
                                });
                              })()}
                            </div>
                          </td>

                          {/* Staff */}
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold shrink-0">
                                {sale.soldByName.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                              </div>
                              <span className="text-sm text-gray-700">{sale.soldByName}</span>
                            </div>
                          </td>

                          {/* Status */}
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            {isCancelled ? (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-red-100 text-red-700 border border-red-200">
                                <XCircle size={11} /> Cancelled
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-green-100 text-green-700 border border-green-200">
                                <CheckCircle2 size={11} /> Completed
                              </span>
                            )}
                            {sale.hasReturn && (
                              <div className="text-[0.65rem] text-amber-600 mt-0.5 font-medium">has return</div>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="px-3 py-3.5 text-right">
                            <button
                              onClick={e => open(sale.id, e)}
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                            >
                              {cancellingId === sale.id
                                ? <Loader2 size={15} className="animate-spin" />
                                : <MoreVertical size={15} />
                              }
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* ── Dropdown portal ──────────────────────────────────────────────── */}
      {mounted && dd.id && ddSale && createPortal(
        <div
          ref={menuRef}
          className="dd-menu fixed z-[500] w-48 bg-white rounded-2xl shadow-xl border border-gray-100 py-1.5 overflow-hidden"
          style={{ top: dd.top, left: dd.left }}
        >
          <button
            onClick={() => { close(); setPrintSale(ddSale); }}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Printer size={14} className="text-indigo-500 shrink-0" /> Print Receipt
          </button>
          {ddSale.status !== "cancelled" && (
            <>
              <div className="mx-3 my-1 border-t border-gray-100" />
              <button
                onClick={() => { close(); setCancelSale(ddSale); }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                <XCircle size={14} className="shrink-0" /> Cancel Sale
              </button>
            </>
          )}
          {ddSale.status === "cancelled" && ddSale.cancelReason && (
            <div className="px-4 py-2.5 text-xs text-gray-400 italic">
              Reason: {ddSale.cancelReason}
            </div>
          )}
        </div>,
        document.body
      )}

      {/* ── Receipt modal ────────────────────────────────────────────────── */}
      {printSale && (
        <ReceiptModal
          sale={printSale}
          shop={shop}
          onClose={() => setPrintSale(null)}
          onPrinted={() => { setPrintSale(null); router.refresh(); }}
        />
      )}

      {/* ── Cancel modal ─────────────────────────────────────────────────── */}
      {cancelSale && (
        <CancelModal
          sale={cancelSale}
          onConfirm={handleCancel}
          onClose={() => setCancelSale(null)}
          loading={cancellingId === cancelSale.id}
        />
      )}

      {/* ── Sell modal ───────────────────────────────────────────────────── */}
      {showSell && (
        <SellModal
          shopId={shop.id}
          products={products}
          sellerName={profile.fullName}
          onClose={() => setShowSell(false)}
          onSuccess={result => {
            setShowSell(false);
            setNewSaleReceipt(result);
          }}
        />
      )}

      {/* ── New sale receipt ─────────────────────────────────────────────── */}
      {newSaleReceipt && (
        <NewSaleReceiptModal
          result={newSaleReceipt}
          shop={shop}
          onClose={() => { setNewSaleReceipt(null); router.refresh(); }}
        />
      )}
    </>
  );
}
