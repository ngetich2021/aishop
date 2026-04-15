"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search, Plus, Loader2, MoreVertical, ArrowRightCircle,
  Printer, X, FileText, Lock, TrendingUp, Calendar, Hash,
} from "lucide-react";
import { createPortal } from "react-dom";
import { convertQuoteToSaleAction, deleteQuoteAction } from "./actions";
import QuotePOSSheet from "./QuotePOSSheet";
import ConvertModal, { type ConvertPayload } from "./ConvertModal";

// ── Types ─────────────────────────────────────────────────────────────────────
type QuoteItem = { id: string; productName: string; quantity: number; price: number; discount: number };
type Quote = {
  id: string; soldById: string; soldByName: string; customerName: string;
  customerContact: string; items: QuoteItem[]; amount: number; shop: string;
  shopLocation: string; shopTel: string; shopId: string; date: string; createdAt: string;
};
type Product = {
  id: string; productName: string; sellingPrice: number; buyingPrice: number;
  discount: number; quantity: number; imageUrl: string | null; shopId: string; shopName: string;
};
type ShopOption  = { id: string; name: string; location: string; tel: string };
type StaffOption = { id: string; fullName: string };
type StatPair    = { count: number; amount: number };
type Profile     = { role: string; shopId: string | null; fullName: string };

type Props = {
  stats: { today: StatPair; week: StatPair; month: StatPair; year: StatPair; total: StatPair };
  quotes: Quote[];
  products: Product[];
  shops: ShopOption[];
  staffList: StaffOption[];
  profile: Profile;
  hasStaffRecord: boolean;
  canSell: boolean;
  activeShopId: string;
  activeShopName: string;
  activeShopLocation: string;
};

type DDState = { id: string | null; top: number; left: number };

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

// ── Print Modal ───────────────────────────────────────────────────────────────
function QuotePrintModal({ quote, onClose }: { quote: Quote; onClose: () => void }) {
  const printRef   = useRef<HTMLDivElement>(null);
  const quoteNo    = quote.id.slice(-6).toUpperCase();

  const handlePrint = () => {
    const content = printRef.current?.innerHTML;
    if (!content) return;
    const win = window.open("", "_blank", "width=420,height=700");
    if (!win) return;
    win.document.write(`<html><head><title>Quote — ${quote.shop}</title>
      <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Courier New',monospace;font-size:12px;padding:16px;max-width:360px}
      .center{text-align:center}.divider{border-top:1px dashed #000;margin:8px 0}.row{display:flex;justify-content:space-between;margin:3px 0}
      .shop-name{font-size:18px;font-weight:bold;text-align:center;margin-bottom:4px}table{width:100%;border-collapse:collapse}td{padding:3px 0;font-size:12px}
      </style></head><body>${content}</body></html>`);
    win.document.close(); win.focus(); win.print(); win.close();
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-bold text-gray-800">Quote Preview</h2>
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 bg-blue-600 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Printer size={14} /> Print
            </button>
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="p-5 overflow-y-auto max-h-[70vh]">
          <div ref={printRef} className="font-mono text-xs border border-dashed border-gray-300 rounded-xl p-5 bg-white">
            <div className="text-center text-base font-bold mb-1">{quote.shop}</div>
            <div className="text-center text-gray-600 text-xs">
              {quote.shopLocation && <div>{quote.shopLocation}</div>}
              {quote.shopTel      && <div>Tel: {quote.shopTel}</div>}
            </div>
            <div className="border-t border-dashed border-gray-400 my-3" />
            <div className="font-bold text-center text-sm mb-2">QUOTATION</div>
            <div className="flex justify-between text-xs mb-1"><span>Quote No:</span><span className="font-bold">{quoteNo}</span></div>
            <div className="flex justify-between text-xs mb-1"><span>Date:</span><span>{quote.date}</span></div>
            <div className="flex justify-between text-xs mb-1"><span>Prepared By:</span><span>{quote.soldByName}</span></div>
            {quote.customerName    && <div className="flex justify-between text-xs mb-1"><span>Customer:</span><span>{quote.customerName}</span></div>}
            {quote.customerContact && <div className="flex justify-between text-xs mb-1"><span>Contact:</span><span>{quote.customerContact}</span></div>}
            <div className="border-t border-dashed border-gray-400 my-3" />
            <div className="flex justify-between font-bold text-xs mb-1">
              <span className="flex-1">Item</span>
              <span className="w-10 text-center">Qty</span>
              <span className="w-24 text-right">Unit Price</span>
              <span className="w-24 text-right">Total</span>
            </div>
            <div className="border-t border-dashed border-gray-300 mb-2" />
            {quote.items.map((item, i) => (
              <div key={item.id} className="flex justify-between text-xs mb-1">
                <span className="flex-1 truncate pr-1">{i + 1}. {item.productName}</span>
                <span className="w-10 text-center">{item.quantity}</span>
                <span className="w-24 text-right">KSh {(item.price - item.discount).toLocaleString()}</span>
                <span className="w-24 text-right">KSh {((item.price - item.discount) * item.quantity).toLocaleString()}</span>
              </div>
            ))}
            <div className="border-t border-dashed border-gray-300 my-2" />
            <div className="flex justify-between font-bold text-sm">
              <span>Total Amount:</span>
              <span>KSh {quote.amount.toLocaleString()}</span>
            </div>
            <div className="border-t border-dashed border-gray-300 my-3" />
            <div className="text-center text-xs text-gray-500">
              This is a quotation only — not a receipt.<br />Valid for 7 days. Thank you! 🙏
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({
  label, count, amount, accent,
}: { label: string; count: number; amount: number; accent: string }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-white border p-4 shadow-xs hover:shadow-sm transition-shadow ${accent}`}>
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{label}</div>
      <div className="text-2xl font-black text-gray-900 leading-none">{count}</div>
      <div className="text-xs text-gray-500 mt-1 font-medium">
        KSh {amount.toLocaleString()}
      </div>
    </div>
  );
}

// ── Payment method badge ──────────────────────────────────────────────────────
const METHOD_META: Record<string, { label: string; color: string }> = {
  cash:               { label: "Cash",    color: "bg-green-100 text-green-700"  },
  mpesa:              { label: "M-Pesa",  color: "bg-emerald-100 text-emerald-700" },
  bank:               { label: "Bank",    color: "bg-blue-100 text-blue-700"    },
  card:               { label: "Card",    color: "bg-purple-100 text-purple-700" },
  credit:             { label: "Credit",  color: "bg-orange-100 text-orange-700" },
};

// ── Main component ────────────────────────────────────────────────────────────
export default function QuoteView({
  stats, quotes, products, shops, staffList, profile,
  hasStaffRecord, canSell, activeShopId, activeShopName, activeShopLocation,
}: Props) {
  const router = useRouter();

  const [search, setSearch]             = useState("");
  const [staffFilter, setStaffFilter]   = useState("all");
  const [showPOS, setShowPOS]           = useState(false);
  const [editQuote, setEditQuote]       = useState<Quote | undefined>();
  const [printQuote, setPrintQuote]     = useState<Quote | null>(null);
  const [convertQuote, setConvertQuote] = useState<Quote | null>(null);
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [deletingId, setDeletingId]     = useState<string | null>(null);
  const [mounted, setMounted]           = useState(false);

  useEffect(() => setMounted(true), []);

  const { dd, open, close, menuRef } = useTableDropdown();
  const ddQuote = dd.id ? quotes.find(q => q.id === dd.id) : null;

  // ── handlers ─────────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    close();
    if (!confirm("Delete this quote? This cannot be undone.")) return;
    setDeletingId(id);
    const res = await deleteQuoteAction(id);
    setDeletingId(null);
    if (res.success) router.refresh();
    else alert(res.error || "Delete failed");
  };

  const handleConvert = async (payload: ConvertPayload) => {
    if (!convertQuote) return;
    setConvertingId(convertQuote.id);
    const res = await convertQuoteToSaleAction(
      convertQuote.id,
      payload.paymentMethod,
      payload.downPayment,
      payload.dueDate,
      payload.customerName,
      payload.customerContact,
      payload.splits,
    );
    setConvertingId(null);
    setConvertQuote(null);
    if (res.success) {
      // Refresh current route then push to sold page so users see the new sale immediately
      router.refresh();
      router.push(`/${activeShopId}/sales/sold`);
    } else {
      alert(res.error || "Conversion failed");
    }
  };

  // ── filter ────────────────────────────────────────────────────────────
  const filtered = quotes.filter(q => {
    const matchSearch = `${q.soldByName} ${q.customerName} ${q.items.map(i => i.productName).join(" ")} ${q.shop}`
      .toLowerCase()
      .includes(search.toLowerCase());
    const matchStaff = staffFilter === "all" || q.soldById === staffFilter;
    return matchSearch && matchStaff;
  });

  return (
    <>
      <style>{`
        .quotes-table .col-sticky { position:sticky;left:0;z-index:10;box-shadow:6px 0 18px -6px rgba(0,0,0,0.06);clip-path:inset(0px -30px 0px 0px); }
        .quotes-table thead .col-sticky { z-index:20; }
        .table-scroll-wrap { position:relative; }
        .table-scroll-wrap::after { content:'';position:absolute;top:0;right:0;bottom:0;width:48px;background:linear-gradient(to right,transparent,rgba(248,250,252,0.7));pointer-events:none;z-index:5;border-radius:0 16px 16px 0; }
        @keyframes rowIn { from{opacity:0;transform:translateX(-5px)} to{opacity:1;transform:translateX(0)} }
        .quotes-table tbody tr { animation:rowIn 0.18s ease both; }
        @keyframes ddIn { from{opacity:0;transform:scale(0.95) translateY(-4px)} to{opacity:1;transform:scale(1) translateY(0)} }
        .dd-menu { animation:ddIn 0.12s ease both;transform-origin:top right; }
      `}</style>

      <div className="min-h-screen bg-slate-50/80 px-3 py-5 md:px-6">
        <div className="mx-auto max-w-screen-2xl space-y-5">

          {/* ── Page header ────────────────────────────────────────────── */}
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
                <FileText size={24} className="text-blue-600" /> Quotes
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">
                {activeShopName}
                {activeShopLocation && <span className="text-gray-400"> · {activeShopLocation}</span>}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {!hasStaffRecord && (
                <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-full font-semibold">
                  No staff record — read only
                </span>
              )}
              {hasStaffRecord && !canSell && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200 rounded-full px-3 py-1.5">
                  <Lock size={11} /> View only
                </span>
              )}
              <button
                onClick={() => { setEditQuote(undefined); setShowPOS(true); }}
                disabled={!canSell}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-xl font-semibold text-sm shadow-sm shadow-blue-200 transition-all"
              >
                <Plus size={17} /> New Quote
              </button>
            </div>
          </div>

          {/* ── Stats ──────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <StatCard label="Today"    count={stats.today.count} amount={stats.today.amount}  accent="border-blue-100" />
            <StatCard label="This week" count={stats.week.count}  amount={stats.week.amount}   accent="border-indigo-100" />
            <StatCard label="This month" count={stats.month.count} amount={stats.month.amount} accent="border-violet-100" />
            <StatCard label="This year" count={stats.year.count}  amount={stats.year.amount}   accent="border-purple-100" />
            <StatCard label="All time"  count={stats.total.count} amount={stats.total.amount}  accent="border-gray-200 col-span-2 sm:col-span-1" />
          </div>

          {/* ── Controls ───────────────────────────────────────────────── */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by customer, product, staff…"
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-300 text-sm outline-none focus:border-blue-500 bg-white shadow-xs"
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
                className="border border-gray-300 rounded-xl px-3 py-2.5 text-sm bg-white outline-none focus:border-blue-400 shadow-xs"
              >
                <option value="all">All staff</option>
                {staffList.map(s => (
                  <option key={s.id} value={s.id}>{s.fullName}</option>
                ))}
              </select>
            )}

            <div className="text-sm text-gray-500 whitespace-nowrap">
              {filtered.length} quote{filtered.length !== 1 ? "s" : ""}
            </div>
          </div>

          {/* ── Table ──────────────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
            {filtered.length === 0 ? (
              <div className="py-20 text-center">
                <FileText size={48} className="mx-auto mb-3 text-gray-200" />
                <p className="text-gray-500 font-medium">
                  {quotes.length === 0 ? "No quotes yet" : "No quotes match your search"}
                </p>
                {quotes.length === 0 && canSell && (
                  <button
                    onClick={() => { setEditQuote(undefined); setShowPOS(true); }}
                    className="mt-4 inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors"
                  >
                    <Plus size={15} /> Create first quote
                  </button>
                )}
              </div>
            ) : (
              <div className="table-scroll-wrap overflow-x-auto">
                <table className="quotes-table w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="col-sticky bg-gray-50 text-left px-4 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wide whitespace-nowrap">
                        <div className="flex items-center gap-1.5"><Hash size={11} /> Quote / Date</div>
                      </th>
                      <th className="text-left px-4 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wide whitespace-nowrap">Customer</th>
                      <th className="text-left px-4 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wide">Items</th>
                      <th className="text-right px-4 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wide whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5"><TrendingUp size={11} /> Amount</div>
                      </th>
                      <th className="text-left px-4 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wide whitespace-nowrap">
                        <div className="flex items-center gap-1.5"><Calendar size={11} /> Prepared by</div>
                      </th>
                      <th className="px-4 py-3.5 w-12" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filtered.map((quote, idx) => (
                      <tr
                        key={quote.id}
                        style={{ animationDelay: `${idx * 0.03}s` }}
                        className="hover:bg-blue-50/50 transition-colors group"
                      >
                        {/* ID + Date */}
                        <td className="col-sticky bg-white group-hover:bg-blue-50/50 px-4 py-3.5 whitespace-nowrap transition-colors">
                          <div className="font-mono font-bold text-blue-700 text-xs">
                            #{quote.id.slice(-6).toUpperCase()}
                          </div>
                          <div className="text-xs text-gray-400 mt-0.5">{quote.date}</div>
                        </td>

                        {/* Customer */}
                        <td className="px-4 py-3.5">
                          {quote.customerName ? (
                            <div>
                              <div className="font-semibold text-gray-800 text-sm">{quote.customerName}</div>
                              {quote.customerContact && (
                                <div className="text-xs text-gray-400 mt-0.5">{quote.customerContact}</div>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400 text-xs italic">Walk-in</span>
                          )}
                        </td>

                        {/* Items */}
                        <td className="px-4 py-3.5">
                          <div className="max-w-[260px] space-y-0.5">
                            {quote.items.slice(0, 3).map(item => (
                              <div key={item.id} className="flex items-center gap-1.5 text-xs">
                                <span className="inline-block w-5 h-5 rounded-md bg-blue-100 text-blue-700 text-[0.65rem] font-bold flex items-center justify-center shrink-0">
                                  {item.quantity}
                                </span>
                                <span className="text-gray-700 truncate">{item.productName}</span>
                              </div>
                            ))}
                            {quote.items.length > 3 && (
                              <div className="text-xs text-gray-400 pl-1">
                                +{quote.items.length - 3} more item{quote.items.length - 3 !== 1 ? "s" : ""}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Amount */}
                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          <span className="font-black text-gray-900 text-base">
                            KSh {quote.amount.toLocaleString()}
                          </span>
                        </td>

                        {/* Staff */}
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold shrink-0">
                              {quote.soldByName.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                            </div>
                            <span className="text-sm text-gray-700">{quote.soldByName}</span>
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="px-3 py-3.5 text-right">
                          <button
                            onClick={e => open(quote.id, e)}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                          >
                            {deletingId === quote.id || convertingId === quote.id
                              ? <Loader2 size={15} className="animate-spin" />
                              : <MoreVertical size={15} />
                            }
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* ── Dropdown portal ──────────────────────────────────────────────── */}
      {mounted && dd.id && ddQuote && createPortal(
        <div
          ref={menuRef}
          className="dd-menu fixed z-[500] w-48 bg-white rounded-2xl shadow-xl border border-gray-100 py-1.5 overflow-hidden"
          style={{ top: dd.top, left: dd.left }}
        >
          <button
            onClick={() => { close(); setEditQuote(ddQuote); setShowPOS(true); }}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <FileText size={14} className="text-blue-500 shrink-0" /> Edit Quote
          </button>
          <button
            onClick={() => { close(); setPrintQuote(ddQuote); }}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Printer size={14} className="text-gray-500 shrink-0" /> Print / Preview
          </button>
          <button
            onClick={() => { close(); setConvertQuote(ddQuote); }}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-green-50 transition-colors"
          >
            <ArrowRightCircle size={14} className="text-green-600 shrink-0" /> Convert to Sale
          </button>
          <div className="mx-3 my-1 border-t border-gray-100" />
          <button
            onClick={() => handleDelete(ddQuote.id)}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
          >
            <X size={14} className="shrink-0" /> Delete Quote
          </button>
        </div>,
        document.body
      )}

      {/* ── POS Sheet ────────────────────────────────────────────────────── */}
      {showPOS && (
        <QuotePOSSheet
          editQuote={editQuote as Parameters<typeof QuotePOSSheet>[0]["editQuote"]}
          products={products}
          shops={shops}
          profile={profile}
          activeShopId={activeShopId}
          canSell={canSell}
          onSuccess={() => { setShowPOS(false); setEditQuote(undefined); router.refresh(); }}
          onClose={() => { setShowPOS(false); setEditQuote(undefined); }}
        />
      )}

      {/* ── Print modal ──────────────────────────────────────────────────── */}
      {printQuote && (
        <QuotePrintModal quote={printQuote} onClose={() => setPrintQuote(null)} />
      )}

      {/* ── Convert modal ────────────────────────────────────────────────── */}
      {convertQuote && (
        <ConvertModal
          quote={convertQuote}
          onConfirm={handleConvert}
          onClose={() => setConvertQuote(null)}
          loading={convertingId === convertQuote.id}
        />
      )}
    </>
  );
}
