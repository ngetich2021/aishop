/**
 * POST /api/mpesa/c2b/confirm
 *
 * Safaricom calls this AFTER a customer successfully pays to Equity Paybill 247247.
 * We identify the user by their phone number, credit their proBalance, and activate Pro.
 *
 * Customers should use their M-Pesa phone number as the account number when paying,
 * e.g. "0712345678". This lets us match them to their subscription automatically.
 */
import { NextRequest }         from "next/server";
import prisma                  from "@/lib/prisma";
import { reconcileProPayment } from "@/lib/pro-billing";
import { formatPhone }         from "@/lib/mpesa";

interface C2BPayload {
  TransactionType?:  string;
  TransID?:          string;    // unique Safaricom transaction ID
  TransTime?:        string;
  TransAmount?:      string;
  BusinessShortCode?: string;
  BillRefNumber?:    string;    // account number the customer typed
  InvoiceNumber?:    string;
  OrgAccountBalance?: string;
  MSISDN?:           string;    // paying phone number (254XXXXXXXXX)
  FirstName?:        string;
  MiddleName?:       string;
  LastName?:         string;
}

export async function POST(req: NextRequest) {
  let body: C2BPayload;
  try {
    body = (await req.json()) as C2BPayload;
  } catch {
    return Response.json({ ResultCode: 0, ResultDesc: "Accepted" });
  }

  const transId   = body.TransID?.trim()    ?? "";
  const msisdn    = body.MSISDN?.trim()     ?? "";
  const billRef   = body.BillRefNumber?.trim() ?? "";
  const amountStr = body.TransAmount?.trim() ?? "0";
  const amount    = Math.round(parseFloat(amountStr));

  if (!transId || amount <= 0) {
    return Response.json({ ResultCode: 0, ResultDesc: "Accepted" });
  }

  // ── Idempotency: skip if already processed ────────────────────────────────
  const already = await prisma.subscriptionPayment.findFirst({
    where: { mpesaRef: transId, status: "completed" },
  }).catch(() => null);
  if (already) return Response.json({ ResultCode: 0, ResultDesc: "Accepted" });

  // ── Identify the user ─────────────────────────────────────────────────────
  // Try BillRefNumber first (customer typed their phone as account number),
  // then fall back to MSISDN (the phone used to pay).
  const candidatePhones: string[] = [];

  if (billRef) candidatePhones.push(formatPhone(billRef));
  if (msisdn)  candidatePhones.push(formatPhone(msisdn));

  type SubRow = { id: string; userId: string; plan: string; status: string };

  let sub: SubRow | null = null;

  for (const phone of candidatePhones) {
    sub = await (prisma.userSubscription as unknown as {
      findFirst: (args: unknown) => Promise<SubRow | null>
    }).findFirst({
      where:  { mpesaPhone: phone },
      select: { id: true, userId: true, plan: true, status: true },
    });
    if (sub) break;
  }

  // If still not found, try matching by userId or sub ID in BillRefNumber
  if (!sub && billRef.length > 8 && !billRef.startsWith("0") && !billRef.startsWith("254")) {
    sub = await (prisma.userSubscription as unknown as {
      findFirst: (args: unknown) => Promise<SubRow | null>
    }).findFirst({
      where: {
        OR: [
          { id:     billRef },
          { userId: billRef },
        ],
      },
      select: { id: true, userId: true, plan: true, status: true },
    });
  }

  if (!sub) {
    // Unknown user — store the payment as unmatched for manual review
    console.warn(`[c2b/confirm] unmatched payment: TransID=${transId} MSISDN=${msisdn} BillRef=${billRef} Amount=${amount}`);
    // Still return success to Safaricom — don't reject received money
    return Response.json({ ResultCode: 0, ResultDesc: "Accepted" });
  }

  // ── Record the payment ────────────────────────────────────────────────────
  try {
    const payment = await prisma.subscriptionPayment.create({
      data: {
        subscriptionId: sub.id,
        plan:           "pro",
        amount,
        phone:          formatPhone(msisdn || billRef),
        mpesaRef:       transId,
        status:         "completed",
      },
    });

    // ── Credit proBalance & activate pro plan ─────────────────────────────
    await reconcileProPayment(sub.id, amount);

    // ── Update mpesaPhone if not already set ──────────────────────────────
    const payingPhone = formatPhone(msisdn || billRef);
    await (prisma.userSubscription as unknown as {
      update: (args: unknown) => Promise<unknown>
    }).update({
      where: { id: sub.id },
      data:  { mpesaPhone: payingPhone },
    });

    console.log(`[c2b/confirm] credited KES ${amount} to sub ${sub.id} (TransID=${transId})`);
    void payment; // used above
  } catch (err) {
    console.error("[c2b/confirm] error processing payment:", err);
  }

  return Response.json({ ResultCode: 0, ResultDesc: "Accepted" });
}
