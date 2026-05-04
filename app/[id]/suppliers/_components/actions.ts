"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { planGuardCreate, planGuardMutate } from "@/lib/plan-guard";

export type ActionResult = { success: boolean; error?: string; id?: string };

export async function createSupplierAction(
  shopId: string,
  data: { name: string; contact1: string; contact2?: string; goodsType?: string }
): Promise<ActionResult> {
  const guard = await planGuardCreate(shopId, "suppliers");
  if (!guard.ok) return { success: false, error: guard.error };

  if (!data.name?.trim()) return { success: false, error: "Supplier name required." };
  if (!data.contact1?.trim()) return { success: false, error: "Primary contact required." };

  try {
    const supplier = await prisma.supplier.create({
      data: {
        shopId,
        name:      data.name.trim(),
        contact1:  data.contact1.trim(),
        contact2:  data.contact2?.trim() || null,
        goodsType: data.goodsType?.trim() || null,
      },
    });
    revalidatePath(`/${shopId}/suppliers`, "page");
    return { success: true, id: supplier.id };
  } catch {
    return { success: false, error: "Failed to add supplier." };
  }
}

export async function updateSupplierAction(
  id: string,
  data: { name: string; contact1: string; contact2?: string; goodsType?: string }
): Promise<ActionResult> {
  const supplier = await prisma.supplier.findUnique({ where: { id }, select: { shopId: true } });
  if (!supplier) return { success: false, error: "Supplier not found." };

  const guard = await planGuardMutate(supplier.shopId);
  if (!guard.ok) return { success: false, error: guard.error };

  const profile = await prisma.profile.findUnique({
    where:  { userId: guard.userId },
    select: { role: true },
  });
  const role = profile?.role?.toLowerCase().trim();
  if (role !== "admin" && role !== "owner" && role !== "manager")
    return { success: false, error: "Only managers can edit suppliers." };

  try {
    await prisma.supplier.update({
      where: { id },
      data: {
        name:      data.name.trim(),
        contact1:  data.contact1.trim(),
        contact2:  data.contact2?.trim() || null,
        goodsType: data.goodsType?.trim() || null,
      },
    });
    revalidatePath(`/${supplier.shopId}/suppliers`, "page");
    return { success: true };
  } catch {
    return { success: false, error: "Update failed." };
  }
}

export async function deleteSupplierAction(id: string): Promise<ActionResult> {
  const supplier = await prisma.supplier.findUnique({ where: { id }, select: { shopId: true } });
  if (!supplier) return { success: false, error: "Supplier not found." };

  const guard = await planGuardMutate(supplier.shopId);
  if (!guard.ok) return { success: false, error: guard.error };

  const profile = await prisma.profile.findUnique({
    where:  { userId: guard.userId },
    select: { role: true },
  });
  const role = profile?.role?.toLowerCase().trim();
  if (role !== "admin" && role !== "owner")
    return { success: false, error: "Only admins can delete suppliers." };

  try {
    await prisma.supplier.delete({ where: { id } });
    revalidatePath(`/${supplier.shopId}/suppliers`, "page");
    return { success: true };
  } catch {
    return { success: false, error: "Delete failed." };
  }
}
