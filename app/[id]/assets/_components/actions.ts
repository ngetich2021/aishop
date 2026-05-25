"use server";

import prisma from "@/lib/prisma";
import { bustShop } from "@/lib/shop-cache";
import { planGuardCreate, planGuardMutate } from "@/lib/plan-guard";

export type ActionResult = { success: boolean; error?: string };

export async function createAssetAction(
  shopId: string,
  data: { itemName: string; cost: number; imageUrl?: string }
): Promise<ActionResult> {
  const guard = await planGuardCreate(shopId, "assets");
  if (!guard.ok) return { success: false, error: guard.error };

  const profile = await prisma.profile.findUnique({
    where:  { userId: guard.userId },
    select: { role: true },
  });
  const role = profile?.role?.toLowerCase().trim();
  if (role !== "admin" && role !== "owner" && role !== "manager")
    return { success: false, error: "Only managers can add assets." };

  if (!data.itemName?.trim()) return { success: false, error: "Asset name required." };
  if (data.cost < 0) return { success: false, error: "Cost cannot be negative." };

  try {
    await prisma.asset.create({
      data: {
        shopId,
        itemName: data.itemName.trim(),
        cost:     data.cost,
        imageUrl: data.imageUrl?.trim() || null,
      },
    });
    bustShop(shopId);
    return { success: true };
  } catch {
    return { success: false, error: "Failed to add asset." };
  }
}

export async function updateAssetAction(
  id: string,
  data: { itemName: string; cost: number; imageUrl?: string }
): Promise<ActionResult> {
  const asset = await prisma.asset.findUnique({ where: { id }, select: { shopId: true } });
  if (!asset) return { success: false, error: "Asset not found." };

  const guard = await planGuardMutate(asset.shopId);
  if (!guard.ok) return { success: false, error: guard.error };

  const profile = await prisma.profile.findUnique({
    where:  { userId: guard.userId },
    select: { role: true },
  });
  const role = profile?.role?.toLowerCase().trim();
  if (role !== "admin" && role !== "owner" && role !== "manager")
    return { success: false, error: "Only managers can edit assets." };

  try {
    await prisma.asset.update({
      where: { id },
      data: {
        itemName: data.itemName.trim(),
        cost:     data.cost,
        imageUrl: data.imageUrl?.trim() || null,
      },
    });
    bustShop(asset.shopId);
    return { success: true };
  } catch {
    return { success: false, error: "Update failed." };
  }
}

export async function deleteAssetAction(id: string): Promise<ActionResult> {
  const asset = await prisma.asset.findUnique({ where: { id }, select: { shopId: true } });
  if (!asset) return { success: false, error: "Asset not found." };

  const guard = await planGuardMutate(asset.shopId);
  if (!guard.ok) return { success: false, error: guard.error };

  const profile = await prisma.profile.findUnique({
    where:  { userId: guard.userId },
    select: { role: true },
  });
  const role = profile?.role?.toLowerCase().trim();
  if (role !== "admin" && role !== "owner")
    return { success: false, error: "Only admins can delete assets." };

  try {
    await prisma.asset.delete({ where: { id } });
    bustShop(asset.shopId);
    return { success: true };
  } catch {
    return { success: false, error: "Delete failed." };
  }
}
