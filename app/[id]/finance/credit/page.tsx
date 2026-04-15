import { auth } from "@/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import CreditView from "./_components/CreditView";

export const revalidate = 0;

interface Props { params: Promise<{ id: string }> }

export default async function CreditPage({ params }: Props) {
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

  const raw = await prisma.credit.findMany({
    where:   { shopId },
    include: { creditPayments: { orderBy: { paidAt: "asc" } } },
    orderBy: { createdAt: "desc" },
  });

  const credits = raw.map(c => {
    const totalPaid  = c.creditPayments.reduce((s, p) => s + p.amount, 0) + c.downPayment;
    const outstanding = Math.max(0, c.amount - totalPaid);
    return {
      id:            c.id,
      customerName:  c.customerName,
      customerPhone: c.customerPhone,
      amount:        c.amount,
      downPayment:   c.downPayment,
      dueDate:       c.dueDate ? c.dueDate.toISOString().split("T")[0] : null,
      status:        c.status,
      totalPaid,
      outstanding,
      date:          c.createdAt.toISOString().split("T")[0],
      payments:      c.creditPayments.map(p => ({
        id:     p.id,
        amount: Math.round(p.amount),
        method: p.method,
        note:   p.note,
        paidAt: p.paidAt.toISOString().split("T")[0],
      })),
    };
  });

  const totalAmount  = credits.reduce((s, c) => s + c.amount, 0);
  const outstanding  = credits.reduce((s, c) => s + c.outstanding, 0);
  const paidCount    = credits.filter(c => c.status === "paid").length;

  return (
    <CreditView
      activeShop={{ id: shop.id, name: shop.name, location: shop.location }}
      isAdmin={isAdmin}
      isManager={isManager}
      credits={credits}
      stats={{ total: credits.length, totalAmount, outstanding, paidCount }}
    />
  );
}
