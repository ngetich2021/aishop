import { redirect }     from "next/navigation";
import { auth }         from "@/auth";
import prisma           from "@/lib/prisma";
import ShopSelectClient from "./_components/ShopSelectClient";

export default async function WelcomePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const userId   = session.user.id;
  const userName = session.user.name ?? session.user.email ?? "there";

  const profile = await prisma.profile.findUnique({
    where:  { userId },
    select: { role: true, shopId: true, allowedRoutes: true },
  });

  // No profile = orphaned account → sign out
  if (!profile) redirect("/api/auth/signout-pending");

  const role      = profile.role.toLowerCase().trim();
  const isOwner   = role === "owner";
  const isAdmin   = role === "admin";
  const canManage = isOwner || isAdmin;

  // role="user" → pending (account not yet assigned)
  if (role === "user") redirect("/api/auth/signout-pending");

  // staff / manager with no shop assigned yet → pending
  if (!canManage && !profile.shopId) redirect("/api/auth/signout-pending");

  // staff with no allowedRoutes → pending (admin hasn't granted access yet)
  if (!canManage && (!profile.allowedRoutes || profile.allowedRoutes.length === 0)) {
    redirect("/api/auth/signout-pending");
  }

  // staff / manager with shopId + allowedRoutes → go directly to their shop dashboard
  if (!canManage && profile.shopId) {
    redirect(`/${profile.shopId}/dashboard`);
  }

  // ── Below here: owner or admin only ──────────────────────────────────────
  let shops: { id: string; name: string; tel: string; location: string }[] = [];

  if (isOwner) {
    shops = await prisma.shop.findMany({
      where:   { userId },
      select:  { id: true, name: true, tel: true, location: true },
      orderBy: { createdAt: "asc" },
    });
  } else {
    // Admin: only their assigned shop
    if (profile.shopId) {
      const shop = await prisma.shop.findUnique({
        where:  { id: profile.shopId },
        select: { id: true, name: true, tel: true, location: true },
      });
      if (shop) shops = [shop];
    }
  }

  return (
    <ShopSelectClient
      shops={shops}
      canManage={canManage}
      userName={userName}
    />
  );
}
