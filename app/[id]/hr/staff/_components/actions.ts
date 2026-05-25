"use server";

import { auth }                  from "@/auth";
import prisma                    from "@/lib/prisma";
import { bustShop } from "@/lib/shop-cache";
import { z }                     from "zod";
import { planGuardCreate, planGuardMutate } from "@/lib/plan-guard";
import { sendStaffInviteEmail }  from "@/lib/email";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

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
  fullName:    z.string().min(2, "Full name is required"),
  tel1:        optPhone,
  tel2:        optPhone,
  mpesaNo:     z.string().regex(phoneRx, "Invalid M-Pesa number").or(z.literal("")).optional(),
  baseSalary:  z.coerce.number().min(0, "Salary must be ≥ 0"),
  userId:      z.string().min(1, "Select a user"),
  shopId:      z.string().min(1),
  designation: z.string().optional(),
});

// ── SAVE STAFF (create or update) ─────────────────────────────────────────────
export async function saveStaffAction(
  _: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const staffId = formData.get("staffId") as string | null;
  const raw = Object.fromEntries(
    ["fullName","tel1","tel2","mpesaNo","baseSalary","userId","shopId","designation"]
      .map(k => [k, formData.get(k)])
  );
  const parsed = staffSchema.safeParse(raw);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const { fullName, tel1, tel2, mpesaNo, baseSalary, userId, shopId, designation } = parsed.data;

  const guard = staffId
    ? await planGuardMutate(shopId)
    : await planGuardCreate(shopId, "staff");
  if (!guard.ok) return { success: false, error: guard.error };

  const check = await canManageShop(shopId);
  if ("error" in check) return check;

  try {
    if (staffId) {
      // Resolve designation routes when designation is provided on update
      let updatedRoutes: string[] | undefined;
      if (designation) {
        const roleRecord = await prisma.role.findUnique({
          where:  { shopId_name: { shopId, name: designation } },
          select: { allowedRoutes: true },
        });
        updatedRoutes = (roleRecord?.allowedRoutes ?? []) as string[];
      }

      const profileUpdate: Record<string, unknown> = { fullName };
      if (designation !== undefined) {
        profileUpdate.designation = designation || null;
        if (updatedRoutes !== undefined) profileUpdate.allowedRoutes = updatedRoutes;
      }

      await prisma.$transaction([
        prisma.staff.update({
          where: { id: staffId },
          data:  { fullName, tel1: tel1 || null, tel2: tel2 || null, mpesaNo: mpesaNo || null, baseSalary },
        }),
        prisma.profile.upsert({
          where:  { userId },
          create: { userId, shopId, role: "staff", fullName, designation: designation || null, allowedRoutes: updatedRoutes ?? [] },
          update: profileUpdate,
        }),
      ]);
    } else {
      const exists = await prisma.staff.findUnique({ where: { userId }, select: { id: true } });
      if (exists) return { success: false, error: "This user is already a staff member." };

      // Resolve designation's allowedRoutes so access is granted immediately on login
      let allowedRoutes: string[] = [];
      if (designation) {
        const roleRecord = await prisma.role.findUnique({
          where:  { shopId_name: { shopId, name: designation } },
          select: { allowedRoutes: true },
        });
        allowedRoutes = (roleRecord?.allowedRoutes ?? []) as string[];
      }

      await prisma.$transaction([
        prisma.staff.create({
          data: { userId, fullName, tel1: tel1 || null, tel2: tel2 || null, mpesaNo: mpesaNo || null, baseSalary, shopId },
        }),
        prisma.profile.upsert({
          where:  { userId },
          create: { userId, shopId, role: "staff", fullName, designation: designation || null, allowedRoutes },
          update: { shopId, role: "staff", fullName, designation: designation || null, allowedRoutes },
        }),
      ]);
    }
    bustShop(shopId);
    return { success: true };
  } catch {
    return { success: false, error: "Save failed. Please try again." };
  }
}

// ── DELETE STAFF ──────────────────────────────────────────────────────────────
export async function deleteStaffAction(staffId: string, shopId: string): Promise<ActionResult> {
  const guard = await planGuardMutate(shopId);
  if (!guard.ok) return { success: false, error: guard.error };

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
    bustShop(shopId);
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

  const guard = await planGuardMutate(shopId);
  if (!guard.ok) return { success: false, error: guard.error };

  const check = await canManageShop(shopId);
  if ("error" in check) return check;

  const roleRecord = await prisma.role.findUnique({
    where:  { shopId_name: { shopId, name: designation } },
    select: { allowedRoutes: true },
  });
  if (!roleRecord) return { success: false, error: "Designation not found." };

  try {
    await prisma.profile.update({
      where: { userId: staffUserId },
      data:  { designation, allowedRoutes: roleRecord.allowedRoutes as string[] },
    });
    bustShop(shopId);
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

  const guard = await planGuardMutate(shopId);
  if (!guard.ok) return { success: false, error: guard.error };

  const check = await canManageShop(shopId);
  if ("error" in check) return check;

  try {
    await prisma.profile.update({
      where: { userId: staffUserId },
      data:  { designation: null, allowedRoutes: [] },
    });
    bustShop(shopId);
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

  const guard = await planGuardMutate(shopId);
  if (!guard.ok) return { success: false, error: guard.error };

  const check = await canManageShop(shopId);
  if ("error" in check) return check;

  try {
    await prisma.profile.update({
      where: { userId: staffUserId },
      data:  { allowedRoutes },
    });
    bustShop(shopId);
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

  const guard = await planGuardMutate(shopId);
  if (!guard.ok) return { success: false, error: guard.error };

  const check = await canManageShop(shopId);
  if ("error" in check) return check;

  const allowed = ["user", "staff", "manager", "admin"];
  if (!allowed.includes(roleName)) return { success: false, error: "Invalid role tier." };

  try {
    await prisma.profile.update({
      where: { userId: staffUserId },
      data:  { role: roleName },
    });
    bustShop(shopId);
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
  const guard = await planGuardMutate(data.shopId);
  if (!guard.ok) return { success: false, error: guard.error };

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
      if (oldName && oldName !== data.name) {
        const shopStaff = await prisma.staff.findMany({
          where:  { shopId: data.shopId },
          select: { userId: true },
        });
        const userIds = shopStaff.map(s => s.userId);
        await prisma.profile.updateMany({
          where: { userId: { in: userIds }, designation: oldName },
          data:  { designation: data.name, allowedRoutes: data.allowedRoutes },
        });
      }
    } else {
      await prisma.role.create({
        data: { shopId: data.shopId, name: data.name, description: data.description, allowedRoutes: data.allowedRoutes },
      });
    }
    bustShop(data.shopId);
    return { success: true };
  } catch (e: unknown) {
    if ((e as { code?: string }).code === "P2002")
      return { success: false, error: "A designation with that name already exists in this shop." };
    return { success: false, error: "Save designation failed." };
  }
}

// ── DELETE ROLE DEFINITION ────────────────────────────────────────────────────
export async function deleteRoleAction(args: { roleId: string; shopId: string }): Promise<ActionResult> {
  const { roleId, shopId } = args;

  const guard = await planGuardMutate(shopId);
  if (!guard.ok) return { success: false, error: guard.error };

  const check = await canManageShop(shopId);
  if ("error" in check) return check;

  try {
    const role = await prisma.role.findUnique({ where: { id: roleId }, select: { name: true, shopId: true } });
    if (!role) return { success: false, error: "Designation not found." };

    const shopStaff = await prisma.staff.findMany({
      where:  { shopId: role.shopId },
      select: { userId: true },
    });
    const userIds = shopStaff.map(s => s.userId);
    await prisma.profile.updateMany({
      where: { userId: { in: userIds }, designation: role.name },
      data:  { designation: null, allowedRoutes: [] },
    });
    await prisma.role.delete({ where: { id: roleId } });
    bustShop(shopId);
    return { success: true };
  } catch {
    return { success: false, error: "Delete designation failed." };
  }
}

// ── SEND STAFF INVITE ─────────────────────────────────────────────────────────
export async function sendStaffInviteAction(args: {
  shopId:       string;
  email:        string;
  fullName?:    string;
  baseSalary?:  number;
  tel1?:        string;
  designation?: string;
}): Promise<ActionResult & { inviteUrl?: string; emailError?: string }> {
  const { shopId, email, fullName, baseSalary, tel1, designation } = args;

  const guard = await planGuardMutate(shopId);
  if (!guard.ok) return { success: false, error: guard.error };

  const role = "staff";
  const check = await canManageShop(shopId);
  if ("error" in check) return check;

  const trimEmail = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimEmail)) {
    return { success: false, error: "Invalid email address." };
  }

  await prisma.shopInvite.deleteMany({
    where: { shopId, email: trimEmail, accepted: false },
  });

  const shop = await prisma.shop.findUnique({
    where:  { id: shopId },
    select: { name: true, user: { select: { name: true } } },
  });
  if (!shop) return { success: false, error: "Shop not found." };

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  try {
    const invite = await prisma.shopInvite.create({
      data: {
        shopId, email: trimEmail, role, expiresAt, accepted: false,
        fullName:    fullName    || null,
        baseSalary:  baseSalary  ?? null,
        tel1:        tel1        || null,
        designation: designation || null,
      },
    });

    const inviteUrl = `${APP_URL}/invite/${invite.token as string}`;

    let emailError: string | undefined;
    try {
      await sendStaffInviteEmail({
        to:        trimEmail,
        shopName:  shop.name,
        ownerName: shop.user.name ?? "Your manager",
        inviteUrl,
        role,
        fullName,
      });
    } catch (e) {
      emailError = e instanceof Error ? e.message : "Email delivery failed";
      console.error("[sendStaffInviteAction] email error:", emailError);
    }

    bustShop(shopId);
    return { success: true, inviteUrl, emailError };
  } catch {
    return { success: false, error: "Failed to create invite." };
  }
}

// ── FIND USER BY EMAIL (for direct-add flow) ──────────────────────────────────
export async function findUserByEmailAction(email: string): Promise<{
  userId: string; name: string; email: string; image: string | null; alreadyStaff: boolean;
} | null> {
  const user = await prisma.user.findFirst({
    where:  { email: email.toLowerCase().trim() },
    select: { id: true, name: true, email: true, image: true },
  });
  if (!user) return null;
  const existing = await prisma.staff.findUnique({ where: { userId: user.id }, select: { id: true } });
  return {
    userId:      user.id,
    name:        user.name  ?? "",
    email:       user.email ?? "",
    image:       user.image ?? null,
    alreadyStaff: !!existing,
  };
}

// ── CANCEL STAFF INVITE ───────────────────────────────────────────────────────
export async function cancelStaffInviteAction(args: {
  inviteId: string;
  shopId:   string;
}): Promise<ActionResult> {
  const { inviteId, shopId } = args;

  const guard = await planGuardMutate(shopId);
  if (!guard.ok) return { success: false, error: guard.error };

  const check = await canManageShop(shopId);
  if ("error" in check) return check;

  try {
    await prisma.shopInvite.delete({ where: { id: inviteId } });
    bustShop(shopId);
    return { success: true };
  } catch {
    return { success: false, error: "Cancel failed." };
  }
}
