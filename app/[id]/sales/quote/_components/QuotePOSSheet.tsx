"use client";

import { useState, useRef } from "react";
import { useActionState } from "react";
import { ArrowLeft, Search, Plus, Minus, Trash2, Loader2, FileText, Package, Lock, Store } from "lucide-react";
import Image from "next/image";
import { saveQuoteAction } from "./actions";

type ActionResult = { success: boolean; error?: string };

type Product = {
  id: string; productName: string; sellingPrice: number; buyingPrice: number;
  discount: number; quantity: number; imageUrl: string | null; shopId: string; shopName: string;
};

type CartItem = {
  productId: string; productName: string; price: number;
  discount: number; quantity: number; maxQty: number;
};

type EditQuote = {
  id: string; soldById: string; customerName: string; customerContact: string;
  items: { id: string; productName: string; quantity: number; price: number; discount: number }[];
  amount: number; shopId: string;
};

type ShopOption = { id: string; name: string; location: string; tel: string };
type Profile    = { role: string; shopId: string | null; fullName: string };

type Props = {
  editQuote?: EditQuote;
  products: Product[];
  shops: ShopOption[];
  profile: Profile;
  activeShopId: string;
  canSell: boolean;
  onSuccess: () => void;
  onClose: () => void;
};

export default function QuotePOSSheet({
  editQuote, products, shops, profile, activeShopId, canSell, onSuccess, onClose,
}: Props) {
  const [search, setSearch]       = useState("");
  const [mobileTab, setMobileTab] = useState<"products" | "cart">("products");
  const [browseShopId, setBrowseShopId] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const [cart, setCart] = useState<CartItem[]>(() => {
    if (!editQuote) return [];
    return editQuote.items.map((item) => {
      const product = products.find((p) => p.productName === item.productName && p.shopId === activeShopId);
      return {
        productId:   product?.id ?? "",
        productName: item.productName,
        price:       item.price,
        discount:    item.discount,
        quantity:    item.quantity,
        maxQty:      product?.quantity ?? item.quantity,
      };
    });
  });

  const otherShops      = shops.filter(s => s.id !== activeShopId);
  const viewingShopId   = browseShopId ?? activeShopId;
  const isViewingOther  = viewingShopId !== activeShopId;
  const viewingProducts = products.filter(p => p.shopId === viewingShopId);
  const shopName        = shops.find(s => s.id === activeShopId)?.name ?? "";

  const filteredProducts = viewingProducts.filter(p =>
    p.productName.toLowerCase().includes(search.toLowerCase())
  );

  const addToCart = (product: Product) => {
    if (product.shopId !== activeShopId) return;
    setCart((prev) => {
      const existing = prev.find((c) => c.productId === product.id);
      if (existing) {
        if (existing.quantity >= existing.maxQty) return prev;
        return prev.map((c) => c.productId === product.id ? { ...c, quantity: c.quantity + 1 } : c);
      }
      return [...prev, {
        productId:   product.id,
        productName: product.productName,
        price:       product.sellingPrice,
        discount:    product.discount ?? 0,
        quantity:    1,
        maxQty:      product.quantity,
      }];
    });
  };

  const updateQty = (productId: string, delta: number) => {
    setCart((prev) => prev.map((c) => {
      if (c.productId !== productId) return c;
      return { ...c, quantity: Math.max(1, Math.min(c.maxQty, c.quantity + delta)) };
    }));
  };

  const setQtyDirect = (productId: string, value: string) => {
    const parsed = parseInt(value, 10);
    setCart((prev) => prev.map((c) => {
      if (c.productId !== productId) return c;
      if (isNaN(parsed) || parsed < 1) return { ...c, quantity: 1 };
      return { ...c, quantity: Math.min(c.maxQty, parsed) };
    }));
  };

  const removeFromCart = (productId: string) =>
    setCart((prev) => prev.filter((c) => c.productId !== productId));

  const total      = cart.reduce((sum, c) => sum + (c.price - c.discount) * c.quantity, 0);
  const totalItems = cart.reduce((sum, c) => sum + c.quantity, 0);

  const [state, submitAction, isPending] = useActionState<ActionResult, FormData>(
    async (prev, formData) => {
      if (!canSell) return { success: false, error: "You are not authorised to create quotes in this shop." };
      formData.set("itemsJson", JSON.stringify(
        cart.map((c) => ({ productId: c.productId, quantity: c.quantity, price: c.price, discount: c.discount }))
      ));
      formData.set("shopId", activeShopId);
      if (editQuote?.id) formData.set("quoteId", editQuote.id);
      const res = await saveQuoteAction(prev, formData);
      if (res.success) onSuccess();
      return res;
    },
    { success: false }
  );

  /* ── SHOP BROWSER TABS ─────────────────────────────────────────────── */
  const ShopBrowser = otherShops.length > 0 && (
    <div className="flex gap-1.5 px-4 pt-3 pb-0 overflow-x-auto shrink-0 flex-wrap">
      <button
        onClick={() => setBrowseShopId(null)}
        className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border transition-colors whitespace-nowrap ${
          !browseShopId
            ? "bg-blue-600 text-white border-blue-600"
            : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"
        }`}
      >
        <Store size={11} /> {shopName} <span className="text-[0.6rem] opacity-70">(quoting)</span>
      </button>
      {otherShops.map(s => (
        <button
          key={s.id}
          onClick={() => setBrowseShopId(s.id)}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border transition-colors whitespace-nowrap ${
            browseShopId === s.id
              ? "bg-slate-700 text-white border-slate-700"
              : "bg-white text-gray-600 border-gray-300 hover:border-slate-400"
          }`}
        >
          <Lock size={10} className="opacity-60" /> {s.name} <span className="text-[0.6rem] opacity-60">(view)</span>
        </button>
      ))}
    </div>
  );

  /* ── CART PANEL ─────────────────────────────────────────────────────── */
  const CartPanel = (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b bg-gray-50 shrink-0">
        <div className="text-sm font-semibold text-gray-600">
          Quote <span className="text-blue-600">({totalItems} items)</span>
        </div>
        {total > 0 && (
          <div className="text-2xl font-black text-gray-900 mt-0.5">
            KSh {total.toLocaleString()}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {cart.length === 0 && (
          <div className="py-12 text-center text-gray-400 text-sm">
            <FileText size={40} className="mx-auto mb-2 opacity-30" />
            {canSell
              ? "Click products to add to quote"
              : <span className="text-rose-400">View-only — switch to your shop to quote</span>
            }
          </div>
        )}
        {cart.map((item) => (
          <div key={item.productId} className="bg-white border border-gray-100 rounded-xl p-3 space-y-2 shadow-xs">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">{item.productName}</div>
                <div className="text-xs text-gray-500">
                  KSh {(item.price - item.discount).toLocaleString()} × {item.quantity} =
                  <span className="font-bold text-blue-700 ml-1">
                    KSh {((item.price - item.discount) * item.quantity).toLocaleString()}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => removeFromCart(item.productId)}
                className="w-6 h-6 rounded-full bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center shrink-0 transition-colors"
              >
                <Trash2 size={12} />
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => updateQty(item.productId, -1)}
                className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center shrink-0 transition-colors"
              >
                <Minus size={13} />
              </button>
              <input
                type="number"
                min={1}
                max={item.maxQty}
                value={item.quantity}
                onChange={(e) => setQtyDirect(item.productId, e.target.value)}
                className="w-14 text-center text-sm font-bold border border-gray-200 rounded-lg py-1 outline-none focus:border-blue-400"
              />
              <button
                type="button"
                onClick={() => updateQty(item.productId, 1)}
                className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center shrink-0 transition-colors"
              >
                <Plus size={13} />
              </button>
              <span className="text-xs text-gray-400 ml-1">/ {item.maxQty}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t p-4 bg-gray-50 space-y-3 shrink-0">
        {state?.error && (
          <div className="bg-red-100 text-red-700 text-sm px-3 py-2 rounded-lg text-center">{state.error}</div>
        )}

        <form ref={formRef} action={submitAction} className="space-y-3">
          <input
            name="customerName"
            defaultValue={editQuote?.customerName ?? ""}
            placeholder="Customer name (optional)"
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:border-blue-400 outline-none"
          />
          <input
            name="customerContact"
            defaultValue={editQuote?.customerContact ?? ""}
            placeholder="Customer contact (optional)"
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:border-blue-400 outline-none"
          />

          <button
            type="submit"
            disabled={isPending || cart.length === 0 || !canSell}
            className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-blue-300 disabled:cursor-not-allowed text-white py-3 font-bold rounded-xl flex items-center justify-center gap-2 text-base transition-colors"
          >
            {isPending
              ? <Loader2 size={20} className="animate-spin" />
              : !canSell
              ? <><Lock size={16} /> Not authorised to quote here</>
              : <><FileText size={18} /> {editQuote ? "Update Quote" : "Save Quote"}</>
            }
          </button>
        </form>
      </div>
    </div>
  );

  /* ── PRODUCT GRID ───────────────────────────────────────────────────── */
  const ProductGrid = (
    <div className="flex flex-col h-full overflow-hidden">
      {ShopBrowser}

      {isViewingOther && (
        <div className="mx-4 mt-2 mb-0 flex items-center gap-2 rounded-xl bg-slate-100 border border-slate-200 px-3 py-2 text-xs text-slate-600 font-medium shrink-0">
          <Lock size={12} className="text-slate-400 shrink-0" />
          Viewing <span className="font-bold mx-1">{shops.find(s => s.id === viewingShopId)?.name}</span>
          — for reference only. Switch back to <span className="font-bold mx-1">{shopName}</span> to add items.
        </div>
      )}

      <div className="p-4 pb-2 border-b shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products…"
            className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-gray-300 text-sm outline-none focus:border-blue-500"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 md:grid-cols-3 gap-3 content-start">
        {filteredProducts.map((product) => {
          const inCart      = cart.find((c) => c.productId === product.id);
          const outOfStock  = product.quantity === 0;
          const isOtherShop = product.shopId !== activeShopId;
          return (
            <button
              key={product.id}
              type="button"
              onClick={() => { if (!outOfStock && !isOtherShop) addToCart(product); }}
              disabled={outOfStock || isOtherShop}
              title={isOtherShop ? `From ${product.shopName} — view only` : undefined}
              className={`relative rounded-xl border p-3 text-left transition-all ${
                isOtherShop
                  ? "opacity-60 cursor-not-allowed border-slate-200 bg-slate-50"
                  : outOfStock
                  ? "opacity-40 cursor-not-allowed border-gray-200"
                  : inCart
                  ? "border-blue-500 bg-blue-50 shadow-sm ring-1 ring-blue-400/30"
                  : "border-gray-200 hover:border-blue-400 hover:shadow-sm"
              }`}
            >
              {product.imageUrl ? (
                <div className="relative w-full h-20 rounded-lg mb-2 overflow-hidden">
                  <Image
                    src={product.imageUrl}
                    alt={product.productName}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 50vw, 33vw"
                  />
                </div>
              ) : (
                <div className="w-full h-20 bg-gray-100 rounded-lg mb-2 flex items-center justify-center text-gray-300 text-2xl">
                  📦
                </div>
              )}
              <div className="text-sm font-semibold text-gray-800 truncate">{product.productName}</div>
              <div className="text-sm font-bold text-blue-700 mt-0.5">KSh {product.sellingPrice.toLocaleString()}</div>
              <div className={`text-xs mt-0.5 ${product.quantity <= 5 ? "text-red-500 font-medium" : "text-gray-400"}`}>
                {outOfStock ? "Out of stock" : `Stock: ${product.quantity}`}
              </div>

              {isOtherShop && (
                <div className="absolute top-2 left-2 bg-slate-600 text-white text-[0.6rem] rounded-full px-1.5 py-0.5 font-bold flex items-center gap-0.5">
                  <Lock size={8} /> view
                </div>
              )}
              {inCart && !isOtherShop && (
                <div className="absolute top-2 right-2 bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold shadow-sm">
                  {inCart.quantity}
                </div>
              )}
              {outOfStock && !isOtherShop && (
                <div className="absolute inset-0 rounded-xl bg-gray-200/60 flex items-center justify-center">
                  <span className="text-xs font-bold text-gray-500 bg-white/80 px-2 py-1 rounded-lg">Out of stock</span>
                </div>
              )}
            </button>
          );
        })}
        {filteredProducts.length === 0 && (
          <div className="col-span-2 md:col-span-3 py-20 text-center text-gray-400">
            <Package size={36} className="mx-auto mb-2 opacity-30" />
            No products found
          </div>
        )}
      </div>
    </div>
  );

  /* ── RENDER ─────────────────────────────────────────────────────────── */
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex justify-end">
      <div className="w-full max-w-5xl h-full bg-white shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 border-b px-4 py-3 bg-white shrink-0">
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 shrink-0 transition-colors">
            <ArrowLeft size={22} />
          </button>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <FileText size={20} className="text-blue-600" />
            {editQuote ? "Edit Quote" : "New Quote"}
          </h2>
          <div className="ml-auto flex items-center gap-2 flex-wrap justify-end">
            <span className="text-sm font-medium text-gray-600 bg-gray-100 px-3 py-1.5 rounded-lg hidden sm:inline">
              {shopName || "—"}
            </span>
            {!canSell && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200 rounded-full px-3 py-1">
                <Lock size={11} /> View only
              </span>
            )}
            <span className="text-sm text-gray-500 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-lg hidden sm:inline">
              👤 {profile.fullName}
            </span>
          </div>
        </div>

        {/* Mobile tabs */}
        <div className="flex border-b md:hidden shrink-0">
          <button
            onClick={() => setMobileTab("products")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-colors ${mobileTab === "products" ? "border-b-2 border-blue-600 text-blue-700" : "text-gray-500"}`}
          >
            <Package size={16} /> Products
          </button>
          <button
            onClick={() => setMobileTab("cart")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-colors ${mobileTab === "cart" ? "border-b-2 border-blue-600 text-blue-700" : "text-gray-500"}`}
          >
            <FileText size={16} /> Quote
            {totalItems > 0 && (
              <span className="bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                {totalItems}
              </span>
            )}
          </button>
        </div>

        {/* Mobile content */}
        <div className="flex-1 overflow-hidden md:hidden">
          {mobileTab === "products" ? ProductGrid : CartPanel}
        </div>

        {/* Desktop split layout */}
        <div className="hidden md:flex flex-1 overflow-hidden">
          <div className="flex-1 overflow-hidden border-r">{ProductGrid}</div>
          <div className="w-full max-w-sm flex flex-col overflow-hidden">{CartPanel}</div>
        </div>
      </div>
    </div>
  );
}
