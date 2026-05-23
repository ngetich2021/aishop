"use server";

import prisma from "@/lib/prisma";
import { DAILY_RATE } from "@/lib/billing-constants";

/** Called whenever a Pro M-Pesa payment completes — full amount credited to proBalance. */
export async function reconcileProPayment(subscriptionId: string, amountPaid: number) {
  const sub = await (prisma.userSubscription as unknown as {
    findUnique: (args: unknown) => Promise<{ proActivatedAt: Date | null } | null>
  }).findUnique({
    where:  { id: subscriptionId },
    select: { proActivatedAt: true },
  });
  if (!sub) return;

  const now = new Date();
  await (prisma.userSubscription as unknown as {
    update: (args: unknown) => Promise<unknown>
  }).update({
    where: { id: subscriptionId },
    data: {
      plan:           "pro",
      status:         "active",
      expiresAt:      null,
      proBalance:     { increment: amountPaid },
      proActivatedAt: sub.proActivatedAt ?? now,
      updatedAt:      now,
    },
  });
}

/**
 * Bill a shop KES 30 for the current day on first visit.
 * - If already billed today → ok immediately (no charge).
 * - If balance insufficient → returns ok:false so the layout can gate access.
 * Uses Kenya (EAT, UTC+3) midnight as the day boundary.
 */
export async function billShopForDay(
  shopId:      string,
  shopOwnerId: string,
): Promise<{ ok: boolean; error?: string }> {
  // Kenya midnight = UTC midnight - 3h
  const now          = new Date();
  const eatOffsetMs  = 3 * 60 * 60 * 1000;
  const eatNow       = new Date(now.getTime() + eatOffsetMs);
  const eatMidnight  = new Date(Date.UTC(eatNow.getUTCFullYear(), eatNow.getUTCMonth(), eatNow.getUTCDate()));
  const todayStart   = new Date(eatMidnight.getTime() - eatOffsetMs); // back to UTC

  // 1. Get or create ShopBilling
  let billing = await (prisma.shopBilling as unknown as {
    findUnique: (args: unknown) => Promise<{ id: string; lastBilledAt: Date | null } | null>
  }).findUnique({
    where:  { shopId },
    select: { id: true, lastBilledAt: true },
  });

  if (!billing) {
    // Shop predates Pro upgrade — create the billing record now
    billing = await (prisma.shopBilling as unknown as {
      create: (args: unknown) => Promise<{ id: string; lastBilledAt: Date | null }>
    }).create({
      data: { shopId, dailyRate: DAILY_RATE, status: "active" },
    });
  }

  // 2. Already billed today — no charge
  if (billing.lastBilledAt && billing.lastBilledAt >= todayStart) {
    return { ok: true };
  }

  // 3. Load owner's balance
  const sub = await (prisma.userSubscription as unknown as {
    findUnique: (args: unknown) => Promise<{ id: string; proBalance: number } | null>
  }).findUnique({
    where:  { userId: shopOwnerId },
    select: { id: true, proBalance: true },
  });

  if (!sub) return { ok: false, error: "Subscription not found." };

  const balance = sub.proBalance ?? 0;
  if (balance < DAILY_RATE) {
    return {
      ok:    false,
      error: `Balance too low — need KES ${DAILY_RATE} for today, have KES ${balance}. Top up at /billing.`,
    };
  }

  // 4. Deduct KES 30 from account balance
  await (prisma.userSubscription as unknown as {
    update: (args: unknown) => Promise<unknown>
  }).update({
    where: { id: sub.id },
    data:  { proBalance: { decrement: DAILY_RATE }, updatedAt: now },
  });

  // 5. Mark shop as billed for today
  await (prisma.shopBilling as unknown as {
    update: (args: unknown) => Promise<unknown>
  }).update({
    where: { id: billing.id },
    data:  { lastBilledAt: now, status: "active", updatedAt: now },
  });

  // 6. Log it
  await (prisma.shopBillingLog as unknown as {
    create: (args: unknown) => Promise<unknown>
  }).create({
    data: {
      billingId: billing.id,
      shopId,
      amount:    DAILY_RATE,
      type:      "daily",
      status:    "paid",
    },
  });

  return { ok: true };
}
