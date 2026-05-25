"use server";

import prisma from "@/lib/prisma";
import { bustShop } from "@/lib/shop-cache";
import { capturePayment } from "@/lib/actions";
import { planGuardMutate } from "@/lib/plan-guard";

export type ActionResult = { success: boolean; error?: string };

export async function addCreditPaymentAction(
  creditId: string,
  shopId: string,
  data: { amount: number; method: string; note?: string }
): Promise<ActionResult> {
  const guard = await planGuardMutate(shopId);
  if (!guard.ok) return { success: false, error: guard.error };

  const profile = await prisma.profile.findUnique({
    where:  { userId: guard.userId },
    select: { role: true },
  });
  const role = profile?.role?.toLowerCase().trim();
  if (role !== "admin" && role !== "owner" && role !== "manager")
    return { success: false, error: "Only managers can record credit payments." };

  if (!data.amount || data.amount <= 0) return { success: false, error: "Amount must be positive." };

  try {
    const credit = await prisma.credit.findUnique({
      where:   { id: creditId },
      include: { creditPayments: true },
    });
    if (!credit) return { success: false, error: "Credit record not found." };

    const prevPaid  = credit.creditPayments.reduce((s, p) => s + p.amount, 0);
    const remaining = credit.amount - credit.downPayment;
    const totalPaid = prevPaid + data.amount;
    const newStatus = totalPaid >= remaining ? "paid" : "partial";

    await prisma.$transaction(async (tx) => {
      await tx.creditPayment.create({
        data: {
          creditId,
          shopId,
          amount: data.amount,
          method: data.method,
          note:   data.note?.trim() || null,
        },
      });
      await tx.credit.update({
        where: { id: creditId },
        data:  { status: newStatus },
      });
      await capturePayment(tx, {
        shopId,
        amount: data.amount,
        method: data.method,
        source: "credit_payment",
      });
    });
    bustShop(shopId);
    return { success: true };
  } catch {
    return { success: false, error: "Failed to record payment." };
  }
}

export async function deleteCreditAction(id: string): Promise<ActionResult> {
  const credit = await prisma.credit.findUnique({ where: { id }, select: { shopId: true } });
  if (!credit) return { success: false, error: "Credit record not found." };

  const guard = await planGuardMutate(credit.shopId);
  if (!guard.ok) return { success: false, error: guard.error };

  const profile = await prisma.profile.findUnique({
    where:  { userId: guard.userId },
    select: { role: true },
  });
  const role = profile?.role?.toLowerCase().trim();
  if (role !== "admin" && role !== "owner")
    return { success: false, error: "Only admins can delete credit records." };

  try {
    await prisma.credit.delete({ where: { id } });
    bustShop(credit.shopId);
    return { success: true };
  } catch {
    return { success: false, error: "Delete failed." };
  }
}
