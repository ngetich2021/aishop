"use server";

import prisma from "@/lib/prisma";
import { bustShop } from "@/lib/shop-cache";
import { planGuardCreate, planGuardMutate } from "@/lib/plan-guard";

export type ActionResult = { success: boolean; error?: string };

export async function createMarginAction(
  shopId: string,
  data: { value: number; profitType?: string; date?: string }
): Promise<ActionResult> {
  const guard = await planGuardCreate(shopId, "margins");
  if (!guard.ok) return { success: false, error: guard.error };

  const profile = await prisma.profile.findUnique({
    where:  { userId: guard.userId },
    select: { role: true },
  });
  const role = profile?.role?.toLowerCase().trim();
  if (role !== "admin" && role !== "owner" && role !== "manager")
    return { success: false, error: "Only managers can record margins." };

  if (data.value === undefined) return { success: false, error: "Margin value required." };

  try {
    await prisma.margin.create({
      data: {
        shopId,
        value:      data.value,
        profitType: data.profitType?.trim() || null,
        date:       data.date ? new Date(`${data.date}T00:00:00.000Z`) : new Date(),
      },
    });
    bustShop(shopId);
    bustShop(shopId);
    return { success: true };
  } catch {
    return { success: false, error: "Failed to record margin." };
  }
}

export async function deleteMarginAction(id: string): Promise<ActionResult> {
  const margin = await prisma.margin.findUnique({ where: { id }, select: { shopId: true } });
  if (!margin) return { success: false, error: "Margin not found." };

  const guard = await planGuardMutate(margin.shopId);
  if (!guard.ok) return { success: false, error: guard.error };

  const profile = await prisma.profile.findUnique({
    where:  { userId: guard.userId },
    select: { role: true },
  });
  const role = profile?.role?.toLowerCase().trim();
  if (role !== "admin" && role !== "owner")
    return { success: false, error: "Only admins can delete margin records." };

  try {
    await prisma.margin.delete({ where: { id } });
    bustShop(margin.shopId);
    return { success: true };
  } catch {
    return { success: false, error: "Delete failed." };
  }
}
