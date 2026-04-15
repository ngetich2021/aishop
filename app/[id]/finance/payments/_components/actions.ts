"use server";

import { revalidatePath } from "next/cache";
import prisma             from "@/lib/prisma";
import { resolveActor, logActivity } from "@/lib/actions";

export type ActionResult = { success: boolean; error?: string };

// Payments are fully automated (captured from sales + credit payments).
// Admins can only delete incorrect records.

export async function deletePaymentAction(
  id: string,
  shopId: string,
): Promise<ActionResult> {
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

    revalidatePath(`/${payment.shopId}/finance/payments`, "page");
    revalidatePath(`/${payment.shopId}/dashboard`);
    return { success: true };
  } catch {
    return { success: false, error: "Delete failed." };
  }
}
