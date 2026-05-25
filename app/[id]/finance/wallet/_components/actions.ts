"use server";

import { bustShop } from "@/lib/shop-cache";
import prisma             from "@/lib/prisma";
import { resolveActor, walletDeduct, capturePayment } from "@/lib/actions";
import { planGuardCreate } from "@/lib/plan-guard";

export type ActionResult = { success: boolean; error?: string };

function revalidate(shopId: string) {
  bustShop(shopId);
}

export async function depositAction(
  shopId: string,
  data: { description: string; amount: number; source: string },
): Promise<ActionResult> {
  const guard = await planGuardCreate(shopId, "transactions");
  if (!guard.ok) return { success: false, error: guard.error };

  const actor = await resolveActor(shopId, { requireAdmin: true });
  if (!actor) return { success: false, error: "Only admins can deposit funds." };
  if (!data.description?.trim()) return { success: false, error: "Description is required." };
  if (!data.amount || data.amount <= 0) return { success: false, error: "Amount must be > 0." };
  if (!data.source?.trim()) return { success: false, error: "Source of money is required." };

  try {
    await prisma.$transaction([
      prisma.wallet.upsert({
        where:  { shopId },
        create: { shopId, balance: data.amount },
        update: { balance: { increment: data.amount } },
      }),
      prisma.transaction.create({
        data: {
          shopId,
          name:          data.description.trim(),
          amount:        data.amount,
          type:          "deposit",
          sourceOfMoney: data.source.trim(),
          authorizedBy:  actor.name,
        },
      }),
    ]);
    revalidate(shopId);
    return { success: true };
  } catch {
    return { success: false, error: "Deposit failed." };
  }
}

export async function withdrawAction(
  shopId: string,
  data: { description: string; amount: number; reason: string },
): Promise<ActionResult> {
  const guard = await planGuardCreate(shopId, "transactions");
  if (!guard.ok) return { success: false, error: guard.error };

  const actor = await resolveActor(shopId, { requireAdmin: true });
  if (!actor) return { success: false, error: "Only admins can withdraw funds." };
  if (!data.description?.trim()) return { success: false, error: "Description is required." };
  if (!data.amount || data.amount <= 0) return { success: false, error: "Amount must be > 0." };
  if (!data.reason?.trim()) return { success: false, error: "Reason is required." };

  try {
    await prisma.$transaction(async (tx) => {
      await walletDeduct(tx, {
        shopId,
        amount:       data.amount,
        type:         "withdraw",
        name:         data.description.trim(),
        authorizedBy: actor.name,
      });
    });
    revalidate(shopId);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Withdrawal failed." };
  }
}

export async function transferFromPaymentsAction(
  shopId: string,
  data: { amount: number; note: string },
): Promise<ActionResult> {
  const guard = await planGuardCreate(shopId, "transactions");
  if (!guard.ok) return { success: false, error: guard.error };

  const actor = await resolveActor(shopId, { requireAdmin: true });
  if (!actor) return { success: false, error: "Only admins can transfer funds." };
  if (!data.amount || data.amount <= 0) return { success: false, error: "Amount must be > 0." };
  if (!data.note?.trim()) return { success: false, error: "Note is required." };

  try {
    await prisma.$transaction(async (tx) => {
      const [inAgg, outAgg] = await Promise.all([
        tx.payment.aggregate({ where: { shopId, direction: "in" },  _sum: { amount: true } }),
        tx.payment.aggregate({ where: { shopId, direction: "out" }, _sum: { amount: true } }),
      ]);
      const available = (inAgg._sum.amount ?? 0) - (outAgg._sum.amount ?? 0);
      if (available < data.amount)
        throw new Error(
          `Insufficient payments balance. Available: KSh ${available.toLocaleString()}.`,
        );

      await capturePayment(tx, {
        shopId,
        amount:    data.amount,
        method:    "wallet_transfer",
        source:    "wallet_transfer_out",
        direction: "out",
        note:      data.note.trim(),
      });

      await tx.wallet.upsert({
        where:  { shopId },
        create: { shopId, balance: data.amount },
        update: { balance: { increment: data.amount } },
      });
      await tx.transaction.create({
        data: {
          shopId,
          name:          data.note.trim(),
          amount:        data.amount,
          type:          "transfer_from_payments",
          sourceOfMoney: "payments",
          authorizedBy:  actor.name,
        },
      });
    });
    revalidate(shopId);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Transfer failed." };
  }
}
