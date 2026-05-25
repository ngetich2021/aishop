"use server";

import prisma from "@/lib/prisma";
import { bustShop } from "@/lib/shop-cache";
import { planGuardCreate, planGuardMutate } from "@/lib/plan-guard";

export type ActionResult = { success: boolean; error?: string };

function invalidate(shopId: string) {
  bustShop(shopId);
  bustShop(shopId);
  bustShop(shopId);
}

export async function autoGenerateSalariesAction(shopId: string): Promise<ActionResult> {
  const guard = await planGuardCreate(shopId, "salaries");
  if (!guard.ok) return { success: false, error: guard.error };

  try {
    const now      = new Date();
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    const staffList = await prisma.staff.findMany({
      where:  { shopId },
      select: { id: true, baseSalary: true },
    });

    const existing = await prisma.salary.findMany({
      where:  { shopId, month: monthStr },
      select: { staffId: true },
    });
    const existingIds = new Set(existing.map(s => s.staffId));
    const toCreate    = staffList.filter(s => !existingIds.has(s.id));

    if (toCreate.length > 0) {
      await prisma.salary.createMany({
        data: toCreate.map(s => ({
          staffId: s.id,
          shopId,
          amount:  s.baseSalary,
          month:   monthStr,
          status:  "pending",
        })),
      });
    }
    invalidate(shopId);
    return { success: true };
  } catch {
    return { success: false, error: "Failed to auto-generate salaries" };
  }
}

export async function updateSalaryStatusAction(id: string, status: string): Promise<ActionResult> {
  const salary = await prisma.salary.findUnique({ where: { id }, select: { shopId: true } });
  if (!salary) return { success: false, error: "Salary not found." };

  const guard = await planGuardMutate(salary.shopId);
  if (!guard.ok) return { success: false, error: guard.error };

  const profile = await prisma.profile.findUnique({
    where:  { userId: guard.userId },
    select: { role: true },
  });
  const role = profile?.role?.toLowerCase().trim();
  if (role !== "manager" && role !== "admin" && role !== "owner")
    return { success: false, error: "Only managers can update salary status." };

  try {
    await prisma.salary.update({ where: { id }, data: { status } });
    invalidate(salary.shopId);
    return { success: true };
  } catch {
    return { success: false, error: "Update failed" };
  }
}

export async function deleteSalaryAction(id: string): Promise<ActionResult> {
  const salary = await prisma.salary.findUnique({ where: { id }, select: { shopId: true } });
  if (!salary) return { success: false, error: "Salary not found." };

  const guard = await planGuardMutate(salary.shopId);
  if (!guard.ok) return { success: false, error: guard.error };

  const profile = await prisma.profile.findUnique({
    where:  { userId: guard.userId },
    select: { role: true },
  });
  const role = profile?.role?.toLowerCase().trim();
  if (role !== "manager" && role !== "admin" && role !== "owner")
    return { success: false, error: "Only managers can delete salary records." };

  try {
    await prisma.salary.delete({ where: { id } });
    bustShop(salary.shopId);
    return { success: true };
  } catch {
    return { success: false, error: "Delete failed" };
  }
}
