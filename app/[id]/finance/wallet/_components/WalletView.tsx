"use client";

import { useState, useTransition } from "react";
import {
  Search, Loader2, Wallet, ArrowUpCircle, ArrowDownCircle, ArrowLeftRight,
  X, TrendingUp, TrendingDown, CheckCircle2, AlertCircle, Plus,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { depositAction, withdrawAction, transferFromPaymentsAction } from "./actions";

// ── Types ─────────────────────────────────────────────────────────────────────
type TxType = "deposit" | "withdraw" | "transfer_out" | "transfer_in" | "transfer_from_payments";

type Transaction = {
  id: string; name: string; amount: number; type: TxType;
  sourceOfMoney: string; toShopName: string | null; fromShopName: string | null;
  authorizedBy: string; date: string; time: string;
};
type ActiveShop = { id: string; name: string; location: string };

type Props = {
  activeShop:      ActiveShop;
  isAdmin:         boolean;
  balance:         number;
  paymentsBalance: number;
  transactions:    Transaction[];
  stats:           { totalDeposited: number; totalWithdrawn: number };
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(n: number) { return `KSh ${Math.round(n).toLocaleString()}`; }

const TX_META: Record<string, { label: string; color: string; bg: string; border: string; sign: "+" | "−"; Icon: React.ElementType }> = {
  deposit:               { label: "Deposit",           color: "text-emerald-700", bg: "bg-emerald-50",  border: "border-emerald-200", sign: "+", Icon: ArrowUpCircle   },
  transfer_in:           { label: "Transfer In",       color: "text-blue-700",    bg: "bg-blue-50",     border: "border-blue-200",    sign: "+", Icon: ArrowLeftRight  },
  transfer_from_payments:{ label: "From Payments",     color: "text-indigo-700",  bg: "bg-indigo-50",   border: "border-indigo-200",  sign: "+", Icon: ArrowLeftRight  },
  withdraw:              { label: "Withdraw",          color: "text-red-600",     bg: "bg-red-50",      border: "border-red-200",     sign: "−", Icon: ArrowDownCircle },
  transfer_out:          { label: "Transfer Out",      color: "text-orange-600",  bg: "bg-orange-50",   border: "border-orange-200",  sign: "−", Icon: ArrowLeftRight  },
};

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ msg, ok, onClose }: { msg: string; ok: boolean; onClose: () => void }) {
  return (
    <div className={`fixed bottom-6 right-6 z-[99999] flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl border text-sm font-semibold ${ok ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-red-50 border-red-200 text-red-700"}`}>
      {ok ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
      {msg}
      <button onClick={onClose} className="ml-2 opacity-60 hover:opacity-100"><X size={14} /></button>
    </div>
  );
}

// ── Modal shell ───────────────────────────────────────────────────────────────
function Modal({ title, icon, onClose, children }: {
  title: string; icon: React.ReactNode; onClose: () => void; children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm border border-gray-100">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-black text-gray-900 flex items-center gap-2">{icon}{title}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition"><X size={15} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Deposit Modal ─────────────────────────────────────────────────────────────
function DepositModal({ shopId, balance, onClose, onDone }: {
  shopId: string; balance: number; onClose: () => void;
  onDone: (msg: string, ok: boolean) => void;
}) {
  const [desc,   setDesc]   = useState("");
  const [amount, setAmount] = useState("");
  const [source, setSource] = useState("");
  const [err,    setErr]    = useState("");
  const [pending, start]    = useTransition();

  function submit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    const amt = parseInt(amount, 10);
    if (!desc.trim())   { setErr("Description is required.");     return; }
    if (!amt || amt<=0) { setErr("Enter a valid amount.");         return; }
    if (!source.trim()) { setErr("Source of money is required.");  return; }
    setErr("");
    start(async () => {
      const res = await depositAction(shopId, { description: desc, amount: amt, source });
      if (res.success) onDone(`KSh ${amt.toLocaleString()} deposited.`, true);
      else setErr(res.error ?? "Deposit failed.");
    });
  }

  return (
    <Modal title="Deposit Funds" icon={<ArrowUpCircle size={16} className="text-emerald-600" />} onClose={onClose}>
      <form onSubmit={submit} className="p-5 space-y-4">
        {err && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 border border-red-100">{err}</p>}
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 text-sm text-emerald-700 font-semibold">Current balance: {fmt(balance)}</div>
        <div>
          <label className="text-xs font-semibold text-gray-600 mb-1 block">Description *</label>
          <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="e.g. Monthly top-up"
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:border-emerald-400 outline-none transition" />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-600 mb-1 block">Amount (KSh) *</label>
          <input type="number" min="1" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0"
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:border-emerald-400 outline-none transition" />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-600 mb-1 block">Source of Money *</label>
          <input value={source} onChange={e => setSource(e.target.value)} placeholder="e.g. M-Pesa, Bank, Cash"
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:border-emerald-400 outline-none transition" />
        </div>
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className="flex-1 border border-gray-200 rounded-xl py-2.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition">Cancel</button>
          <button type="submit" disabled={pending}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl py-2.5 text-xs font-semibold transition disabled:opacity-60 flex items-center justify-center gap-1.5">
            {pending ? <Loader2 size={12} className="animate-spin" /> : <ArrowUpCircle size={12} />} Deposit
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── Withdraw Modal ────────────────────────────────────────────────────────────
function WithdrawModal({ shopId, balance, onClose, onDone }: {
  shopId: string; balance: number; onClose: () => void;
  onDone: (msg: string, ok: boolean) => void;
}) {
  const [desc,   setDesc]   = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [err,    setErr]    = useState("");
  const [pending, start]    = useTransition();

  function submit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    const amt = parseInt(amount, 10);
    if (!desc.trim())   { setErr("Description is required.");   return; }
    if (!amt || amt<=0) { setErr("Enter a valid amount.");       return; }
    if (amt > balance)  { setErr(`Insufficient balance. Available: ${fmt(balance)}`); return; }
    if (!reason.trim()) { setErr("Reason is required.");         return; }
    setErr("");
    start(async () => {
      const res = await withdrawAction(shopId, { description: desc, amount: amt, reason });
      if (res.success) onDone(`KSh ${amt.toLocaleString()} withdrawn.`, true);
      else setErr(res.error ?? "Withdrawal failed.");
    });
  }

  return (
    <Modal title="Withdraw Funds" icon={<ArrowDownCircle size={16} className="text-red-500" />} onClose={onClose}>
      <form onSubmit={submit} className="p-5 space-y-4">
        {err && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 border border-red-100">{err}</p>}
        <div className={`border rounded-xl px-4 py-2.5 text-sm font-semibold ${balance > 0 ? "bg-slate-50 border-gray-200 text-gray-700" : "bg-red-50 border-red-200 text-red-600"}`}>
          Available: {fmt(balance)}{balance <= 0 && <span className="ml-2 text-xs font-normal">— no funds</span>}
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-600 mb-1 block">Description *</label>
          <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="e.g. Cash withdrawal"
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:border-red-400 outline-none transition" />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-600 mb-1 block">Amount (KSh) *</label>
          <input type="number" min="1" max={balance} value={amount} onChange={e => setAmount(e.target.value)} placeholder="0"
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:border-red-400 outline-none transition" />
          <p className="text-[0.68rem] text-gray-400 mt-1">Max: {fmt(balance)}</p>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-600 mb-1 block">Reason *</label>
          <input value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Owner withdrawal"
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:border-red-400 outline-none transition" />
        </div>
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className="flex-1 border border-gray-200 rounded-xl py-2.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition">Cancel</button>
          <button type="submit" disabled={pending || balance <= 0}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-xl py-2.5 text-xs font-semibold transition disabled:opacity-60 flex items-center justify-center gap-1.5">
            {pending ? <Loader2 size={12} className="animate-spin" /> : <ArrowDownCircle size={12} />} Withdraw
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── Transfer From Payments Modal ──────────────────────────────────────────────
function TransferFromPaymentsModal({ shopId, paymentsBalance, onClose, onDone }: {
  shopId: string; paymentsBalance: number;
  onClose: () => void; onDone: (msg: string, ok: boolean) => void;
}) {
  const [amount, setAmount] = useState("");
  const [note,   setNote]   = useState("");
  const [err,    setErr]    = useState("");
  const [pending, start]    = useTransition();

  function submit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    const amt = parseInt(amount, 10);
    if (!amt || amt <= 0)         { setErr("Enter a valid amount.");      return; }
    if (amt > paymentsBalance)    { setErr(`Insufficient payments balance. Available: ${fmt(paymentsBalance)}`); return; }
    if (!note.trim())             { setErr("Note is required.");          return; }
    setErr("");
    start(async () => {
      const res = await transferFromPaymentsAction(shopId, { amount: amt, note });
      if (res.success) onDone(`KSh ${amt.toLocaleString()} moved to wallet.`, true);
      else setErr(res.error ?? "Transfer failed.");
    });
  }

  return (
    <Modal title="Payments → Wallet" icon={<ArrowLeftRight size={16} className="text-indigo-600" />} onClose={onClose}>
      <form onSubmit={submit} className="p-5 space-y-4">
        {err && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 border border-red-100">{err}</p>}
        <div className={`border rounded-xl px-4 py-2.5 text-sm font-semibold ${paymentsBalance > 0 ? "bg-indigo-50 border-indigo-200 text-indigo-700" : "bg-red-50 border-red-200 text-red-600"}`}>
          Payments available: {fmt(paymentsBalance)}
          {paymentsBalance <= 0 && <span className="ml-2 text-xs font-normal">— no funds to transfer</span>}
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-600 mb-1 block">Amount (KSh) *</label>
          <input type="number" min="1" max={paymentsBalance} value={amount} onChange={e => setAmount(e.target.value)} placeholder="0"
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:border-indigo-400 outline-none transition" />
          <p className="text-[0.68rem] text-gray-400 mt-1">Max: {fmt(paymentsBalance)}</p>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-600 mb-1 block">Note *</label>
          <input value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Move sales revenue to wallet"
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:border-indigo-400 outline-none transition" />
        </div>
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className="flex-1 border border-gray-200 rounded-xl py-2.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition">Cancel</button>
          <button type="submit" disabled={pending || paymentsBalance <= 0}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-2.5 text-xs font-semibold transition disabled:opacity-60 flex items-center justify-center gap-1.5">
            {pending ? <Loader2 size={12} className="animate-spin" /> : <ArrowLeftRight size={12} />} Transfer
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── Main View ─────────────────────────────────────────────────────────────────
export default function WalletView({ activeShop, isAdmin, balance, paymentsBalance, transactions, stats }: Props) {
  const router = useRouter();
  const [search,     setSearch]     = useState("");
  const [modal,      setModal]      = useState<"deposit" | "withdraw" | "from_payments" | null>(null);
  const [typeFilter, setTypeFilter] = useState<TxType | "all">("all");
  const [toast,      setToast]      = useState<{ msg: string; ok: boolean } | null>(null);

  function handleDone(msg: string, ok: boolean) {
    setModal(null);
    setToast({ msg, ok });
    if (ok) router.refresh();
    setTimeout(() => setToast(null), 4000);
  }

  const filtered = transactions.filter(t => {
    const q = search.toLowerCase();
    const matchSearch = `${t.name} ${t.sourceOfMoney} ${t.authorizedBy}`.toLowerCase().includes(q);
    const matchType   = typeFilter === "all" || t.type === typeFilter;
    return matchSearch && matchType;
  });

  return (
    <>
      <style>{`
        @keyframes rowIn{from{opacity:0;transform:translateX(-5px)}to{opacity:1;transform:translateX(0)}}
        .tx-row{animation:rowIn 0.18s ease both}
      `}</style>

      <div className="min-h-screen bg-slate-50/80 px-3 py-5 md:px-6">
        <div className="mx-auto max-w-screen-lg space-y-5">

          {/* ── Header ──────────────────────────────────────────────────── */}
          <div className="flex items-center justify-between rounded-2xl border bg-white px-5 py-4 shadow-sm">
            <div>
              <h1 className="text-xl font-black text-gray-900 flex items-center gap-2">
                <Wallet size={22} className="text-indigo-600" /> Wallet
              </h1>
              <p className="text-xs text-gray-400 mt-0.5">{activeShop.name} · {activeShop.location}</p>
            </div>
            {isAdmin && (
              <div className="flex items-center gap-2">
                <button onClick={() => setModal("deposit")}
                  className="flex items-center gap-1.5 bg-emerald-600 text-white px-3 py-2 rounded-xl text-xs font-bold hover:bg-emerald-700 transition shadow-sm">
                  <ArrowUpCircle size={13} /> Deposit
                </button>
                <button onClick={() => setModal("from_payments")}
                  className="flex items-center gap-1.5 bg-indigo-600 text-white px-3 py-2 rounded-xl text-xs font-bold hover:bg-indigo-700 transition shadow-sm">
                  <ArrowLeftRight size={13} /> From Payments
                </button>
                <button onClick={() => setModal("withdraw")}
                  className="flex items-center gap-1.5 bg-red-600 text-white px-3 py-2 rounded-xl text-xs font-bold hover:bg-red-700 transition shadow-sm">
                  <ArrowDownCircle size={13} /> Withdraw
                </button>
              </div>
            )}
          </div>

          {/* ── Balance cards ────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-800 text-white px-7 py-7 shadow-lg">
              <div className="absolute -top-8 -right-8 w-40 h-40 bg-white/5 rounded-full" />
              <p className="text-sm font-semibold opacity-80 mb-1">Wallet Balance</p>
              <p className="text-4xl font-black tabular-nums">{fmt(balance)}</p>
              <p className="text-xs opacity-60 mt-2">{activeShop.name}</p>
            </div>
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-800 text-white px-7 py-7 shadow-lg">
              <div className="absolute -top-8 -right-8 w-40 h-40 bg-white/5 rounded-full" />
              <p className="text-sm font-semibold opacity-80 mb-1">Payments Balance</p>
              <p className="text-4xl font-black tabular-nums">{fmt(paymentsBalance)}</p>
              <p className="text-xs opacity-60 mt-2">Available to transfer</p>
            </div>
          </div>

          {/* ── Stats ───────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3">
            <div className="relative overflow-hidden rounded-xl border bg-white px-4 pt-4 pb-3 shadow-sm">
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-emerald-500" />
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp size={14} className="text-emerald-600" />
                <p className="text-[0.63rem] font-bold uppercase tracking-widest text-gray-400">Total Deposited</p>
              </div>
              <p className="text-xl font-black tabular-nums text-emerald-700">{fmt(stats.totalDeposited)}</p>
            </div>
            <div className="relative overflow-hidden rounded-xl border bg-white px-4 pt-4 pb-3 shadow-sm">
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-red-500" />
              <div className="flex items-center gap-2 mb-1">
                <TrendingDown size={14} className="text-red-500" />
                <p className="text-[0.63rem] font-bold uppercase tracking-widest text-gray-400">Total Outflow</p>
              </div>
              <p className="text-xl font-black tabular-nums text-red-600">{fmt(stats.totalWithdrawn)}</p>
            </div>
          </div>

          {/* ── Toolbar ─────────────────────────────────────────────────── */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search transactions…"
                className="w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 py-2 text-xs focus:border-indigo-400 outline-none shadow-sm transition" />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X size={12} />
                </button>
              )}
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {([
                { key: "all",                   label: "All" },
                { key: "deposit",               label: "Deposits" },
                { key: "withdraw",              label: "Withdrawals" },
                { key: "transfer_from_payments",label: "From Payments" },
              ] as { key: TxType | "all"; label: string }[]).map(f => (
                <button key={f.key} onClick={() => setTypeFilter(f.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${typeFilter === f.key ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-600 border-gray-300 hover:border-indigo-400"}`}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Transaction table ────────────────────────────────────────── */}
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-gray-200">
                    {["#", "Type", "Description", "Reference / Source", "Authorized By", "Amount", "Date"].map(h => (
                      <th key={h} className="px-4 py-3.5 text-left text-xs font-bold uppercase tracking-widest text-gray-400 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((t, i) => {
                    const meta = TX_META[t.type] ?? TX_META.deposit;
                    const TxIcon = meta.Icon;
                    const isCredit = meta.sign === "+";

                    let reference = t.sourceOfMoney;
                    if (t.type === "transfer_out" && t.toShopName)   reference = `→ ${t.toShopName}`;
                    if (t.type === "transfer_in"  && t.fromShopName) reference = `← ${t.fromShopName}`;

                    return (
                      <tr key={t.id} style={{ animationDelay: `${i * 0.02}s` }}
                        className="tx-row bg-white hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 text-xs text-gray-400 font-bold w-8">{i + 1}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[0.68rem] font-bold border ${meta.bg} ${meta.color} ${meta.border}`}>
                            <TxIcon size={11} />{meta.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-gray-800 text-[0.82rem] truncate max-w-[160px]">{t.name}</p>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500 truncate max-w-[140px]">{reference}</td>
                        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{t.authorizedBy}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`tabular-nums font-black text-[0.85rem] ${isCredit ? "text-emerald-700" : "text-red-600"}`}>
                            {meta.sign} {fmt(t.amount)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                          <p>{t.date}</p>
                          <p className="text-[0.6rem] text-gray-300">{t.time}</p>
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr><td colSpan={7} className="py-20 text-center">
                      <div className="flex flex-col items-center gap-3 text-gray-300">
                        <Wallet size={38} strokeWidth={1} />
                        <p className="text-sm font-semibold text-gray-400">
                          {transactions.length === 0 ? "No transactions yet" : "No transactions match your filter"}
                        </p>
                        {isAdmin && transactions.length === 0 && (
                          <button onClick={() => setModal("deposit")}
                            className="mt-1 flex items-center gap-1.5 bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-emerald-700 transition">
                            <Plus size={13} /> Make first deposit
                          </button>
                        )}
                      </div>
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>

      {modal === "deposit" && (
        <DepositModal shopId={activeShop.id} balance={balance} onClose={() => setModal(null)} onDone={handleDone} />
      )}
      {modal === "withdraw" && (
        <WithdrawModal shopId={activeShop.id} balance={balance} onClose={() => setModal(null)} onDone={handleDone} />
      )}
      {modal === "from_payments" && (
        <TransferFromPaymentsModal shopId={activeShop.id} paymentsBalance={paymentsBalance} onClose={() => setModal(null)} onDone={handleDone} />
      )}

      {toast && <Toast msg={toast.msg} ok={toast.ok} onClose={() => setToast(null)} />}
    </>
  );
}
