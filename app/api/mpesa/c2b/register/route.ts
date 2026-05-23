/**
 * GET /api/mpesa/c2b/register?secret=<BILLING_SECRET>
 *
 * One-time setup: registers the C2B confirmation and validation URLs
 * for the Equity Paybill (247247) with Safaricom Daraja.
 *
 * Run this ONCE after deployment from a browser or curl:
 *   curl "https://yourdomain.com/api/mpesa/c2b/register?secret=YOUR_SECRET"
 */
import { NextRequest }       from "next/server";
import { registerC2BUrls } from "@/lib/mpesa";

const C2B_SHORTCODE = process.env.MPESA_SHORTCODE!;

const BILLING_SECRET = process.env.BILLING_SECRET ?? "kwenik-billing-2024";

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (secret !== BILLING_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    return Response.json({ error: "NEXT_PUBLIC_APP_URL not set" }, { status: 500 });
  }

  const confirmationUrl = `${appUrl}/api/mpesa/c2b/confirm`;
  const validationUrl   = `${appUrl}/api/mpesa/c2b/validate`;

  try {
    const result = await registerC2BUrls({
      shortCode:       C2B_SHORTCODE,
      confirmationUrl,
      validationUrl,
    });

    return Response.json({
      ok:              result.ok,
      message:         result.message,
      shortCode:       C2B_SHORTCODE,
      confirmationUrl,
      validationUrl,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}
