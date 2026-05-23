"use server";

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { walletDeduct } from "@/lib/actions";
import { planGuardCreate, planGuardMutate } from "@/lib/plan-guard";

export type ActionResult = { success: boolean; error?: string };

export type BuyItem = { name: string; qty: number; price: number };

export async function createBuyAction(
  shopId: string,
  data: {
    supplierId:    string;
    items:         BuyItem[];
    transportCost: number;
    authorizedBy?: string;
  }
): Promise<ActionResult> {
  const guard = await planGuardCreate(shopId, "buys");
  if (!guard.ok) return { success: false, error: guard.error };

  const [profile, user] = await Promise.all([
    prisma.profile.findUnique({ where: { userId: guard.userId }, select: { fullName: true } }),
    prisma.user.findUnique({ where: { id: guard.userId }, select: { name: true, email: true } }),
  ]);

  if (!data.supplierId) return { success: false, error: "Supplier required." };
  if (!data.items || data.items.length === 0) return { success: false, error: "At least one item required." };

  const totalAmount   = data.items.reduce((s, i) => s + i.qty * i.price, 0);
  const resolvedActor = data.authorizedBy?.trim() ||
    profile?.fullName?.trim() || user?.name?.trim() || user?.email?.trim() || "System";

  try {
    await prisma.buy.create({
      data: {
        shopId,
        supplierId:    data.supplierId,
        itemsJson:     JSON.stringify(data.items),
        totalAmount,
        transportCost: data.transportCost ?? 0,
        status:        "pending",
        authorizedBy:  resolvedActor,
      },
    });
    revalidatePath(`/${shopId}/buy`, "page");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to create purchase order." };
  }
}

export async function updateBuyStatusAction(
  id: string,
  status: "pending" | "received" | "cancelled"
): Promise<ActionResult> {
  const buy = await prisma.buy.findUnique({
    where:  { id },
    select: { shopId: true, totalAmount: true, transportCost: true, authorizedBy: true, itemsJson: true, status: true, supplier: { select: { name: true } } },
  });
  if (!buy) return { success: false, error: "Purchase order not found." };

  const guard = await planGuardMutate(buy.shopId);
  if (!guard.ok) return { success: false, error: guard.error };

  const profile = await prisma.profile.findUnique({
    where:  { userId: guard.userId },
    select: { fullName: true },
  });

  try {
    if (status === "received" && buy.status !== "received") {
      const grandTotal = buy.totalAmount + buy.transportCost;
      const items = JSON.parse(buy.itemsJson) as BuyItem[];
      const actorName = profile?.fullName ?? guard.userId;

      await prisma.$transaction(async tx => {
        await walletDeduct(tx, {
          shopId:       buy.shopId,
          amount:       grandTotal,
          type:         "buy",
          name:         `Purchase from ${buy.supplier?.name ?? "supplier"}`,
          authorizedBy: buy.authorizedBy ?? actorName,
        });

        for (const item of items) {
          if (!item.name?.trim()) continue;
          const product = await tx.product.findFirst({
            where: {
              shopId:      buy.shopId,
              productName: item.name.trim(),
            },
            select: { id: true },
          });
          if (product) {
            await tx.product.update({
              where: { id: product.id },
              data:  { quantity: { increment: item.qty }, buyingPrice: item.price },
            });
          }
        }

        await tx.buy.update({ where: { id }, data: { status } });
      });
    } else {
      await prisma.buy.update({ where: { id }, data: { status } });
    }

    revalidatePath(`/${buy.shopId}/buy`, "page");
    return { success: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Update failed.";
    return { success: false, error: msg };
  }
}

export async function deleteBuyAction(id: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  const buy = await prisma.buy.findUnique({ where: { id }, select: { shopId: true } });
  if (!buy) return { success: false, error: "Purchase order not found." };

  const guard = await planGuardMutate(buy.shopId);
  if (!guard.ok) return { success: false, error: guard.error };

  const profile = await prisma.profile.findUnique({
    where:  { userId: guard.userId },
    select: { role: true },
  });
  const role = profile?.role?.toLowerCase().trim();
  if (role !== "admin" && role !== "owner")
    return { success: false, error: "Only admins can delete purchase orders." };

  try {
    await prisma.buy.delete({ where: { id } });
    revalidatePath(`/${buy.shopId}/buy`, "page");
    return { success: true };
  } catch {
    return { success: false, error: "Delete failed." };
  }
}
