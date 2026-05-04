"use server";

import { auth }  from "@/auth";
import prisma    from "@/lib/prisma";

export type PlanGuardResult =
  | { ok: true;  plan: string; userId: string }
  | { ok: false; error: string };

// Every section that has a 1-entry limit on Demo+
export type Section =
  | "products" | "adjustments" | "sales" | "quotes"
  | "expenses" | "credits" | "payments" | "transactions" | "margins"
  | "suppliers" | "staff" | "payrolls" | "advances" | "salaries"
  | "assets" | "buys";

// ─── internal helpers ─────────────────────────────────────────────────────────

async function getShopPlan(shopId: string) {
  const shop = await prisma.shop.findUnique({
    where:  { id: shopId },
    select: { user: { select: { subscription: { select: { plan: true, expiresAt: true } } } } },
  });
  return {
    plan:      shop?.user?.subscription?.plan      ?? "demo",
    expiresAt: shop?.user?.subscription?.expiresAt ?? null,
  };
}

async function sectionCount(shopId: string, section: Section): Promise<number> {
  switch (section) {
    case "products":     return prisma.product.count({ where: { shopId } });
    case "adjustments":  return prisma.adjustment.count({ where: { shopId } });
    case "sales":        return prisma.sale.count({ where: { shopId } });
    case "quotes":       return prisma.quote.count({ where: { shopId } });
    case "expenses":     return prisma.expense.count({ where: { shopId } });
    case "credits":      return prisma.credit.count({ where: { shopId } });
    case "payments":     return prisma.payment.count({ where: { shopId } });
    case "transactions":  return prisma.transaction.count({ where: { shopId } });
    case "margins":      return prisma.margin.count({ where: { shopId } });
    case "suppliers":    return prisma.supplier.count({ where: { shopId } });
    case "staff":        return prisma.staff.count({ where: { shopId } });
    case "payrolls":     return prisma.payroll.count({ where: { shopId } });
    case "advances":     return prisma.advance.count({ where: { shopId } });
    case "salaries":     return prisma.salary.count({ where: { shopId } });
    case "assets":       return prisma.asset.count({ where: { shopId } });
    case "buys":         return prisma.buy.count({ where: { shopId } });
    default:             return 0;
  }
}

function demoOnlyError(): PlanGuardResult {
  return {
    ok:    false,
    error: "Free Demo is view-only — no data entry is allowed. Upgrade to Demo+ (KES 2/24 h) or Pro at /billing.",
  };
}

function demoPlusExpiredError(): PlanGuardResult {
  return {
    ok:    false,
    error: "Your Demo+ plan has expired. Please renew at /billing to continue.",
  };
}

function demoPlusLimitError(section: string): PlanGuardResult {
  return {
    ok:    false,
    error: `Demo+ allows only 1 entry per section (${section}). Upgrade to Pro for unlimited entries.`,
  };
}

// ─── public API ───────────────────────────────────────────────────────────────

/**
 * Call before any CREATE operation.
 * - demo      → blocked (view-only)
 * - demo_plus → allowed only if section count < 1
 * - pro       → always allowed
 */
export async function planGuardCreate(
  shopId:  string,
  section: Section,
): Promise<PlanGuardResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Unauthorized" };

  const { plan, expiresAt } = await getShopPlan(shopId);

  if (plan === "demo") return demoOnlyError();

  if (plan === "demo_plus") {
    if (!expiresAt || new Date(expiresAt) < new Date()) return demoPlusExpiredError();
    const count = await sectionCount(shopId, section);
    if (count >= 1) return demoPlusLimitError(section);
  }

  return { ok: true, plan, userId: session.user.id };
}

/**
 * Call before any EDIT or DELETE operation.
 * - demo      → blocked
 * - demo_plus → allowed while not expired (editing the 1 existing entry is fine)
 * - pro       → always allowed
 */
export async function planGuardMutate(shopId: string): Promise<PlanGuardResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Unauthorized" };

  const { plan, expiresAt } = await getShopPlan(shopId);

  if (plan === "demo") return demoOnlyError();
  if (plan === "demo_plus" && expiresAt && new Date(expiresAt) < new Date()) return demoPlusExpiredError();

  return { ok: true, plan, userId: session.user.id };
}

/**
 * Legacy helper kept for backward compat — same as planGuardMutate but reads
 * plan from JWT (fast, no shopId needed). Use planGuardCreate / planGuardMutate
 * for new code.
 */
export async function requirePaidPlan(): Promise<PlanGuardResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Unauthorized" };

  const userId = session.user.id;
  const plan   = (session.user.plan as string | undefined) ?? "demo";

  if (plan === "demo") return demoOnlyError();

  const planExpiry = session.user.planExpiry as string | undefined;
  if (plan === "demo_plus" && planExpiry && new Date(planExpiry) < new Date()) {
    return demoPlusExpiredError();
  }

  return { ok: true, plan, userId };
}
