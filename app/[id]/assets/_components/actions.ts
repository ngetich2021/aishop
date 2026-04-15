"use server";

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export type ActionResult = { success: boolean; error?: string };

export async function createAssetAction(
  shopId: string,
  data: { itemName: string; cost: number; imageUrl?: string }
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  const profile = await prisma.profile.findUnique({
    where:  { userId: session.user.id },
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
    revalidatePath(`/${shopId}/assets`, "page");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to add asset." };
  }
}

export async function updateAssetAction(
  id: string,
  data: { itemName: string; cost: number; imageUrl?: string }
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  const profile = await prisma.profile.findUnique({
    where:  { userId: session.user.id },
    select: { role: true },
  });
  const role = profile?.role?.toLowerCase().trim();
  if (role !== "admin" && role !== "owner" && role !== "manager")
    return { success: false, error: "Only managers can edit assets." };

  try {
    const asset = await prisma.asset.findUnique({ where: { id }, select: { shopId: true } });
    await prisma.asset.update({
      where: { id },
      data: {
        itemName: data.itemName.trim(),
        cost:     data.cost,
        imageUrl: data.imageUrl?.trim() || null,
      },
    });
    if (asset?.shopId) revalidatePath(`/${asset.shopId}/assets`, "page");
    return { success: true };
  } catch {
    return { success: false, error: "Update failed." };
  }
}

export async function deleteAssetAction(id: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  const profile = await prisma.profile.findUnique({
    where:  { userId: session.user.id },
    select: { role: true },
  });
  const role = profile?.role?.toLowerCase().trim();
  if (role !== "admin" && role !== "owner")
    return { success: false, error: "Only admins can delete assets." };

  try {
    const asset = await prisma.asset.findUnique({ where: { id }, select: { shopId: true } });
    await prisma.asset.delete({ where: { id } });
    if (asset?.shopId) revalidatePath(`/${asset.shopId}/assets`, "page");
    return { success: true };
  } catch {
    return { success: false, error: "Delete failed." };
  }
}
