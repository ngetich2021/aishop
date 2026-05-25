/**
 * Shop ISR data layer.
 *
 * All heavy Prisma queries live here wrapped in unstable_cache.
 * Pages call these functions — auth + access guard stay uncached.
 * Actions call bust(shopId) to invalidate the entire shop cache.
 *
 * Cache key includes shopId (and userId where data is user-specific).
 * Tag  = shop:<shopId>  — one revalidateTag call busts everything for that shop.
 */

import { unstable_cache } from "next/cache";
import prisma              from "@/lib/prisma";
import { revalidateTag }   from "next/cache";

export const SHOP_REVALIDATE = 30;  // seconds
export const SHOP_REVALIDATE_SLOW = 60; // for heavy aggregations

/** Returns the ISR tag for a shop. Import this in action files. */
export function shopTag(shopId: string) { return `shop:${shopId}`; }

/** Single call to bust all cached data for one shop. Use in server actions. */
export function bustShop(shopId: string) {
  revalidateTag(shopTag(shopId), "default");
}

/** ISO helper */
function iso(d?: Date | null) { return d ? d.toISOString() : null; }

// ─── Products page ──────────────────────────────────────────────────────────
export function getProductsPageData(shopId: string, userId: string) {
  return unstable_cache(
    async () => {
      const [products, categories, subCategories, saleItems, returnItems] = await Promise.all([
        prisma.product.findMany({
          where:   { shopId },
          include: { subCategory: { include: { category: true } } },
          orderBy: { createdAt: "desc" },
        }),
        prisma.category.findMany({
          where:   { OR: [{ userId }, { userId: null }] },
          orderBy: { name: "asc" },
        }),
        prisma.subCategory.findMany({
          where:   { OR: [{ userId }, { userId: null }] },
          include: { category: { select: { name: true } } },
          orderBy: { name: "asc" },
        }),
        prisma.saleItem.findMany({
          where:  { sale: { shopId } },
          select: { quantity: true, productId: true },
        }),
        prisma.returnItem.findMany({
          where:  { return: { shopId } },
          select: { quantity: true, productId: true },
        }),
      ]);

      const soldMap   = saleItems.reduce<Record<string, number>>((a, s) => { a[s.productId] = (a[s.productId] ?? 0) + s.quantity; return a; }, {});
      const returnMap = returnItems.reduce<Record<string, number>>((a, r) => { a[r.productId] = (a[r.productId] ?? 0) + r.quantity; return a; }, {});

      const totalSold     = saleItems.reduce((s, x) => s + x.quantity, 0);
      const totalReturned = returnItems.reduce((s, x) => s + x.quantity, 0);
      const productValue  = products.reduce((s, p) => s + p.quantity * p.buyingPrice, 0);
      const outOfStock    = products.filter(p => p.quantity <= p.outOfStockLimit).length;
      const slowSelling   = products.filter(p => (soldMap[p.id] ?? 0) < 3).length;

      return {
        stats: { totalProducts: products.length, productValue, totalSold, totalReturned, outOfStock, slowSelling },
        products: products.map(p => ({
          id:              p.id,
          name:            p.productName,
          serialNo:        p.serialNo ?? "",
          image:           p.imageUrl,
          category:        p.subCategory.category.name,
          subcategory:     p.subCategory.name,
          price:           p.sellingPrice,
          discount:        p.discount,
          quantity:        p.quantity,
          shopId:          p.shopId,
          buyingPrice:     p.buyingPrice,
          subCategoryId:   p.subCategoryId,
          categoryId:      p.subCategory.categoryId,
          outOfStockLimit: p.outOfStockLimit,
          totalSold:       soldMap[p.id] ?? 0,
          totalReturned:   returnMap[p.id] ?? 0,
        })),
        categories,
        subCategories: subCategories.map(s => ({
          id: s.id, name: s.name, categoryId: s.categoryId, category: { name: s.category.name },
        })),
      };
    },
    [`${shopId}:products:${userId}`],
    { revalidate: SHOP_REVALIDATE, tags: [shopTag(shopId)] },
  )();
}

// ─── Stock (adjustments + returns) page ─────────────────────────────────────
export function getStockPageData(shopId: string) {
  return unstable_cache(
    async () => {
      const [adjustments, returns, products, sales] = await Promise.all([
        prisma.adjustment.findMany({
          where:   { shopId },
          include: { product: { select: { productName: true } } },
          orderBy: { createdAt: "desc" },
        }),
        prisma.return.findMany({
          where:   { shopId },
          include: { returnItems: { include: { product: { select: { productName: true } } } } },
          orderBy: { createdAt: "desc" },
        }),
        prisma.product.findMany({
          where:   { shopId },
          select:  { id: true, productName: true, quantity: true, sellingPrice: true },
          orderBy: { productName: "asc" },
        }),
        prisma.sale.findMany({
          where:   { shopId, status: "completed" },
          select:  { id: true, createdAt: true, totalAmount: true },
          orderBy: { createdAt: "desc" },
          take:    200,
        }),
      ]);

      return {
        stats: {
          totalAdjustments: adjustments.length,
          totalValue:       adjustments.reduce((s, a) => s + (a.value ?? 0), 0),
          totalReturns:     returns.length,
          totalReturnValue: returns.reduce((s, r) => s + r.returnItems.reduce((x, i) => x + i.price * i.quantity, 0), 0),
          pendingReturns:   returns.filter(r => r.status === "pending").length,
        },
        adjustments: adjustments.map(a => ({
          id: a.id, productName: a.product.productName, productId: a.productId,
          adjustType: a.adjustType, quantity: a.quantity, originalStock: a.originalStock ?? 0,
          newStockQty: a.newStockQty ?? 0, value: a.value ?? 0, adjustedBy: a.adjustedBy,
          shopId: a.shopId, date: a.createdAt.toISOString(),
        })),
        returns: returns.map(r => ({
          id: r.id, saleId: r.saleId, reason: r.reason ?? "", status: r.status,
          returnedById: r.returnedById, shopId: r.shopId, date: r.createdAt.toISOString(),
          totalQty:   r.returnItems.reduce((s, i) => s + i.quantity, 0),
          totalValue: r.returnItems.reduce((s, i) => s + i.price * i.quantity, 0),
          items: r.returnItems.map(i => ({
            id: i.id, productId: i.productId, productName: i.product.productName,
            quantity: i.quantity, price: i.price, reason: i.reason ?? "",
          })),
        })),
        products,
        sales: sales.map(s => ({ id: s.id, createdAt: iso(s.createdAt)!, totalAmount: s.totalAmount })),
      };
    },
    [`${shopId}:stock`],
    { revalidate: SHOP_REVALIDATE, tags: [shopTag(shopId)] },
  )();
}

// ─── Sales (sold) page ───────────────────────────────────────────────────────
export function getSalesPageData(shopId: string) {
  return unstable_cache(
    async () => {
      const [sales, staffList, products] = await Promise.all([
        prisma.sale.findMany({
          where:   { shopId },
          include: {
            saleItems: { include: { product: { select: { productName: true } } } },
            returns:   { select: { id: true, status: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 1000,
        }),
        prisma.staff.findMany({
          where:   { shopId },
          select:  { id: true, userId: true, fullName: true },
          orderBy: { fullName: "asc" },
        }),
        prisma.product.findMany({
          where:   { shopId, quantity: { gt: 0 } },
          select:  { id: true, productName: true, sellingPrice: true, buyingPrice: true, quantity: true, discount: true },
          orderBy: { productName: "asc" },
        }),
      ]);

      const staffMap = new Map(staffList.map(s => [s.userId, s.fullName]));

      const fmtSales = sales.map(s => ({
        id: s.id, soldById: s.soldById,
        soldByName:         staffMap.get(s.soldById) ?? "—",
        totalAmount:        s.totalAmount,
        paymentMethod:      s.paymentMethod,
        paymentMethodsJson: s.paymentMethodsJson ?? null,
        customerName:       s.customerName  ?? null,
        customerPhone:      s.customerPhone ?? null,
        isPrinted:          s.isPrinted,
        status:             s.status,
        cancelReason:       s.cancelReason ?? null,
        createdAt:          s.createdAt.toISOString(),
        hasReturn:          s.returns.length > 0,
        items: s.saleItems.map(i => ({
          id: i.id, productName: i.product.productName, quantity: i.quantity, price: i.price, discount: i.discount,
        })),
      }));

      return {
        sales:     fmtSales,
        staffList: staffList.map(s => ({ id: s.id, userId: s.userId, fullName: s.fullName })),
        products:  products.map(p => ({ id: p.id, productName: p.productName, sellingPrice: p.sellingPrice, buyingPrice: p.buyingPrice, quantity: p.quantity, discount: p.discount })),
      };
    },
    [`${shopId}:sales`],
    { revalidate: SHOP_REVALIDATE, tags: [shopTag(shopId)] },
  )();
}

// ─── Suppliers page ──────────────────────────────────────────────────────────
export function getSuppliersPageData(shopId: string) {
  return unstable_cache(
    async () => {
      const raw = await prisma.supplier.findMany({
        where:   { shopId },
        include: { _count: { select: { buys: true } } },
        orderBy: { name: "asc" },
      });
      return raw.map(s => ({
        id: s.id, name: s.name, contact1: s.contact1, contact2: s.contact2,
        goodsType: s.goodsType, buyCount: s._count.buys,
      }));
    },
    [`${shopId}:suppliers`],
    { revalidate: SHOP_REVALIDATE, tags: [shopTag(shopId)] },
  )();
}

// ─── Buy page ────────────────────────────────────────────────────────────────
export function getBuysPageData(shopId: string) {
  return unstable_cache(
    async () => {
      const [rawBuys, rawSuppliers] = await Promise.all([
        prisma.buy.findMany({
          where:   { shopId },
          include: { supplier: { select: { name: true } } },
          orderBy: { createdAt: "desc" },
        }),
        prisma.supplier.findMany({
          where:   { shopId },
          select:  { id: true, name: true },
          orderBy: { name: "asc" },
        }),
      ]);

      const buys = rawBuys.map(b => {
        let items: { name: string; qty: number; price: number }[] = [];
        try { items = JSON.parse(b.itemsJson); } catch { items = []; }
        return {
          id: b.id, supplierId: b.supplierId, supplierName: b.supplier.name,
          items, totalAmount: b.totalAmount, transportCost: b.transportCost,
          status: b.status, authorizedBy: b.authorizedBy,
          date: b.createdAt.toISOString().split("T")[0],
        };
      });

      return {
        buys,
        suppliers: rawSuppliers,
        stats: {
          total:         buys.length,
          totalAmount:   buys.reduce((s, b) => s + b.totalAmount + b.transportCost, 0),
          pendingCount:  buys.filter(b => b.status === "pending").length,
          receivedCount: buys.filter(b => b.status === "received").length,
        },
      };
    },
    [`${shopId}:buys`],
    { revalidate: SHOP_REVALIDATE, tags: [shopTag(shopId)] },
  )();
}

// ─── Assets page ─────────────────────────────────────────────────────────────
export function getAssetsPageData(shopId: string) {
  return unstable_cache(
    async () => {
      const raw = await prisma.asset.findMany({
        where:   { shopId },
        orderBy: { createdAt: "desc" },
      });
      const assets = raw.map(a => ({
        id: a.id, itemName: a.itemName, cost: a.cost, imageUrl: a.imageUrl,
        date: a.createdAt.toISOString().split("T")[0],
      }));
      return { assets, stats: { total: assets.length, totalCost: assets.reduce((s, a) => s + a.cost, 0) } };
    },
    [`${shopId}:assets`],
    { revalidate: SHOP_REVALIDATE, tags: [shopTag(shopId)] },
  )();
}

// ─── Credit page ─────────────────────────────────────────────────────────────
export function getCreditPageData(shopId: string) {
  return unstable_cache(
    async () => {
      const raw = await prisma.credit.findMany({
        where:   { shopId },
        include: { creditPayments: { orderBy: { paidAt: "asc" } } },
        orderBy: { createdAt: "desc" },
      });
      const credits = raw.map(c => {
        const totalPaid   = c.creditPayments.reduce((s, p) => s + p.amount, 0) + c.downPayment;
        const outstanding = Math.max(0, c.amount - totalPaid);
        return {
          id: c.id, customerName: c.customerName, customerPhone: c.customerPhone,
          amount: c.amount, downPayment: c.downPayment,
          dueDate: c.dueDate ? c.dueDate.toISOString().split("T")[0] : null,
          status: c.status, totalPaid, outstanding,
          date: c.createdAt.toISOString().split("T")[0],
          payments: c.creditPayments.map(p => ({
            id: p.id, amount: Math.round(p.amount), method: p.method, note: p.note,
            paidAt: p.paidAt.toISOString().split("T")[0],
          })),
        };
      });
      return {
        credits,
        stats: {
          total: credits.length,
          totalAmount:  credits.reduce((s, c) => s + c.amount, 0),
          outstanding:  credits.reduce((s, c) => s + c.outstanding, 0),
          paidCount:    credits.filter(c => c.status === "paid").length,
        },
      };
    },
    [`${shopId}:credit`],
    { revalidate: SHOP_REVALIDATE, tags: [shopTag(shopId)] },
  )();
}

// ─── Expenses page ───────────────────────────────────────────────────────────
export function getExpensesPageData(shopId: string) {
  return unstable_cache(
    async () => {
      const now          = new Date();
      const startOfDay   = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfWeek  = new Date(startOfDay); startOfWeek.setDate(startOfDay.getDate() - startOfDay.getDay());
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfYear  = new Date(now.getFullYear(), 0, 1);

      const [expensesRaw, todayAgg, weekAgg, monthAgg, yearAgg, wallet] = await Promise.all([
        prisma.expense.findMany({
          where:   { shopId },
          select:  { id: true, description: true, amount: true, category: true, paidById: true, shopId: true, shop: { select: { name: true } }, createdAt: true },
          orderBy: { createdAt: "desc" },
        }),
        prisma.expense.aggregate({ where: { shopId, createdAt: { gte: startOfDay   } }, _sum: { amount: true }, _count: true }),
        prisma.expense.aggregate({ where: { shopId, createdAt: { gte: startOfWeek  } }, _sum: { amount: true }, _count: true }),
        prisma.expense.aggregate({ where: { shopId, createdAt: { gte: startOfMonth } }, _sum: { amount: true }, _count: true }),
        prisma.expense.aggregate({ where: { shopId, createdAt: { gte: startOfYear  } }, _sum: { amount: true }, _count: true }),
        prisma.wallet.findUnique({ where: { shopId }, select: { balance: true } }),
      ]);

      // Resolve paidBy names
      const userIds   = [...new Set(expensesRaw.map(e => e.paidById))];
      const [profiles, users] = await Promise.all([
        prisma.profile.findMany({ where: { userId: { in: userIds } }, select: { userId: true, fullName: true } }),
        prisma.user.findMany   ({ where: { id:     { in: userIds } }, select: { id: true, name: true, email: true } }),
      ]);
      const nameMap: Record<string, string> = {};
      for (const uid of userIds) {
        const p = profiles.find(x => x.userId === uid);
        const u = users.find(x => x.id === uid);
        nameMap[uid] = p?.fullName ?? u?.name ?? u?.email ?? "—";
      }

      const expenses = expensesRaw.map(e => ({
        id: e.id, description: e.description, amount: e.amount, category: e.category ?? null,
        paidById: e.paidById, paidByName: nameMap[e.paidById] ?? "—",
        shop: e.shop.name, shopId: e.shopId,
        date: e.createdAt.toISOString().split("T")[0],
        time: e.createdAt.toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" }),
      }));

      return {
        expenses,
        walletBalance: wallet?.balance ?? 0,
        stats: {
          today: { count: todayAgg._count, amount: todayAgg._sum.amount ?? 0 },
          week:  { count: weekAgg._count,  amount: weekAgg._sum.amount  ?? 0 },
          month: { count: monthAgg._count, amount: monthAgg._sum.amount ?? 0 },
          year:  { count: yearAgg._count,  amount: yearAgg._sum.amount  ?? 0 },
          total: { count: expenses.length, amount: expenses.reduce((s, e) => s + e.amount, 0) },
        },
      };
    },
    [`${shopId}:expenses`],
    { revalidate: SHOP_REVALIDATE, tags: [shopTag(shopId)] },
  )();
}

// ─── Payments page ───────────────────────────────────────────────────────────
export function getPaymentsPageData(shopId: string) {
  return unstable_cache(
    async () => {
      const raw = await prisma.payment.findMany({
        where:   { shopId },
        orderBy: { createdAt: "desc" },
      });
      const payments = raw.map(p => ({
        id: p.id, amount: p.amount, method: p.method, direction: p.direction,
        source: p.source, note: p.note, transactionCode: p.transactionCode,
        date: p.createdAt.toISOString().split("T")[0],
      }));
      const inflows     = payments.filter(p => p.direction === "in");
      const totalAmount = inflows.reduce((s, p) => s + p.amount, 0);
      const methodBreakdown: Record<string, number> = {};
      for (const p of inflows) methodBreakdown[p.method] = (methodBreakdown[p.method] ?? 0) + p.amount;
      return { payments, stats: { total: payments.length, totalAmount, methodBreakdown } };
    },
    [`${shopId}:payments`],
    { revalidate: SHOP_REVALIDATE, tags: [shopTag(shopId)] },
  )();
}

// ─── Wallet page ─────────────────────────────────────────────────────────────
export function getWalletPageData(shopId: string) {
  return unstable_cache(
    async () => {
      const [wallet, raw, payInAgg, payOutAgg] = await Promise.all([
        prisma.wallet.findUnique({ where: { shopId }, select: { balance: true } }),
        prisma.transaction.findMany({ where: { shopId }, orderBy: { createdAt: "desc" } }),
        prisma.payment.aggregate({ where: { shopId, direction: "in"  }, _sum: { amount: true } }),
        prisma.payment.aggregate({ where: { shopId, direction: "out" }, _sum: { amount: true } }),
      ]);

      const transactions = raw.map(t => ({
        id: t.id, name: t.name, amount: t.amount,
        type: t.type as "deposit" | "withdraw" | "transfer_out" | "transfer_in",
        sourceOfMoney: t.sourceOfMoney, toShopName: t.toShopName ?? null, fromShopName: t.fromShopName ?? null,
        authorizedBy: t.authorizedBy,
        date: t.createdAt.toISOString().split("T")[0],
        time: t.createdAt.toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" }),
      }));

      const totalDeposited = raw.filter(t => t.type === "deposit" || t.type === "transfer_in").reduce((s, t) => s + t.amount, 0);
      const totalWithdrawn = raw.filter(t => t.type === "withdraw" || t.type === "transfer_out").reduce((s, t) => s + t.amount, 0);
      const paymentsBalance = (payInAgg._sum.amount ?? 0) - (payOutAgg._sum.amount ?? 0);

      return {
        balance: wallet?.balance ?? 0,
        transactions,
        paymentsBalance,
        stats: { totalDeposited, totalWithdrawn },
      };
    },
    [`${shopId}:wallet`],
    { revalidate: SHOP_REVALIDATE, tags: [shopTag(shopId)] },
  )();
}

// ─── Margins page ────────────────────────────────────────────────────────────
export function getMarginsPageData(shopId: string) {
  return unstable_cache(
    async () => {
      const now            = new Date();
      const monthStart     = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd       = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const prevMonthEnd   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      const twelveAgo      = new Date(now.getFullYear(), now.getMonth() - 11, 1);

      const [salesThisMonth, expensesThisMonth, salesPrevMonth, expensesPrevMonthAgg, sales12m, expenses12m, saleItems12m] = await Promise.all([
        prisma.sale.aggregate({ where: { shopId, status: "completed", createdAt: { gte: monthStart, lte: monthEnd } }, _sum: { totalAmount: true }, _count: true }),
        prisma.expense.aggregate({ where: { shopId, createdAt: { gte: monthStart, lte: monthEnd } }, _sum: { amount: true }, _count: true }),
        prisma.sale.aggregate({ where: { shopId, status: "completed", createdAt: { gte: prevMonthStart, lte: prevMonthEnd } }, _sum: { totalAmount: true }, _count: true }),
        prisma.expense.aggregate({ where: { shopId, createdAt: { gte: prevMonthStart, lte: prevMonthEnd } }, _sum: { amount: true } }),
        prisma.sale.findMany({ where: { shopId, status: "completed", createdAt: { gte: twelveAgo } }, select: { totalAmount: true, createdAt: true } }),
        prisma.expense.findMany({ where: { shopId, createdAt: { gte: twelveAgo } }, select: { amount: true, createdAt: true } }),
        prisma.saleItem.findMany({
          where:  { sale: { shopId, status: "completed", createdAt: { gte: twelveAgo } } },
          select: { quantity: true, price: true, discount: true, product: { select: { buyingPrice: true } }, sale: { select: { createdAt: true } } },
        }),
      ]);

      // Build monthly buckets (12 months)
      const buckets: Record<string, { revenue: number; expenses: number; cogs: number }> = {};
      for (let i = 0; i < 12; i++) {
        const d   = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        buckets[key] = { revenue: 0, expenses: 0, cogs: 0 };
      }
      for (const s of sales12m) {
        const key = `${s.createdAt.getFullYear()}-${String(s.createdAt.getMonth() + 1).padStart(2, "0")}`;
        if (buckets[key]) buckets[key].revenue += s.totalAmount;
      }
      for (const e of expenses12m) {
        const key = `${e.createdAt.getFullYear()}-${String(e.createdAt.getMonth() + 1).padStart(2, "0")}`;
        if (buckets[key]) buckets[key].expenses += e.amount;
      }
      for (const item of saleItems12m) {
        const key = `${item.sale.createdAt.getFullYear()}-${String(item.sale.createdAt.getMonth() + 1).padStart(2, "0")}`;
        if (buckets[key]) buckets[key].cogs += item.product.buyingPrice * item.quantity;
      }

      const monthlyData = Object.entries(buckets).map(([month, b]) => {
        const grossProfit    = b.revenue - b.cogs;
        const netProfit      = b.revenue - b.expenses;
        const grossMarginPct = b.revenue > 0 ? (grossProfit / b.revenue) * 100 : 0;
        const netMarginPct   = b.revenue > 0 ? (netProfit   / b.revenue) * 100 : 0;
        return {
          month, label: new Date(month + "-01").toLocaleDateString("en-KE", { month: "short" }),
          revenue: b.revenue, expenses: b.expenses, cogs: b.cogs,
          grossProfit, netProfit,
          grossMarginPct: Math.round(grossMarginPct * 10) / 10,
          netMarginPct:   Math.round(netMarginPct   * 10) / 10,
        };
      });

      // Daily buckets (last 30 days)
      const dailyBuckets: Record<string, { revenue: number; expenses: number; cogs: number }> = {};
      for (let i = 29; i >= 0; i--) {
        const d   = new Date(now); d.setDate(now.getDate() - i);
        const key = d.toISOString().split("T")[0];
        dailyBuckets[key] = { revenue: 0, expenses: 0, cogs: 0 };
      }
      for (const s of sales12m)     { const k = s.createdAt.toISOString().split("T")[0]; if (dailyBuckets[k]) dailyBuckets[k].revenue   += s.totalAmount; }
      for (const e of expenses12m)  { const k = e.createdAt.toISOString().split("T")[0]; if (dailyBuckets[k]) dailyBuckets[k].expenses  += e.amount; }
      for (const item of saleItems12m) { const k = item.sale.createdAt.toISOString().split("T")[0]; if (dailyBuckets[k]) dailyBuckets[k].cogs += item.product.buyingPrice * item.quantity; }

      const dailyData = Object.entries(dailyBuckets).map(([date, b]) => ({
        date, label: new Date(date).toLocaleDateString("en-KE", { day: "numeric", month: "short" }),
        revenue: b.revenue, expenses: b.expenses, cogs: b.cogs,
        grossProfit: b.revenue - b.cogs, netProfit: b.revenue - b.expenses,
      }));

      const thisRevenue  = salesThisMonth._sum.totalAmount    ?? 0;
      const thisExpenses = expensesThisMonth._sum.amount      ?? 0;
      const prevRevenue  = salesPrevMonth._sum.totalAmount    ?? 0;
      const prevExpenses = expensesPrevMonthAgg._sum.amount   ?? 0;
      const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const thisCogs     = buckets[thisMonthKey]?.cogs ?? 0;
      const thisGross    = thisRevenue - thisCogs;
      const thisNet      = thisRevenue - thisExpenses;
      const prevNet      = prevRevenue - prevExpenses;

      return {
        kpi: {
          thisRevenue, thisExpenses, thisCogs, thisGross, thisNet,
          prevRevenue, prevExpenses, prevNet,
          revenueChange: prevRevenue  > 0 ? ((thisRevenue - prevRevenue)  / prevRevenue)  * 100 : null,
          netChange:     prevNet !== 0    ? ((thisNet     - prevNet)       / Math.abs(prevNet)) * 100 : null,
          ytdRevenue:    monthlyData.reduce((s, m) => s + m.revenue,    0),
          ytdExpenses:   monthlyData.reduce((s, m) => s + m.expenses,   0),
          ytdNet:        monthlyData.reduce((s, m) => s + m.netProfit,  0),
          ytdGross:      monthlyData.reduce((s, m) => s + m.grossProfit, 0),
          grossMarginPct: thisRevenue > 0 ? Math.round((thisGross / thisRevenue) * 1000) / 10 : 0,
          netMarginPct:   thisRevenue > 0 ? Math.round((thisNet   / thisRevenue) * 1000) / 10 : 0,
        },
        monthlyData,
        dailyData,
        bestMonth: monthlyData.reduce<typeof monthlyData[0] | null>(
          (best, m) => m.netProfit > (best?.netProfit ?? -Infinity) ? m : best, null,
        ),
      };
    },
    [`${shopId}:margins`],
    { revalidate: SHOP_REVALIDATE_SLOW, tags: [shopTag(shopId)] },
  )();
}

// ─── Reports page ────────────────────────────────────────────────────────────
export function getReportsPageData(shopId: string) {
  return unstable_cache(
    async () => {
      const now            = new Date();
      const monthStart     = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd       = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const prevMonthEnd   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      const yearStart      = new Date(now.getFullYear(), 0, 1);

      const [sales, prevSalesRaw, expenses, prevExpenses, staffCount, credits, payments] = await Promise.all([
        prisma.sale.findMany({ where: { shopId, status: "completed", createdAt: { gte: monthStart, lte: monthEnd } }, include: { saleItems: { select: { quantity: true, price: true, discount: true } } } }),
        prisma.sale.count({ where: { shopId, status: "completed", createdAt: { gte: prevMonthStart, lte: prevMonthEnd } } }),
        prisma.expense.findMany({ where: { shopId, createdAt: { gte: monthStart, lte: monthEnd } }, select: { amount: true, createdAt: true } }),
        prisma.expense.aggregate({ where: { shopId, createdAt: { gte: prevMonthStart, lte: prevMonthEnd } }, _sum: { amount: true } }),
        prisma.staff.count({ where: { shopId } }),
        prisma.credit.findMany({ where: { shopId, status: { not: "paid" } }, select: { amount: true, downPayment: true, creditPayments: { select: { amount: true } } } }),
        prisma.payment.findMany({ where: { shopId, createdAt: { gte: monthStart, lte: monthEnd } }, select: { amount: true, method: true } }),
      ]);

      const revenue     = sales.reduce((s, sale) => s + sale.totalAmount, 0);
      const expTotal    = expenses.reduce((s, e) => s + e.amount, 0);
      const [prevRevRaw, salaryTotal] = await Promise.all([
        prisma.sale.aggregate({ where: { shopId, status: "completed", createdAt: { gte: prevMonthStart, lte: prevMonthEnd } }, _sum: { totalAmount: true } }),
        prisma.salary.aggregate({ where: { shopId, month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}` }, _sum: { amount: true } }),
      ]);

      const prevRevenue  = prevRevRaw._sum.totalAmount ?? 0;
      const prevExpAmt   = prevExpenses._sum.amount ?? 0;
      const grossProfit  = revenue - expTotal;
      const creditOut    = credits.reduce((s, c) => {
        const paid = c.creditPayments.reduce((x, p) => x + p.amount, 0) + c.downPayment;
        return s + Math.max(0, c.amount - paid);
      }, 0);
      const netProfit = grossProfit - (salaryTotal._sum.amount ?? 0);

      // Daily data (last 30 days)
      const salesByDay: Record<string, { revenue: number; sales: number }> = {};
      for (const s of sales) {
        const d = s.createdAt.toISOString().split("T")[0];
        if (!salesByDay[d]) salesByDay[d] = { revenue: 0, sales: 0 };
        salesByDay[d].revenue += s.totalAmount;
        salesByDay[d].sales   += 1;
      }
      const expByDay: Record<string, number> = {};
      for (const e of expenses) { const d = e.createdAt.toISOString().split("T")[0]; expByDay[d] = (expByDay[d] ?? 0) + e.amount; }

      const dailyData = [];
      for (let i = 29; i >= 0; i--) {
        const d   = new Date(now); d.setDate(now.getDate() - i);
        const key = d.toISOString().split("T")[0];
        dailyData.push({ date: key, revenue: salesByDay[key]?.revenue ?? 0, expenses: expByDay[key] ?? 0, sales: salesByDay[key]?.sales ?? 0 });
      }

      // Top products (year to date)
      const saleItemsYTD = await prisma.saleItem.findMany({
        where:   { sale: { shopId, status: "completed", createdAt: { gte: yearStart } } },
        include: { product: { select: { productName: true } } },
      });
      const productMap: Record<string, { name: string; qty: number; revenue: number }> = {};
      for (const item of saleItemsYTD) {
        const name = item.product.productName;
        if (!productMap[name]) productMap[name] = { name, qty: 0, revenue: 0 };
        productMap[name].qty     += item.quantity;
        productMap[name].revenue += (item.price - item.discount) * item.quantity;
      }
      const topProducts = Object.values(productMap).sort((a, b) => b.revenue - a.revenue).slice(0, 8);

      // Payment breakdown
      const payMap: Record<string, { amount: number; count: number }> = {};
      for (const p of payments) {
        if (!payMap[p.method]) payMap[p.method] = { amount: 0, count: 0 };
        payMap[p.method].amount += p.amount;
        payMap[p.method].count  += 1;
      }
      const payBreakdown = Object.entries(payMap).map(([method, v]) => ({ method, ...v })).sort((a, b) => b.amount - a.amount);

      return {
        stats: { revenue, prevRevenue, expenses: expTotal, prevExpenses: prevExpAmt, salesCount: sales.length, prevSales: prevSalesRaw, staffCount, creditOut: Math.round(creditOut), grossProfit, netProfit },
        dailyData,
        topProducts,
        payBreakdown,
      };
    },
    [`${shopId}:reports`],
    { revalidate: SHOP_REVALIDATE_SLOW, tags: [shopTag(shopId)] },
  )();
}

// ─── Staff page ───────────────────────────────────────────────────────────────
export function getStaffPageData(shopId: string, userId: string) {
  return unstable_cache(
    async () => {
      const myStaffRecord = await prisma.staff.findUnique({
        where:  { userId },
        select: { id: true, baseSalary: true, shopId: true },
      });

      const [staffList, rolesList, advances, salaries, pendingInvites, myAdvances] = await Promise.all([
        prisma.staff.findMany({
          where:   { shopId },
          include: { user: { select: { id: true, email: true, image: true, profile: { select: { designation: true, allowedRoutes: true, role: true } } } } },
          orderBy: { fullName: "asc" },
        }),
        prisma.role.findMany({ where: { shopId }, orderBy: { name: "asc" } }),
        prisma.advance.groupBy({ by: ["staffId"], where: { shopId, status: { in: ["approved", "paid"] } }, _sum: { amount: true } }),
        prisma.salary.groupBy({ by: ["staffId"], where: { shopId, status: "paid" }, _count: { id: true } }),
        prisma.shopInvite.findMany({
          where:   { shopId, accepted: false, expiresAt: { gt: new Date() } },
          select:  { id: true, email: true, role: true, fullName: true, createdAt: true, expiresAt: true },
          orderBy: { createdAt: "desc" },
        }),
        myStaffRecord
          ? prisma.advance.findMany({
              where:   { staffId: myStaffRecord.id, shopId },
              select:  { id: true, amount: true, date: true, reason: true, status: true, createdAt: true },
              orderBy: { createdAt: "desc" },
              take:    10,
            })
          : Promise.resolve([]),
      ]);

      const advanceMap: Record<string, number> = {};
      const salaryMap:  Record<string, number>  = {};
      for (const a of advances) advanceMap[a.staffId] = a._sum.amount ?? 0;
      for (const s of salaries) salaryMap[s.staffId]  = s._count.id;

      const fmtStaff = staffList.map(s => ({
        id: s.id, userId: s.userId, fullName: s.fullName,
        tel1: s.tel1 ?? null, tel2: s.tel2 ?? null, mpesaNo: s.mpesaNo ?? null,
        baseSalary: s.baseSalary, shopId: s.shopId,
        email:         s.user.email ?? null,
        image:         s.user.image ?? null,
        designation:   s.user.profile?.designation   ?? null,
        allowedRoutes: (s.user.profile?.allowedRoutes ?? []) as string[],
        profileRole:   s.user.profile?.role          ?? "staff",
        totalAdvances: advanceMap[s.id] ?? 0,
        paidSalaries:  salaryMap[s.id]  ?? 0,
        createdAt:     s.createdAt.toISOString().split("T")[0],
      }));

      return {
        staffList: fmtStaff,
        rolesList: rolesList.map(r => ({ id: r.id, name: r.name, description: r.description, allowedRoutes: r.allowedRoutes as string[] })),
        pendingInvites: pendingInvites.map(inv => ({
          id: inv.id, email: inv.email, role: inv.role, fullName: inv.fullName ?? null,
          createdAt: inv.createdAt.toISOString().split("T")[0],
          expiresAt: inv.expiresAt.toISOString().split("T")[0],
        })),
        stats: {
          total:          fmtStaff.length,
          totalSalaryBill: staffList.reduce((s, m) => s + m.baseSalary, 0),
          totalAdvances:   Object.values(advanceMap).reduce((s, v) => s + v, 0),
        },
        myStaff: myStaffRecord ? { id: myStaffRecord.id, baseSalary: myStaffRecord.baseSalary, shopId: myStaffRecord.shopId } : null,
        myAdvances: myAdvances.map(a => ({
          id: a.id, amount: a.amount, date: a.date.toISOString().split("T")[0],
          reason: a.reason ?? null, status: a.status, createdAt: a.createdAt.toISOString(),
        })),
      };
    },
    [`${shopId}:staff:${userId}`],
    { revalidate: SHOP_REVALIDATE, tags: [shopTag(shopId)] },
  )();
}

// ─── Advance page ─────────────────────────────────────────────────────────────
export function getAdvancesPageData(shopId: string, userId: string) {
  return unstable_cache(
    async () => {
      const staffRecord = await prisma.staff.findFirst({
        where:  { userId, shopId },
        select: { id: true, fullName: true, baseSalary: true },
      });

      const isStaff = !!staffRecord;

      const [raw, staffList] = await Promise.all([
        prisma.advance.findMany({
          where:   { shopId, ...(isStaff && staffRecord ? { staffId: staffRecord.id } : {}) },
          include: { staff: { select: { fullName: true, baseSalary: true } } },
          orderBy: { createdAt: "desc" },
        }),
        prisma.staff.findMany({ where: { shopId }, select: { id: true, fullName: true, baseSalary: true }, orderBy: { fullName: "asc" } }),
      ]);

      const advances = raw.map(a => ({
        id: a.id, staffId: a.staffId, staffName: a.staff.fullName, baseSalary: a.staff.baseSalary,
        amount: a.amount, date: a.date.toISOString().split("T")[0], reason: a.reason ?? null,
        status: a.status, transactionCode: a.transactionCode ?? null, shopId: a.shopId,
        createdAt: a.createdAt.toISOString().split("T")[0],
      }));

      return {
        advances,
        staffList,
        currentStaff: staffRecord ? { id: staffRecord.id, fullName: staffRecord.fullName, baseSalary: staffRecord.baseSalary } : null,
        stats: {
          totalAdvances:  advances.length,
          totalAdvance:   advances.reduce((s, a) => s + a.amount, 0),
          pendingAdvance: advances.filter(a => a.status === "requested" || a.status === "approved").reduce((s, a) => s + a.amount, 0),
          approvedCount:  advances.filter(a => a.status === "approved").length,
        },
      };
    },
    [`${shopId}:advances:${userId}`],
    { revalidate: SHOP_REVALIDATE, tags: [shopTag(shopId)] },
  )();
}

// ─── Logs page ───────────────────────────────────────────────────────────────
export function getLogsPageData(shopId: string) {
  return unstable_cache(
    async () => {
      const shopRow   = await prisma.shop.findUnique({ where: { id: shopId }, select: { userId: true } });
      const staffRows = await prisma.staff.findMany({ where: { shopId }, select: { userId: true } });
      const shopUserIds = Array.from(new Set([shopRow?.userId, ...staffRows.map(s => s.userId)].filter(Boolean) as string[]));

      const LOG_LIMIT = 300;

      const [rawLogin, rawActivity] = await Promise.all([
        prisma.loginLog.findMany({
          where:   { userId: { in: shopUserIds } },
          orderBy: { loginTime: "desc" },
          take:    LOG_LIMIT,
          include: { user: { select: { id: true, name: true, email: true, image: true } } },
        }),
        prisma.activityLog.findMany({
          where:   { OR: [{ shopId }, { shopId: null, userId: { in: shopUserIds } }] },
          orderBy: { createdAt: "desc" },
          take:    LOG_LIMIT,
          include: { user: { select: { id: true, name: true, email: true, image: true } } },
        }),
      ]);

      const logs = rawLogin.map(l => ({
        id: l.id, userId: l.userId,
        loginTime: l.loginTime.toISOString(), lastSeen: l.lastSeen.toISOString(),
        duration: l.duration ?? 0,
        user: { id: l.user.id, name: l.user.name ?? "Unknown", email: l.user.email ?? "—", image: l.user.image ?? null },
      }));

      const activityLogs = rawActivity.map(a => ({
        id: a.id, userId: a.userId, action: a.action,
        entity: a.entity ?? null, entityId: (a as any).entityId ?? null,
        path: a.path, method: (a as any).method,
        createdAt: a.createdAt.toISOString(),
        user: { id: a.user.id, name: a.user.name ?? "Unknown", email: a.user.email ?? "—", image: a.user.image ?? null },
      }));

      const nonZero    = logs.filter(l => l.duration > 0);
      const avgDuration = nonZero.length ? Math.round(nonZero.reduce((a, b) => a + b.duration, 0) / nonZero.length) : 0;

      return {
        logs, activityLogs,
        stats: { totalSessions: logs.length, longSessions: logs.filter(l => l.duration > 3600).length, avgDuration },
        capped: rawLogin.length === LOG_LIMIT || rawActivity.length === LOG_LIMIT,
      };
    },
    [`${shopId}:logs`],
    { revalidate: SHOP_REVALIDATE, tags: [shopTag(shopId)] },
  )();
}

// ─── Dashboard page ───────────────────────────────────────────────────────────
// Per (shopId, userId) — queries are permission-gated; cached per user+shop.
export function getDashboardPageData(
  shopId: string,
  userId: string,
  isAdmin: boolean,
  canSales: boolean,
  canFinance: boolean,
  canInventory: boolean,
  canHR: boolean,
) {
  const permKey = `${+isAdmin}${+canSales}${+canFinance}${+canInventory}${+canHR}`;
  return unstable_cache(
    async () => {
      const now          = new Date();
      const startOfDay   = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfWeek  = new Date(startOfDay); startOfWeek.setDate(startOfDay.getDate() - startOfDay.getDay());
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const twelveAgo    = new Date(now.getFullYear(), now.getMonth() - 11, 1);
      const shopFilter   = { shopId };

      function nullAgg() { return { _sum: {} as Record<string, number | null>, _count: 0 }; }

      const [
        userRecord, allShops, totalProducts, totalStaff,
        salesTotal, salesToday, salesWeek, salesMonth,
        expenseTotal, expenseToday, creditRows, walletsRaw,
        recentSalesRaw, recentExpensesRaw, monthlySalesRaw, monthlyExpensesRaw,
        advanceAgg, paymentTodayAgg,
      ] = await Promise.all([
        prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
        isAdmin ? prisma.shop.findMany({ where: { userId }, select: { id: true, name: true, location: true } }) : Promise.resolve([] as { id: string; name: string; location: string }[]),
        canInventory ? prisma.product.count({ where: { shopId } }) : Promise.resolve(0),
        canHR ? prisma.staff.count({ where: { shopId } }) : Promise.resolve(0),
        canSales ? prisma.sale.aggregate({ where: { ...shopFilter, status: "completed" }, _sum: { totalAmount: true }, _count: true }) : Promise.resolve(nullAgg()),
        canSales ? prisma.sale.aggregate({ where: { ...shopFilter, status: "completed", createdAt: { gte: startOfDay   } }, _sum: { totalAmount: true }, _count: true }) : Promise.resolve(nullAgg()),
        canSales ? prisma.sale.aggregate({ where: { ...shopFilter, status: "completed", createdAt: { gte: startOfWeek  } }, _sum: { totalAmount: true }, _count: true }) : Promise.resolve(nullAgg()),
        canSales ? prisma.sale.aggregate({ where: { ...shopFilter, status: "completed", createdAt: { gte: startOfMonth } }, _sum: { totalAmount: true }, _count: true }) : Promise.resolve(nullAgg()),
        canFinance ? prisma.expense.aggregate({ where: shopFilter, _sum: { amount: true }, _count: true }) : Promise.resolve(nullAgg()),
        canFinance ? prisma.expense.aggregate({ where: { ...shopFilter, createdAt: { gte: startOfDay } }, _sum: { amount: true }, _count: true }) : Promise.resolve(nullAgg()),
        canFinance ? prisma.credit.findMany({ where: { shopId, status: { not: "paid" } }, select: { amount: true, downPayment: true, creditPayments: { select: { amount: true } } } }) : Promise.resolve([]),
        canFinance ? prisma.wallet.findMany({ where: { shopId }, select: { balance: true, shopId: true, shop: { select: { name: true } } } }) : Promise.resolve([]),
        canSales ? prisma.sale.findMany({ where: { ...shopFilter, status: "completed" }, select: { id: true, totalAmount: true, paymentMethod: true, shop: { select: { name: true } }, saleItems: { select: { quantity: true, product: { select: { productName: true } } }, take: 1 }, createdAt: true }, orderBy: { createdAt: "desc" }, take: 8 }) : Promise.resolve([]),
        canFinance ? prisma.expense.findMany({ where: shopFilter, select: { id: true, description: true, amount: true, category: true, shop: { select: { name: true } }, createdAt: true }, orderBy: { createdAt: "desc" }, take: 6 }) : Promise.resolve([]),
        canSales ? prisma.sale.findMany({ where: { ...shopFilter, status: "completed", createdAt: { gte: twelveAgo } }, select: { totalAmount: true, createdAt: true } }) : Promise.resolve([]),
        canFinance ? prisma.expense.findMany({ where: { ...shopFilter, createdAt: { gte: twelveAgo } }, select: { amount: true, createdAt: true } }) : Promise.resolve([]),
        canHR ? prisma.advance.aggregate({ where: { ...shopFilter, status: { in: ["approved", "paid"] } }, _sum: { amount: true }, _count: true }) : Promise.resolve(nullAgg()),
        canFinance ? prisma.payment.aggregate({ where: { ...shopFilter, createdAt: { gte: startOfDay } }, _sum: { amount: true }, _count: true }) : Promise.resolve(nullAgg()),
      ]);

      // Monthly chart
      const monthlyMap: Record<string, { sales: number; expenses: number }> = {};
      for (let i = 0; i < 12; i++) {
        const d   = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        monthlyMap[key] = { sales: 0, expenses: 0 };
      }
      for (const s of monthlySalesRaw   as { totalAmount: number; createdAt: Date }[]) { const k = `${s.createdAt.getFullYear()}-${String(s.createdAt.getMonth() + 1).padStart(2, "0")}`; if (monthlyMap[k]) monthlyMap[k].sales    += s.totalAmount; }
      for (const e of monthlyExpensesRaw as { amount: number; createdAt: Date }[])    { const k = `${e.createdAt.getFullYear()}-${String(e.createdAt.getMonth() + 1).padStart(2, "0")}`; if (monthlyMap[k]) monthlyMap[k].expenses += e.amount; }

      const monthlyData = Object.entries(monthlyMap).map(([month, d]) => ({
        month,
        label:    new Date(month + "-01").toLocaleDateString("en-KE", { month: "short" }),
        sales:    d.sales,
        expenses: d.expenses,
        profit:   d.sales - d.expenses,
      }));

      type AggR = { _sum: Record<string, number | null>; _count: number | { _all: number } };
      const sumOf  = (a: AggR, k: string) => (a._sum?.[k] as number | null) ?? 0;
      const countOf = (a: AggR) => { const c = a._count; return typeof c === "number" ? c : (c as { _all: number })._all ?? 0; };

      const totalSalesAmt   = sumOf(salesTotal   as AggR, "totalAmount");
      const totalExpenseAmt = sumOf(expenseTotal as AggR, "amount");
      const creditDue = (creditRows as { amount: number; downPayment: number; creditPayments: { amount: number }[] }[])
        .reduce((s, c) => { const paid = c.creditPayments.reduce((x, p) => x + p.amount, 0) + c.downPayment; return s + Math.max(0, c.amount - paid); }, 0);
      const walletsArr = walletsRaw as { balance: number; shopId: string; shop: { name: string } }[];

      return {
        userName: userRecord?.name ?? null,
        allShops: allShops as { id: string; name: string; location: string }[],
        stats: {
          sales: {
            today: { count: countOf(salesToday as AggR), amount: sumOf(salesToday as AggR, "totalAmount") },
            week:  { count: countOf(salesWeek  as AggR), amount: sumOf(salesWeek  as AggR, "totalAmount") },
            month: { count: countOf(salesMonth as AggR), amount: sumOf(salesMonth as AggR, "totalAmount") },
            total: { count: countOf(salesTotal as AggR), amount: totalSalesAmt },
          },
          expenses: {
            today: { count: countOf(expenseToday as AggR), amount: sumOf(expenseToday as AggR, "amount") },
            total: { count: countOf(expenseTotal as AggR), amount: totalExpenseAmt },
          },
          totalProducts:  totalProducts as number,
          totalStaff:     totalStaff    as number,
          netProfit:      totalSalesAmt - totalExpenseAmt,
          creditDue:      Math.round(creditDue),
          totalBalance:   walletsArr.reduce((s, w) => s + w.balance, 0),
          advances:       { count: countOf(advanceAgg      as AggR), amount: sumOf(advanceAgg      as AggR, "amount") },
          paymentsToday:  { count: countOf(paymentTodayAgg as AggR), amount: sumOf(paymentTodayAgg as AggR, "amount") },
        },
        recentSales: (recentSalesRaw as { id: string; totalAmount: number; paymentMethod: string; shop: { name: string }; saleItems: { quantity: number; product: { productName: string } }[]; createdAt: Date }[]).map(s => ({
          id: s.id, productName: s.saleItems[0]?.product.productName ?? "Multiple items",
          totalItems: s.saleItems.reduce((sum, i) => sum + i.quantity, 0),
          amount: s.totalAmount, method: s.paymentMethod, shop: s.shop.name,
          date: s.createdAt.toISOString().split("T")[0],
          time: s.createdAt.toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" }),
        })),
        recentExpenses: (recentExpensesRaw as { id: string; description: string; amount: number; category: string | null; shop: { name: string }; createdAt: Date }[]).map(e => ({
          id: e.id, description: e.description, amount: e.amount, category: e.category ?? "General",
          shop: e.shop.name, date: e.createdAt.toISOString().split("T")[0],
        })),
        monthlyData,
        wallets: walletsArr.map(w => ({ balance: w.balance, shopName: w.shop.name, shopId: w.shopId })),
      };
    },
    [`${shopId}:dashboard:${userId}:${permKey}`],
    { revalidate: SHOP_REVALIDATE, tags: [shopTag(shopId)] },
  )();
}
