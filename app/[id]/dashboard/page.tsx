import { auth }      from "@/auth";
import prisma         from "@/lib/prisma";
import { redirect }   from "next/navigation";
import DashboardView  from "./_components/DashboardView";
import { parseAllowedRoutes, isRouteAllowed } from "@/lib/permissions";

export const revalidate = 0;

interface Props { params: Promise<{ id: string }> }

export default async function DashboardPage({ params }: Props) {
  const { id: shopId } = await params;

  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const userId = session.user.id;

  const profile = await prisma.profile.findUnique({
    where:  { userId },
    select: { role: true, shopId: true, allowedRoutes: true, fullName: true },
  });

  const role          = (profile?.role ?? "user").toLowerCase().trim();
  const isAdmin       = role === "admin" || role === "owner";
  const allowedRoutes = parseAllowedRoutes(profile?.allowedRoutes);

  const can = (prefix: string) => isRouteAllowed(prefix, role, allowedRoutes);
  const canSales     = can("/sales");
  const canFinance   = can("/finance");
  const canInventory = can("/inventory");
  const canHR        = can("/hr");
  const canReports   = can("/reports");

  // ── Access guard ──────────────────────────────────────────────────────────
  if (isAdmin) {
    const owned = await prisma.shop.findUnique({ where: { id: shopId }, select: { userId: true } });
    if (!owned || owned.userId !== userId) redirect("/welcome");
  } else {
    // Non-admin must be assigned to this shop
    if (profile?.shopId !== shopId) redirect("/welcome");
  }

  const shop = await prisma.shop.findUnique({
    where:  { id: shopId },
    select: { id: true, name: true, location: true },
  });
  if (!shop) redirect("/welcome");

  // ── Date ranges ───────────────────────────────────────────────────────────
  const now          = new Date();
  const startOfDay   = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek  = new Date(startOfDay);
  startOfWeek.setDate(startOfDay.getDate() - startOfDay.getDay());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const twelveAgo    = new Date(now.getFullYear(), now.getMonth() - 11, 1);

  const shopFilter = { shopId };

  // ── Parallel queries, permission-gated ────────────────────────────────────
  const [
    userRecord,
    allShops,
    totalProducts,
    totalStaff,
    salesTotal,
    salesToday,
    salesWeek,
    salesMonth,
    expenseTotal,
    expenseToday,
    creditRows,
    walletsRaw,
    recentSalesRaw,
    recentExpensesRaw,
    monthlySalesRaw,
    monthlyExpensesRaw,
    advanceAgg,
    paymentTodayAgg,
  ] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),

    // All shops owned by this user (for multi-shop card)
    isAdmin
      ? prisma.shop.findMany({ where: { userId }, select: { id: true, name: true, location: true } })
      : Promise.resolve([shop]),

    // Inventory
    canInventory
      ? prisma.product.count({ where: { shopId } })
      : Promise.resolve(0),

    // HR
    canHR
      ? prisma.staff.count({ where: { shopId } })
      : Promise.resolve(0),

    // Sales aggregates
    canSales ? prisma.sale.aggregate({ where: { ...shopFilter, status: "completed" }, _sum: { totalAmount: true }, _count: true }) : Promise.resolve(nullAgg()),
    canSales ? prisma.sale.aggregate({ where: { ...shopFilter, status: "completed", createdAt: { gte: startOfDay   } }, _sum: { totalAmount: true }, _count: true }) : Promise.resolve(nullAgg()),
    canSales ? prisma.sale.aggregate({ where: { ...shopFilter, status: "completed", createdAt: { gte: startOfWeek  } }, _sum: { totalAmount: true }, _count: true }) : Promise.resolve(nullAgg()),
    canSales ? prisma.sale.aggregate({ where: { ...shopFilter, status: "completed", createdAt: { gte: startOfMonth } }, _sum: { totalAmount: true }, _count: true }) : Promise.resolve(nullAgg()),

    // Expense aggregates
    canFinance ? prisma.expense.aggregate({ where: shopFilter, _sum: { amount: true }, _count: true }) : Promise.resolve(nullAgg()),
    canFinance ? prisma.expense.aggregate({ where: { ...shopFilter, createdAt: { gte: startOfDay } }, _sum: { amount: true }, _count: true }) : Promise.resolve(nullAgg()),

    // Credit rows
    canFinance
      ? prisma.credit.findMany({
          where:   { shopId, status: { not: "paid" } },
          select:  { amount: true, downPayment: true, creditPayments: { select: { amount: true } } },
        })
      : Promise.resolve([]),

    // Wallets
    canFinance
      ? prisma.wallet.findMany({ where: { shopId }, select: { balance: true, shopId: true, shop: { select: { name: true } } } })
      : Promise.resolve([]),

    // Recent sales
    canSales
      ? prisma.sale.findMany({
          where:   { ...shopFilter, status: "completed" },
          select: {
            id: true, totalAmount: true, paymentMethod: true,
            shop:      { select: { name: true } },
            saleItems: { select: { quantity: true, product: { select: { productName: true } } }, take: 1 },
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 8,
        })
      : Promise.resolve([]),

    // Recent expenses
    canFinance
      ? prisma.expense.findMany({
          where:   shopFilter,
          select: { id: true, description: true, amount: true, category: true, shop: { select: { name: true } }, createdAt: true },
          orderBy: { createdAt: "desc" },
          take: 6,
        })
      : Promise.resolve([]),

    // Monthly sales (12 months)
    canSales
      ? prisma.sale.findMany({
          where:  { ...shopFilter, status: "completed", createdAt: { gte: twelveAgo } },
          select: { totalAmount: true, createdAt: true },
        })
      : Promise.resolve([]),

    // Monthly expenses (12 months)
    canFinance
      ? prisma.expense.findMany({
          where:  { ...shopFilter, createdAt: { gte: twelveAgo } },
          select: { amount: true, createdAt: true },
        })
      : Promise.resolve([]),

    // Staff advances
    canHR
      ? prisma.advance.aggregate({ where: { ...shopFilter, status: { in: ["approved", "paid"] } }, _sum: { amount: true }, _count: true })
      : Promise.resolve(nullAgg()),

    // Payments today
    canFinance
      ? prisma.payment.aggregate({ where: { ...shopFilter, createdAt: { gte: startOfDay } }, _sum: { amount: true }, _count: true })
      : Promise.resolve(nullAgg()),
  ]);

  // ── Monthly chart buckets ──────────────────────────────────────────────────
  const monthlyMap: Record<string, { sales: number; expenses: number }> = {};
  for (let i = 0; i < 12; i++) {
    const d   = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthlyMap[key] = { sales: 0, expenses: 0 };
  }
  (monthlySalesRaw as { totalAmount: number; createdAt: Date }[]).forEach(s => {
    const key = `${s.createdAt.getFullYear()}-${String(s.createdAt.getMonth() + 1).padStart(2, "0")}`;
    if (monthlyMap[key]) monthlyMap[key].sales += s.totalAmount;
  });
  (monthlyExpensesRaw as { amount: number; createdAt: Date }[]).forEach(e => {
    const key = `${e.createdAt.getFullYear()}-${String(e.createdAt.getMonth() + 1).padStart(2, "0")}`;
    if (monthlyMap[key]) monthlyMap[key].expenses += e.amount;
  });
  const monthlyData = Object.entries(monthlyMap).map(([month, d]) => ({
    month,
    label:    new Date(month + "-01").toLocaleDateString("en-KE", { month: "short" }),
    sales:    d.sales,
    expenses: d.expenses,
    profit:   d.sales - d.expenses,
  }));

  // ── Derived numbers ───────────────────────────────────────────────────────
  type AggResult = { _sum: Record<string, number | null>; _count: number | { _all: number } };

  function sumOf(agg: AggResult, key: string) {
    return (agg._sum?.[key] as number | null) ?? 0;
  }
  function countOf(agg: AggResult) {
    const c = agg._count;
    if (typeof c === "number") return c;
    return (c as { _all: number })._all ?? 0;
  }

  const totalSalesAmt   = sumOf(salesTotal   as AggResult, "totalAmount");
  const totalExpenseAmt = sumOf(expenseTotal as AggResult, "amount");
  const netProfit       = totalSalesAmt - totalExpenseAmt;

  const creditDue = (creditRows as { amount: number; downPayment: number; creditPayments: { amount: number }[] }[])
    .reduce((s, c) => {
      const paid = c.creditPayments.reduce((x, p) => x + p.amount, 0) + c.downPayment;
      return s + Math.max(0, c.amount - paid);
    }, 0);

  const walletsArr = walletsRaw as { balance: number; shopId: string; shop: { name: string } }[];
  const totalBalance = walletsArr.reduce((s, w) => s + w.balance, 0);

  return (
    <DashboardView
      shopId={shopId}
      userName={
        profile?.fullName ??
        userRecord?.name ??
        session.user.name ??
        "User"
      }
      isAdmin={isAdmin}
      selectedShopName={shop.name}
      shops={allShops as { id: string; name: string; location: string }[]}
      blocked={false}
      permissions={{ canSales, canFinance, canInventory, canHR, canReports }}
      stats={{
        sales: {
          today: { count: countOf(salesToday as AggResult), amount: sumOf(salesToday as AggResult, "totalAmount") },
          week:  { count: countOf(salesWeek  as AggResult), amount: sumOf(salesWeek  as AggResult, "totalAmount") },
          month: { count: countOf(salesMonth as AggResult), amount: sumOf(salesMonth as AggResult, "totalAmount") },
          total: { count: countOf(salesTotal as AggResult), amount: totalSalesAmt },
        },
        expenses: {
          today: { count: countOf(expenseToday as AggResult), amount: sumOf(expenseToday as AggResult, "amount") },
          total: { count: countOf(expenseTotal as AggResult), amount: totalExpenseAmt },
        },
        totalProducts: totalProducts as number,
        totalStaff:    totalStaff    as number,
        netProfit,
        creditDue:     Math.round(creditDue),
        totalBalance,
        advances:      { count: countOf(advanceAgg      as AggResult), amount: sumOf(advanceAgg      as AggResult, "amount") },
        paymentsToday: { count: countOf(paymentTodayAgg as AggResult), amount: sumOf(paymentTodayAgg as AggResult, "amount") },
      }}
      recentSales={(recentSalesRaw as {
        id: string; totalAmount: number; paymentMethod: string;
        shop: { name: string };
        saleItems: { quantity: number; product: { productName: string } }[];
        createdAt: Date;
      }[]).map(s => ({
        id:          s.id,
        productName: s.saleItems[0]?.product.productName ?? "Multiple items",
        totalItems:  s.saleItems.reduce((sum, i) => sum + i.quantity, 0),
        amount:      s.totalAmount,
        method:      s.paymentMethod,
        shop:        s.shop.name,
        date:        s.createdAt.toISOString().split("T")[0],
        time:        s.createdAt.toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" }),
      }))}
      recentExpenses={(recentExpensesRaw as {
        id: string; description: string; amount: number; category: string | null;
        shop: { name: string }; createdAt: Date;
      }[]).map(e => ({
        id:          e.id,
        description: e.description,
        amount:      e.amount,
        category:    e.category ?? "General",
        shop:        e.shop.name,
        date:        e.createdAt.toISOString().split("T")[0],
      }))}
      monthlyData={monthlyData}
      wallets={walletsArr.map(w => ({ balance: w.balance, shopName: w.shop.name, shopId: w.shopId }))}
    />
  );
}

// ── Null aggregation placeholder ──────────────────────────────────────────────
function nullAgg() {
  return { _sum: {}, _count: 0 };
}
