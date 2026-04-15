"use server";

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { walletDeduct } from "@/lib/actions";

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
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  const profile = await prisma.profile.findUnique({
    where:  { userId: session.user.id },
    select: { role: true, fullName: true },
  });
  const role = profile?.role?.toLowerCase().trim();
  if (role !== "admin" && role !== "owner" && role !== "manager")
    return { success: false, error: "Only managers can create purchase orders." };

  if (!data.supplierId) return { success: false, error: "Supplier required." };
  if (!data.items || data.items.length === 0) return { success: false, error: "At least one item required." };

  const totalAmount = data.items.reduce((s, i) => s + i.qty * i.price, 0);

  try {
    await prisma.buy.create({
      data: {
        shopId,
        supplierId:    data.supplierId,
        itemsJson:     JSON.stringify(data.items),
        totalAmount,
        transportCost: data.transportCost ?? 0,
        status:        "pending",
        authorizedBy:  data.authorizedBy ?? profile?.fullName ?? session.user.id,
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
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  const profile = await prisma.profile.findUnique({
    where:  { userId: session.user.id },
    select: { role: true, fullName: true },
  });
  const role = profile?.role?.toLowerCase().trim();
  if (role !== "admin" && role !== "owner" && role !== "manager")
    return { success: false, error: "Only managers can update purchase orders." };

  try {
    const buy = await prisma.buy.findUnique({
      where:  { id },
      select: { shopId: true, totalAmount: true, transportCost: true, authorizedBy: true, itemsJson: true, status: true, supplier: { select: { name: true } } },
    });
    if (!buy) return { success: false, error: "Purchase order not found." };

    if (status === "received" && buy.status !== "received") {
      const grandTotal = buy.totalAmount + buy.transportCost;
      const items = JSON.parse(buy.itemsJson) as BuyItem[];
      const actorName = profile?.fullName ?? session.user.id;

      await prisma.$transaction(async tx => {
        // 1. Deduct from wallet
        await walletDeduct(tx, {
          shopId:       buy.shopId,
          amount:       grandTotal,
          type:         "buy",
          name:         `Purchase from ${buy.supplier?.name ?? "supplier"}`,
          authorizedBy: buy.authorizedBy ?? actorName,
        });

        // 2. Update stock for matched products (best-effort by name)
        for (const item of items) {
          if (!item.name?.trim()) continue;
          const product = await tx.product.findFirst({
            where: {
              shopId:      buy.shopId,
              productName: { equals: item.name.trim(), mode: "insensitive" },
            },
            select: { id: true },
          });
          if (product) {
            await tx.product.update({
              where: { id: product.id },
              data:  {
                quantity:     { increment: item.qty },
                buyingPrice:  item.price,
              },
            });
          }
        }

        // 3. Mark as received
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

  const profile = await prisma.profile.findUnique({
    where:  { userId: session.user.id },
    select: { role: true },
  });
  const role = profile?.role?.toLowerCase().trim();
  if (role !== "admin" && role !== "owner")
    return { success: false, error: "Only admins can delete purchase orders." };

  try {
    const buy = await prisma.buy.findUnique({ where: { id }, select: { shopId: true } });
    await prisma.buy.delete({ where: { id } });
    if (buy?.shopId) revalidatePath(`/${buy.shopId}/buy`, "page");
    return { success: true };
  } catch {
    return { success: false, error: "Delete failed." };
  }
}
