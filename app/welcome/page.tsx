import { redirect }     from "next/navigation";
import { auth }         from "@/auth";
import prisma           from "@/lib/prisma";
import ShopSelectClient from "./_components/ShopSelectClient";
import WaitingPage      from "./_components/WaitingPage";
import SessionRefresher from "./_components/SessionRefresher";
import SuspendedPage    from "@/components/SuspendedPage";
import { Mail, Clock }  from "lucide-react";

// ─── helpers ──────────────────────────────────────────────────────────────────

function planActive(plan: string, expiresAt?: Date | null): boolean {
  if (plan === "pro")      return true;
  if (plan === "demo")     return true; // free tier — always active
  if (plan === "demo_plus") return !!expiresAt && expiresAt > new Date();
  return false;
}

// ─── tiny inline pages ────────────────────────────────────────────────────────

function PendingInvitePage({ userName, shopName }: { userName: string; shopName: string }) {
  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 to-blue-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-sm border-2 border-amber-200 max-w-md w-full p-10 text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto">
          <Mail className="w-7 h-7 text-amber-600" />
        </div>
        <h1 className="text-xl font-black text-gray-900">Invite waiting in your email</h1>
        <p className="text-sm text-gray-600">
          <strong>{shopName}</strong> sent you a staff invite — open the email and click the link to join.
        </p>
        <div className="flex items-center justify-center gap-2 text-xs text-amber-700 bg-amber-50 rounded-xl px-4 py-2.5">
          <Clock size={14} /> <span>Invite expires in 7 days</span>
        </div>
        <p className="text-xs text-gray-400">Signed in as <span className="font-semibold">{userName}</span></p>
      </div>
    </div>
  );
}

// ─── main page ────────────────────────────────────────────────────────────────

export default async function WelcomePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const userId    = session.user.id;
  const userEmail = session.user.email ?? "";
  const userName  = (session.user.name ?? userEmail) || "there";

  // Upsert profile — guards against race on first sign-in
  let profile = await prisma.profile.findUnique({
    where:  { userId },
    select: { role: true, shopId: true, isSystemAdmin: true },
  });
  if (!profile) {
    profile = await prisma.profile.upsert({
      where:  { userId },
      update: {},
      create: { userId, role: "user", email: userEmail || null },
      select: { role: true, shopId: true, isSystemAdmin: true },
    });
  }

  // Use `let` so we can correct a stale "user" role below without a redirect.
  let role = profile.role.toLowerCase().trim();

  /*
   * ── REMOVED: jwtRole !== role → SessionRefresher target="/welcome" ─────────
   *
   * That pattern created an infinite loading loop:
   *   /welcome → SessionRefresher → update() hangs/fails → navigate "/welcome"
   *   → jwtRole still stale → SessionRefresher again → repeat forever.
   *
   * The /welcome page has no Navbar so a stale JWT causes zero visible harm.
   * When the user enters a shop, SessionSync in [id]/layout.tsx refreshes the
   * JWT silently.  We render entirely from DB role (always correct); JWT is
   * best-effort and eventually consistent.
   * ──────────────────────────────────────────────────────────────────────────
   */

  // ── STAFF / MANAGER ───────────────────────────────────────────────────────
  if (role === "staff" || role === "manager") {
    if (profile.shopId) {
      // Check if the shop owner has an active plan
      const shop = await prisma.shop.findUnique({
        where:  { id: profile.shopId },
        select: {
          name: true,
          user: { select: { subscription: { select: { plan: true, expiresAt: true } } } },
        },
      });
      const sub    = shop?.user?.subscription;
      const active = planActive(sub?.plan ?? "demo", sub?.expiresAt);

      if (!active) {
        // Owner hasn't paid — staff cannot enter
        const reason: "demo" | "expired" = sub?.plan === "demo_plus" ? "expired" : "demo";
        return (
          <SuspendedPage
            shopName={shop?.name ?? "Your shop"}
            userName={userName}
            reason={reason}
          />
        );
      }

      // Navigate to dashboard — SessionSync there will refresh the JWT.
      return <SessionRefresher target={`/${profile.shopId}/dashboard`} />;
    }

    // Staff with no shop assigned
    return <WaitingPage userName={userName} />;
  }

  // ── ROLE = "user" — if they already own shops, fix the stale role ─────────
  // Handles a timing edge case where promoteToOwner ran but this request
  // hit the DB before the commit was visible (or the profile row is cached).
  // FIX: update role in-memory and continue rendering — DO NOT loop back to
  // /welcome via SessionRefresher; the JWT is refreshed by SessionSync later.
  if (role === "user") {
    const ownedShops = await prisma.shop.count({ where: { userId } });
    if (ownedShops > 0) {
      await prisma.profile.update({ where: { userId }, data: { role: "owner" } });
      role = "owner"; // fall through to owner rendering below
    }
  }

  // ── ROLE = "user" — check for a pending or accepted invite ───────────────
  if (role === "user" && userEmail) {
    const invite = await prisma.shopInvite.findFirst({
      where:   { email: userEmail },
      select:  { accepted: true, shopId: true, shop: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });

    if (invite) {
      if (invite.accepted) {
        // Profile was never updated — fix it now, then route to shop
        await prisma.profile.update({
          where: { userId },
          data:  { role: "staff", shopId: invite.shopId },
        });
        const shop = await prisma.shop.findUnique({
          where:  { id: invite.shopId },
          select: {
            name: true,
            user: { select: { subscription: { select: { plan: true, expiresAt: true } } } },
          },
        });
        const sub    = shop?.user?.subscription;
        const active = planActive(sub?.plan ?? "demo", sub?.expiresAt);
        if (!active) {
          const reason: "demo" | "expired" = sub?.plan === "demo_plus" ? "expired" : "demo";
          return (
            <SuspendedPage
              shopName={shop?.name ?? "Your shop"}
              userName={userName}
              reason={reason}
            />
          );
        }
        return <SessionRefresher target={`/${invite.shopId}/dashboard`} />;
      }

      // Invite not yet accepted — mark as staff, show "check your email"
      await prisma.profile.update({ where: { userId }, data: { role: "staff" } });
      return <PendingInvitePage userName={userName} shopName={invite.shop.name} />;
    }
  }

  // ── OWNER / ADMIN / NEW USER ──────────────────────────────────────────────

  const isOwner   = role === "owner";
  const isAdmin   = role === "admin";
  const canManage = isOwner || isAdmin || role === "user";

  // Load shops for the management UI
  let shops: { id: string; name: string; tel: string; location: string }[] = [];

  if (isOwner) {
    shops = await prisma.shop.findMany({
      where:   { userId },
      select:  { id: true, name: true, tel: true, location: true },
      orderBy: { createdAt: "asc" },
    });
  } else if (isAdmin && profile.shopId) {
    const s = await prisma.shop.findUnique({
      where:  { id: profile.shopId },
      select: { id: true, name: true, tel: true, location: true },
    });
    if (s) shops = [s];
  }

  // Plan badge info for the welcome UI — always read from DB so it's never stale
  let plan: string               = "demo";
  let planExpiry: string | undefined;

  if (isOwner) {
    const sub = await prisma.userSubscription.findUnique({
      where:  { userId },
      select: { plan: true, expiresAt: true },
    });
    plan       = sub?.plan                      ?? "demo";
    planExpiry = sub?.expiresAt?.toISOString()  ?? undefined;
  } else if (isAdmin && profile.shopId) {
    const s = await prisma.shop.findUnique({
      where:  { id: profile.shopId },
      select: { user: { select: { subscription: { select: { plan: true, expiresAt: true } } } } },
    });
    plan       = s?.user?.subscription?.plan                      ?? "demo";
    planExpiry = s?.user?.subscription?.expiresAt?.toISOString()  ?? undefined;
  }

  return (
    <ShopSelectClient
      shops={shops}
      canManage={canManage}
      userName={userName}
      plan={plan}
      planExpiry={planExpiry}
      isSystemAdmin={profile?.isSystemAdmin ?? false}
    />
  );
}
