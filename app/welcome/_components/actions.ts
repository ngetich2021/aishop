"use server";

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { chargeShopCreation } from "@/lib/pro-billing";
import { DAILY_RATE } from "@/lib/billing-constants";

export async function saveShopAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" };

  const userId = session.user.id;
  const shopId = formData.get("shopId")?.toString() || null;

  const name     = formData.get("name")?.toString().trim() ?? "";
  const tel      = formData.get("tel")?.toString().trim() ?? "";
  const location = formData.get("location")?.toString().trim() ?? "";

  if (!name || !tel || !location) {
    return { error: "Name, telephone and location are required." };
  }

  // Fetch profile, subscription, and current shop count in parallel
  const [profile, sub, existingShopCount] = await Promise.all([
    prisma.profile.findUnique({ where: { userId }, select: { role: true } }),
    (prisma.userSubscription as unknown as {
      findUnique: (args: unknown) => Promise<{ id: string; plan: string } | null>
    }).findUnique({
      where:  { userId },
      select: { id: true, plan: true },
    }),
    shopId ? Promise.resolve(0) : prisma.shop.count({ where: { userId } }),
  ]);

  const role = profile?.role?.toLowerCase().trim() ?? "user";
  const plan = sub?.plan ?? "demo";

  if (shopId && role !== "owner") return { error: "Only owners can manage shops." };
  if (!shopId && role !== "owner" && role !== "user") return { error: "Only owners can create shops." };

  // ── 1-shop limit for demo / demo+ ───────────────────────────────────────────
  if (!shopId && (plan === "demo" || plan === "demo_plus") && existingShopCount >= 1) {
    return {
      error: "Demo plans support only 1 shop. Upgrade to Pro at /billing to create multiple shops.",
    };
  }

  try {
    if (shopId) {
      // ── Edit existing shop ──────────────────────────────────────────────────
      const existing = await prisma.shop.findUnique({ where: { id: shopId }, select: { userId: true } });
      if (!existing) return { error: "Shop not found." };
      if (existing.userId !== userId) return { error: "You can only edit your own shop." };
      await prisma.shop.update({ where: { id: shopId }, data: { name, tel, location } });
      revalidatePath("/welcome");
      return { success: true };
    }

    if (plan === "pro" && sub) {
      // ── Pro: charge KES 5 creation fee, create ShopBilling ─────────────────
      const fee = await chargeShopCreation(sub.id);
      if (!fee.ok) return { error: fee.error };

      let newShopId = "";
      await prisma.$transaction(async (tx) => {
        const shop = await tx.shop.create({ data: { name, tel, location, userId } });
        newShopId = shop.id;

        await tx.wallet.create({ data: { shopId: shop.id, balance: 0 } });

        await tx.profile.upsert({
          where:  { userId },
          update: { role: "owner" },
          create: { userId, role: "owner", email: null },
        });

        await (tx.shopBilling as unknown as {
          create: (args: unknown) => Promise<unknown>
        }).create({
          data: { shopId: shop.id, dailyRate: DAILY_RATE, status: "active" },
        });
      });

      revalidatePath("/welcome");
      revalidatePath(`/${newShopId}/shop`);
      return { success: true, shopId: newShopId };
    }

    // ── Demo / Demo+: first shop free — reset demo clock ───────────────────
    let newShopId = "";
    await prisma.$transaction(async (tx) => {
      const shop = await tx.shop.create({ data: { name, tel, location, userId } });
      newShopId = shop.id;

      await tx.wallet.create({ data: { shopId: shop.id, balance: 0 } });

      await tx.profile.upsert({
        where:  { userId },
        update: { role: "owner" },
        create: { userId, role: "owner", email: null },
      });

      await tx.userSubscription.upsert({
        where:  { userId },
        update: { demoStartedAt: new Date() },
        create: { userId, plan: "demo", status: "active", demoStartedAt: new Date() },
      });
    });

    revalidatePath("/welcome");
    revalidatePath(`/${newShopId}/shop`);
    return { success: true, shopId: newShopId };
  } catch (err) {
    console.error("saveShopAction error:", err);
    return { error: shopId ? "Failed to update shop." : "Failed to create shop." };
  }
}

export async function deleteShopAction(shopId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const userId = session.user.id;

  const profile = await prisma.profile.findUnique({
    where:  { userId },
    select: { role: true },
  });
  if (profile?.role?.toLowerCase().trim() !== "owner") {
    throw new Error("Only owners can delete shops.");
  }

  const shop = await prisma.shop.findUnique({ where: { id: shopId }, select: { userId: true } });
  if (!shop) throw new Error("Shop not found.");
  if (shop.userId !== userId) throw new Error("You can only delete your own shop.");

  await prisma.shop.delete({ where: { id: shopId } });
  revalidatePath("/welcome");
  revalidatePath(`/${userId}/shop`);
}
