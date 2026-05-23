import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import PricingView from "./_components/PricingView";

type SubRow = {
  plan:            string;
  status:          string;
  expiresAt:       Date | null;
  demoStartedAt:   Date;
  proBalance:      number;
  proActivatedAt:  Date | null;
  proLastBilledAt: Date | null;
  payments: Array<{ id: string; plan: string; amount: number; mpesaRef: string | null; phone: string | null; checkoutRequestId: string | null; createdAt: Date }>;
};

export default async function BillingPage() {
  const session = await auth();
  const userId  = session?.user?.id ?? null;

  let subscription: {
    plan:            string;
    status:          string;
    expiresAt:       string | null;
    demoStartedAt:   string;
    proBalance:      number;
    proActivatedAt:  string | null;
    proLastBilledAt: string | null;
    payments: Array<{ id: string; plan: string; amount: number; mpesaRef: string | null; phone: string | null; createdAt: string }>;
  } | null = null;

  let activeShopCount = 0;

  if (userId) {
    const [sub, shopCount] = await Promise.all([
      (prisma.userSubscription as unknown as {
        findUnique: (args: unknown) => Promise<SubRow | null>
      }).findUnique({
        where:  { userId },
        select: {
          plan:            true,
          status:          true,
          expiresAt:       true,
          demoStartedAt:   true,
          proBalance:      true,
          proActivatedAt:  true,
          proLastBilledAt: true,
          payments: {
            where:   { status: "completed" },
            orderBy: { createdAt: "desc" },
            take:    50,
            select:  { id: true, plan: true, amount: true, mpesaRef: true, phone: true, checkoutRequestId: true, createdAt: true },
          },
        },
      }),
      // Count shops with active ShopBilling
      (prisma.shopBilling as unknown as {
        count: (args: unknown) => Promise<number>
      }).count({
        where: {
          status: "active",
          shop:   { userId },
        },
      }),
    ]);

    activeShopCount = shopCount ?? 0;

    // Backfill mpesaRef for completed payments that are missing it
    if (sub) {
      const missing = sub.payments.filter(p => !p.mpesaRef && p.checkoutRequestId);
      if (missing.length > 0) {
        await Promise.allSettled(
          missing.map(async (p) => {
            const cb = await prisma.mpesaCallback.findUnique({
              where:  { checkoutRequestId: p.checkoutRequestId! },
              select: { mpesaReceiptNo: true },
            }).catch(() => null);
            if (cb?.mpesaReceiptNo) {
              await prisma.subscriptionPayment.update({
                where: { id: p.id },
                data:  { mpesaRef: cb.mpesaReceiptNo },
              }).catch(() => null);
              p.mpesaRef = cb.mpesaReceiptNo;
            }
          })
        );
      }
    }

    if (sub) {
      subscription = {
        plan:            sub.plan,
        status:          sub.status,
        expiresAt:       sub.expiresAt?.toISOString() ?? null,
        demoStartedAt:   sub.demoStartedAt.toISOString(),
        proBalance:      sub.proBalance ?? 0,
        proActivatedAt:  sub.proActivatedAt?.toISOString() ?? null,
        proLastBilledAt: sub.proLastBilledAt?.toISOString() ?? null,
        payments:        sub.payments.map(({ checkoutRequestId: _cid, createdAt, ...p }) => ({ ...p, createdAt: createdAt.toISOString() })),
      };
    }
  }

  return <PricingView userId={userId} subscription={subscription} activeShopCount={activeShopCount} />;
}
