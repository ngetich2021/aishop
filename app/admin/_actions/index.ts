"use server";

import { auth }                      from "@/auth";
import prisma                         from "@/lib/prisma";
import { revalidateTag }              from "next/cache";
import { ADMIN_TAG }                  from "@/app/admin/_lib/cache";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  const profile = await prisma.profile.findUnique({
    where:  { userId: session.user.id },
    select: { isSystemAdmin: true },
  });
  if (!profile?.isSystemAdmin) throw new Error("Not authorized");
  return session.user.id;
}

/** Bust all admin caches at once. */
function bust() { revalidateTag(ADMIN_TAG, "default"); }

export async function updateUserPlan(userId: string, plan: string) {
  await requireAdmin();
  await prisma.userSubscription.update({ where: { userId }, data: { plan } });
  bust();
  return { ok: true };
}

export async function addProBalance(userId: string, amount: number) {
  await requireAdmin();
  await prisma.userSubscription.update({
    where: { userId },
    data:  { proBalance: { increment: amount } },
  });
  bust();
  return { ok: true };
}

export async function updateUserRole(userId: string, role: string) {
  await requireAdmin();
  await prisma.profile.update({ where: { userId }, data: { role } });
  bust();
  return { ok: true };
}

export async function suspendShop(shopId: string) {
  await requireAdmin();
  await (prisma.shopBilling as any).update({
    where: { shopId },
    data:  { status: "suspended" },
  });
  bust();
  return { ok: true };
}

export async function unsuspendShop(shopId: string) {
  await requireAdmin();
  await (prisma.shopBilling as any).update({
    where: { shopId },
    data:  { status: "active" },
  });
  bust();
  return { ok: true };
}

export async function markCallbackProcessed(id: string) {
  await requireAdmin();
  await prisma.mpesaCallback.update({ where: { id }, data: { processed: true } });
  bust();
  return { ok: true };
}
