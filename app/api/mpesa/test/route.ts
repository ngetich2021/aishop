/**
 * GET /api/mpesa/test
 * Diagnostic endpoint — shows exactly what Safaricom returns for a token request.
 * Remove or protect this before going public.
 */
import { getMpesaToken } from "@/lib/mpesa";

export async function GET() {
  const env        = process.env.MPESA_ENV ?? "(not set — sandbox)";
  const shortcode  = process.env.MPESA_SHORTCODE ?? "(not set)";
  const hasKey     = !!process.env.MPESA_CONSUMER_KEY;
  const hasSecret  = !!process.env.MPESA_CONSUMER_SECRET;
  const hasPasskey = !!process.env.MPESA_PASSKEY;
  const callback   = process.env.MPESA_CALLBACK_URL ?? "(not set)";

  let token: string | null = null;
  let error: string | null = null;

  try {
    token = await getMpesaToken();
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  return Response.json({
    env,
    shortcode,
    hasConsumerKey:    hasKey,
    hasConsumerSecret: hasSecret,
    hasPasskey,
    callbackUrl:       callback,
    tokenOk:           !!token,
    tokenPreview:      token ? token.slice(0, 12) + "…" : null,
    error,
  });
}
