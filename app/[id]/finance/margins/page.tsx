import { auth }       from "@/auth";
import { redirect }   from "next/navigation";
import prisma         from "@/lib/prisma";
import MarginsView    from "./_components/MarginsView";

export const revalidate = 0;

interface Props { params: Promise<{ id: string }> }

export default async function MarginsPage({ params }: Props) {
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

  // ── Date ranges ──────────────────────────────────────────────────────────
  const now             = new Date();
  const monthStart      = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd        = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  const prevMonthStart  = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthEnd    = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
  const twelveAgo       = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  const thirtyAgo       = new Date(now); thirtyAgo.setDate(now.getDate() - 29); thirtyAgo.setHours(0,0,0,0);

  // ── Parallel data fetch ──────────────────────────────────────────────────
  const [
    salesThisMonth,
    expensesThisMonth,
    salesPrevMonth,
    expensesPrevMonthAgg,
    sales12m,
    expenses12m,
    saleItems12m,       // for gross margin computation
  ] = await Promise.all([
    // This month — full sales for revenue
    prisma.sale.aggregate({
      where: { shopId, status: "completed", createdAt: { gte: monthStart, lte: monthEnd } },
      _sum: { totalAmount: true }, _count: true,
    }),

    // This month — expenses
    prisma.expense.aggregate({
      where: { shopId, createdAt: { gte: monthStart, lte: monthEnd } },
      _sum: { amount: true }, _count: true,
    }),

    // Prev month — sales agg
    prisma.sale.aggregate({
      where: { shopId, status: "completed", createdAt: { gte: prevMonthStart, lte: prevMonthEnd } },
      _sum: { totalAmount: true }, _count: true,
    }),

    // Prev month — expenses agg
    prisma.expense.aggregate({
      where: { shopId, createdAt: { gte: prevMonthStart, lte: prevMonthEnd } },
      _sum: { amount: true },
    }),

    // Last 12 months — daily sales for monthly bucketing
    prisma.sale.findMany({
      where:  { shopId, status: "completed", createdAt: { gte: twelveAgo } },
      select: { totalAmount: true, createdAt: true },
    }),

    // Last 12 months — daily expenses for monthly bucketing
    prisma.expense.findMany({
      where:  { shopId, createdAt: { gte: twelveAgo } },
      select: { amount: true, createdAt: true },
    }),

    // Last 12 months — sale items with product buying prices (for gross margin)
    prisma.saleItem.findMany({
      where: { sale: { shopId, status: "completed", createdAt: { gte: twelveAgo } } },
      select: {
        quantity:  true,
        price:     true,
        discount:  true,
        product:   { select: { buyingPrice: true } },
        sale:      { select: { createdAt: true } },
      },
    }),
  ]);

  // ── Monthly buckets (12 months) ──────────────────────────────────────────
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
    const grossProfit   = b.revenue - b.cogs;
    const netProfit     = b.revenue - b.expenses;
    const grossMarginPct = b.revenue > 0 ? (grossProfit / b.revenue) * 100 : 0;
    const netMarginPct   = b.revenue > 0 ? (netProfit   / b.revenue) * 100 : 0;
    return {
      month,
      label:          new Date(month + "-01").toLocaleDateString("en-KE", { month: "short" }),
      revenue:        b.revenue,
      expenses:       b.expenses,
      cogs:           b.cogs,
      grossProfit,
      netProfit,
      grossMarginPct: Math.round(grossMarginPct * 10) / 10,
      netMarginPct:   Math.round(netMarginPct   * 10) / 10,
    };
  });

  // ── Daily buckets (last 30 days) ─────────────────────────────────────────
  const dailyBuckets: Record<string, { revenue: number; expenses: number; cogs: number }> = {};
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now); d.setDate(now.getDate() - i);
    const key = d.toISOString().split("T")[0];
    dailyBuckets[key] = { revenue: 0, expenses: 0, cogs: 0 };
  }
  for (const s of sales12m) {
    const key = s.createdAt.toISOString().split("T")[0];
    if (dailyBuckets[key]) dailyBuckets[key].revenue += s.totalAmount;
  }
  for (const e of expenses12m) {
    const key = e.createdAt.toISOString().split("T")[0];
    if (dailyBuckets[key]) dailyBuckets[key].expenses += e.amount;
  }
  for (const item of saleItems12m) {
    const key = item.sale.createdAt.toISOString().split("T")[0];
    if (dailyBuckets[key]) dailyBuckets[key].cogs += item.product.buyingPrice * item.quantity;
  }
  const dailyData = Object.entries(dailyBuckets).map(([date, b]) => ({
    date,
    label:      new Date(date).toLocaleDateString("en-KE", { day: "numeric", month: "short" }),
    revenue:    b.revenue,
    expenses:   b.expenses,
    cogs:       b.cogs,
    grossProfit: b.revenue - b.cogs,
    netProfit:   b.revenue - b.expenses,
  }));

  // ── Derived KPIs ─────────────────────────────────────────────────────────
  const thisRevenue   = salesThisMonth._sum.totalAmount   ?? 0;
  const thisExpenses  = expensesThisMonth._sum.amount     ?? 0;
  const prevRevenue   = salesPrevMonth._sum.totalAmount   ?? 0;
  const prevExpenses  = expensesPrevMonthAgg._sum.amount  ?? 0;

  // Gross margin from saleItems for this month
  const thisMonthKey  = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const thisCogs      = buckets[thisMonthKey]?.cogs ?? 0;
  const thisGross     = thisRevenue - thisCogs;
  const thisNet       = thisRevenue - thisExpenses;
  const prevNet       = prevRevenue - prevExpenses;

  const revenueChange = prevRevenue  > 0 ? ((thisRevenue  - prevRevenue)  / prevRevenue)  * 100 : null;
  const netChange     = prevNet !== 0    ? ((thisNet       - prevNet)       / Math.abs(prevNet)) * 100 : null;

  // Best month
  const bestMonth = monthlyData.reduce(
    (best, m) => m.netProfit > (best?.netProfit ?? -Infinity) ? m : best,
    null as typeof monthlyData[0] | null,
  );

  // YTD
  const ytdRevenue  = monthlyData.reduce((s, m) => s + m.revenue,    0);
  const ytdExpenses = monthlyData.reduce((s, m) => s + m.expenses,   0);
  const ytdNet      = monthlyData.reduce((s, m) => s + m.netProfit,  0);
  const ytdGross    = monthlyData.reduce((s, m) => s + m.grossProfit, 0);

  return (
    <MarginsView
      activeShop={{ id: shop.id, name: shop.name, location: shop.location }}
      kpi={{
        thisRevenue, thisExpenses, thisCogs, thisGross, thisNet,
        prevRevenue, prevExpenses, prevNet,
        revenueChange, netChange,
        ytdRevenue, ytdExpenses, ytdNet, ytdGross,
        grossMarginPct: thisRevenue > 0 ? Math.round((thisGross / thisRevenue) * 1000) / 10 : 0,
        netMarginPct:   thisRevenue > 0 ? Math.round((thisNet   / thisRevenue) * 1000) / 10 : 0,
      }}
      monthlyData={monthlyData}
      dailyData={dailyData}
      bestMonth={bestMonth}
    />
  );
}
