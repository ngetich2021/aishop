"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Plus, Search, Grid3X3, List, Store, MapPin, TrendingUp,
  Package, DollarSign, RotateCcw, AlertTriangle, Clock,
  Edit2, Trash2, Eye, Loader2, ChevronUp, ChevronDown,
} from "lucide-react";
import CategoryManager from "./CategoryManager";
import ProductFormModal from "./ProductFormModal";
import { deleteProductAction } from "./actions";

// ── Types ─────────────────────────────────────────────────────────────────────

export type Product = {
  id: string;
  name: string;
  serialNo: string;
  image: string | null;
  category: string;
  subcategory: string;
  price: number;
  discount: number;
  quantity: number;
  shopId: string;
  buyingPrice: number;
  subCategoryId: string;
  categoryId: string;
  outOfStockLimit: number;
  totalSold: number;
  totalReturned: number;
};

type Stats = {
  totalProducts: number;
  productValue: number;
  totalSold: number;
  totalReturned: number;
  outOfStock: number;
  slowSelling: number;
};

type SortKey = "name" | "price" | "quantity" | "buyingPrice" | "margin";
type SortDir = "asc" | "desc";

interface Props {
  shopId: string;
  activeShop: { id: string; name: string; location: string };
  isOwner: boolean;
  stats: Stats;
  products: Product[];
  categories: { id: string; name: string }[];
  subCategories: { id: string; name: string; categoryId: string; category?: { name: string } }[];
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({
  icon, label, value, sub, accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  accent: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 flex items-center gap-4">
      <div className={`h-11 w-11 shrink-0 rounded-xl flex items-center justify-center ${accent}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-gray-400">{label}</p>
        <p className="text-xl font-bold text-gray-900 leading-tight">{value}</p>
        {sub && <p className="text-[0.65rem] text-gray-400 truncate">{sub}</p>}
      </div>
    </div>
  );
}

// ── Stock Badge ───────────────────────────────────────────────────────────────

function StockBadge({ qty, limit }: { qty: number; limit: number }) {
  if (qty === 0) return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-[0.65rem] font-bold text-red-700">
      <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> Out
    </span>
  );
  if (qty <= limit) return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[0.65rem] font-bold text-amber-700">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Low: {qty}
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[0.65rem] font-bold text-emerald-700">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> {qty}
    </span>
  );
}

// ── Product Card (grid view) ──────────────────────────────────────────────────

function ProductCard({
  product, isOwner, deletingId,
  onView, onEdit, onDelete,
}: {
  product: Product;
  isOwner: boolean;
  deletingId: string | null;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const margin = product.price - product.buyingPrice;
  const marginPct = product.buyingPrice > 0
    ? Math.round((margin / product.buyingPrice) * 100)
    : 0;

  return (
    <div className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col">
      {/* Image */}
      <div
        className="relative h-40 bg-gradient-to-br from-slate-50 to-indigo-50 overflow-hidden cursor-pointer"
        onClick={onView}
      >
        {product.image ? (
          <Image
            src={product.image}
            alt={product.name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Package size={40} className="text-indigo-200" />
          </div>
        )}
        {/* Stock overlay badge */}
        <div className="absolute top-2 right-2">
          <StockBadge qty={product.quantity} limit={product.outOfStockLimit} />
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 p-4 flex flex-col gap-2">
        <div>
          <p className="font-bold text-gray-900 leading-snug truncate">{product.name}</p>
          <p className="text-[0.7rem] text-gray-400 truncate">{product.category} · {product.subcategory}</p>
        </div>

        <div className="flex items-center justify-between mt-auto">
          <div>
            <p className="text-xs text-gray-400">Selling</p>
            <p className="font-bold text-indigo-700 text-sm">
              {product.price.toLocaleString()}
              {product.discount > 0 && (
                <span className="ml-1 text-[0.65rem] text-gray-400 line-through">{(product.price + product.discount).toLocaleString()}</span>
              )}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400">Margin</p>
            <p className={`font-bold text-sm ${marginPct >= 20 ? "text-emerald-600" : marginPct >= 10 ? "text-amber-600" : "text-red-500"}`}>
              {marginPct}%
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      {isOwner && (
        <div className="border-t border-gray-100 px-4 py-2.5 flex items-center justify-end gap-1.5">
          <button onClick={onView} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-indigo-600 transition">
            <Eye size={14} />
          </button>
          <button onClick={onEdit} className="p-1.5 rounded-lg text-gray-400 hover:bg-indigo-50 hover:text-indigo-600 transition">
            <Edit2 size={14} />
          </button>
          <button
            onClick={onDelete}
            disabled={deletingId === product.id}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 transition disabled:opacity-50"
          >
            {deletingId === product.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ProductsView({
  shopId, activeShop, isOwner, stats, products, categories, subCategories,
}: Props) {
  const router = useRouter();

  const [search,       setSearch]       = useState("");
  const [viewMode,     setViewMode]     = useState<"table" | "grid">("table");
  const [filterCat,    setFilterCat]    = useState("all");
  const [filterStock,  setFilterStock]  = useState<"all" | "ok" | "low" | "out">("all");
  const [sortKey,      setSortKey]      = useState<SortKey>("name");
  const [sortDir,      setSortDir]      = useState<SortDir>("asc");
  const [deletingId,   setDeletingId]   = useState<string | null>(null);
  const [showForm,     setShowForm]     = useState(false);
  const [showCatMgr,   setShowCatMgr]   = useState(false);
  const [formMode,     setFormMode]     = useState<"add" | "edit" | "view">("add");
  const [selectedProd, setSelectedProd] = useState<Product | undefined>();

  // Sort toggle
  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  const SortIcon = ({ col }: { col: SortKey }) =>
    sortKey === col
      ? (sortDir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />)
      : <ChevronUp size={12} className="opacity-20" />;

  const uniqueCategories = useMemo(
    () => Array.from(new Set(products.map((p) => p.category))).sort(),
    [products]
  );

  const filtered = useMemo(() => {
    let list = products;

    if (search) list = list.filter((p) => `${p.name} ${p.serialNo} ${p.category} ${p.subcategory}`.toLowerCase().includes(search.toLowerCase()));
    if (filterCat !== "all") list = list.filter((p) => p.category === filterCat);
    if (filterStock === "ok")  list = list.filter((p) => p.quantity > p.outOfStockLimit);
    if (filterStock === "low") list = list.filter((p) => p.quantity > 0 && p.quantity <= p.outOfStockLimit);
    if (filterStock === "out") list = list.filter((p) => p.quantity === 0);

    list = [...list].sort((a, b) => {
      let av: number | string = a.name, bv: number | string = b.name;
      if (sortKey === "price")      { av = a.price;      bv = b.price; }
      if (sortKey === "quantity")   { av = a.quantity;   bv = b.quantity; }
      if (sortKey === "buyingPrice"){ av = a.buyingPrice; bv = b.buyingPrice; }
      if (sortKey === "margin")     { av = a.price - a.buyingPrice; bv = b.price - b.buyingPrice; }
      if (typeof av === "string") return sortDir === "asc" ? av.localeCompare(bv as string) : (bv as string).localeCompare(av);
      return sortDir === "asc" ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });

    return list;
  }, [products, search, filterCat, filterStock, sortKey, sortDir]);

  const openForm = (mode: "add" | "edit" | "view", p?: Product) => {
    setFormMode(mode);
    setSelectedProd(p);
    setShowForm(true);
  };

  const handleDelete = async (p: Product) => {
    if (!confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
    setDeletingId(p.id);
    const res = await deleteProductAction(p.id, shopId);
    setDeletingId(null);
    if (res.success) router.refresh();
    else alert(res.error ?? "Delete failed");
  };

  // Product‑to‑edit shape required by the form
  const productToEdit = selectedProd
    ? {
        id:             selectedProd.id,
        name:           selectedProd.name,
        serialNo:       selectedProd.serialNo || null,
        price:          selectedProd.price,
        discount:       selectedProd.discount,
        buyingPrice:    selectedProd.buyingPrice,
        quantity:       selectedProd.quantity,
        outOfStockLimit: selectedProd.outOfStockLimit,
        subCategoryId:  selectedProd.subCategoryId,
        categoryId:     selectedProd.categoryId,
        image:          selectedProd.image,
      }
    : undefined;

  const fmt = (n: number) => n.toLocaleString();

  return (
    <>
      <div className="min-h-screen bg-slate-50/70 px-3 py-5 md:px-6 space-y-5">

        {/* ── Shop Banner ────────────────────────────────────────────────── */}
        <div className="flex items-center gap-4 rounded-2xl bg-linear-to-r from-indigo-600 to-violet-600 px-5 py-4 shadow-lg shadow-indigo-200/40">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20">
            <Store size={18} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[0.6rem] font-semibold uppercase tracking-widest text-indigo-200">Inventory</p>
            <p className="font-bold text-white truncate">{activeShop.name}</p>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs text-indigo-100 shrink-0">
            <MapPin size={11} />
            {activeShop.location}
          </div>
          {!isOwner && (
            <span className="rounded-full bg-amber-400/20 border border-amber-300/30 px-3 py-1 text-xs font-bold text-amber-200 shrink-0">
              View Only
            </span>
          )}
        </div>

        {/* ── Stats ──────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          <StatCard icon={<Package size={18} className="text-indigo-600" />}  label="Products"   value={fmt(stats.totalProducts)} accent="bg-indigo-50" />
          <StatCard icon={<DollarSign size={18} className="text-emerald-600" />} label="Stock Value" value={fmt(stats.productValue)} sub="buying cost" accent="bg-emerald-50" />
          <StatCard icon={<TrendingUp size={18} className="text-blue-600" />}  label="Total Sold" value={fmt(stats.totalSold)} accent="bg-blue-50" />
          <StatCard icon={<RotateCcw size={18} className="text-violet-600" />} label="Returned"   value={fmt(stats.totalReturned)} accent="bg-violet-50" />
          <StatCard icon={<AlertTriangle size={18} className="text-red-500" />}  label="Out of Stock" value={stats.outOfStock} accent="bg-red-50" />
          <StatCard icon={<Clock size={18} className="text-amber-500" />}  label="Slow Moving" value={stats.slowSelling} sub="< 3 sold" accent="bg-amber-50" />
        </div>

        {/* ── Toolbar ────────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          {/* Left: filters + search */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Category filter */}
            <select
              value={filterCat}
              onChange={(e) => setFilterCat(e.target.value)}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            >
              <option value="all">All categories</option>
              {uniqueCategories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>

            {/* Stock filter */}
            {(["all","ok","low","out"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setFilterStock(k)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${
                  filterStock === k
                    ? k === "out" ? "bg-red-600 text-white border-red-600"
                      : k === "low" ? "bg-amber-500 text-white border-amber-500"
                      : "bg-indigo-600 text-white border-indigo-600"
                    : "bg-white text-gray-600 border-gray-200 hover:border-indigo-300"
                }`}
              >
                {k === "all" ? "All Stock" : k === "ok" ? "In Stock" : k === "low" ? "Low Stock" : "Out"}
              </button>
            ))}

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={13} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search products…"
                className="w-52 rounded-xl border border-gray-200 bg-white pl-9 pr-3 py-2 text-xs shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition"
              />
            </div>
          </div>

          {/* Right: view toggle + action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {/* View toggle */}
            <div className="flex rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
              <button
                onClick={() => setViewMode("table")}
                className={`px-3 py-2 transition ${viewMode === "table" ? "bg-indigo-600 text-white" : "text-gray-500 hover:bg-gray-50"}`}
              >
                <List size={15} />
              </button>
              <button
                onClick={() => setViewMode("grid")}
                className={`px-3 py-2 transition ${viewMode === "grid" ? "bg-indigo-600 text-white" : "text-gray-500 hover:bg-gray-50"}`}
              >
                <Grid3X3 size={15} />
              </button>
            </div>

            {isOwner && (
              <>
                <button
                  onClick={() => setShowCatMgr(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 shadow-sm transition"
                >
                  <Plus size={14} /> Categories
                </button>
                <button
                  onClick={() => openForm("add")}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 shadow-sm transition"
                >
                  <Plus size={14} /> Product
                </button>
              </>
            )}
          </div>
        </div>

        {/* ── Content ────────────────────────────────────────────────────── */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-28 text-center">
            <Package size={56} strokeWidth={1} className="text-gray-200 mb-4" />
            <p className="text-sm font-semibold text-gray-400">
              {search || filterCat !== "all" || filterStock !== "all"
                ? "No products match your filters."
                : "No products yet."}
            </p>
            {isOwner && !search && filterCat === "all" && filterStock === "all" && (
              <button
                onClick={() => openForm("add")}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 shadow transition"
              >
                <Plus size={15} /> Add first product
              </button>
            )}
          </div>
        ) : viewMode === "grid" ? (
          /* ── GRID VIEW ── */
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filtered.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                isOwner={isOwner}
                deletingId={deletingId}
                onView={() => openForm("view", p)}
                onEdit={() => openForm("edit", p)}
                onDelete={() => handleDelete(p)}
              />
            ))}
          </div>
        ) : (
          /* ── TABLE VIEW ── */
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-gray-200">
                    <th className="px-4 py-3.5 text-left sticky left-0 bg-slate-50 z-10 text-[0.68rem] font-bold uppercase tracking-widest text-gray-400">
                      Product
                    </th>
                    <th className="px-4 py-3.5 text-left text-[0.68rem] font-bold uppercase tracking-widest text-gray-400">
                      Category
                    </th>
                    <th
                      className="px-4 py-3.5 text-right text-[0.68rem] font-bold uppercase tracking-widest text-gray-400 cursor-pointer select-none"
                      onClick={() => toggleSort("buyingPrice")}
                    >
                      <span className="inline-flex items-center gap-1">Buying <SortIcon col="buyingPrice" /></span>
                    </th>
                    <th
                      className="px-4 py-3.5 text-right text-[0.68rem] font-bold uppercase tracking-widest text-gray-400 cursor-pointer select-none"
                      onClick={() => toggleSort("price")}
                    >
                      <span className="inline-flex items-center gap-1">Selling <SortIcon col="price" /></span>
                    </th>
                    <th
                      className="px-4 py-3.5 text-right text-[0.68rem] font-bold uppercase tracking-widest text-gray-400 cursor-pointer select-none"
                      onClick={() => toggleSort("margin")}
                    >
                      <span className="inline-flex items-center gap-1">Margin <SortIcon col="margin" /></span>
                    </th>
                    <th
                      className="px-4 py-3.5 text-center text-[0.68rem] font-bold uppercase tracking-widest text-gray-400 cursor-pointer select-none"
                      onClick={() => toggleSort("quantity")}
                    >
                      <span className="inline-flex items-center justify-center gap-1">Stock <SortIcon col="quantity" /></span>
                    </th>
                    <th className="px-4 py-3.5 text-center text-[0.68rem] font-bold uppercase tracking-widest text-gray-400">
                      Sold
                    </th>
                    <th className="px-4 py-3.5 text-center text-[0.68rem] font-bold uppercase tracking-widest text-gray-400">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((p, i) => {
                    const margin    = p.price - p.buyingPrice;
                    const marginPct = p.buyingPrice > 0 ? Math.round((margin / p.buyingPrice) * 100) : 0;

                    return (
                      <tr
                        key={p.id}
                        className="hover:bg-slate-50/70 transition-colors"
                        style={{ animationDelay: `${i * 0.02}s` }}
                      >
                        {/* Product name + image — sticky */}
                        <td className="px-4 py-3 sticky left-0 bg-white z-[5] hover:bg-slate-50/70">
                          <div className="flex items-center gap-3 min-w-[180px]">
                            <div className="relative h-10 w-10 shrink-0 rounded-xl overflow-hidden bg-indigo-50 border border-gray-100">
                              {p.image
                                ? <Image src={p.image} alt={p.name} fill className="object-cover" />
                                : <Package size={18} className="absolute inset-0 m-auto text-indigo-200" />
                              }
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-gray-900 truncate max-w-[150px]">{p.name}</p>
                              {p.serialNo && (
                                <p className="text-[0.65rem] text-gray-400 truncate">S/N: {p.serialNo}</p>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <div>
                            <p className="text-xs font-medium text-gray-700">{p.category}</p>
                            <p className="text-[0.65rem] text-gray-400">{p.subcategory}</p>
                          </div>
                        </td>

                        <td className="px-4 py-3 text-right font-medium text-gray-600 tabular-nums">
                          {fmt(p.buyingPrice)}
                        </td>

                        <td className="px-4 py-3 text-right font-bold text-gray-900 tabular-nums">
                          {fmt(p.price)}
                          {p.discount > 0 && (
                            <div className="text-[0.65rem] text-emerald-600 font-medium">-{fmt(p.discount)} off</div>
                          )}
                        </td>

                        <td className="px-4 py-3 text-right tabular-nums">
                          <span className={`font-bold text-sm ${marginPct >= 20 ? "text-emerald-600" : marginPct >= 10 ? "text-amber-600" : "text-red-500"}`}>
                            {marginPct}%
                          </span>
                          <div className="text-[0.65rem] text-gray-400">{fmt(margin)}</div>
                        </td>

                        <td className="px-4 py-3 text-center">
                          <StockBadge qty={p.quantity} limit={p.outOfStockLimit} />
                        </td>

                        <td className="px-4 py-3 text-center">
                          <span className="text-xs font-semibold text-indigo-600">{fmt(p.totalSold)}</span>
                          {p.totalReturned > 0 && (
                            <div className="text-[0.65rem] text-red-400">-{p.totalReturned} ret</div>
                          )}
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => openForm("view", p)}
                              className="p-1.5 rounded-lg text-gray-400 hover:bg-indigo-50 hover:text-indigo-600 transition"
                              title="View"
                            >
                              <Eye size={14} />
                            </button>
                            {isOwner && (
                              <>
                                <button
                                  onClick={() => openForm("edit", p)}
                                  className="p-1.5 rounded-lg text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition"
                                  title="Edit"
                                >
                                  <Edit2 size={14} />
                                </button>
                                <button
                                  onClick={() => handleDelete(p)}
                                  disabled={deletingId === p.id}
                                  className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 transition disabled:opacity-50"
                                  title="Delete"
                                >
                                  {deletingId === p.id
                                    ? <Loader2 size={14} className="animate-spin" />
                                    : <Trash2 size={14} />
                                  }
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Table footer */}
            <div className="border-t border-gray-100 px-4 py-2.5 flex items-center justify-between text-xs text-gray-400">
              <span>{filtered.length} of {products.length} products</span>
              {(search || filterCat !== "all" || filterStock !== "all") && (
                <button
                  onClick={() => { setSearch(""); setFilterCat("all"); setFilterStock("all"); }}
                  className="text-indigo-500 hover:text-indigo-700 font-medium transition"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Product Form Side Sheet ────────────────────────────────────── */}
      {showForm && (
        <ProductFormModal
          shopId={shopId}
          mode={formMode}
          productToEdit={productToEdit}
          categories={categories}
          subCategories={subCategories}
          onSuccess={() => { setShowForm(false); router.refresh(); }}
          onClose={() => setShowForm(false)}
        />
      )}

      {/* ── Category Manager Panel ─────────────────────────────────────── */}
      {showCatMgr && (
        <CategoryManager
          shopId={shopId}
          categories={categories}
          subCategories={subCategories}
          onClose={() => setShowCatMgr(false)}
        />
      )}
    </>
  );
}
