import { auth } from "@/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import SuppliersView from "./_components/SuppliersView";

export const revalidate = 0;

interface Props { params: Promise<{ id: string }> }

export default async function SuppliersPage({ params }: Props) {
  const { id: shopId } = await params;

  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const userId = session.user.id;

  const profile = await prisma.profile.findUnique({
    where:  { userId },
    select: { role: true, shopId: true },
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

  const raw = await prisma.supplier.findMany({
    where:   { shopId },
    include: { _count: { select: { buys: true } } },
    orderBy: { name: "asc" },
  });

  const suppliers = raw.map(s => ({
    id:        s.id,
    name:      s.name,
    contact1:  s.contact1,
    contact2:  s.contact2,
    goodsType: s.goodsType,
    buyCount:  s._count.buys,
  }));

  return (
    <SuppliersView
      activeShop={{ id: shop.id, name: shop.name, location: shop.location }}
      isAdmin={isAdmin}
      isManager={isManager}
      suppliers={suppliers}
    />
  );
}
