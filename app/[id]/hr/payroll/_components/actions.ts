"use server";

import prisma from "@/lib/prisma";
import { bustShop } from "@/lib/shop-cache";
import { planGuardMutate } from "@/lib/plan-guard";

export type ActionResult = { success: boolean; error?: string };

function invalidate(shopId: string) {
  bustShop(shopId);
  bustShop(shopId);
  bustShop(shopId);
}

export async function updatePayrollStatusAction(id: string, status: string): Promise<ActionResult> {
  const payroll = await prisma.payroll.findUnique({ where: { id }, select: { shopId: true } });
  if (!payroll) return { success: false, error: "Payroll not found." };

  const guard = await planGuardMutate(payroll.shopId);
  if (!guard.ok) return { success: false, error: guard.error };

  const profile = await prisma.profile.findUnique({
    where:  { userId: guard.userId },
    select: { role: true },
  });
  const role = profile?.role?.toLowerCase().trim();
  if (role !== "manager" && role !== "admin" && role !== "owner")
    return { success: false, error: "Only managers can update payroll status." };

  try {
    await prisma.payroll.update({ where: { id }, data: { status } });
    invalidate(payroll.shopId);
    return { success: true };
  } catch {
    return { success: false, error: "Update failed" };
  }
}

export async function deletePayrollAction(id: string): Promise<ActionResult> {
  const payroll = await prisma.payroll.findUnique({ where: { id }, select: { shopId: true } });
  if (!payroll) return { success: false, error: "Payroll not found." };

  const guard = await planGuardMutate(payroll.shopId);
  if (!guard.ok) return { success: false, error: guard.error };

  const profile = await prisma.profile.findUnique({
    where:  { userId: guard.userId },
    select: { role: true },
  });
  const role = profile?.role?.toLowerCase().trim();
  if (role !== "manager" && role !== "admin" && role !== "owner")
    return { success: false, error: "Only managers can delete payroll records." };

  try {
    await prisma.payroll.delete({ where: { id } });
    bustShop(payroll.shopId);
    return { success: true };
  } catch {
    return { success: false, error: "Delete failed" };
  }
}
