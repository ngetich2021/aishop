import prisma         from "@/lib/prisma";
import AdminOverview  from "./_components/AdminOverview";

export const revalidate = 0;

export default async function AdminPage() {
  const now        = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    totalShops,
    proUsers,
    demoPlusUsers,
    totalRevenueAgg,
    monthRevenueAgg,
    newUsersThisWeek,
    activeShops,
    suspendedShops,
    recentPayments,
    recentUsers,
    mpesaCallbacks,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.shop.count(),
    prisma.userSubscription.count({ where: { plan: "pro" } }),
    prisma.userSubscription.count({ where: { plan: "demo_plus" } }),
    prisma.subscriptionPayment.aggregate({
      where: { status: "completed" },
      _sum:  { amount: true },
    }),
    prisma.subscriptionPayment.aggregate({
      where: { status: "completed", createdAt: { gte: startOfMonth } },
      _sum:  { amount: true },
    }),
    prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    (prisma.shopBilling as any).count({ where: { status: "active" } }),
    (prisma.shopBilling as any).count({ where: { status: "suspended" } }),
    prisma.subscriptionPayment.findMany({
      where:   { status: "completed" },
      orderBy: { createdAt: "desc" },
      take:    8,
      include: {
        subscription: {
          include: { user: { select: { name: true, email: true } } },
        },
      },
    }),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take:    8,
      include: {
        profile:      { select: { role: true, fullName: true } },
        subscription: { select: { plan: true, status: true } },
        _count:       { select: { shops: true } },
      },
    }),
    prisma.mpesaCallback.findMany({
      orderBy: { createdAt: "desc" },
      take:    5,
    }),
  ]);

  const totalRevenue    = totalRevenueAgg._sum.amount ?? 0;
  const revenueThisMonth = monthRevenueAgg._sum.amount ?? 0;
  const demoUsers       = await prisma.userSubscription.count({ where: { plan: "demo" } });

  return (
    <AdminOverview
      stats={{
        totalUsers,
        totalShops,
        proUsers,
        demoPlusUsers,
        demoUsers,
        totalRevenue,
        revenueThisMonth,
        newUsersThisWeek,
        activeShops,
        suspendedShops,
      }}
      recentPayments={recentPayments.map(p => ({
        id:        p.id,
        phone:     p.phone ?? "",
        amount:    p.amount,
        plan:      p.plan,
        mpesaRef:  p.mpesaRef ?? "",
        createdAt: p.createdAt.toISOString(),
        userName:  p.subscription.user.name ?? p.subscription.user.email ?? "Unknown",
        userEmail: p.subscription.user.email ?? "",
      }))}
      recentUsers={recentUsers.map(u => ({
        id:        u.id,
        name:      u.name ?? "—",
        email:     u.email ?? "—",
        role:      u.profile?.role ?? "user",
        plan:      u.subscription?.plan ?? "demo",
        shopCount: u._count.shops,
        createdAt: u.createdAt.toISOString(),
      }))}
      mpesaCallbacks={mpesaCallbacks.map(c => ({
        id:                c.id,
        checkoutRequestId: c.checkoutRequestId,
        resultCode:        c.resultCode ?? 0,
        mpesaReceiptNo:    c.mpesaReceiptNo ?? "",
        amount:            c.amount ?? 0,
        phoneNumber:       c.phoneNumber ?? "",
        processed:         c.processed,
        createdAt:         c.createdAt.toISOString(),
      }))}
    />
  );
}
