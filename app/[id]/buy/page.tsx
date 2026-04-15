import { auth } from "@/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import BuyView from "./_components/BuyView";

export const revalidate = 0;

interface Props { params: Promise<{ id: string }> }

export default async function BuyPage({ params }: Props) {
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

  const [rawBuys, rawSuppliers] = await Promise.all([
    prisma.buy.findMany({
      where:   { shopId },
      include: { supplier: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.supplier.findMany({
      where:   { shopId },
      select:  { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const buys = rawBuys.map(b => {
    let items: { name: string; qty: number; price: number }[] = [];
    try { items = JSON.parse(b.itemsJson); } catch { items = []; }
    return {
      id:            b.id,
      supplierId:    b.supplierId,
      supplierName:  b.supplier.name,
      items,
      totalAmount:   b.totalAmount,
      transportCost: b.transportCost,
      status:        b.status,
      authorizedBy:  b.authorizedBy,
      date:          b.createdAt.toISOString().split("T")[0],
    };
  });

  const totalAmount    = buys.reduce((s, b) => s + b.totalAmount + b.transportCost, 0);
  const pendingCount   = buys.filter(b => b.status === "pending").length;
  const receivedCount  = buys.filter(b => b.status === "received").length;

  return (
    <BuyView
      activeShop={{ id: shop.id, name: shop.name, location: shop.location }}
      isAdmin={isAdmin}
      isManager={isManager}
      buys={buys}
      suppliers={rawSuppliers}
      stats={{ total: buys.length, totalAmount, pendingCount, receivedCount }}
    />
  );
}
