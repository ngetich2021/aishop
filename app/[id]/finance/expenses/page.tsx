import { auth }      from "@/auth";
import { redirect }  from "next/navigation";
import prisma        from "@/lib/prisma";
import ExpensesView  from "./_components/ExpensesView";

export const revalidate = 0;

interface Props { params: Promise<{ id: string }> }

export default async function ExpensesPage({ params }: Props) {
  const { id: shopId } = await params;

  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const userId = session.user.id;

  const profile = await prisma.profile.findUnique({
    where:  { userId },
    select: { role: true, shopId: true, fullName: true },
  });

  const role      = (profile?.role ?? "user").toLowerCase().trim();
  const isAdmin   = role === "admin" || role === "owner";
  const isManager = role === "manager" || isAdmin;

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

  const now           = new Date();
  const startOfDay    = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek   = new Date(startOfDay); startOfWeek.setDate(startOfDay.getDate() - startOfDay.getDay());
  const startOfMonth  = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear   = new Date(now.getFullYear(), 0, 1);
  const where         = { shopId };

  const [
    expensesRaw,
    todayAgg, weekAgg, monthAgg, yearAgg,
    wallet,
  ] = await Promise.all([
    prisma.expense.findMany({
      where,
      select: {
        id: true, description: true, amount: true,
        category: true, paidById: true, shopId: true,
        shop:      { select: { name: true } },
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.expense.aggregate({ where: { ...where, createdAt: { gte: startOfDay   } }, _sum: { amount: true }, _count: true }),
    prisma.expense.aggregate({ where: { ...where, createdAt: { gte: startOfWeek  } }, _sum: { amount: true }, _count: true }),
    prisma.expense.aggregate({ where: { ...where, createdAt: { gte: startOfMonth } }, _sum: { amount: true }, _count: true }),
    prisma.expense.aggregate({ where: { ...where, createdAt: { gte: startOfYear  } }, _sum: { amount: true }, _count: true }),
    prisma.wallet.findUnique({ where: { shopId }, select: { balance: true } }),
  ]);

  // ── Resolve paidBy names ─────────────────────────────────────────────────
  const userIds = [...new Set(expensesRaw.map(e => e.paidById))];
  const [profiles, users] = await Promise.all([
    prisma.profile.findMany({ where: { userId: { in: userIds } }, select: { userId: true, fullName: true } }),
    prisma.user.findMany    ({ where: { id:     { in: userIds } }, select: { id: true, name: true, email: true } }),
  ]);
  const nameMap: Record<string, string> = {};
  for (const uid of userIds) {
    const p = profiles.find(x => x.userId === uid);
    const u = users.find(x => x.id === uid);
    nameMap[uid] = p?.fullName ?? u?.name ?? u?.email ?? "—";
  }

  const currentUserName = profile?.fullName ?? session.user.name ?? session.user.email ?? "You";
  const walletBalance   = wallet?.balance ?? 0;

  const expenses = expensesRaw.map(e => ({
    id:          e.id,
    description: e.description,
    amount:      e.amount,
    category:    e.category ?? null,
    paidById:    e.paidById,
    paidByName:  nameMap[e.paidById] ?? "—",
    shop:        e.shop.name,
    shopId:      e.shopId,
    date:        e.createdAt.toISOString().split("T")[0],
    time:        e.createdAt.toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" }),
  }));

  return (
    <ExpensesView
      activeShop={{ id: shop.id, name: shop.name, location: shop.location }}
      isAdmin={isAdmin}
      isManager={isManager}
      walletBalance={walletBalance}
      currentUserName={currentUserName}
      expenses={expenses}
      stats={{
        today: { count: todayAgg._count,  amount: todayAgg._sum.amount  ?? 0 },
        week:  { count: weekAgg._count,   amount: weekAgg._sum.amount   ?? 0 },
        month: { count: monthAgg._count,  amount: monthAgg._sum.amount  ?? 0 },
        year:  { count: yearAgg._count,   amount: yearAgg._sum.amount   ?? 0 },
        total: { count: expenses.length,  amount: expenses.reduce((s, e) => s + e.amount, 0) },
      }}
    />
  );
}
