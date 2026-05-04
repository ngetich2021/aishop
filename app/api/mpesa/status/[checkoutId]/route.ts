/**
 * GET /api/mpesa/status/[checkoutId]
 *
 * Priority order:
 * 1. DB payment record already completed/failed → return immediately
 * 2. MpesaCallback table has a successful entry → reconcile & return completed
 * 3. Query Safaricom directly (may fail due to Incapsula)
 * 4. Return pending
 */
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { querySTK } from "@/lib/mpesa";
import { clearUserShopsData } from "@/lib/clearShopData";
import { reconcileProPayment } from "@/lib/pro-billing";

interface RouteContext {
  params: Promise<{ checkoutId: string }>;
}

async function reconcilePayment(checkoutId: string, mpesaRef?: string) {
  const payment = await prisma.subscriptionPayment.findUnique({
    where:   { checkoutRequestId: checkoutId },
    include: { subscription: { select: { userId: true } } },
  });
  if (!payment || payment.status !== "pending") return payment;

  const now = new Date();
  await prisma.subscriptionPayment.update({
    where: { id: payment.id },
    data:  { status: "completed", mpesaRef: mpesaRef ?? null, updatedAt: now },
  });

  if (payment.plan === "demo_plus") {
    if (payment.subscription?.userId) {
      await clearUserShopsData(payment.subscription.userId);
    }
    await prisma.userSubscription.update({
      where: { id: payment.subscriptionId },
      data:  { plan: "demo_plus", status: "active", expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000), updatedAt: now },
    });
  } else if (payment.plan === "pro") {
    await reconcileProPayment(payment.subscriptionId, payment.amount);
  }

  return { ...payment, status: "completed", mpesaRef: mpesaRef ?? null };
}

export async function GET(_req: NextRequest, ctx: RouteContext) {
  const { checkoutId } = await ctx.params;
  if (!checkoutId) {
    return Response.json({ status: "failed", message: "Missing checkoutId" }, { status: 400 });
  }

  try {
    // ── 1. DB fast path ───────────────────────────────────────────────────────
    const payment = await prisma.subscriptionPayment.findUnique({
      where:  { checkoutRequestId: checkoutId },
      select: { status: true, mpesaRef: true, plan: true },
    });

    if (payment?.status === "completed") {
      return Response.json({ status: "completed", mpesaRef: payment.mpesaRef ?? undefined, plan: payment.plan });
    }
    if (payment?.status === "failed") {
      return Response.json({ status: "failed" });
    }

    // ── 2. Check MpesaCallback table — callback may have arrived silently ─────
    const cb = await prisma.mpesaCallback.findUnique({
      where:  { checkoutRequestId: checkoutId },
      select: { resultCode: true, mpesaReceiptNo: true },
    }).catch(() => null);

    if (cb?.resultCode === 0) {
      // Callback arrived with success — reconcile now
      const done = await reconcilePayment(checkoutId, cb.mpesaReceiptNo ?? undefined);
      return Response.json({ status: "completed", mpesaRef: done?.mpesaRef ?? cb.mpesaReceiptNo ?? undefined });
    }
    if (cb?.resultCode !== null && cb?.resultCode !== undefined && cb.resultCode !== 0) {
      // Callback arrived with failure
      await prisma.subscriptionPayment.updateMany({
        where: { checkoutRequestId: checkoutId, status: "pending" },
        data:  { status: "failed", updatedAt: new Date() },
      }).catch(() => null);
      return Response.json({ status: "failed" });
    }

    // ── 3. Query Safaricom directly (may be blocked by Incapsula) ────────────
    try {
      const result = await querySTK(checkoutId);

      if (result.resultCode === 0) {
        const done = await reconcilePayment(checkoutId);
        return Response.json({ status: "completed", mpesaRef: done?.mpesaRef ?? undefined });
      }

      if (result.resultCode !== null && result.resultCode !== 0) {
        await prisma.subscriptionPayment.updateMany({
          where: { checkoutRequestId: checkoutId, status: "pending" },
          data:  { status: "failed", updatedAt: new Date() },
        }).catch(() => null);
        return Response.json({ status: "failed", reason: result.resultDesc });
      }
    } catch {
      // Incapsula blocked the query — fall through to pending
    }

    return Response.json({ status: "pending" });
  } catch (err) {
    console.error("[mpesa/status] error:", err);
    return Response.json({ status: "pending" });
  }
}
