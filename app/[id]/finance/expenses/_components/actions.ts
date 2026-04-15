"use server";

import { auth }           from "@/auth";
import prisma             from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z }              from "zod";

export type ActionResult = { success: boolean; error?: string };

// ── Permission helper ─────────────────────────────────────────────────────────
async function canManage(shopId: string) {
  const session = await auth();
  if (!session?.user?.id) return null;
  const userId = session.user.id;

  const profile = await prisma.profile.findUnique({
    where:  { userId },
    select: { role: true, shopId: true, fullName: true },
  });
  const role    = (profile?.role ?? "user").toLowerCase().trim();
  const isAdmin   = role === "admin" || role === "owner";
  const isManager = role === "manager" || isAdmin;
  if (!isManager) return null;

  if (isAdmin) {
    const shop = await prisma.shop.findUnique({ where: { id: shopId }, select: { userId: true } });
    if (!shop || shop.userId !== userId) return null;
  } else {
    if (profile?.shopId !== shopId) return null;
  }
  return { userId, isAdmin, name: profile?.fullName ?? session.user.name ?? "Unknown" };
}

// ── Schema ────────────────────────────────────────────────────────────────────
const schema = z.object({
  description: z.string().min(1, "Description is required"),
  amount:      z.coerce.number().min(1, "Amount must be greater than 0"),
  category:    z.string().optional(),
  shopId:      z.string().min(1),
});

// ── SAVE (create or update) ───────────────────────────────────────────────────
export async function saveExpenseAction(
  _: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const shopId    = formData.get("shopId")?.toString() ?? "";
  const expenseId = formData.get("expenseId")?.toString() || null;

  const ctx = await canManage(shopId);
  if (!ctx) return { success: false, error: "Permission denied." };

  const parsed = schema.safeParse({
    description: formData.get("description"),
    amount:      formData.get("amount"),
    category:    formData.get("category")?.toString().trim() || undefined,
    shopId,
  });
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const { description, amount, category } = parsed.data;

  // Wallet must exist
  const wallet = await prisma.wallet.findUnique({
    where:  { shopId },
    select: { balance: true },
  });
  if (!wallet)
    return { success: false, error: "No wallet found for this shop. Add funds via the Wallet page first." };

  try {
    if (expenseId) {
      // ── Update: only charge/refund the delta ────────────────────────────────
      const existing = await prisma.expense.findUnique({
        where:  { id: expenseId },
        select: { amount: true },
      });
      const oldAmount = existing?.amount ?? 0;
      const netDelta  = amount - oldAmount; // positive → more deducted; negative → refund

      if (netDelta > 0 && wallet.balance < netDelta)
        return { success: false, error: `Insufficient wallet balance. Available: KSh ${wallet.balance.toLocaleString()}` };

      await prisma.$transaction([
        prisma.expense.update({
          where: { id: expenseId },
          data:  { description, amount, category: category ?? null },
        }),
        ...(netDelta !== 0
          ? [prisma.wallet.update({ where: { shopId }, data: { balance: { decrement: netDelta } } })]
          : []),
      ]);
    } else {
      // ── Create: must have enough wallet balance ─────────────────────────────
      if (wallet.balance < amount)
        return { success: false, error: `Insufficient wallet balance. Available: KSh ${wallet.balance.toLocaleString()}` };

      await prisma.$transaction([
        prisma.expense.create({
          data: { shopId, description, amount, category: category ?? null, paidById: ctx.userId },
        }),
        prisma.wallet.update({ where: { shopId }, data: { balance: { decrement: amount } } }),
      ]);
    }

    revalidatePath(`/${shopId}/finance/expenses`, "page");
    revalidatePath(`/${shopId}/finance/wallet`,   "page");
    return { success: true };
  } catch {
    return { success: false, error: expenseId ? "Update failed." : "Create failed." };
  }
}

// ── DELETE (refunds wallet) ───────────────────────────────────────────────────
export async function deleteExpenseAction(id: string, shopId: string): Promise<ActionResult> {
  const ctx = await canManage(shopId);
  if (!ctx || !ctx.isAdmin) return { success: false, error: "Only admins can delete expenses." };

  try {
    const expense = await prisma.expense.findUnique({
      where:  { id },
      select: { amount: true, shopId: true },
    });
    if (!expense) return { success: false, error: "Expense not found." };

    await prisma.$transaction([
      prisma.expense.delete({ where: { id } }),
      // Refund the amount back to wallet
      prisma.wallet.update({
        where: { shopId: expense.shopId },
        data:  { balance: { increment: expense.amount } },
      }),
    ]);

    revalidatePath(`/${shopId}/finance/expenses`, "page");
    revalidatePath(`/${shopId}/finance/wallet`,   "page");
    return { success: true };
  } catch {
    return { success: false, error: "Delete failed." };
  }
}
