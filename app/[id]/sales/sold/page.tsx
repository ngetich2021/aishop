import { redirect } from "next/navigation";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { format, startOfDay, startOfWeek, startOfMonth, startOfYear } from "date-fns";
import SoldView from "./_components/SoldView";

export const revalidate = 0;

interface Props { params: Promise<{ id: string }> }

export default async function SoldPage({ params }: Props) {
  const { id: shopId } = await params;

  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const userId = session.user.id;

  const [profile, staffRecord] = await Promise.all([
    prisma.profile.findUnique({
      where:  { userId },
      select: { role: true, shopId: true, fullName: true },
    }),
    prisma.staff.findUnique({
      where:  { userId },
      select: { id: true, shopId: true },
    }),
  ]);

  const role    = (profile?.role ?? "user").toLowerCase().trim();
  const isAdmin = role === "admin" || role === "owner";

  // ── access guard ─────────────────────────────────────────────────────────
  if (isAdmin) {
    const owned = await prisma.shop.findUnique({ where: { id: shopId }, select: { userId: true } });
    if (!owned || owned.userId !== userId) redirect("/welcome");
  } else {
    if (profile?.shopId !== shopId) redirect("/welcome");
  }

  const shop = await prisma.shop.findUnique({
    where:  { id: shopId },
    select: { id: true, name: true, location: true, tel: true },
  });
  if (!shop) redirect("/welcome");

  // canSell: any staff assigned to this shop (not admin/owner)
  const canSell = !isAdmin && !!staffRecord && staffRecord.shopId === shopId;

  // ── fetch data ────────────────────────────────────────────────────────────
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
      select:  {
        id: true, productName: true, sellingPrice: true,
        buyingPrice: true, quantity: true, discount: true,
      },
      orderBy: { productName: "asc" },
    }),
  ]);

  // soldById stores the User ID (actor.userId), so key the map by userId
  const staffMap = new Map(staffList.map(s => [s.userId, s.fullName]));

  // ── stats ─────────────────────────────────────────────────────────────────
  const now        = new Date();
  const todayStart = startOfDay(now);
  const weekStart  = startOfWeek(now, { weekStartsOn: 1 });
  const monthStart = startOfMonth(now);
  const yearStart  = startOfYear(now);

  const completedSales = sales.filter(s => s.status === "completed");

  function bucketRevenue(list: typeof completedSales) {
    const today = { count: 0, amount: 0 };
    const week  = { count: 0, amount: 0 };
    const month = { count: 0, amount: 0 };
    const year  = { count: 0, amount: 0 };
    const total = { count: 0, amount: 0 };
    for (const s of list) {
      const d = s.createdAt;
      total.count++;  total.amount  += s.totalAmount;
      if (d >= yearStart)  { year.count++;  year.amount  += s.totalAmount; }
      if (d >= monthStart) { month.count++; month.amount += s.totalAmount; }
      if (d >= weekStart)  { week.count++;  week.amount  += s.totalAmount; }
      if (d >= todayStart) { today.count++; today.amount += s.totalAmount; }
    }
    return { today, week, month, year, total };
  }

  const stats = bucketRevenue(completedSales);

  // ── payment method breakdown ──────────────────────────────────────────────
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

  // ── format sales ──────────────────────────────────────────────────────────
  const fmtSales = sales.map(s => ({
    id:                 s.id,
    soldById:           s.soldById,
    soldByName:         staffMap.get(s.soldById) ?? "—",
    totalAmount:        s.totalAmount,
    paymentMethod:      s.paymentMethod,
    paymentMethodsJson: s.paymentMethodsJson ?? null,
    customerName:       s.customerName  ?? null,
    customerPhone:      s.customerPhone ?? null,
    isPrinted:          s.isPrinted,
    status:             s.status,
    cancelReason:       s.cancelReason ?? null,
    date:               format(s.createdAt, "dd MMM yyyy, HH:mm"),
    createdAt:          s.createdAt.toISOString(),
    hasReturn:          s.returns.length > 0,
    items: s.saleItems.map(i => ({
      id:          i.id,
      productName: i.product.productName,
      quantity:    i.quantity,
      price:       i.price,
      discount:    i.discount,
    })),
  }));

  return (
    <SoldView
      stats={stats}
      sales={fmtSales}
      staffList={staffList}
      shop={{ id: shop.id, name: shop.name, location: shop.location, tel: shop.tel }}
      profile={{ role, fullName: profile?.fullName ?? session.user.name ?? "User" }}
      methodBreakdown={methodBreakdown}
      canSell={canSell}
      products={products.map(p => ({
        id:           p.id,
        productName:  p.productName,
        sellingPrice: p.sellingPrice,
        buyingPrice:  p.buyingPrice,
        quantity:     p.quantity,
        discount:     p.discount,
      }))}
    />
  );
}
