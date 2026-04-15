"use server";

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export type ActionResult = { success: boolean; error?: string };

function invalidate(shopId: string) {
  revalidatePath(`/${shopId}/hr/payroll`, "page");
  revalidatePath(`/${shopId}/hr/salary`, "page");
  revalidatePath(`/${shopId}/dashboard`);
}

export async function updatePayrollStatusAction(id: string, status: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  const profile = await prisma.profile.findUnique({
    where:  { userId: session.user.id },
    select: { role: true },
  });
  const role = profile?.role?.toLowerCase().trim();
  if (role !== "manager" && role !== "admin" && role !== "owner")
    return { success: false, error: "Only managers can update payroll status." };

  try {
    const payroll = await prisma.payroll.findUnique({ where: { id }, select: { shopId: true } });
    await prisma.payroll.update({ where: { id }, data: { status } });
    if (payroll?.shopId) invalidate(payroll.shopId);
    return { success: true };
  } catch {
    return { success: false, error: "Update failed" };
  }
}

export async function deletePayrollAction(id: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  const profile = await prisma.profile.findUnique({
    where:  { userId: session.user.id },
    select: { role: true },
  });
  const role = profile?.role?.toLowerCase().trim();
  if (role !== "manager" && role !== "admin" && role !== "owner")
    return { success: false, error: "Only managers can delete payroll records." };

  try {
    const payroll = await prisma.payroll.findUnique({ where: { id }, select: { shopId: true } });
    await prisma.payroll.delete({ where: { id } });
    if (payroll?.shopId) revalidatePath(`/${payroll.shopId}/hr/payroll`, "page");
    return { success: true };
  } catch {
    return { success: false, error: "Delete failed" };
  }
}
