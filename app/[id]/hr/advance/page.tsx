import { auth }                from "@/auth";
import { redirect }            from "next/navigation";
import prisma                   from "@/lib/prisma";
import AdvanceView              from "./_components/AdvanceView";
import { getAdvancesPageData }  from "@/lib/shop-cache";

export const dynamic = "force-dynamic";

interface Props { params: Promise<{ id: string }> }

export default async function AdvancePage({ params }: Props) {
  const { id: shopId } = await params;

  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const userId = session.user.id;

  const profile = await prisma.profile.findUnique({ where: { userId }, select: { role: true, shopId: true, fullName: true } });

  const role      = (profile?.role ?? "user").toLowerCase().trim();
  const isAdmin   = role === "admin" || role === "owner";
  const isManager = role === "manager" || isAdmin;

  if (isAdmin) {
    const owned = await prisma.shop.findUnique({ where: { id: shopId }, select: { userId: true } });
    if (!owned || owned.userId !== userId) redirect("/welcome");
  } else {
    if (profile?.shopId !== shopId) redirect("/welcome");
  }

  const shop = await prisma.shop.findUnique({ where: { id: shopId }, select: { id: true, name: true, location: true } });
  if (!shop) redirect("/welcome");

  const { advances, staffList, currentStaff, stats } = await getAdvancesPageData(shopId, userId);
  const isStaff = !!currentStaff && !isManager;

  // Staff see only their own advances — already filtered by cache (userId)
  // Managers see all — cache fetches all when not isStaff
  // Re-inject shop name
  const fmtAdvances = advances.map(a => ({ ...a, shop: shop.name }));

  return (
    <AdvanceView
      shopId={shopId}
      activeShop={{ id: shop.id, name: shop.name, location: shop.location }}
      isStaff={isStaff}
      isAdmin={isAdmin}
      isManager={isManager}
      currentStaff={currentStaff}
      stats={stats}
      advances={fmtAdvances}
      staffList={isManager ? staffList : []}
    />
  );
}
