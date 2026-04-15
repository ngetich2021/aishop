"use server";
/**
 * Shared server-side utilities for all action files.
 *
 *  - resolveActor()  — verify auth + shop membership; returns actor context
 *  - logActivity()   — write sensitive ops to ActivityLog
 *  - walletDeduct()  — deduct from wallet + create Transaction inside a tx
 */
import { auth }   from "@/auth";
import prisma      from "@/lib/prisma";

// ─────────────────────────────────────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────────────────────────────────────

export interface Actor {
  userId:    string;
  name:      string;
  role:      string;
  isAdmin:   boolean;
  isManager: boolean;
}

export interface ActivityPayload {
  userId:   string;
  shopId?:  string;
  action:   string;          // e.g. "delete" | "edit" | "create"
  entity:   string;          // e.g. "Sale" | "Staff" | "Advance"
  entityId?: string;
  details?: Record<string, unknown>;  // snapshot of what changed/deleted
  path:     string;
  method?:  string;
}

// ─────────────────────────────────────────────────────────────────────────────
//  resolveActor — authenticate and confirm shop membership
//  Pass requireRoute to also check allowedRoutes (for staff who have access)
// ─────────────────────────────────────────────────────────────────────────────
export async function resolveActor(
  shopId: string,
  options: { requireAdmin?: boolean; requireManager?: boolean } = {},
): Promise<Actor | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const userId = session.user.id;

  const profile = await prisma.profile.findUnique({
    where:  { userId },
    select: { role: true, shopId: true, fullName: true, allowedRoutes: true },
  });
  // No profile = deleted / orphaned account → deny all server actions
  if (!profile) return null;
  const role      = profile.role.toLowerCase().trim();
  const isAdmin   = role === "admin" || role === "owner";
  const isManager = role === "manager" || isAdmin;

  // Shop membership check
  if (isAdmin) {
    const shop = await prisma.shop.findUnique({ where: { id: shopId }, select: { userId: true } });
    if (!shop || shop.userId !== userId) return null;
  } else {
    if (profile?.shopId !== shopId) return null;
  }

  // Optional role gates
  if (options.requireAdmin   && !isAdmin)   return null;
  if (options.requireManager && !isManager) return null;

  const name = profile?.fullName ?? session.user.name ?? "Unknown";
  return { userId, name, role, isAdmin, isManager };
}

// ─────────────────────────────────────────────────────────────────────────────
//  logActivity — fire-and-forget, never throws
// ─────────────────────────────────────────────────────────────────────────────
export async function logActivity(payload: ActivityPayload): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        userId:   payload.userId,
        shopId:   payload.shopId ?? null,
        action:   payload.action,
        entity:   payload.entity,
        entityId: payload.entityId ?? null,
        details:  payload.details ? JSON.stringify(payload.details) : null,
        path:     payload.path,
        method:   payload.method ?? "POST",
      },
    });
  } catch { /* best-effort */ }
}

// ─────────────────────────────────────────────────────────────────────────────
//  walletDeduct — must be called inside a prisma.$transaction(async tx => …)
//  Throws on insufficient balance so the outer tx rolls back.
// ─────────────────────────────────────────────────────────────────────────────
export async function walletDeduct(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  opts: {
    shopId:        string;
    amount:        number;
    type:          string;   // expense | salary | advance | buy | withdraw | transfer_to_payments
    name:          string;
    authorizedBy:  string;
    referenceType?: string;
    referenceId?:   string;
  },
): Promise<void> {
  const wallet = await tx.wallet.findUnique({
    where:  { shopId: opts.shopId },
    select: { balance: true },
  });
  if (!wallet)
    throw new Error("No wallet found. Please deposit funds via the Wallet page first.");
  if (wallet.balance < opts.amount)
    throw new Error(
      `Insufficient wallet balance. Available: KSh ${wallet.balance.toLocaleString()}, required: KSh ${opts.amount.toLocaleString()}.`,
    );

  await tx.wallet.update({
    where: { shopId: opts.shopId },
    data:  { balance: { decrement: opts.amount } },
  });
  await tx.transaction.create({
    data: {
      shopId:        opts.shopId,
      name:          opts.name,
      amount:        opts.amount,
      type:          opts.type,
      sourceOfMoney: opts.type,
      referenceType: opts.referenceType ?? null,
      referenceId:   opts.referenceId   ?? null,
      authorizedBy:  opts.authorizedBy,
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  capturePayment — record incoming cash into the Payments ledger
//  Safe to call inside or outside a transaction
// ─────────────────────────────────────────────────────────────────────────────
export async function capturePayment(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  opts: {
    shopId:          string;
    amount:          number;
    method:          string;
    source:          string; // sale | credit_payment
    direction?:      string; // in (default) | out
    note?:           string;
    saleId?:         string;
    transactionCode?: string;
  },
): Promise<void> {
  await tx.payment.create({
    data: {
      shopId:          opts.shopId,
      amount:          opts.amount,
      method:          opts.method,
      direction:       opts.direction ?? "in",
      source:          opts.source,
      note:            opts.note           ?? null,
      saleId:          opts.saleId         ?? null,
      transactionCode: opts.transactionCode ?? null,
    },
  });
}
