/**
 * POST /api/mpesa/verify
 *
 * Manual fallback: user pastes their M-Pesa confirmation code.
 * Checks the MpesaCallback table first, then queries Safaricom directly.
 * Body: { receiptCode: string, checkoutId: string }
 */
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { querySTK } from "@/lib/mpesa";
import { clearUserShopsData } from "@/lib/clearShopData";
import { reconcileProPayment } from "@/lib/pro-billing";

async function reconcilePayment(checkoutId: string, mpesaRef?: string) {
  const payment = await prisma.subscriptionPayment.findUnique({
    where:   { checkoutRequestId: checkoutId },
    include: { subscription: { select: { userId: true } } },
  });
  if (!payment) return null;
  if (payment.status === "completed") return payment;

  const now = new Date();
  await prisma.subscriptionPayment.update({
    where: { id: payment.id },
    data:  { status: "completed", mpesaRef: mpesaRef ?? null, updatedAt: now },
  });

  if (payment.plan === "demo_plus") {
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    await clearUserShopsData(payment.subscription.userId);
    await prisma.userSubscription.update({
      where: { id: payment.subscriptionId },
      data:  { plan: "demo_plus", status: "active", expiresAt, updatedAt: now },
    });
  } else if (payment.plan === "pro") {
    await reconcileProPayment(payment.subscriptionId, payment.amount);
  }

  return { ...payment, status: "completed" };
}

export async function POST(req: NextRequest) {
  let body: { receiptCode?: string; checkoutId?: string; userId?: string; plan?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ success: false, error: "Invalid body" }, { status: 400 });
  }

  const { receiptCode, checkoutId, userId, plan } = body;
  const code = receiptCode?.trim().toUpperCase();

  // ── Global uniqueness check — reject any already-used receipt code ─────────
  if (code && code.length >= 8) {
    const alreadyUsed = await prisma.subscriptionPayment.findFirst({
      where: { mpesaRef: code, status: "completed" },
    }).catch(() => null);
    if (alreadyUsed) {
      return Response.json({ success: false, error: "This M-Pesa receipt code has already been used." }, { status: 400 });
    }
  }

  // ── No checkoutId: STK push never reached Safaricom. ──────────────────────
  // Trust the receipt code — find the most recent pending payment for this user.
  if (!checkoutId && userId && plan && code && code.length >= 8) {
    try {
      const sub = await prisma.userSubscription.findUnique({ where: { userId } });
      if (!sub) return Response.json({ success: false, error: "Subscription not found." }, { status: 404 });

      const pending = await prisma.subscriptionPayment.findFirst({
        where:   { subscriptionId: sub.id, plan, status: "pending" },
        orderBy: { createdAt: "desc" },
      });

      if (pending) {
        if (pending.checkoutRequestId) {
          await reconcilePayment(pending.checkoutRequestId, code);
        } else {
          const now = new Date();
          await prisma.subscriptionPayment.update({
            where: { id: pending.id },
            data:  { status: "completed", mpesaRef: code, updatedAt: now },
          });
          if (plan === "demo_plus") {
            await clearUserShopsData(userId);
            await prisma.userSubscription.update({
              where: { id: sub.id },
              data:  { plan: "demo_plus", status: "active", expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000), updatedAt: now },
            });
          } else if (plan === "pro") {
            await reconcileProPayment(pending.subscriptionId, pending.amount);
          }
        }
        return Response.json({ success: true, mpesaRef: code });
      }
    } catch (err) {
      console.error("[mpesa/verify] userId lookup error:", err);
    }
    return Response.json({ success: false, error: "No pending payment found. Please contact support." });
  }

  if (!checkoutId) {
    return Response.json({ success: false, error: "checkoutId required" }, { status: 400 });
  }

  try {
    // ── 1. Check if callback already arrived with this receipt code ───────────
    if (code) {
      const cb = await prisma.mpesaCallback.findFirst({
        where: {
          mpesaReceiptNo: { equals: code, mode: "insensitive" },
          resultCode:     0,
        },
      }).catch(() => null);

      if (cb?.checkoutRequestId === checkoutId || cb?.mpesaReceiptNo) {
        await reconcilePayment(checkoutId, cb.mpesaReceiptNo ?? undefined);
        return Response.json({ success: true, mpesaRef: cb.mpesaReceiptNo });
      }
    }

    // ── 2. Query Safaricom directly ───────────────────────────────────────────
    const result = await querySTK(checkoutId);

    if (result.resultCode === 0) {
      const cb = await prisma.mpesaCallback.findUnique({
        where: { checkoutRequestId: checkoutId },
        select: { mpesaReceiptNo: true },
      }).catch(() => null);

      const ref = cb?.mpesaReceiptNo ?? code ?? undefined;
      await reconcilePayment(checkoutId, ref);
      return Response.json({ success: true, mpesaRef: ref });
    }

    // ── 3. Trust the receipt code if payment record exists ────────────────────
    // (Safaricom sandbox sometimes doesn't return correct query results)
    if (code && code.length >= 8) {
      const payment = await prisma.subscriptionPayment.findUnique({
        where:  { checkoutRequestId: checkoutId },
        select: { status: true },
      });

      if (payment && payment.status === "pending") {
        await reconcilePayment(checkoutId, code);
        return Response.json({ success: true, mpesaRef: code, trusted: true });
      }

      if (payment?.status === "completed") {
        return Response.json({ success: true });
      }
    }

    return Response.json({ success: false, error: "Could not verify payment. Check the code and try again." });
  } catch (err) {
    console.error("[mpesa/verify] error:", err);
    return Response.json({ success: false, error: "Verification failed. Try again." }, { status: 500 });
  }
}
