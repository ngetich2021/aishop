"use server";

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export type ActionResult = { success: boolean; error?: string };

type ReturnLineItem = {
  productId: string;
  quantity:  number;
  price:     number;
  reason?:   string;
};

async function getCtx() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const profile = await prisma.profile.findUnique({
    where:  { userId: session.user.id },
    select: { role: true, shopId: true, fullName: true },
  });
  const isOwner = (profile?.role ?? "owner").toLowerCase().trim() === "owner";
  return { userId: session.user.id, isOwner, profile };
}

function invalidate(shopId: string) {
  revalidatePath(`/${shopId}/inventory/stock`);
  revalidatePath(`/${shopId}/inventory/products`);
}

// ── CREATE RETURN ─────────────────────────────────────────────────────────────
export async function saveReturnAction(
  _: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const ctx = await getCtx();
  if (!ctx) return { success: false, error: "Unauthorized" };
  const { userId, isOwner, profile } = ctx;

  const formShopId = formData.get("shopId")?.toString() ?? "";
  const shopId     = isOwner ? formShopId : (profile?.shopId ?? "");

  if (!shopId) return { success: false, error: "No shop assigned" };

  // Verify shop access for owner
  if (isOwner) {
    const owned = await prisma.shop.findUnique({ where: { id: shopId }, select: { userId: true } });
    if (!owned || owned.userId !== userId)
      return { success: false, error: "Not authorised for this shop" };
  }

  const saleId = formData.get("saleId")?.toString() || null;
  const reason = formData.get("reason")?.toString()  || null;

  let items: ReturnLineItem[] = [];
  try {
    items = JSON.parse(formData.get("items")?.toString() ?? "[]") as ReturnLineItem[];
  } catch {
    return { success: false, error: "Invalid items payload" };
  }

  if (!items.length) return { success: false, error: "At least one return item required" };
  if (items.some((i) => !i.productId || i.quantity < 1))
    return { success: false, error: "Each item needs a product and quantity ≥ 1" };

  // Verify all products belong to this shop
  for (const item of items) {
    const p = await prisma.product.findUnique({ where: { id: item.productId }, select: { shopId: true } });
    if (!p || p.shopId !== shopId)
      return { success: false, error: `Product ${item.productId} not found in this shop` };
  }

  try {
    // Create return + items + restore stock in one transaction
    await prisma.$transaction(async (tx) => {
      const ret = await tx.return.create({
        data: {
          shopId,
          saleId,
          reason,
          returnedById: userId,
          status: "pending",
          returnItems: {
            create: items.map((i) => ({
              productId: i.productId,
              quantity:  i.quantity,
              price:     i.price,
              reason:    i.reason ?? null,
            })),
          },
        },
      });

      // Restore stock for each returned item
      for (const item of items) {
        await tx.product.update({
          where: { id: item.productId },
          data:  { quantity: { increment: item.quantity } },
        });
        // Log an adjustment record for traceability
        const product = await tx.product.findUnique({
          where:  { id: item.productId },
          select: { quantity: true, sellingPrice: true },
        });
        await tx.adjustment.create({
          data: {
            shopId,
            productId:    item.productId,
            adjustType:   "increase",
            quantity:     item.quantity,
            originalStock: (product?.quantity ?? item.quantity) - item.quantity,
            newStockQty:   product?.quantity ?? item.quantity,
            value:         (product?.sellingPrice ?? item.price) * item.quantity,
            adjustedBy:    `Return #${ret.id.slice(0, 8)}`,
          },
        });
      }
    });

    invalidate(shopId);
    return { success: true };
  } catch (err) {
    console.error("[saveReturnAction]", err);
    return { success: false, error: "Failed to save return" };
  }
}

// ── DELETE RETURN (reverses stock) ────────────────────────────────────────────
export async function deleteReturnAction(id: string): Promise<ActionResult> {
  const ctx = await getCtx();
  if (!ctx) return { success: false, error: "Unauthorized" };
  const { userId, isOwner } = ctx;

  if (!isOwner) return { success: false, error: "Only owners can delete returns" };

  try {
    const ret = await prisma.return.findUnique({
      where:   { id },
      include: {
        returnItems: { select: { productId: true, quantity: true } },
        shop:        { select: { userId: true } },
      },
    });
    if (!ret) return { success: false, error: "Return not found" };
    if (ret.shop.userId !== userId) return { success: false, error: "Not authorised" };

    await prisma.$transaction(async (tx) => {
      // Reverse stock
      for (const item of ret.returnItems) {
        await tx.product.update({
          where: { id: item.productId },
          data:  { quantity: { decrement: item.quantity } },
        });
      }
      await tx.return.delete({ where: { id } });
    });

    invalidate(ret.shopId);
    return { success: true };
  } catch (err) {
    console.error("[deleteReturnAction]", err);
    return { success: false, error: "Delete failed" };
  }
}

// ── UPDATE STATUS ─────────────────────────────────────────────────────────────
export async function updateReturnStatusAction(
  id: string,
  status: string
): Promise<ActionResult> {
  const ctx = await getCtx();
  if (!ctx) return { success: false, error: "Unauthorized" };
  const { userId, isOwner } = ctx;

  if (!isOwner) return { success: false, error: "Only owners can update return status" };

  const allowed = ["pending", "approved", "rejected"];
  if (!allowed.includes(status)) return { success: false, error: "Invalid status" };

  try {
    const ret = await prisma.return.findUnique({
      where:  { id },
      select: { shopId: true, shop: { select: { userId: true } } },
    });
    if (!ret) return { success: false, error: "Return not found" };
    if (ret.shop.userId !== userId) return { success: false, error: "Not authorised" };

    await prisma.return.update({ where: { id }, data: { status } });
    invalidate(ret.shopId);
    return { success: true };
  } catch {
    return { success: false, error: "Status update failed" };
  }
}
