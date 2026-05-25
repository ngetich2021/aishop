"use server";

import { bustShop } from "@/lib/shop-cache";
import prisma             from "@/lib/prisma";
import { resolveActor, logActivity } from "@/lib/actions";
import { planGuardMutate } from "@/lib/plan-guard";

export type ActionResult = { success: boolean; error?: string };

// Payments are fully automated (captured from sales + credit payments).
// Admins can only delete incorrect records.

export async function deletePaymentAction(
  id: string,
  shopId: string,
): Promise<ActionResult> {
  const guard = await planGuardMutate(shopId);
  if (!guard.ok) return { success: false, error: guard.error };

  const actor = await resolveActor(shopId, { requireAdmin: true });
  if (!actor) return { success: false, error: "Only admins can delete payments." };

  try {
    const payment = await prisma.payment.findUnique({
      where:  { id },
      select: { shopId: true, amount: true, method: true, source: true },
    });
    if (!payment) return { success: false, error: "Payment not found." };

    await prisma.payment.delete({ where: { id } });

    await logActivity({
      userId:   actor.userId,
      shopId:   payment.shopId,
      action:   "delete",
      entity:   "Payment",
      entityId: id,
      details:  { amount: payment.amount, method: payment.method, source: payment.source },
      path:     `/${shopId}/finance/payments`,
    });

    bustShop(payment.shopId);
    bustShop(payment.shopId);
    return { success: true };
  } catch {
    return { success: false, error: "Delete failed." };
  }
}
