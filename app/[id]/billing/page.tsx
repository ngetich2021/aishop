import { redirect } from "next/navigation";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import ShopBillingView from "./_components/ShopBillingView";

// eslint-disable-next-line @typescript-eslint/no-explicit-any


interface Props {
  params: Promise<{ id: string }>;
}

export default async function ShopBillingPage({ params }: Props) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user?.id) redirect("/");
  if (session.user.id !== id) redirect(`/${session.user.id}/billing`);

  const userId = session.user.id;

  // Only owners/admins access this page
  const profile = await prisma.profile.findUnique({
    where:  { userId },
    select: { role: true },
  });
  const role = (profile?.role ?? "user").toLowerCase().trim();
  if (role !== "owner" && role !== "admin") redirect(`/${id}/dashboard`);

  // Load all shops with wallet + billing info
  const shops = await prisma.shop.findMany({
    where:   { userId },
    select: {
      id:       true,
      name:     true,
      location: true,
      wallet: {
        select: { balance: true },
      },
      billing: {
        select: {
          id:          true,
          status:      true,
          dailyRate:   true,
          creationFee: true,
          lastBilledAt: true,
          history: {
            orderBy: { billedAt: "desc" },
            take:    20,
            select: {
              id:       true,
              amount:   true,
              type:     true,
              status:   true,
              reason:   true,
              billedAt: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  // Load user subscription
  const subscription = await prisma.userSubscription.findUnique({
    where:  { userId },
    select: { plan: true, status: true, expiresAt: true, demoStartedAt: true },
  }) as {
    plan: string;
    status: string;
    expiresAt: Date | null;
    demoStartedAt: Date;
  } | null;

  const shopsData = shops.map((s) => ({
    id:           s.id,
    name:         s.name,
    location:     s.location,
    walletBalance: s.wallet?.balance ?? 0,
    billing:      s.billing
      ? {
          id:           s.billing.id,
          status:       s.billing.status,
          dailyRate:    s.billing.dailyRate,
          creationFee:  s.billing.creationFee,
          lastBilledAt: s.billing.lastBilledAt?.toISOString() ?? null,
          history:      s.billing.history.map((h) => ({
            id:       h.id,
            amount:   h.amount,
            type:     h.type,
            status:   h.status,
            reason:   h.reason ?? null,
            billedAt: h.billedAt.toISOString(),
          })),
        }
      : null,
  }));

  return (
    <ShopBillingView
      userId={userId}
      shops={shopsData}
      subscription={
        subscription
          ? {
              plan:          subscription.plan,
              status:        subscription.status,
              expiresAt:     subscription.expiresAt?.toISOString() ?? null,
              demoStartedAt: subscription.demoStartedAt.toISOString(),
            }
          : null
      }
    />
  );
}
