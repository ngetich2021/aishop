import prisma      from "@/lib/prisma";
import BillingView from "./_components/BillingView";

export const revalidate = 0;

export default async function AdminBillingPage() {
  const now = new Date();

  // Last 6 months labels
  const months: { year: number; month: number; label: string }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      year:  d.getFullYear(),
      month: d.getMonth(),
      label: d.toLocaleDateString("en-KE", { month: "short", year: "numeric" }),
    });
  }

  const [
    subscriptionPayments,
    shopBillingLogs,
    planDist,
  ] = await Promise.all([
    prisma.subscriptionPayment.findMany({
      orderBy: { createdAt: "desc" },
      take:    500,
      include: {
        subscription: {
          include: { user: { select: { name: true, email: true } } },
        },
      },
    }),
    (prisma.shopBillingLog as any).findMany({
      orderBy: { billedAt: "desc" },
      take:    500,
      include: {
        billing: {
          include: { shop: { select: { name: true } } },
        },
      },
    }),
    Promise.all([
      prisma.userSubscription.count({ where: { plan: "demo" } }),
      prisma.userSubscription.count({ where: { plan: "demo_plus" } }),
      prisma.userSubscription.count({ where: { plan: "pro" } }),
    ]),
  ]);

  // Monthly revenue
  const monthlyRevenue = await Promise.all(
    months.map(async m => {
      const start = new Date(m.year, m.month, 1);
      const end   = new Date(m.year, m.month + 1, 1);
      const agg   = await prisma.subscriptionPayment.aggregate({
        where: { status: "completed", createdAt: { gte: start, lt: end } },
        _sum:  { amount: true },
      });
      return { label: m.label, total: agg._sum.amount ?? 0 };
    })
  );

  return (
    <BillingView
      subscriptionPayments={subscriptionPayments.map(p => ({
        id:        p.id,
        plan:      p.plan,
        amount:    p.amount,
        phone:     p.phone ?? "",
        mpesaRef:  p.mpesaRef ?? "",
        status:    p.status,
        createdAt: p.createdAt.toISOString(),
        userName:  p.subscription.user.name ?? p.subscription.user.email ?? "Unknown",
        userEmail: p.subscription.user.email ?? "",
      }))}
      shopBillingLogs={(shopBillingLogs as any[]).map((l: any) => ({
        id:        l.id,
        shopName:  l.billing?.shop?.name ?? "Unknown",
        amount:    l.amount,
        type:      l.type,
        status:    l.status,
        reason:    l.reason ?? "",
        billedAt:  l.billedAt.toISOString(),
      }))}
      planDist={{ demo: planDist[0], demoPlusUsers: planDist[1], pro: planDist[2] }}
      monthlyRevenue={monthlyRevenue}
    />
  );
}
