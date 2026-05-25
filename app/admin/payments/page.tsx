import prisma       from "@/lib/prisma";
import PaymentsView from "./_components/PaymentsView";

export const revalidate = 0;

export default async function AdminPaymentsPage() {
  const [mpesaCallbacks, subscriptionPayments] = await Promise.all([
    prisma.mpesaCallback.findMany({
      orderBy: { createdAt: "desc" },
      take:    100,
    }),
    prisma.subscriptionPayment.findMany({
      orderBy: { createdAt: "desc" },
      take:    100,
      include: {
        subscription: {
          include: { user: { select: { name: true, email: true } } },
        },
      },
    }),
  ]);

  return (
    <PaymentsView
      mpesaCallbacks={mpesaCallbacks.map(c => ({
        id:                c.id,
        checkoutRequestId: c.checkoutRequestId,
        merchantRequestId: c.merchantRequestId ?? "",
        resultCode:        c.resultCode ?? 0,
        resultDesc:        c.resultDesc ?? "",
        mpesaReceiptNo:    c.mpesaReceiptNo ?? "",
        amount:            c.amount ?? 0,
        phoneNumber:       c.phoneNumber ?? "",
        processed:         c.processed,
        createdAt:         c.createdAt.toISOString(),
      }))}
      subscriptionPayments={subscriptionPayments.map(p => ({
        id:        p.id,
        plan:      p.plan,
        amount:    p.amount,
        phone:     p.phone ?? "",
        mpesaRef:  p.mpesaRef ?? "",
        status:    p.status,
        createdAt: p.createdAt.toISOString(),
        userName:  p.subscription.user.name ?? p.subscription.user.email ?? "Unknown",
        userEmail: p.subscription.user.email ?? "",
      }))}
    />
  );
}
