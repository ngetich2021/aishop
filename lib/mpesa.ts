/**
 * lib/mpesa.ts
 * M-Pesa Daraja API helpers — STK Push (Lipa Na M-Pesa Online)
 *
 * Uses Node's native https module (not fetch/undici) to avoid the JA3 TLS
 * fingerprint that Safaricom's Incapsula WAF flags as a bot.
 */

import https from "https";

const BASE            = process.env.MPESA_ENV === "production"
  ? "https://api.safaricom.co.ke"
  : "https://sandbox.safaricom.co.ke";

const SHORTCODE       = process.env.MPESA_SHORTCODE!;
const PASSKEY         = process.env.MPESA_PASSKEY!;
const CONSUMER_KEY    = process.env.MPESA_CONSUMER_KEY!;
const CONSUMER_SECRET = process.env.MPESA_CONSUMER_SECRET!;

// Equity Paybill C2B constants
export const C2B_SHORTCODE   = process.env.MPESA_C2B_SHORTCODE ?? "247247";
export const C2B_ACCOUNT     = process.env.MPESA_C2B_ACCOUNT   ?? "876954";

// ─── Low-level HTTPS helper ───────────────────────────────────────────────────

interface HttpResult { status: number; body: string }

function httpsRequest(
  url:     string,
  method:  string,
  headers: Record<string, string>,
  body?:   string,
): Promise<HttpResult> {
  return new Promise((resolve, reject) => {
    const { hostname, pathname, search } = new URL(url);

    const req = https.request(
      {
        hostname,
        path:    pathname + (search ?? ""),
        method,
        headers: {
          // Common browser-like headers every request carries
          "User-Agent":      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          "Accept":          "application/json, text/plain, */*",
          "Accept-Language": "en-US,en;q=0.9",
          "Cache-Control":   "no-cache",
          "Pragma":          "no-cache",
          ...headers,
          ...(body ? { "Content-Length": Buffer.byteLength(body).toString() } : {}),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () =>
          resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString("utf8") })
        );
      },
    );

    req.on("error", reject);
    req.setTimeout(30_000, () => req.destroy(new Error("M-Pesa request timed out")));

    if (body) req.write(body);
    req.end();
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTimestamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    String(now.getFullYear()) +
    pad(now.getMonth() + 1) +
    pad(now.getDate()) +
    pad(now.getHours()) +
    pad(now.getMinutes()) +
    pad(now.getSeconds())
  );
}

function buildPassword(timestamp: string): string {
  return Buffer.from(`${SHORTCODE}${PASSKEY}${timestamp}`).toString("base64");
}

/**
 * Normalise a Kenyan phone number to the 254XXXXXXXXX format.
 * Accepts: 07XXXXXXXX | +2547XXXXXXXX | 2547XXXXXXXX | 01XXXXXXXX
 */
export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("254") && digits.length === 12) return digits;
  if (digits.startsWith("0")   && digits.length === 10) return `254${digits.slice(1)}`;
  if (digits.startsWith("7")   && digits.length === 9)  return `254${digits}`;
  if (digits.startsWith("1")   && digits.length === 9)  return `254${digits}`;
  return digits;
}

// ─── Token ────────────────────────────────────────────────────────────────────

export async function getMpesaToken(): Promise<string> {
  const credentials = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString("base64");

  const { status, body } = await httpsRequest(
    `${BASE}/oauth/v1/generate?grant_type=client_credentials`,
    "GET",
    { Authorization: `Basic ${credentials}` },
  );

  if (status < 200 || status >= 300) {
    throw new Error(`M-Pesa token request failed (${status}): ${body || "(empty response — check MPESA_CONSUMER_KEY / MPESA_CONSUMER_SECRET)"}`);
  }

  const data = JSON.parse(body) as { access_token?: string };
  if (!data.access_token) throw new Error("M-Pesa: no access_token in response");
  return data.access_token;
}

// ─── STK Push ─────────────────────────────────────────────────────────────────

export interface StkPushOptions {
  phone:        string;
  amount:       number;
  accountRef:   string;
  description:  string;
  callbackUrl?: string;
  // Optional overrides for C2B (Equity Paybill) payments
  shortCode?:   string;
  passKey?:     string;
  partyB?:      string;
}

export interface StkPushResult {
  checkoutRequestId:   string;
  merchantRequestId:   string;
  responseCode:        string;
  responseDescription: string;
  customerMessage:     string;
}

export async function stkPush(opts: StkPushOptions): Promise<StkPushResult> {
  const token     = await getMpesaToken();
  const timestamp = getTimestamp();
  const sc        = opts.shortCode ?? SHORTCODE;
  const pk        = opts.passKey   ?? PASSKEY;
  const password  = Buffer.from(`${sc}${pk}${timestamp}`).toString("base64");
  const phone     = formatPhone(opts.phone);
  const rawCallbackUrl =
    opts.callbackUrl ??
    process.env.MPESA_CALLBACK_URL ??
    `${process.env.NEXT_PUBLIC_APP_URL}/api/mpesa/callback`;
  // Ensure the callback URL always points to the correct path
  const callbackUrl = rawCallbackUrl.endsWith("/api/mpesa/callback")
    ? rawCallbackUrl
    : rawCallbackUrl.replace(/\/$/, "") + "/api/mpesa/callback";

  const payload = JSON.stringify({
    BusinessShortCode: sc,
    Password:          password,
    Timestamp:         timestamp,
    TransactionType:   "CustomerPayBillOnline",
    Amount:            String(Math.round(opts.amount)),
    PartyA:            phone,
    PartyB:            opts.partyB ?? sc,
    PhoneNumber:       phone,
    CallBackURL:       callbackUrl,
    AccountReference:  opts.accountRef.slice(0, 12),
    TransactionDesc:   opts.description.slice(0, 13),
  });

  const { status, body } = await httpsRequest(
    `${BASE}/mpesa/stkpush/v1/processrequest`,
    "POST",
    { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    payload,
  );

  if (status < 200 || status >= 300) {
    throw new Error(`STK Push failed (${status}): ${body}`);
  }

  const data = JSON.parse(body) as {
    CheckoutRequestID?:   string;
    MerchantRequestID?:   string;
    ResponseCode?:        string;
    ResponseDescription?: string;
    CustomerMessage?:     string;
    errorCode?:           string;
    errorMessage?:        string;
  };

  if (data.errorCode) {
    throw new Error(`STK Push error [${data.errorCode}]: ${data.errorMessage}`);
  }
  if (!data.CheckoutRequestID) {
    throw new Error("STK Push: no CheckoutRequestID in response");
  }

  return {
    checkoutRequestId:   data.CheckoutRequestID,
    merchantRequestId:   data.MerchantRequestID  ?? "",
    responseCode:        data.ResponseCode        ?? "",
    responseDescription: data.ResponseDescription ?? "",
    customerMessage:     data.CustomerMessage     ?? "",
  };
}

// ─── STK Query ────────────────────────────────────────────────────────────────

export interface StkQueryResult {
  resultCode: number | null;
  resultDesc: string;
}

export async function querySTK(checkoutRequestId: string): Promise<StkQueryResult> {
  const token     = await getMpesaToken();
  const timestamp = getTimestamp();
  const password  = buildPassword(timestamp);

  const payload = JSON.stringify({
    BusinessShortCode: SHORTCODE,
    Password:          password,
    Timestamp:         timestamp,
    CheckoutRequestID: checkoutRequestId,
  });

  const { status, body } = await httpsRequest(
    `${BASE}/mpesa/stkpushquery/v1/query`,
    "POST",
    { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    payload,
  );

  if (status < 200 || status >= 300) {
    throw new Error(`STK Query failed (${status}): ${body}`);
  }

  const data = JSON.parse(body) as {
    ResultCode?:   string | number;
    ResultDesc?:   string;
    errorCode?:    string;
    errorMessage?: string;
  };

  if (data.errorCode) {
    return { resultCode: null, resultDesc: data.errorMessage ?? "Pending" };
  }

  return {
    resultCode: data.ResultCode !== undefined ? Number(data.ResultCode) : null,
    resultDesc: data.ResultDesc ?? "",
  };
}

// ─── C2B URL Registration ─────────────────────────────────────────────────────

export async function registerC2BUrls(opts: {
  shortCode:       string;
  confirmationUrl: string;
  validationUrl:   string;
}): Promise<{ ok: boolean; message: string }> {
  const token = await getMpesaToken();

  const payload = JSON.stringify({
    ShortCode:       opts.shortCode,
    ResponseType:    "Completed",
    ConfirmationURL: opts.confirmationUrl,
    ValidationURL:   opts.validationUrl,
  });

  const { status, body } = await httpsRequest(
    `${BASE}/mpesa/c2b/v1/registerurl`,
    "POST",
    { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    payload,
  );

  const data = JSON.parse(body) as {
    ResponseCode?:        string;
    ResponseDescription?: string;
    errorCode?:           string;
    errorMessage?:        string;
  };

  if (status < 200 || status >= 300 || data.errorCode) {
    return { ok: false, message: data.errorMessage ?? data.ResponseDescription ?? body };
  }

  return { ok: true, message: data.ResponseDescription ?? "URLs registered successfully" };
}
