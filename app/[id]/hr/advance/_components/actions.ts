"use server";

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export type ActionResult = { success: boolean; error?: string };

function invalidate(shopId: string) {
  revalidatePath(`/${shopId}/hr/advance`, "page");
  revalidatePath(`/${shopId}/hr/payroll`, "page");
  revalidatePath(`/${shopId}/hr/salary`, "page");
  revalidatePath(`/${shopId}/dashboard`);
}

// ── REQUEST ADVANCE (staff) ───────────────────────────────────────────────────
export async function requestAdvanceAction(
  shopId: string,
  amount: number,
  date: string,
  reason?: string,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  const staffRecord = await prisma.staff.findFirst({
    where:  { userId: session.user.id, shopId },
    select: { id: true, baseSalary: true },
  });
  if (!staffRecord) return { success: false, error: "No staff record found for this shop." };

  const maxAdvance = Math.floor(staffRecord.baseSalary * 0.30);
  if (amount <= 0)             return { success: false, error: "Amount must be greater than zero." };
  if (amount > maxAdvance)
    return { success: false, error: `Advance cannot exceed 30% of your base salary (KSh ${maxAdvance.toLocaleString()}).` };

  try {
    await prisma.advance.create({
      data: {
        staffId: staffRecord.id,
        shopId,
        amount,
        date:    new Date(`${date}T00:00:00.000Z`),
        reason:  reason || null,
        status:  "requested",
      },
    });
    revalidatePath(`/${shopId}/hr/advance`, "page");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to submit advance request." };
  }
}

// ── MANAGER: CREATE ADVANCE FOR STAFF ────────────────────────────────────────
export async function createAdvanceForStaffAction(
  shopId: string,
  staffId: string,
  amount: number,
  date: string,
  reason?: string,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  const profile = await prisma.profile.findUnique({
    where:  { userId: session.user.id },
    select: { role: true },
  });
  const role = profile?.role?.toLowerCase().trim();
  if (role !== "manager" && role !== "admin" && role !== "owner")
    return { success: false, error: "Only managers can create advances." };

  const staffRecord = await prisma.staff.findUnique({
    where:  { id: staffId },
    select: { baseSalary: true },
  });
  if (!staffRecord) return { success: false, error: "Staff record not found." };
  const maxAdvance = Math.floor(staffRecord.baseSalary * 0.30);
  if (amount > maxAdvance)
    return { success: false, error: `Advance cannot exceed 30% of staff salary (KSh ${maxAdvance.toLocaleString()}).` };

  try {
    await prisma.advance.create({
      data: {
        staffId,
        shopId,
        amount,
        date:   new Date(`${date}T00:00:00.000Z`),
        reason: reason || null,
        status: "approved",
      },
    });
    invalidate(shopId);
    return { success: true };
  } catch {
    return { success: false, error: "Failed to create advance." };
  }
}

// ── UPDATE ADVANCE STATUS (manager) ──────────────────────────────────────────
export async function updateAdvanceStatusAction(
  id: string,
  status: string,
  transactionCode?: string,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  const profile = await prisma.profile.findUnique({
    where:  { userId: session.user.id },
    select: { role: true },
  });
  const role = profile?.role?.toLowerCase().trim();
  if (role !== "manager" && role !== "admin" && role !== "owner")
    return { success: false, error: "Only managers can update advance status." };

  try {
    const advance = await prisma.advance.findUnique({ where: { id }, select: { shopId: true } });
    await prisma.advance.update({
      where: { id },
      data:  { status, transactionCode: transactionCode || null },
    });
    if (advance?.shopId) invalidate(advance.shopId);
    return { success: true };
  } catch {
    return { success: false, error: "Update failed." };
  }
}

// ── DELETE ADVANCE ────────────────────────────────────────────────────────────
export async function deleteAdvanceAction(id: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  const profile = await prisma.profile.findUnique({
    where:  { userId: session.user.id },
    select: { role: true },
  });
  const role = profile?.role?.toLowerCase().trim();
  if (role !== "manager" && role !== "admin" && role !== "owner")
    return { success: false, error: "Only managers can delete advances." };

  try {
    const advance = await prisma.advance.findUnique({ where: { id }, select: { shopId: true } });
    await prisma.advance.delete({ where: { id } });
    if (advance?.shopId) revalidatePath(`/${advance.shopId}/hr/advance`, "page");
    return { success: true };
  } catch {
    return { success: false, error: "Delete failed." };
  }
}
