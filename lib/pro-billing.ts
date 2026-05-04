"use server";

import prisma from "@/lib/prisma";
import { SHOP_CREATION_FEE } from "@/lib/billing-constants";

/** Called whenever a pro M-Pesa payment completes — full amount credited to proBalance. */
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
 * Deduct SHOP_CREATION_FEE from proBalance when creating a new shop on pro plan.
 * Returns ok:false with error if balance is insufficient.
 */
export async function chargeShopCreation(
  subscriptionId: string,
): Promise<{ ok: boolean; error?: string }> {
  const sub = await (prisma.userSubscription as unknown as {
    findUnique: (args: unknown) => Promise<{ proBalance: number } | null>
  }).findUnique({
    where:  { id: subscriptionId },
    select: { proBalance: true },
  });
  if (!sub) return { ok: false, error: "Subscription not found." };

  if ((sub.proBalance ?? 0) < SHOP_CREATION_FEE) {
    return {
      ok:    false,
      error: `Insufficient balance. You need at least KES ${SHOP_CREATION_FEE} to create a shop — top up at /billing.`,
    };
  }

  await (prisma.userSubscription as unknown as {
    update: (args: unknown) => Promise<unknown>
  }).update({
    where: { id: subscriptionId },
    data:  { proBalance: { decrement: SHOP_CREATION_FEE } },
  });
  return { ok: true };
}
