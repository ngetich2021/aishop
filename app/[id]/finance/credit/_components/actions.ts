"use server";

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { capturePayment } from "@/lib/actions";

export type ActionResult = { success: boolean; error?: string };

export async function addCreditPaymentAction(
  creditId: string,
  shopId: string,
  data: { amount: number; method: string; note?: string }
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  const profile = await prisma.profile.findUnique({
    where:  { userId: session.user.id },
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
    const remaining = credit.amount - credit.downPayment; // net owed after downpayment
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
      // Capture in payments ledger so it appears in the total received
      await capturePayment(tx, {
        shopId,
        amount: data.amount,
        method: data.method,
        source: "credit_payment",
      });
    });
    revalidatePath(`/${shopId}/finance/credit`, "page");
    revalidatePath(`/${shopId}/dashboard`);
    return { success: true };
  } catch {
    return { success: false, error: "Failed to record payment." };
  }
}

export async function deleteCreditAction(id: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  const profile = await prisma.profile.findUnique({
    where:  { userId: session.user.id },
    select: { role: true },
  });
  const role = profile?.role?.toLowerCase().trim();
  if (role !== "admin" && role !== "owner")
    return { success: false, error: "Only admins can delete credit records." };

  try {
    const credit = await prisma.credit.findUnique({ where: { id }, select: { shopId: true } });
    await prisma.credit.delete({ where: { id } });
    if (credit?.shopId) revalidatePath(`/${credit.shopId}/finance/credit`, "page");
    return { success: true };
  } catch {
    return { success: false, error: "Delete failed." };
  }
}
