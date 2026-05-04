"use server";

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { chargeShopCreation } from "@/lib/pro-billing";
import { DAILY_RATE } from "@/lib/billing-constants";

function isOwner(role: string) {
  return role.toLowerCase().trim() === "owner";
}

export async function saveShopAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" };

  const userId = session.user.id;

  const profile = await prisma.profile.findUnique({
    where:  { userId },
    select: { role: true },
  });

  if (!isOwner(profile?.role ?? "")) {
    return { error: "Only owners can manage shops." };
  }

  const shopId   = formData.get("shopId")?.toString() || null;
  const name     = formData.get("name")?.toString().trim() ?? "";
  const tel      = formData.get("tel")?.toString().trim() ?? "";
  const location = formData.get("location")?.toString().trim() ?? "";

  if (!name || !tel || !location) {
    return { error: "Name, telephone and location are required." };
  }

  try {
    if (shopId) {
      // ── Edit existing shop ─────────────────────────────────────────────────
      const existing = await prisma.shop.findUnique({ where: { id: shopId }, select: { userId: true } });
      if (!existing) return { error: "Shop not found." };
      if (existing.userId !== userId) return { error: "You can only edit your own shop." };
      await prisma.shop.update({ where: { id: shopId }, data: { name, tel, location } });
      revalidatePath(`/${userId}/shop`);
      return { success: true };
    }

    // ── Creating a new shop ────────────────────────────────────────────────
    const [sub, existingShopCount] = await Promise.all([
      (prisma.userSubscription as unknown as {
        findUnique: (args: unknown) => Promise<{ id: string; plan: string } | null>
      }).findUnique({
        where:  { userId },
        select: { id: true, plan: true },
      }),
      prisma.shop.count({ where: { userId } }),
    ]);

    const plan = sub?.plan ?? "demo";

    // ── 1-shop limit for demo / demo+ ──────────────────────────────────────
    if ((plan === "demo" || plan === "demo_plus") && existingShopCount >= 1) {
      return {
        error: "Demo plans support only 1 shop. Upgrade to Pro at /billing to create multiple shops.",
      };
    }

    if (plan === "pro" && sub) {
      // ── Pro: charge KES 5 creation fee from proBalance ─────────────────────
      const fee = await chargeShopCreation(sub.id);
      if (!fee.ok) return { error: fee.error };

      let newShopId = "";
      await prisma.$transaction(async (tx) => {
        const shop = await tx.shop.create({ data: { name, tel, location, userId } });
        newShopId = shop.id;

        await tx.wallet.create({ data: { shopId: shop.id, balance: 0 } });

        await (tx.shopBilling as unknown as {
          create: (args: unknown) => Promise<unknown>
        }).create({
          data: { shopId: shop.id, dailyRate: DAILY_RATE, status: "active" },
        });
      });

      revalidatePath(`/${userId}/shop`);
      return { success: true, shopId: newShopId };
    }

    // ── Demo / Demo+: first shop (no charge) ──────────────────────────────
    let newShopId = "";
    await prisma.$transaction(async (tx) => {
      const shop = await tx.shop.create({ data: { name, tel, location, userId } });
      newShopId = shop.id;
      await tx.wallet.create({ data: { shopId: shop.id, balance: 0 } });
    });

    revalidatePath(`/${userId}/shop`);
    return { success: true, shopId: newShopId };
  } catch (err) {
    console.error("saveShopAction error:", err);
    return { error: shopId ? "Failed to update shop." : "Failed to add shop." };
  }
}

export async function deleteShopAction(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const userId = session.user.id;

  const profile = await prisma.profile.findUnique({ where: { userId }, select: { role: true } });
  if (!isOwner(profile?.role ?? "")) throw new Error("Only owners can delete shops.");

  const shop = await prisma.shop.findUnique({ where: { id }, select: { userId: true } });
  if (!shop) throw new Error("Shop not found.");
  if (shop.userId !== userId) throw new Error("You can only delete your own shop.");

  await prisma.shop.delete({ where: { id } });
  revalidatePath(`/${userId}/shop`);
}
