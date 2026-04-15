import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import { format, startOfDay, startOfWeek, startOfMonth, startOfYear } from "date-fns";
import QuoteView from "./_components/QuoteView";

export const revalidate = 0;

interface Props { params: Promise<{ id: string }> }

export default async function QuotePage({ params }: Props) {
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

  // ── access guard ────────────────────────────────────────────────────────────
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

  // ── active shop from cookie (admin can switch shops) ────────────────────────
  const cookieStore = await cookies();
  const cookieShopId = cookieStore.get("active_shop_id")?.value ?? "";

  // For admin: all shops they own. For staff: only their assigned shop.
  const allShops = isAdmin
    ? await prisma.shop.findMany({
        where:   { userId },
        select:  { id: true, name: true, location: true, tel: true },
        orderBy: { name: "asc" },
      })
    : [{ id: shop.id, name: shop.name, location: shop.location, tel: shop.tel }];

  const activeShopId =
    allShops.find(s => s.id === cookieShopId)?.id ??
    allShops.find(s => s.id === (profile?.shopId ?? staffRecord?.shopId))?.id ??
    shop.id;

  const activeShop = allShops.find(s => s.id === activeShopId) ?? shop;

  // ── canSell: staff with a record for this shop can sell; admin/owner cannot ──
  const canSell = !isAdmin && !!staffRecord && staffRecord.shopId === activeShopId;

  // ── fetch data ───────────────────────────────────────────────────────────────
  const [quotes, staffList, products] = await Promise.all([
    prisma.quote.findMany({
      where:   { shopId: activeShopId },
      include: { quoteItems: { include: { product: { select: { productName: true } } } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.staff.findMany({
      where:   { shopId: activeShopId },
      select:  { id: true, fullName: true },
      orderBy: { fullName: "asc" },
    }),
    prisma.product.findMany({
      where: {
        shopId: { in: allShops.map(s => s.id) },
      },
      select: {
        id: true, productName: true, sellingPrice: true, buyingPrice: true,
        discount: true, quantity: true, imageUrl: true, shopId: true,
        shop: { select: { name: true } },
      },
      orderBy: { productName: "asc" },
    }),
  ]);

  // ── staff name map ────────────────────────────────────────────────────────────
  const staffMap = new Map(staffList.map(s => [s.id, s.fullName]));

  // ── stats ─────────────────────────────────────────────────────────────────────
  const now  = new Date();
  const todayStart = startOfDay(now);
  const weekStart  = startOfWeek(now, { weekStartsOn: 1 });
  const monthStart = startOfMonth(now);
  const yearStart  = startOfYear(now);

  function bucketStats(list: typeof quotes) {
    let today = { count: 0, amount: 0 };
    let week  = { count: 0, amount: 0 };
    let month = { count: 0, amount: 0 };
    let year  = { count: 0, amount: 0 };
    let total = { count: 0, amount: 0 };

    for (const q of list) {
      const d = q.createdAt;
      total.count++;  total.amount  += q.amount;
      if (d >= yearStart)  { year.count++;  year.amount  += q.amount; }
      if (d >= monthStart) { month.count++; month.amount += q.amount; }
      if (d >= weekStart)  { week.count++;  week.amount  += q.amount; }
      if (d >= todayStart) { today.count++; today.amount += q.amount; }
    }
    return { today, week, month, year, total };
  }

  const stats = bucketStats(quotes);

  // ── format quotes ─────────────────────────────────────────────────────────────
  const fmtQuotes = quotes.map(q => ({
    id:              q.id,
    soldById:        q.soldById,
    soldByName:      staffMap.get(q.soldById) ?? "—",
    customerName:    q.customerName,
    customerContact: q.customerContact,
    amount:          q.amount,
    shop:            activeShop.name,
    shopLocation:    activeShop.location,
    shopTel:         activeShop.tel,
    shopId:          q.shopId,
    date:            format(q.createdAt, "dd MMM yyyy, HH:mm"),
    createdAt:       q.createdAt.toISOString(),
    items:           q.quoteItems.map(i => ({
      id:          i.id,
      productName: i.product.productName,
      quantity:    i.quantity,
      price:       i.price,
      discount:    i.discount,
    })),
  }));

  // ── format products (include all shops so POS can browse) ─────────────────────
  const fmtProducts = products.map(p => ({
    id:           p.id,
    productName:  p.productName,
    sellingPrice: p.sellingPrice,
    buyingPrice:  p.buyingPrice,
    discount:     p.discount,
    quantity:     p.quantity,
    imageUrl:     p.imageUrl,
    shopId:       p.shopId,
    shopName:     p.shop.name,
  }));

  const fmtShops = allShops.map(s => ({
    id:       s.id,
    name:     s.name,
    location: s.location,
    tel:      s.tel,
  }));

  return (
    <QuoteView
      stats={stats}
      quotes={fmtQuotes}
      products={fmtProducts}
      shops={fmtShops}
      staffList={staffList}
      profile={{ role, shopId: profile?.shopId ?? null, fullName: profile?.fullName ?? session.user.name ?? "User" }}
      hasStaffRecord={!!staffRecord}
      canSell={canSell}
      activeShopId={activeShopId}
      activeShopName={activeShop.name}
      activeShopLocation={activeShop.location}
    />
  );
}
