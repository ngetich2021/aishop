"use server";

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export type ActionResult = { success: boolean; error?: string };

function invalidate(shopId: string) {
  revalidatePath(`/${shopId}/hr/salary`, "page");
  revalidatePath(`/${shopId}/hr/payroll`, "page");
  revalidatePath(`/${shopId}/dashboard`);
}

/**
 * Auto-generate salary records for all staff in the shop for the current month.
 * Idempotent — skips staff that already have a record for this month.
 */
export async function autoGenerateSalariesAction(shopId: string): Promise<ActionResult> {
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
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  const profile = await prisma.profile.findUnique({
    where:  { userId: session.user.id },
    select: { role: true },
  });
  const role = profile?.role?.toLowerCase().trim();
  if (role !== "manager" && role !== "admin" && role !== "owner")
    return { success: false, error: "Only managers can update salary status." };

  try {
    const salary = await prisma.salary.findUnique({ where: { id }, select: { shopId: true } });
    await prisma.salary.update({ where: { id }, data: { status } });
    if (salary?.shopId) invalidate(salary.shopId);
    return { success: true };
  } catch {
    return { success: false, error: "Update failed" };
  }
}

export async function deleteSalaryAction(id: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  const profile = await prisma.profile.findUnique({
    where:  { userId: session.user.id },
    select: { role: true },
  });
  const role = profile?.role?.toLowerCase().trim();
  if (role !== "manager" && role !== "admin" && role !== "owner")
    return { success: false, error: "Only managers can delete salary records." };

  try {
    const salary = await prisma.salary.findUnique({ where: { id }, select: { shopId: true } });
    await prisma.salary.delete({ where: { id } });
    if (salary?.shopId) revalidatePath(`/${salary.shopId}/hr/salary`, "page");
    return { success: true };
  } catch {
    return { success: false, error: "Delete failed" };
  }
}
