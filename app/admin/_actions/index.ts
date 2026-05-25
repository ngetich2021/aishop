"use server";

import { auth }         from "@/auth";
import prisma           from "@/lib/prisma";
import { revalidatePath } from "next/cache";

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

export async function updateUserPlan(userId: string, plan: string) {
  await requireAdmin();
  await prisma.userSubscription.update({
    where: { userId },
    data:  { plan },
  });
  revalidatePath("/admin");
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function addProBalance(userId: string, amount: number) {
  await requireAdmin();
  await prisma.userSubscription.update({
    where:  { userId },
    data:   { proBalance: { increment: amount } },
  });
  revalidatePath("/admin");
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function updateUserRole(userId: string, role: string) {
  await requireAdmin();
  await prisma.profile.update({
    where: { userId },
    data:  { role },
  });
  revalidatePath("/admin");
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function suspendShop(shopId: string) {
  await requireAdmin();
  await (prisma.shopBilling as any).update({
    where: { shopId },
    data:  { status: "suspended" },
  });
  revalidatePath("/admin");
  revalidatePath("/admin/shops");
  return { ok: true };
}

export async function unsuspendShop(shopId: string) {
  await requireAdmin();
  await (prisma.shopBilling as any).update({
    where: { shopId },
    data:  { status: "active" },
  });
  revalidatePath("/admin");
  revalidatePath("/admin/shops");
  return { ok: true };
}

export async function markCallbackProcessed(id: string) {
  await requireAdmin();
  await prisma.mpesaCallback.update({
    where: { id },
    data:  { processed: true },
  });
  revalidatePath("/admin/payments");
  return { ok: true };
}
