import { auth }                from "@/auth";
import { redirect }            from "next/navigation";
import prisma                   from "@/lib/prisma";
import DashboardView            from "./_components/DashboardView";
import { parseAllowedRoutes, isRouteAllowed } from "@/lib/permissions";
import { getDashboardPageData } from "@/lib/shop-cache";

export const dynamic = "force-dynamic";

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
  } else if (role === "user") {
    const owned = await prisma.shop.findUnique({ where: { id: shopId }, select: { userId: true } });
    if (owned?.userId !== userId && profile?.shopId !== shopId) redirect("/welcome");
  } else {
    if (profile?.shopId !== shopId) redirect("/welcome");
  }

  const shop = await prisma.shop.findUnique({ where: { id: shopId }, select: { id: true, name: true, location: true } });
  if (!shop) redirect("/welcome");

  const data = await getDashboardPageData(shopId, userId, isAdmin, canSales, canFinance, canInventory, canHR);

  const allShops = isAdmin
    ? data.allShops.length > 0 ? data.allShops : [shop]
    : [shop];

  return (
    <DashboardView
      shopId={shopId}
      userName={profile?.fullName ?? data.userName ?? session.user.name ?? "User"}
      isAdmin={isAdmin}
      selectedShopName={shop.name}
      shops={allShops as { id: string; name: string; location: string }[]}
      blocked={false}
      permissions={{ canSales, canFinance, canInventory, canHR, canReports }}
      stats={data.stats}
      recentSales={data.recentSales}
      recentExpenses={data.recentExpenses}
      monthlyData={data.monthlyData}
      wallets={data.wallets}
    />
  );
}
