import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "@auth/core/jwt";

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const res = NextResponse.next();
  res.headers.set("x-pathname", pathname);

  const systemSegs = new Set(["api", "_next", "welcome", "billing", "invite", ""]);
  const parts      = pathname.split("/").filter(Boolean);
  const firstSeg   = parts[0] ?? "";

  // Only enforce on shop routes: /{shopId}/something
  const isShopRoute = !systemSegs.has(firstSeg) && parts.length >= 2;
  if (!isShopRoute) return res;

  const hasSession =
    req.cookies.has("authjs.session-token") ||
    req.cookies.has("__Secure-authjs.session-token");

  if (!hasSession) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  const secret = process.env.AUTH_SECRET;
  if (!secret) return res;

  let token: Record<string, unknown> | null = null;
  try {
    token = (await getToken({
      req,
      secret,
      secureCookie: req.nextUrl.protocol === "https:",
    })) as Record<string, unknown> | null;
  } catch {
    return res;
  }

  if (!token) return res;

  // Owners have unrestricted access — no plan gating in the proxy.
  // Billing prompts are shown as banners inside the app, not as hard blocks.

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|.*\\..*).*)" ],
};
