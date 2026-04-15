import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * proxy.ts — Edge-compatible (no Prisma, no DB calls)
 *
 * 1. Stamps x-pathname on every response so server-component layouts
 *    can read the current URL path (used for allowedRoutes enforcement).
 * 2. Redirects to "/" if no session cookie is present on a shop route.
 *
 * Full allowedRoutes enforcement happens in app/[id]/layout.tsx which
 * runs in Node.js runtime and can safely use auth() + Prisma.
 */
export default function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Stamp pathname so server components can read it via headers()
  const res = NextResponse.next();
  res.headers.set("x-pathname", pathname);

  // next-auth v5 uses "authjs.session-token" (http) / "__Secure-authjs.session-token" (https)
  const hasSession =
    req.cookies.has("authjs.session-token") ||
    req.cookies.has("__Secure-authjs.session-token");

  // Protect /{shopId}/... routes — if no session cookie redirect to login
  const parts      = pathname.split("/").filter(Boolean);
  const firstSeg   = parts[0] ?? "";
  const systemSegs = new Set(["api", "_next", "welcome", ""]);

  if (!systemSegs.has(firstSeg) && parts.length >= 2 && !hasSession) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return res;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\..*).*)",
  ],
};
