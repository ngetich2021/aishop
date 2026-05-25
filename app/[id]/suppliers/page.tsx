import { auth }                  from "@/auth";
import { redirect }              from "next/navigation";
import prisma                     from "@/lib/prisma";
import SuppliersView              from "./_components/SuppliersView";
import { getSuppliersPageData }   from "@/lib/shop-cache";

export const dynamic = "force-dynamic";

interface Props { params: Promise<{ id: string }> }

export default async function SuppliersPage({ params }: Props) {
  const { id: shopId } = await params;

  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const userId = session.user.id;

  const profile = await prisma.profile.findUnique({ where: { userId }, select: { role: true, shopId: true } });

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

  const suppliers = await getSuppliersPageData(shopId);

  return <SuppliersView activeShop={{ id: shop.id, name: shop.name, location: shop.location }} isAdmin={isAdmin} isManager={isManager} suppliers={suppliers} />;
}
