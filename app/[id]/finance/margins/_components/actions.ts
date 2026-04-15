"use server";

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export type ActionResult = { success: boolean; error?: string };

export async function createMarginAction(
  shopId: string,
  data: { value: number; profitType?: string; date?: string }
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  const profile = await prisma.profile.findUnique({
    where:  { userId: session.user.id },
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
    revalidatePath(`/${shopId}/finance/margins`, "page");
    revalidatePath(`/${shopId}/dashboard`);
    return { success: true };
  } catch {
    return { success: false, error: "Failed to record margin." };
  }
}

export async function deleteMarginAction(id: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  const profile = await prisma.profile.findUnique({
    where:  { userId: session.user.id },
    select: { role: true },
  });
  const role = profile?.role?.toLowerCase().trim();
  if (role !== "admin" && role !== "owner")
    return { success: false, error: "Only admins can delete margin records." };

  try {
    const margin = await prisma.margin.findUnique({ where: { id }, select: { shopId: true } });
    await prisma.margin.delete({ where: { id } });
    if (margin?.shopId) revalidatePath(`/${margin.shopId}/finance/margins`, "page");
    return { success: true };
  } catch {
    return { success: false, error: "Delete failed." };
  }
}
