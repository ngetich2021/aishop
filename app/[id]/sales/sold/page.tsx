import { redirect }        from "next/navigation";
import { auth }            from "@/auth";
import prisma               from "@/lib/prisma";
import { format, startOfDay, startOfWeek, startOfMonth, startOfYear } from "date-fns";
import SoldView             from "./_components/SoldView";
import { getSalesPageData } from "@/lib/shop-cache";

export const dynamic = "force-dynamic";

interface Props { params: Promise<{ id: string }> }

export default async function SoldPage({ params }: Props) {
  const { id: shopId } = await params;

  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const userId = session.user.id;

  const [profile, staffRecord] = await Promise.all([
    prisma.profile.findUnique({ where: { userId }, select: { role: true, shopId: true, fullName: true, allowedRoutes: true } }),
    prisma.staff.findUnique({ where: { userId }, select: { id: true, shopId: true } }),
  ]);

  const role    = (profile?.role ?? "user").toLowerCase().trim();
  const isAdmin = role === "admin" || role === "owner";

  if (isAdmin) {
    const owned = await prisma.shop.findUnique({ where: { id: shopId }, select: { userId: true } });
    if (!owned || owned.userId !== userId) redirect("/welcome");
  } else {
    if (profile?.shopId !== shopId) redirect("/welcome");
  }

  const shop = await prisma.shop.findUnique({ where: { id: shopId }, select: { id: true, name: true, location: true, tel: true } });
  if (!shop) redirect("/welcome");

  const allowedRoutes = (profile?.allowedRoutes ?? []) as string[];
  const hasSalesRoute = allowedRoutes.some(r => r === "/sales" || "/sales".startsWith(r + "/"));
  const canSell       = isAdmin || role === "manager" || (!!staffRecord && staffRecord.shopId === shopId) || hasSalesRoute;

  const { sales, staffList, products } = await getSalesPageData(shopId);

  // Compute stats from cached sales
  const now          = new Date();
  const todayStart   = startOfDay(now);
  const weekStart    = startOfWeek(now, { weekStartsOn: 1 });
  const monthStart   = startOfMonth(now);
  const yearStart    = startOfYear(now);
  const completedSales = sales.filter(s => s.status === "completed");

  function bucketRevenue(list: typeof completedSales) {
    const today = { count: 0, amount: 0 }, week  = { count: 0, amount: 0 };
    const month = { count: 0, amount: 0 }, year  = { count: 0, amount: 0 };
    const total = { count: 0, amount: 0 };
    for (const s of list) {
      const d = new Date(s.createdAt);
      total.count++;  total.amount  += s.totalAmount;
      if (d >= yearStart)  { year.count++;  year.amount  += s.totalAmount; }
      if (d >= monthStart) { month.count++; month.amount += s.totalAmount; }
      if (d >= weekStart)  { week.count++;  week.amount  += s.totalAmount; }
      if (d >= todayStart) { today.count++; today.amount += s.totalAmount; }
    }
    return { today, week, month, year, total };
  }

  const stats = bucketRevenue(completedSales);

  const methodBreakdown: Record<string, { count: number; amount: number }> = {};
  for (const s of completedSales) {
    const pmts = s.paymentMethodsJson
      ? (JSON.parse(s.paymentMethodsJson) as { method: string; amount: number }[])
      : [{ method: s.paymentMethod || "unknown", amount: s.totalAmount }];
    for (const p of pmts) {
      if (!methodBreakdown[p.method]) methodBreakdown[p.method] = { count: 0, amount: 0 };
      methodBreakdown[p.method].count++;
      methodBreakdown[p.method].amount += p.amount;
    }
  }

  const fmtSales = sales.map(s => ({ ...s, date: format(new Date(s.createdAt), "dd MMM yyyy, HH:mm") }));

  return (
    <SoldView
      stats={stats}
      sales={fmtSales}
      staffList={staffList}
      shop={{ id: shop.id, name: shop.name, location: shop.location, tel: shop.tel }}
      profile={{ role, fullName: profile?.fullName ?? session.user.name ?? "User" }}
      methodBreakdown={methodBreakdown}
      canSell={canSell}
      products={products}
    />
  );
}
