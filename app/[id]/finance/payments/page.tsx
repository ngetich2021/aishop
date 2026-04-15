import { auth } from "@/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import PaymentsView from "./_components/PaymentsView";

export const revalidate = 0;

interface Props { params: Promise<{ id: string }> }

export default async function PaymentsPage({ params }: Props) {
  const { id: shopId } = await params;

  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const userId = session.user.id;

  const profile = await prisma.profile.findUnique({
    where:  { userId },
    select: { role: true, shopId: true },
  });

  const role      = (profile?.role ?? "user").toLowerCase().trim();
  const isAdmin = role === "admin" || role === "owner";

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

  const raw = await prisma.payment.findMany({
    where:   { shopId },
    orderBy: { createdAt: "desc" },
  });

  const payments = raw.map(p => ({
    id:              p.id,
    amount:          p.amount,
    method:          p.method,
    direction:       p.direction,
    source:          p.source,
    note:            p.note,
    transactionCode: p.transactionCode,
    date:            p.createdAt.toISOString().split("T")[0],
  }));

  // Total = inflows only; exclude wallet-transfer outflows
  const inflows = payments.filter(p => p.direction === "in");
  const totalAmount = inflows.reduce((s, p) => s + p.amount, 0);
  const methodBreakdown: Record<string, number> = {};
  for (const p of inflows) {
    methodBreakdown[p.method] = (methodBreakdown[p.method] ?? 0) + p.amount;
  }

  return (
    <PaymentsView
      activeShop={{ id: shop.id, name: shop.name, location: shop.location }}
      isAdmin={isAdmin}
      payments={payments}
      stats={{ total: payments.length, totalAmount, methodBreakdown }}
    />
  );
}
