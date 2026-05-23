/**
 * POST /api/mpesa/stk
 *
 * Initiates an M-Pesa STK Push for a subscription plan.
 *
 * demo_plus → fixed KES 2, uses default shortcode
 * pro       → customer-specified amount, routes to Equity Paybill 247247 / account 876954
 *
 * Body: { phone, plan, userId, amount? }
 */
import { NextRequest }            from "next/server";
import prisma                     from "@/lib/prisma";
import { stkPush, formatPhone } from "@/lib/mpesa";

const DEMO_PLUS_AMOUNT = 50;   // KES fixed for Demo+
const MIN_PRO_AMOUNT   = 100;  // KES minimum Pro top-up

export async function POST(req: NextRequest) {
  let body: { phone?: string; plan?: string; userId?: string; amount?: number };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ success: false, message: "Invalid JSON body" }, { status: 400 });
  }

  const { phone, plan, userId } = body;

  if (!phone || !plan || !userId) {
    return Response.json({ success: false, message: "phone, plan, and userId are required" }, { status: 400 });
  }

  if (!["demo_plus", "pro"].includes(plan)) {
    return Response.json({ success: false, message: "plan must be demo_plus or pro" }, { status: 400 });
  }

  const formattedPhone = formatPhone(phone);
  if (!/^254\d{9}$/.test(formattedPhone)) {
    return Response.json({ success: false, message: "Invalid phone number. Use format 07XXXXXXXX" }, { status: 400 });
  }

  // Determine amount
  let amount: number;
  if (plan === "demo_plus") {
    amount = DEMO_PLUS_AMOUNT;
  } else {
    amount = Math.round(Number(body.amount ?? 0));
    if (amount < MIN_PRO_AMOUNT) {
      return Response.json({
        success: false,
        message: `Minimum top-up is KES ${MIN_PRO_AMOUNT}.`,
      }, { status: 400 });
    }
  }

  try {
    // Get or create subscription
    let subscription = await prisma.userSubscription.findUnique({ where: { userId } });

    if (!subscription) {
      subscription = await prisma.userSubscription.create({
        data: { userId, plan: "demo", status: "active", demoStartedAt: new Date(), mpesaPhone: formattedPhone },
      });
    } else {
      await prisma.userSubscription.update({
        where: { id: subscription.id },
        data:  { mpesaPhone: formattedPhone },
      });
    }

    // Pending payment record
    const pendingPayment = await prisma.subscriptionPayment.create({
      data: { subscriptionId: subscription.id, plan, amount, phone: formattedPhone, status: "pending" },
    });

    const stkOpts = {
      phone,
      amount,
      accountRef:  plan === "pro" ? "ProTopUp" : "DemoPlus",
      description: plan === "pro" ? "Pro Top-up" : "Demo+ 50",
    };

    const stkResult = await stkPush(stkOpts);

    await prisma.subscriptionPayment.update({
      where: { id: pendingPayment.id },
      data:  { checkoutRequestId: stkResult.checkoutRequestId },
    });

    return Response.json({
      success:           true,
      checkoutRequestId: stkResult.checkoutRequestId,
      message:           stkResult.customerMessage || "Check your phone and enter your M-Pesa PIN",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to initiate payment";
    console.error("[mpesa/stk]", message);
    return Response.json({ success: false, message }, { status: 500 });
  }
}
