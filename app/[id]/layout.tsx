import { auth }           from "@/auth";
import { redirect }       from "next/navigation";
import { headers }        from "next/headers";
import { isRouteAllowed } from "@/lib/permissions";
import Navbar             from "@/components/Navbar";
import IdleTimer          from "@/components/IdleTimer";
import PlanBanner         from "@/components/PlanBanner";
import SuspendedPage      from "@/components/SuspendedPage";
import { PlanProvider }   from "@/components/PlanProvider";
import SessionSync        from "@/components/SessionSync";
import { ReactNode }      from "react";
import prisma             from "@/lib/prisma";

interface Props {
  children: ReactNode;
  params:   Promise<{ id: string }>;
}

export default async function ShopLayout({ children, params }: Props) {
  const { id: shopId } = await params;

  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const userName = session.user.name ?? session.user.email ?? "there";

  // ── Always read role + allowedRoutes fresh from DB ───────────────────────
  // JWT can be stale (e.g. just promoted from user→owner after shop creation).
  const dbProfile = await prisma.profile.findUnique({
    where:  { userId: session.user.id },
    select: { role: true, allowedRoutes: true },
  });
  const role          = (dbProfile?.role ?? "user").toLowerCase().trim();
  const allowedRoutes = (dbProfile?.allowedRoutes ?? []) as string[];

  // ── Route access enforcement ──────────────────────────────────────────────
  const reqHeaders = await headers();
  const pathname   = reqHeaders.get("x-pathname") ?? "";
  const parts      = pathname.split("/").filter(Boolean);
  const section    = parts[1] ? `/${parts[1]}` : "/dashboard";

  if (!isRouteAllowed(section, role, allowedRoutes)) {
    const first = allowedRoutes[0];
    // Redirect within the shop — never back to /welcome (causes loops for staff)
    redirect(first ? `/${shopId}${first}` : `/${shopId}/dashboard`);
  }

  // ── Plan: read live from DB for everyone ─────────────────────────────────
  // Owner: from their own subscription. Staff/manager: from the shop owner's sub.
  let plan       = "demo";
  let planExpiry: string | undefined;
  let shopName   = "";

  const shop = await prisma.shop.findUnique({
    where:  { id: shopId },
    select: {
      name: true,
      user: { select: { subscription: { select: { plan: true, expiresAt: true } } } },
    },
  });
  shopName   = shop?.name ?? "";
  const sub  = shop?.user?.subscription;
  if (sub) {
    plan       = sub.plan;
    planExpiry = sub.expiresAt?.toISOString() ?? undefined;
  }

  // demo = free tier (always active, shows upgrade banner)
  // demo_plus = paid extended demo (active while not expired)
  // pro = fully paid (always active)
  const active =
    plan === "pro" ||
    plan === "demo" ||
    (plan === "demo_plus" && !!planExpiry && new Date(planExpiry) > new Date());

  // ── Owners always have full access — no billing gate ────────────────────
  // Staff/manager with an inactive owner plan → suspended page
  if (!active && (role === "staff" || role === "manager")) {
    const reason: "demo" | "expired" = plan === "demo_plus" ? "expired" : "demo";
    return (
      <SuspendedPage
        shopName={shopName}
        userName={userName}
        reason={reason}
      />
    );
  }

  // ── Mirror PlanBanner visibility for CSS variable ─────────────────────────
  const planExpired  = plan === "demo_plus" && !!planExpiry && Date.now() > new Date(planExpiry).getTime();
  const bannerShown  = plan === "demo" || planExpired;

  return (
    <div className="min-h-screen bg-gray-50">
      <PlanBanner plan={plan} planExpiry={planExpiry} />
      <IdleTimer />
      <style>{`
        :root {
          --sidebar-w: 64px;
          --topbar-h:  56px;
          --banner-h:  ${bannerShown ? "40px" : "0px"};
        }
        .app-main {
          padding-top:  calc(var(--topbar-h) + var(--banner-h));
          padding-left: var(--sidebar-w);
          transition:   padding-left 200ms ease-in-out;
          min-height:   100vh;
          width:        100%;
          box-sizing:   border-box;
        }
        @media (max-width: 767px) {
          .app-main { padding-left: 0 !important; }
        }
      `}</style>
      <SessionSync dbRole={role} dbAllowedRoutes={allowedRoutes} />
      <Navbar />
      <main className="app-main p-4 md:p-6">
        <PlanProvider plan={plan} planExpiry={planExpiry}>
          {children}
        </PlanProvider>
      </main>
    </div>
  );
}
