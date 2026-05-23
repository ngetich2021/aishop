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
import { billShopForDay } from "@/lib/pro-billing";
import { DEMO_SHOP_LIMIT, DEMO_PLUS_SHOP_LIMIT } from "@/lib/billing-constants";

interface Props {
  children: ReactNode;
  params:   Promise<{ id: string }>;
}

export default async function ShopLayout({ children, params }: Props) {
  const { id: shopId } = await params;

  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const userName = session.user.name ?? session.user.email ?? "there";

  // ── Role + allowedRoutes from DB ─────────────────────────────────────────
  const dbProfile = await prisma.profile.findUnique({
    where:  { userId: session.user.id },
    select: { role: true, allowedRoutes: true },
  });
  let role            = (dbProfile?.role ?? "user").toLowerCase().trim();
  const allowedRoutes = (dbProfile?.allowedRoutes ?? []) as string[];

  // Auto-promote: if they're entering THEIR OWN shop but role is still "user"
  if (role === "user") {
    const ownsShop = await prisma.shop.findFirst({
      where:  { id: shopId, userId: session.user.id },
      select: { id: true },
    });
    if (ownsShop) {
      await prisma.profile.update({
        where: { userId: session.user.id },
        data:  { role: "owner" },
      });
      role = "owner";
    }
  }

  // ── Route access enforcement ──────────────────────────────────────────────
  const reqHeaders = await headers();
  const pathname   = reqHeaders.get("x-pathname") ?? "";
  const parts      = pathname.split("/").filter(Boolean);
  const section    = parts[1] ? `/${parts[1]}` : "/dashboard";

  if (!isRouteAllowed(section, role, allowedRoutes)) {
    const first = allowedRoutes[0];
    redirect(first ? `/${shopId}${first}` : `/${shopId}/dashboard`);
  }

  // ── Shop + owner subscription ─────────────────────────────────────────────
  const shop = await prisma.shop.findUnique({
    where:  { id: shopId },
    select: {
      name:   true,
      userId: true,
      user: {
        select: {
          subscription: { select: { plan: true, expiresAt: true } },
        },
      },
    },
  });

  const shopName  = shop?.name ?? "";
  const ownerId   = shop?.userId ?? "";
  const sub       = shop?.user?.subscription;
  const plan      = sub?.plan ?? "demo";
  const planExpiry = sub?.expiresAt?.toISOString() ?? undefined;

  // ── Global plan activity ──────────────────────────────────────────────────
  const globallyActive =
    plan === "pro" ||
    plan === "demo" ||
    (plan === "demo_plus" && !!planExpiry && new Date(planExpiry) > new Date());

  // Staff/manager blocked when plan is globally inactive
  if (!globallyActive && (role === "staff" || role === "manager")) {
    return (
      <SuspendedPage
        shopName={shopName} userName={userName}
        reason={plan === "demo_plus" ? "expired" : "demo"}
      />
    );
  }

  // ── Per-shop access gate ──────────────────────────────────────────────────

  if ((plan === "demo" || plan === "demo_plus") && globallyActive) {
    // Determine which shops this plan allows (first N by creation date)
    const limit = plan === "demo" ? DEMO_SHOP_LIMIT : DEMO_PLUS_SHOP_LIMIT;
    const allowedShops = await prisma.shop.findMany({
      where:   { userId: ownerId },
      orderBy: { createdAt: "asc" },
      select:  { id: true },
      take:    limit,
    });
    const isAllowed = allowedShops.some(s => s.id === shopId);

    if (!isAllowed) {
      return (
        <SuspendedPage
          shopName={shopName} userName={userName}
          reason="demo_limit"
          plan={plan}
          isOwner={role === "owner"}
        />
      );
    }
  }

  if (plan === "pro") {
    const bill = await billShopForDay(shopId, ownerId);
    if (!bill.ok) {
      return (
        <SuspendedPage
          shopName={shopName} userName={userName}
          reason="unpaid"
          isOwner={role === "owner"}
          error={bill.error}
        />
      );
    }
  }

  // ── Render layout ─────────────────────────────────────────────────────────
  const planExpired = plan === "demo_plus" && !!planExpiry && Date.now() > new Date(planExpiry).getTime();
  const bannerShown = plan === "demo" || planExpired;

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
