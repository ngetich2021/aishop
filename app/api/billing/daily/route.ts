/**
 * GET /api/billing/daily?secret=<BILLING_SECRET>
 *
 * Cron endpoint — charges KES 30/day per shop.
 * - Pro plan owners: deducted from their proBalance (M-Pesa deposit).
 * - Other plans: deducted from the shop's Wallet.
 * If balance is insufficient the shop billing is suspended.
 */
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { walletDeduct } from "@/lib/actions";
import { DAILY_RATE } from "@/lib/billing-constants";

const BILLING_SECRET = process.env.BILLING_SECRET ?? "kwenik-billing-2024";

type SubInfo = { id: string; plan: string; proBalance: number } | null;

type BillingRow = {
  id:        string;
  shopId:    string;
  dailyRate: number;
  shop: {
    name:   string;
    userId: string;
    user: {
      subscription: SubInfo;
    };
  };
};

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (secret !== BILLING_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now       = new Date();
  const cutoff24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // ── Migration: auto-register ShopBilling for pro users' existing shops ──────
  // This silently picks up shops created before the billing system existed.
  // No creation fee charged — just starts billing from today.
  try {
    const billedShopIds = (await prisma.shopBilling.findMany({ select: { shopId: true } }))
      .map(r => r.shopId);

    const orphanedShops = await prisma.shop.findMany({
      where: {
        user: { subscription: { plan: "pro" } },
        ...(billedShopIds.length > 0 ? { id: { notIn: billedShopIds } } : {}),
      },
      select: { id: true },
    });

    for (const shop of orphanedShops) {
      await prisma.shopBilling.create({
        data: { shopId: shop.id, dailyRate: DAILY_RATE, status: "active" },
      }).catch(() => { /* ignore unique constraint race */ });
    }
  } catch (migErr) {
    console.error("[billing/daily] migration error:", migErr);
  }

  const billings = await (prisma.shopBilling as unknown as {
    findMany: (args: unknown) => Promise<BillingRow[]>
  }).findMany({
    where: {
      status: "active",
      OR: [
        { lastBilledAt: null },
        { lastBilledAt: { lt: cutoff24h } },
      ],
    },
    select: {
      id:        true,
      shopId:    true,
      dailyRate: true,
      shop: {
        select: {
          name:   true,
          userId: true,
          user: {
            select: {
              subscription: {
                select: { id: true, plan: true, proBalance: true },
              },
            },
          },
        },
      },
    },
  });

  const summary = {
    processed: 0,
    succeeded: 0,
    failed:    0,
    details:   [] as Array<{ shopId: string; shopName: string; status: string; reason?: string; billedVia?: string }>,
  };

  for (const billing of billings) {
    summary.processed++;
    const ownerSub = billing.shop.user.subscription as SubInfo;
    const isPro    = ownerSub?.plan === "pro";
    const shopName = billing.shop.name;

    try {
      if (isPro && ownerSub) {
        // ── Pro plan: deduct from proBalance ────────────────────────────────
        if ((ownerSub.proBalance ?? 0) >= billing.dailyRate) {
          await prisma.$transaction(async (tx) => {
            await (tx.userSubscription as unknown as {
              update: (args: unknown) => Promise<unknown>
            }).update({
              where: { id: ownerSub.id },
              data:  {
                proBalance:      { decrement: billing.dailyRate },
                proLastBilledAt: now,
              },
            });

            await (tx.shopBilling as unknown as {
              update: (args: unknown) => Promise<unknown>
            }).update({
              where: { id: billing.id },
              data:  { lastBilledAt: now },
            });

            await (tx.shopBillingLog as unknown as {
              create: (args: unknown) => Promise<unknown>
            }).create({
              data: {
                billingId: billing.id,
                shopId:    billing.shopId,
                amount:    billing.dailyRate,
                type:      "daily",
                status:    "paid",
                billedAt:  now,
              },
            });
          });

          summary.succeeded++;
          summary.details.push({ shopId: billing.shopId, shopName, status: "charged", billedVia: "proBalance" });
        } else {
          // Insufficient pro balance — suspend this shop
          await prisma.$transaction(async (tx) => {
            await (tx.shopBilling as unknown as {
              update: (args: unknown) => Promise<unknown>
            }).update({
              where: { id: billing.id },
              data:  { status: "suspended" },
            });

            await (tx.shopBillingLog as unknown as {
              create: (args: unknown) => Promise<unknown>
            }).create({
              data: {
                billingId: billing.id,
                shopId:    billing.shopId,
                amount:    billing.dailyRate,
                type:      "daily",
                status:    "failed",
                reason:    "Insufficient pro balance",
                billedAt:  now,
              },
            });
          });

          summary.failed++;
          summary.details.push({ shopId: billing.shopId, shopName, status: "suspended", reason: "Insufficient pro balance" });
        }
      } else {
        // ── Non-pro: deduct from shop wallet ────────────────────────────────
        await prisma.$transaction(async (tx) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const dtx = tx as any;

          await walletDeduct(tx, {
            shopId:        billing.shopId,
            amount:        billing.dailyRate,
            type:          "withdraw",
            name:          "Daily Billing Fee",
            authorizedBy:  "System",
            referenceType: "ShopBilling",
            referenceId:   billing.id,
          });

          await dtx.shopBilling.update({
            where: { id: billing.id },
            data:  { lastBilledAt: now },
          });

          await dtx.shopBillingLog.create({
            data: {
              billingId: billing.id,
              shopId:    billing.shopId,
              amount:    billing.dailyRate,
              type:      "daily",
              status:    "paid",
              billedAt:  now,
            },
          });
        });

        summary.succeeded++;
        summary.details.push({ shopId: billing.shopId, shopName, status: "charged", billedVia: "wallet" });
      }
    } catch (err: unknown) {
      const reason = err instanceof Error ? err.message : "Unknown error";
      try {
        await prisma.$transaction(async (tx) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const dtx = tx as any;
          await dtx.shopBilling.update({ where: { id: billing.id }, data: { status: "suspended" } });
          await dtx.shopBillingLog.create({
            data: {
              billingId: billing.id,
              shopId:    billing.shopId,
              amount:    billing.dailyRate,
              type:      "daily",
              status:    "failed",
              reason,
              billedAt:  now,
            },
          });
        });
      } catch (logErr) {
        console.error("[billing/daily] failed to log suspension:", logErr);
      }

      summary.failed++;
      summary.details.push({ shopId: billing.shopId, shopName, status: "suspended", reason });
    }
  }

  return Response.json({ ok: true, timestamp: now.toISOString(), ...summary });
}
