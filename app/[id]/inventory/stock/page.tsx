import { redirect } from "next/navigation";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { format } from "date-fns";
import AdjustStockView from "./_components/AdjustStockView";

export const revalidate = 0;

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

  // Access guard
  if (isOwner) {
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

  const [adjustments, returns, products, sales] = await Promise.all([
    prisma.adjustment.findMany({
      where:   { shopId },
      include: { product: { select: { productName: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.return.findMany({
      where:   { shopId },
      include: { returnItems: { include: { product: { select: { productName: true } } } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.product.findMany({
      where:   { shopId },
      select:  { id: true, productName: true, quantity: true, sellingPrice: true },
      orderBy: { productName: "asc" },
    }),
    prisma.sale.findMany({
      where:   { shopId, status: "completed" },
      select:  { id: true, createdAt: true, totalAmount: true },
      orderBy: { createdAt: "desc" },
      take:    200,
    }),
  ]);

  const totalAdjValue   = adjustments.reduce((s, a) => s + (a.value ?? 0), 0);
  const totalRetValue   = returns.reduce((s, r) => s + r.returnItems.reduce((sum, i) => sum + i.price * i.quantity, 0), 0);
  const pendingReturns  = returns.filter((r) => r.status === "pending").length;

  const fmtAdj = adjustments.map((a) => ({
    id:            a.id,
    productName:   a.product.productName,
    productId:     a.productId,
    adjustType:    a.adjustType,
    quantity:      a.quantity,
    originalStock: a.originalStock ?? 0,
    newStockQty:   a.newStockQty ?? 0,
    value:         a.value ?? 0,
    adjustedBy:    a.adjustedBy,
    shop:          shop.name,
    shopId:        a.shopId,
    date:          format(a.createdAt, "dd MMM yyyy, HH:mm"),
  }));

  const fmtRet = returns.map((r) => ({
    id:           r.id,
    saleId:       r.saleId,
    reason:       r.reason ?? "",
    status:       r.status,
    returnedById: r.returnedById,
    shopId:       r.shopId,
    shopName:     shop.name,
    date:         format(r.createdAt, "dd MMM yyyy, HH:mm"),
    totalQty:     r.returnItems.reduce((s, i) => s + i.quantity, 0),
    totalValue:   r.returnItems.reduce((s, i) => s + i.price * i.quantity, 0),
    items:        r.returnItems.map((i) => ({
      id:          i.id,
      productId:   i.productId,
      productName: i.product.productName,
      quantity:    i.quantity,
      price:       i.price,
      reason:      i.reason ?? "",
    })),
  }));

  const fmtSales = sales.map((s) => ({
    id:    s.id,
    label: `${s.id.slice(0, 8).toUpperCase()} — ${format(s.createdAt, "dd MMM")} — KSh ${s.totalAmount.toLocaleString()}`,
  }));

  return (
    <AdjustStockView
      shopId={shopId}
      activeShop={shop}
      isOwner={isOwner}
      stats={{
        totalAdjustments: adjustments.length,
        totalValue:        totalAdjValue,
        totalReturns:      returns.length,
        totalReturnValue:  totalRetValue,
        pendingReturns,
      }}
      adjustments={fmtAdj}
      returns={fmtRet}
      products={products}
      sales={fmtSales}
      profile={{ role, shopId: profile?.shopId ?? shopId, fullName: profile?.fullName ?? session.user.name ?? "User" }}
    />
  );
}
