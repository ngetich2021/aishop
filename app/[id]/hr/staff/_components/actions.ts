"use server";

import { auth }            from "@/auth";
import prisma              from "@/lib/prisma";
import { revalidatePath }  from "next/cache";
import { z }               from "zod";

export type ActionResult = { success: boolean; error?: string };

// ── Auth / ownership helper ───────────────────────────────────────────────────
async function canManageShop(shopId: string): Promise<{ userId: string } | ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };
  const userId = session.user.id;

  const profile = await prisma.profile.findUnique({
    where:  { userId },
    select: { role: true, shopId: true },
  });
  const role = (profile?.role ?? "user").toLowerCase().trim();

  if (role === "admin" || role === "owner") {
    const shop = await prisma.shop.findUnique({ where: { id: shopId }, select: { userId: true } });
    if (!shop || shop.userId !== userId) return { success: false, error: "Not your shop." };
  } else if (role === "manager") {
    if (profile?.shopId !== shopId) return { success: false, error: "Not assigned to this shop." };
  } else {
    return { success: false, error: "Permission denied." };
  }
  return { userId };
}

// ── Validation ────────────────────────────────────────────────────────────────
const phoneRx = /^(\+254|0)7\d{8}$/;
const optPhone = z.string().regex(phoneRx, "Invalid phone number").or(z.literal("")).optional();

const staffSchema = z.object({
  fullName:   z.string().min(2, "Full name is required"),
  tel1:       optPhone,
  tel2:       optPhone,
  mpesaNo:    z.string().regex(phoneRx, "Invalid M-Pesa number").or(z.literal("")).optional(),
  baseSalary: z.coerce.number().min(0, "Salary must be ≥ 0"),
  userId:     z.string().min(1, "Select a user"),
  shopId:     z.string().min(1),
});

// ── SAVE STAFF (create or update) ─────────────────────────────────────────────
export async function saveStaffAction(
  _: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const staffId = formData.get("staffId") as string | null;
  const raw = Object.fromEntries(
    ["fullName","tel1","tel2","mpesaNo","baseSalary","userId","shopId"]
      .map(k => [k, formData.get(k)])
  );
  const parsed = staffSchema.safeParse(raw);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const { fullName, tel1, tel2, mpesaNo, baseSalary, userId, shopId } = parsed.data;

  const check = await canManageShop(shopId);
  if ("error" in check) return check;

  try {
    if (staffId) {
      // Update existing
      await prisma.$transaction([
        prisma.staff.update({
          where: { id: staffId },
          data:  { fullName, tel1: tel1 || null, tel2: tel2 || null, mpesaNo: mpesaNo || null, baseSalary },
        }),
        prisma.profile.upsert({
          where:  { userId },
          create: { userId, shopId, role: "staff", fullName },
          update: { fullName },
        }),
      ]);
    } else {
      // Create new
      const exists = await prisma.staff.findUnique({ where: { userId }, select: { id: true } });
      if (exists) return { success: false, error: "This user is already a staff member." };

      await prisma.$transaction([
        prisma.staff.create({
          data: { userId, fullName, tel1: tel1 || null, tel2: tel2 || null, mpesaNo: mpesaNo || null, baseSalary, shopId },
        }),
        prisma.profile.upsert({
          where:  { userId },
          create: { userId, shopId, role: "staff", fullName },
          update: { shopId, role: "staff", fullName },
        }),
      ]);
    }
    revalidatePath(`/${shopId}/hr/staff`, "page");
    return { success: true };
  } catch {
    return { success: false, error: "Save failed. Please try again." };
  }
}

// ── DELETE STAFF ──────────────────────────────────────────────────────────────
export async function deleteStaffAction(staffId: string, shopId: string): Promise<ActionResult> {
  const check = await canManageShop(shopId);
  if ("error" in check) return check;

  try {
    const staff = await prisma.staff.findUnique({ where: { id: staffId }, select: { userId: true } });
    if (!staff) return { success: false, error: "Staff not found." };

    await prisma.$transaction([
      prisma.staff.delete({ where: { id: staffId } }),
      prisma.profile.update({
        where: { userId: staff.userId },
        data:  { role: "user", shopId: null, designation: null, allowedRoutes: [] },
      }),
    ]);
    revalidatePath(`/${shopId}/hr/staff`, "page");
    return { success: true };
  } catch {
    return { success: false, error: "Delete failed." };
  }
}

// ── ASSIGN DESIGNATION ────────────────────────────────────────────────────────
export async function assignDesignationAction(args: {
  staffUserId: string;
  designation: string;
  shopId:      string;
}): Promise<ActionResult> {
  const { staffUserId, designation, shopId } = args;
  const check = await canManageShop(shopId);
  if ("error" in check) return check;

  const roleRecord = await prisma.role.findUnique({
    where:  { name: designation },
    select: { allowedRoutes: true },
  });
  if (!roleRecord) return { success: false, error: "Designation not found." };

  try {
    await prisma.profile.update({
      where: { userId: staffUserId },
      data:  { designation, allowedRoutes: roleRecord.allowedRoutes },
    });
    revalidatePath(`/${shopId}/hr/staff`, "page");
    return { success: true };
  } catch {
    return { success: false, error: "Assign designation failed." };
  }
}

// ── REMOVE DESIGNATION ────────────────────────────────────────────────────────
export async function removeDesignationAction(args: {
  staffUserId: string;
  shopId:      string;
}): Promise<ActionResult> {
  const { staffUserId, shopId } = args;
  const check = await canManageShop(shopId);
  if ("error" in check) return check;

  try {
    await prisma.profile.update({
      where: { userId: staffUserId },
      data:  { designation: null, allowedRoutes: [] },
    });
    revalidatePath(`/${shopId}/hr/staff`, "page");
    return { success: true };
  } catch {
    return { success: false, error: "Remove designation failed." };
  }
}

// ── SAVE ALLOWED ROUTES (per-user fine-tuning) ────────────────────────────────
export async function saveAllowedRoutesAction(args: {
  staffUserId:   string;
  allowedRoutes: string[];
  shopId:        string;
}): Promise<ActionResult> {
  const { staffUserId, allowedRoutes, shopId } = args;
  const check = await canManageShop(shopId);
  if ("error" in check) return check;

  try {
    await prisma.profile.update({
      where: { userId: staffUserId },
      data:  { allowedRoutes },
    });
    revalidatePath(`/${shopId}/hr/staff`, "page");
    return { success: true };
  } catch {
    return { success: false, error: "Save sections failed." };
  }
}

// ── ASSIGN ROLE TIER ──────────────────────────────────────────────────────────
export async function assignStaffRoleAction(args: {
  staffUserId: string;
  roleName:    string;
  shopId:      string;
}): Promise<ActionResult> {
  const { staffUserId, roleName, shopId } = args;
  const check = await canManageShop(shopId);
  if ("error" in check) return check;

  const allowed = ["user", "staff", "manager", "admin"];
  if (!allowed.includes(roleName)) return { success: false, error: "Invalid role tier." };

  try {
    await prisma.profile.update({
      where: { userId: staffUserId },
      data:  { role: roleName },
    });
    revalidatePath(`/${shopId}/hr/staff`, "page");
    return { success: true };
  } catch {
    return { success: false, error: "Role update failed." };
  }
}

// ── SAVE ROLE DEFINITION ──────────────────────────────────────────────────────
export async function saveRoleAction(data: {
  roleId?:       string;
  name:          string;
  description:   string;
  allowedRoutes: string[];
  shopId:        string;
}): Promise<ActionResult> {
  const check = await canManageShop(data.shopId);
  if ("error" in check) return check;

  const reserved = ["user", "staff", "admin", "owner", "manager"];
  if (reserved.includes(data.name.toLowerCase().trim()))
    return { success: false, error: `"${data.name}" is a reserved system role.` };

  try {
    if (data.roleId) {
      const existing = await prisma.role.findUnique({
        where:  { id: data.roleId },
        select: { name: true },
      });
      const oldName = existing?.name;

      await prisma.role.update({
        where: { id: data.roleId },
        data:  { name: data.name, description: data.description, allowedRoutes: data.allowedRoutes },
      });
      // Cascade rename to all profiles using the old designation name
      if (oldName && oldName !== data.name) {
        await prisma.profile.updateMany({
          where: { designation: oldName },
          data:  { designation: data.name, allowedRoutes: data.allowedRoutes },
        });
      }
    } else {
      await prisma.role.create({
        data: { name: data.name, description: data.description, allowedRoutes: data.allowedRoutes },
      });
    }
    revalidatePath(`/${data.shopId}/hr/staff`, "page");
    return { success: true };
  } catch (e: unknown) {
    if ((e as { code?: string }).code === "P2002")
      return { success: false, error: "A designation with that name already exists." };
    return { success: false, error: "Save designation failed." };
  }
}

// ── DELETE ROLE DEFINITION ────────────────────────────────────────────────────
export async function deleteRoleAction(args: { roleId: string; shopId: string }): Promise<ActionResult> {
  const { roleId, shopId } = args;
  const check = await canManageShop(shopId);
  if ("error" in check) return check;

  try {
    const role = await prisma.role.findUnique({ where: { id: roleId }, select: { name: true } });
    if (!role) return { success: false, error: "Designation not found." };

    // Clear all profiles assigned this designation
    await prisma.profile.updateMany({
      where: { designation: role.name },
      data:  { designation: null, allowedRoutes: [] },
    });
    await prisma.role.delete({ where: { id: roleId } });
    revalidatePath(`/${shopId}/hr/staff`, "page");
    return { success: true };
  } catch {
    return { success: false, error: "Delete designation failed." };
  }
}
