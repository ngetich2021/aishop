import { redirect }         from "next/navigation";
import { auth }             from "@/auth";
import prisma                from "@/lib/prisma";
import { format }            from "date-fns";
import AdjustStockView       from "./_components/AdjustStockView";
import { getStockPageData }  from "@/lib/shop-cache";

export const dynamic = "force-dynamic";

interface Props { params: Promise<{ id: string }> }

export default async function AdjustStockPage({ params }: Props) {
  const { id: shopId } = await params;

  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const userId = session.user.id;

  const profile = await prisma.profile.findUnique({
    where:  { userId },
    select: { role: true, shopId: true, fullName: true },
  });

  const role    = (profile?.role ?? "owner").toLowerCase().trim();
  const isOwner = role === "owner";

  if (isOwner) {
    const owned = await prisma.shop.findUnique({ where: { id: shopId }, select: { userId: true } });
    if (!owned || owned.userId !== userId) redirect("/welcome");
  } else {
    if (profile?.shopId !== shopId) redirect("/welcome");
  }

  const shop = await prisma.shop.findUnique({ where: { id: shopId }, select: { id: true, name: true, location: true } });
  if (!shop) redirect("/welcome");

  const { stats, adjustments, returns, products, sales } = await getStockPageData(shopId);

  // Re-inject shop name into adjustments (needed by view)
  const fmtAdj = adjustments.map(a => ({ ...a, shop: shop.name, date: format(new Date(a.date), "dd MMM yyyy, HH:mm") }));
  const fmtRet = returns.map(r => ({ ...r, shopName: shop.name, date: format(new Date(r.date), "dd MMM yyyy, HH:mm") }));
  const fmtSales = sales.map(s => ({
    id:    s.id,
    label: `${s.id.slice(0, 8).toUpperCase()} — ${format(new Date(s.createdAt), "dd MMM")} — KSh ${s.totalAmount.toLocaleString()}`,
  }));

  return (
    <AdjustStockView
      shopId={shopId}
      activeShop={shop}
      isOwner={isOwner}
      stats={stats}
      adjustments={fmtAdj}
      returns={fmtRet}
      products={products}
      sales={fmtSales}
      profile={{ role, shopId: profile?.shopId ?? shopId, fullName: profile?.fullName ?? session.user.name ?? "User" }}
    />
  );
}
