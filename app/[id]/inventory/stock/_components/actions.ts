"use server";

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { bustShop } from "@/lib/shop-cache";
import * as z from "zod";
import { planGuardCreate, planGuardMutate } from "@/lib/plan-guard";

export type ActionResult = { success: boolean; error?: string };

const adjustSchema = z.object({
  productId:  z.string().min(1, "Product required"),
  adjustType: z.enum(["increase", "decrease", "set"]),
  quantity:   z.number().min(0, "Quantity must be 0 or more"),
  shopId:     z.string().min(1, "Shop required"),
});

async function getCtx() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const profile = await prisma.profile.findUnique({
    where:  { userId: session.user.id },
    select: { role: true, shopId: true, fullName: true },
  });
  const role        = (profile?.role ?? "owner").toLowerCase().trim();
  const isOwner     = role === "owner";
  const displayName = profile?.fullName?.trim() || session.user.name?.trim() || "Unknown";
  return { userId: session.user.id, isOwner, profile, displayName };
}

export async function saveAdjustmentAction(
  _: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const formShopId = formData.get("shopId")?.toString() ?? "";
  const ctx        = await getCtx();
  if (!ctx) return { success: false, error: "Unauthorized" };
  const { userId, isOwner, profile, displayName } = ctx;

  // Staff: always use their assigned shop; owner: use form shopId
  const resolvedShopId = isOwner ? formShopId : (profile?.shopId ?? "");
  if (!resolvedShopId)
    return { success: false, error: "No shop assigned. Contact your administrator." };

  const guard = await planGuardCreate(resolvedShopId, "adjustments");
  if (!guard.ok) return { success: false, error: guard.error };

  const adjustedBy = displayName;

  const raw = {
    productId:  formData.get("productId")?.toString()  ?? "",
    adjustType: formData.get("adjustType")?.toString() ?? "increase",
    quantity:   Number(formData.get("quantity") || 0),
    shopId:     resolvedShopId,
  };

  try {
    const v = adjustSchema.parse(raw);

    const product = await prisma.product.findUnique({
      where:  { id: v.productId },
      select: { quantity: true, sellingPrice: true, shopId: true },
    });
    if (!product) return { success: false, error: "Product not found" };
    if (product.shopId !== v.shopId)
      return { success: false, error: "Product does not belong to the selected shop" };

    if (isOwner) {
      const owned = await prisma.shop.findUnique({ where: { id: v.shopId }, select: { userId: true } });
      if (!owned || owned.userId !== userId)
        return { success: false, error: "Not authorised for this shop" };
    }

    const originalStock = product.quantity;
    const newStockQty =
      v.adjustType === "increase" ? originalStock + v.quantity
      : v.adjustType === "decrease" ? Math.max(0, originalStock - v.quantity)
      : v.quantity;

    const value = (product.sellingPrice ?? 0) * v.quantity;

    await prisma.$transaction([
      prisma.adjustment.create({
        data: {
          productId:  v.productId,
          adjustType: v.adjustType,
          quantity:   v.quantity,
          shopId:     v.shopId,
          originalStock,
          newStockQty,
          value,
          adjustedBy,
        },
      }),
      prisma.product.update({
        where: { id: v.productId },
        data:  { quantity: newStockQty },
      }),
    ]);

    bustShop(v.shopId);
    bustShop(v.shopId);
    return { success: true };
  } catch (err) {
    if (err instanceof z.ZodError)
      return { success: false, error: err.issues[0]?.message ?? "Validation failed" };
    console.error("[saveAdjustmentAction]", err);
    return { success: false, error: "Adjustment failed" };
  }
}

export async function deleteAdjustmentAction(id: string, shopId: string): Promise<ActionResult> {
  const guard = await planGuardMutate(shopId);
  if (!guard.ok) return { success: false, error: guard.error };

  const ctx = await getCtx();
  if (!ctx) return { success: false, error: "Unauthorized" };
  const { userId, isOwner } = ctx;

  if (!isOwner) return { success: false, error: "Only owners can delete adjustments" };

  try {
    const existing = await prisma.adjustment.findUnique({
      where:  { id },
      select: { shop: { select: { userId: true } } },
    });
    if (!existing) return { success: false, error: "Adjustment not found" };
    if (existing.shop.userId !== userId)
      return { success: false, error: "Not authorised to delete this adjustment" };

    await prisma.adjustment.delete({ where: { id } });
    bustShop(shopId);
    return { success: true };
  } catch {
    return { success: false, error: "Delete failed" };
  }
}
