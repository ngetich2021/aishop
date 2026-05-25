import prisma    from "@/lib/prisma";
import ShopsView from "./_components/ShopsView";

export const revalidate = 0;

export default async function AdminShopsPage() {
  const shops = await prisma.shop.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      user: {
        select: {
          name:         true,
          email:        true,
          subscription: { select: { plan: true } },
        },
      },
      billing: {
        select: { status: true, dailyRate: true, lastBilledAt: true },
      },
      _count: {
        select: { products: true, staffs: true, sales: true },
      },
    },
  });

  const serialized = shops.map(s => ({
    id:          s.id,
    name:        s.name,
    tel:         s.tel,
    location:    s.location,
    createdAt:   s.createdAt.toISOString(),
    ownerName:   s.user.name ?? "—",
    ownerEmail:  s.user.email ?? "—",
    plan:        s.user.subscription?.plan ?? "demo",
    billingStatus: (s.billing as any)?.status ?? null,
    dailyRate:   (s.billing as any)?.dailyRate ?? null,
    lastBilledAt: (s.billing as any)?.lastBilledAt ? (s.billing as any).lastBilledAt.toISOString() : null,
    productCount: s._count.products,
    staffCount:   s._count.staffs,
    salesCount:   s._count.sales,
  }));

  return <ShopsView shops={serialized} />;
}
