"use server";

import { auth } from "@/auth";
import prisma from "@/lib/prisma";

// eslint-disable-next-line @typescript-eslint/no-explicit-any


const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function requireOwner(shopId: string) {
  const session = await auth();
  if (!session?.user?.id) return null;

  const userId = session.user.id;
  const shop = await prisma.shop.findUnique({
    where:  { id: shopId },
    select: { userId: true },
  });
  if (!shop || shop.userId !== userId) return null;
  return { userId, session };
}

// ─── Send Invite ──────────────────────────────────────────────────────────────

export async function sendInviteAction(
  shopId: string,
  email: string,
  role: string,
): Promise<{ success: boolean; inviteUrl?: string; error?: string }> {
  const actor = await requireOwner(shopId);
  if (!actor) return { success: false, error: "Unauthorized" };

  const trimmedEmail = email.trim().toLowerCase();
  if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    return { success: false, error: "Invalid email address" };
  }

  const validRoles = ["staff", "manager", "cashier", "viewer"];
  if (!validRoles.includes(role)) {
    return { success: false, error: "Invalid role" };
  }

  // Check the shop belongs to this user
  const shop = await prisma.shop.findUnique({
    where:  { id: shopId },
    select: { id: true, name: true },
  });
  if (!shop) return { success: false, error: "Shop not found" };

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // +7 days

  try {
    const invite = await prisma.shopInvite.create({
      data: {
        shopId,
        email:    trimmedEmail,
        role,
        expiresAt,
        accepted: false,
      },
    });

    const inviteUrl = `${APP_URL}/invite/${invite.token as string}`;
    return { success: true, inviteUrl };
  } catch (err) {
    console.error("sendInviteAction error:", err);
    return { success: false, error: "Failed to create invite" };
  }
}

// ─── Cancel Invite ────────────────────────────────────────────────────────────

export async function cancelInviteAction(
  inviteId: string,
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  const userId = session.user.id;

  // Verify ownership via the shop
  const invite = await prisma.shopInvite.findUnique({
    where:  { id: inviteId },
    select: { shopId: true },
  });
  if (!invite) return { success: false, error: "Invite not found" };

  const shop = await prisma.shop.findUnique({
    where:  { id: invite.shopId as string },
    select: { userId: true },
  });
  if (!shop || shop.userId !== userId) return { success: false, error: "Unauthorized" };

  try {
    await prisma.shopInvite.delete({ where: { id: inviteId } });
    return { success: true };
  } catch (err) {
    console.error("cancelInviteAction error:", err);
    return { success: false, error: "Failed to cancel invite" };
  }
}
