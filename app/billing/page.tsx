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
  payments: Array<{ id: string; amount: number; mpesaRef: string | null; createdAt: Date }>;
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
    payments: Array<{ id: string; amount: number; mpesaRef: string | null; createdAt: string }>;
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
            where:   { plan: "pro", status: "completed" },
            orderBy: { createdAt: "desc" },
            take:    20,
            select:  { id: true, amount: true, mpesaRef: true, createdAt: true },
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

    if (sub) {
      subscription = {
        plan:            sub.plan,
        status:          sub.status,
        expiresAt:       sub.expiresAt?.toISOString() ?? null,
        demoStartedAt:   sub.demoStartedAt.toISOString(),
        proBalance:      sub.proBalance ?? 0,
        proActivatedAt:  sub.proActivatedAt?.toISOString() ?? null,
        proLastBilledAt: sub.proLastBilledAt?.toISOString() ?? null,
        payments:        sub.payments.map(p => ({ ...p, createdAt: p.createdAt.toISOString() })),
      };
    }
  }

  return <PricingView userId={userId} subscription={subscription} activeShopCount={activeShopCount} />;
}
