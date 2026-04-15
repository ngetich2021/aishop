import { auth } from "@/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import ReportsView from "./_components/ReportsView";

export const revalidate = 0;

interface Props { params: Promise<{ id: string }> }

export default async function ReportsPage({ params }: Props) {
  const { id: shopId } = await params;

  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const userId = session.user.id;

  const profile = await prisma.profile.findUnique({
    where:  { userId },
    select: { role: true, shopId: true },
  });

  const role    = (profile?.role ?? "user").toLowerCase().trim();
  const isAdmin = role === "admin" || role === "owner";

  if (isAdmin) {
    const owned = await prisma.shop.findUnique({ where: { id: shopId }, select: { userId: true } });
    if (!owned || owned.userId !== userId) redirect("/welcome");
  } else {
    if (profile?.shopId !== shopId) redirect("/welcome");
  }

  const shop = await prisma.shop.findUnique({
    where:  { id: shopId },
    select: { id: true, name: true, location: true },
  });
  if (!shop) redirect("/welcome");

  const now         = new Date();
  const monthStart  = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd    = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthEnd   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
  const yearStart   = new Date(now.getFullYear(), 0, 1);

  // Current month sales
  const [sales, prevSalesRaw, expenses, prevExpenses, staffCount, credits, payments] = await Promise.all([
    prisma.sale.findMany({
      where:   { shopId, status: "completed", createdAt: { gte: monthStart, lte: monthEnd } },
      include: { saleItems: { select: { quantity: true, price: true, discount: true } } },
    }),
    prisma.sale.count({
      where: { shopId, status: "completed", createdAt: { gte: prevMonthStart, lte: prevMonthEnd } },
    }),
    prisma.expense.findMany({
      where: { shopId, createdAt: { gte: monthStart, lte: monthEnd } },
      select: { amount: true, createdAt: true },
    }),
    prisma.expense.aggregate({
      where: { shopId, createdAt: { gte: prevMonthStart, lte: prevMonthEnd } },
      _sum: { amount: true },
    }),
    prisma.staff.count({ where: { shopId } }),
    prisma.credit.findMany({
      where:   { shopId, status: { not: "paid" } },
      select:  { amount: true, downPayment: true, creditPayments: { select: { amount: true } } },
    }),
    prisma.payment.findMany({
      where:   { shopId, createdAt: { gte: monthStart, lte: monthEnd } },
      select:  { amount: true, method: true },
    }),
  ]);

  const revenue     = sales.reduce((s, sale) => s + sale.totalAmount, 0);
  const expTotal    = expenses.reduce((s, e) => s + e.amount, 0);
  const prevRevRaw  = await prisma.sale.aggregate({
    where: { shopId, status: "completed", createdAt: { gte: prevMonthStart, lte: prevMonthEnd } },
    _sum:  { totalAmount: true },
  });
  const prevRevenue  = prevRevRaw._sum.totalAmount ?? 0;
  const prevExpAmt   = prevExpenses._sum.amount ?? 0;
  const grossProfit  = revenue - expTotal;
  const creditOut    = credits.reduce((s, c) => {
    const paid = c.creditPayments.reduce((x, p) => x + p.amount, 0) + c.downPayment;
    return s + Math.max(0, c.amount - paid);
  }, 0);

  // Salary costs this month
  const salaryTotal = await prisma.salary.aggregate({
    where: { shopId, month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}` },
    _sum:  { amount: true },
  });
  const netProfit = grossProfit - (salaryTotal._sum.amount ?? 0);

  // Daily data (this month)
  const salesByDay: Record<string, { revenue: number; sales: number }> = {};
  for (const s of sales) {
    const d = s.createdAt.toISOString().split("T")[0];
    if (!salesByDay[d]) salesByDay[d] = { revenue: 0, sales: 0 };
    salesByDay[d].revenue += s.totalAmount;
    salesByDay[d].sales   += 1;
  }
  const expByDay: Record<string, number> = {};
  for (const e of expenses) {
    const d = e.createdAt.toISOString().split("T")[0];
    expByDay[d] = (expByDay[d] ?? 0) + e.amount;
  }

  // Build daily array for the last 30 days
  const dailyData = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now); d.setDate(now.getDate() - i);
    const key = d.toISOString().split("T")[0];
    dailyData.push({
      date:     key,
      revenue:  salesByDay[key]?.revenue ?? 0,
      expenses: expByDay[key] ?? 0,
      sales:    salesByDay[key]?.sales ?? 0,
    });
  }

  // Top products (year to date)
  const saleItemsYTD = await prisma.saleItem.findMany({
    where: {
      sale: { shopId, status: "completed", createdAt: { gte: yearStart } },
    },
    include: { product: { select: { productName: true } } },
  });
  const productMap: Record<string, { name: string; qty: number; revenue: number }> = {};
  for (const item of saleItemsYTD) {
    const name = item.product.productName;
    if (!productMap[name]) productMap[name] = { name, qty: 0, revenue: 0 };
    productMap[name].qty     += item.quantity;
    productMap[name].revenue += (item.price - item.discount) * item.quantity;
  }
  const topProducts = Object.values(productMap)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8);

  // Payment breakdown
  const payMap: Record<string, { amount: number; count: number }> = {};
  for (const p of payments) {
    if (!payMap[p.method]) payMap[p.method] = { amount: 0, count: 0 };
    payMap[p.method].amount += p.amount;
    payMap[p.method].count  += 1;
  }
  const payBreakdown = Object.entries(payMap)
    .map(([method, v]) => ({ method, ...v }))
    .sort((a, b) => b.amount - a.amount);

  return (
    <ReportsView
      activeShop={{ id: shop.id, name: shop.name, location: shop.location }}
      period="month"
      stats={{
        revenue,
        prevRevenue,
        expenses:     expTotal,
        prevExpenses: prevExpAmt,
        salesCount:   sales.length,
        prevSales:    prevSalesRaw,
        staffCount,
        creditOut:    Math.round(creditOut),
        grossProfit,
        netProfit,
      }}
      dailyData={dailyData}
      topProducts={topProducts}
      payBreakdown={payBreakdown}
    />
  );
}
