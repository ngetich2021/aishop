/**
 * POST /api/mpesa/callback
 *
 * Receives the Safaricom STK Push callback, persists the raw payload,
 * then reconciles the payment and subscription records.
 */
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { clearUserShopsData } from "@/lib/clearShopData";
import { reconcileProPayment } from "@/lib/pro-billing";

// Cast to any so new models (not yet in generated client) resolve at runtime
// eslint-disable-next-line @typescript-eslint/no-explicit-any


// Safaricom always POSTs JSON — no auth header needed; we verify via checkoutRequestId lookup
export async function POST(req: NextRequest) {
  let rawJson = "";
  try {
    rawJson = await req.text();
  } catch {
    return Response.json({ ResultCode: 1, ResultDesc: "Failed to read body" });
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawJson) as Record<string, unknown>;
  } catch {
    return Response.json({ ResultCode: 1, ResultDesc: "Invalid JSON" });
  }

  // Safaricom wraps the callback in Body.stkCallback
  const stkCallback = (
    (body?.Body as Record<string, unknown>)?.stkCallback as Record<string, unknown>
  ) ?? {};

  const checkoutRequestId = (stkCallback?.CheckoutRequestID as string | undefined) ?? "";
  const merchantRequestId = (stkCallback?.MerchantRequestID as string | undefined) ?? null;
  const resultCode        = stkCallback?.ResultCode !== undefined
    ? Number(stkCallback.ResultCode)
    : null;
  const resultDesc        = (stkCallback?.ResultDesc as string | undefined) ?? null;

  // Parse CallbackMetadata items (only present on success)
  let mpesaReceiptNo:  string | null = null;
  let amount:          number | null = null;
  let phoneNumber:     string | null = null;
  let transactionDate: string | null = null;

  const metadataItems = (
    (stkCallback?.CallbackMetadata as Record<string, unknown>)?.Item as Array<{ Name: string; Value: unknown }>
  ) ?? [];

  for (const item of metadataItems) {
    switch (item.Name) {
      case "MpesaReceiptNumber": mpesaReceiptNo  = String(item.Value); break;
      case "Amount":             amount          = Number(item.Value);  break;
      case "PhoneNumber":        phoneNumber     = String(item.Value);  break;
      case "TransactionDate":    transactionDate = String(item.Value);  break;
    }
  }

  // Persist raw callback — upsert so duplicate deliveries are idempotent
  if (checkoutRequestId) {
    try {
      await prisma.mpesaCallback.upsert({
        where:  { checkoutRequestId },
        update: {
          merchantRequestId,
          resultCode,
          resultDesc,
          mpesaReceiptNo,
          amount,
          phoneNumber,
          transactionDate,
          rawJson,
        },
        create: {
          checkoutRequestId,
          merchantRequestId,
          resultCode,
          resultDesc,
          mpesaReceiptNo,
          amount,
          phoneNumber,
          transactionDate,
          rawJson,
        },
      });
    } catch (err) {
      console.error("[mpesa/callback] failed to save MpesaCallback:", err);
    }
  }

  // Only reconcile on success
  if (resultCode !== 0 || !checkoutRequestId) {
    // Mark payment as failed if we have a record
    if (checkoutRequestId) {
      try {
        await prisma.subscriptionPayment.updateMany({
          where: { checkoutRequestId, status: "pending" },
          data:  { status: "failed", updatedAt: new Date() },
        });
      } catch { /* best-effort */ }
    }
    return Response.json({ ResultCode: 0, ResultDesc: "Accepted" });
  }

  // Reject duplicate M-Pesa receipt codes
  if (mpesaReceiptNo) {
    const alreadyUsed = await prisma.subscriptionPayment.findFirst({
      where: { mpesaRef: mpesaReceiptNo, status: "completed" },
    }).catch(() => null);
    if (alreadyUsed) {
      return Response.json({ ResultCode: 0, ResultDesc: "Accepted" });
    }
  }

  // Find pending payment
  try {
    const payment = await prisma.subscriptionPayment.findUnique({
      where: { checkoutRequestId },
    });

    if (!payment || payment.status !== "pending") {
      // Already processed or no record — still return 200
      return Response.json({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    // Mark payment completed
    await prisma.subscriptionPayment.update({
      where: { id: payment.id },
      data:  {
        status:    "completed",
        mpesaRef:  mpesaReceiptNo ?? null,
        updatedAt: new Date(),
      },
    });

    // Update subscription based on plan
    const now = new Date();
    if (payment.plan === "demo_plus") {
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // +24 h
      const sub = await prisma.userSubscription.findUnique({
        where:  { id: payment.subscriptionId },
        select: { userId: true },
      });
      if (sub) await clearUserShopsData(sub.userId);
      await prisma.userSubscription.update({
        where: { id: payment.subscriptionId },
        data:  {
          plan:      "demo_plus",
          status:    "active",
          expiresAt,
          updatedAt: now,
        },
      });
    } else if (payment.plan === "pro") {
      await reconcileProPayment(payment.subscriptionId, payment.amount);
    }

    // Mark callback as processed
    await prisma.mpesaCallback.update({
      where: { checkoutRequestId },
      data:  { processed: true },
    });
  } catch (err) {
    console.error("[mpesa/callback] reconciliation error:", err);
  }

  return Response.json({ ResultCode: 0, ResultDesc: "Accepted" });
}
