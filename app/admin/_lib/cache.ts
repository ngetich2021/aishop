/**
 * Admin ISR data layer.
 *
 * All heavy Prisma queries live here, wrapped in unstable_cache so they are
 * cached for REVALIDATE seconds server-side.  Mutations in _actions/index.ts
 * call revalidateTag("admin") to bust every entry immediately.
 *
 * Pages become thin: call one function, pass the result straight to the view.
 */

import { unstable_cache } from "next/cache";
import prisma from "@/lib/prisma";

export const ADMIN_TAG  = "admin";
const        REVALIDATE = 30; // seconds

// ── helper ────────────────────────────────────────────────────────────────────
function iso(d?: Date | null) { return d ? d.toISOString() : null; }

// ── Overview ──────────────────────────────────────────────────────────────────
export const getAdminOverview = unstable_cache(
  async () => {
    const now          = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalUsers, totalShops,
      proUsers, demoPlusUsers,
      totalRevenueAgg, monthRevenueAgg,
      newUsersThisWeek, activeShops, suspendedShops,
      recentPayments, recentUsers, mpesaCallbacks, demoUsers,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.shop.count(),
      prisma.userSubscription.count({ where: { plan: "pro" } }),
      prisma.userSubscription.count({ where: { plan: "demo_plus" } }),
      prisma.subscriptionPayment.aggregate({ where: { status: "completed" }, _sum: { amount: true } }),
      prisma.subscriptionPayment.aggregate({ where: { status: "completed", createdAt: { gte: startOfMonth } }, _sum: { amount: true } }),
      prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      (prisma.shopBilling as any).count({ where: { status: "active" } }),
      (prisma.shopBilling as any).count({ where: { status: "suspended" } }),
      prisma.subscriptionPayment.findMany({
        where: { status: "completed" }, orderBy: { createdAt: "desc" }, take: 8,
        include: { subscription: { include: { user: { select: { name: true, email: true } } } } },
      }),
      prisma.user.findMany({
        orderBy: { createdAt: "desc" }, take: 8,
        include: {
          profile:      { select: { role: true, fullName: true } },
          subscription: { select: { plan: true, status: true } },
          _count:       { select: { shops: true } },
        },
      }),
      prisma.mpesaCallback.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
      prisma.userSubscription.count({ where: { plan: "demo" } }),
    ]);

    return {
      stats: {
        totalUsers, totalShops, proUsers, demoPlusUsers, demoUsers,
        totalRevenue:      totalRevenueAgg._sum.amount ?? 0,
        revenueThisMonth:  monthRevenueAgg._sum.amount ?? 0,
        newUsersThisWeek,  activeShops, suspendedShops,
      },
      recentPayments: recentPayments.map(p => ({
        id: p.id, phone: p.phone ?? "", amount: p.amount, plan: p.plan,
        mpesaRef: p.mpesaRef ?? "", createdAt: iso(p.createdAt)!,
        userName:  p.subscription.user.name  ?? p.subscription.user.email ?? "Unknown",
        userEmail: p.subscription.user.email ?? "",
      })),
      recentUsers: recentUsers.map(u => ({
        id: u.id, name: u.name ?? "—", email: u.email ?? "—",
        role: u.profile?.role ?? "user", plan: u.subscription?.plan ?? "demo",
        shopCount: u._count.shops, createdAt: iso(u.createdAt)!,
      })),
      mpesaCallbacks: mpesaCallbacks.map(c => ({
        id: c.id, checkoutRequestId: c.checkoutRequestId,
        resultCode: c.resultCode ?? 0, mpesaReceiptNo: c.mpesaReceiptNo ?? "",
        amount: c.amount ?? 0, phoneNumber: c.phoneNumber ?? "",
        processed: c.processed, createdAt: iso(c.createdAt)!,
      })),
    };
  },
  ["admin-overview"],
  { revalidate: REVALIDATE, tags: [ADMIN_TAG, "admin-overview"] },
);

// ── Users ─────────────────────────────────────────────────────────────────────
export const getAdminUsers = unstable_cache(
  async (page: number, take: number) => {
    const skip = (page - 1) * take;
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        orderBy: { createdAt: "desc" }, take, skip,
        include: {
          profile:      { select: { role: true, fullName: true, email: true } },
          subscription: { select: { plan: true, status: true, proBalance: true } },
          _count:       { select: { shops: true } },
        },
      }),
      prisma.user.count(),
    ]);
    return {
      users: users.map(u => ({
        id: u.id, name: u.name ?? "—", email: u.email ?? "—",
        image: u.image ?? null, createdAt: iso(u.createdAt)!,
        role:       u.profile?.role ?? "user",
        fullName:   u.profile?.fullName ?? null,
        plan:       u.subscription?.plan ?? "demo",
        subStatus:  u.subscription?.status ?? "active",
        proBalance: u.subscription?.proBalance ?? 0,
        shopCount:  u._count.shops,
      })),
      total,
    };
  },
  ["admin-users"],
  { revalidate: REVALIDATE, tags: [ADMIN_TAG, "admin-users"] },
);

// ── Shops ─────────────────────────────────────────────────────────────────────
export const getAdminShops = unstable_cache(
  async () => {
    const shops = await prisma.shop.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { name: true, email: true, subscription: { select: { plan: true } } } },
        billing: { select: { status: true, dailyRate: true, lastBilledAt: true } },
        _count:  { select: { products: true, staffs: true, sales: true } },
      },
    });
    return shops.map(s => ({
      id: s.id, name: s.name, tel: s.tel, location: s.location,
      createdAt:     iso(s.createdAt)!,
      ownerName:     s.user.name  ?? "—",
      ownerEmail:    s.user.email ?? "—",
      plan:          s.user.subscription?.plan ?? "demo",
      billingStatus: (s.billing as any)?.status     ?? null,
      dailyRate:     (s.billing as any)?.dailyRate   ?? null,
      lastBilledAt:  iso((s.billing as any)?.lastBilledAt),
      productCount:  s._count.products,
      staffCount:    s._count.staffs,
      salesCount:    s._count.sales,
    }));
  },
  ["admin-shops"],
  { revalidate: REVALIDATE, tags: [ADMIN_TAG, "admin-shops"] },
);

// ── Billing ───────────────────────────────────────────────────────────────────
export const getAdminBilling = unstable_cache(
  async () => {
    const now    = new Date();
    const months: { year: number; month: number; label: string }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ year: d.getFullYear(), month: d.getMonth(),
        label: d.toLocaleDateString("en-KE", { month: "short", year: "numeric" }) });
    }

    const [subscriptionPayments, shopBillingLogs, planDist] = await Promise.all([
      prisma.subscriptionPayment.findMany({
        orderBy: { createdAt: "desc" }, take: 500,
        include: { subscription: { include: { user: { select: { name: true, email: true } } } } },
      }),
      (prisma.shopBillingLog as any).findMany({
        orderBy: { billedAt: "desc" }, take: 500,
        include: { billing: { include: { shop: { select: { name: true } } } } },
      }),
      Promise.all([
        prisma.userSubscription.count({ where: { plan: "demo" } }),
        prisma.userSubscription.count({ where: { plan: "demo_plus" } }),
        prisma.userSubscription.count({ where: { plan: "pro" } }),
      ]),
    ]);

    const monthlyRevenue = await Promise.all(
      months.map(async m => {
        const start = new Date(m.year, m.month, 1);
        const end   = new Date(m.year, m.month + 1, 1);
        const agg   = await prisma.subscriptionPayment.aggregate({
          where: { status: "completed", createdAt: { gte: start, lt: end } },
          _sum:  { amount: true },
        });
        return { label: m.label, total: agg._sum.amount ?? 0 };
      })
    );

    return {
      subscriptionPayments: subscriptionPayments.map(p => ({
        id: p.id, plan: p.plan, amount: p.amount,
        phone: p.phone ?? "", mpesaRef: p.mpesaRef ?? "",
        status: p.status, createdAt: iso(p.createdAt)!,
        userName:  p.subscription.user.name  ?? p.subscription.user.email ?? "Unknown",
        userEmail: p.subscription.user.email ?? "",
      })),
      shopBillingLogs: (shopBillingLogs as any[]).map((l: any) => ({
        id: l.id, shopName: l.billing?.shop?.name ?? "Unknown",
        amount: l.amount, type: l.type, status: l.status,
        reason: l.reason ?? "", billedAt: iso(l.billedAt)!,
      })),
      planDist: { demo: planDist[0], demoPlusUsers: planDist[1], pro: planDist[2] },
      monthlyRevenue,
    };
  },
  ["admin-billing"],
  { revalidate: 60, tags: [ADMIN_TAG, "admin-billing"] },
);

// ── Payments ──────────────────────────────────────────────────────────────────
export const getAdminPayments = unstable_cache(
  async () => {
    const [mpesaCallbacks, subscriptionPayments] = await Promise.all([
      prisma.mpesaCallback.findMany({ orderBy: { createdAt: "desc" }, take: 500 }),
      prisma.subscriptionPayment.findMany({
        orderBy: { createdAt: "desc" }, take: 500,
        include: { subscription: { include: { user: { select: { name: true, email: true } } } } },
      }),
    ]);
    return {
      mpesaCallbacks: mpesaCallbacks.map(c => ({
        id: c.id, checkoutRequestId: c.checkoutRequestId,
        merchantRequestId: c.merchantRequestId ?? "",
        resultCode: c.resultCode ?? 0, resultDesc: c.resultDesc ?? "",
        mpesaReceiptNo: c.mpesaReceiptNo ?? "", amount: c.amount ?? 0,
        phoneNumber: c.phoneNumber ?? "", processed: c.processed,
        createdAt: iso(c.createdAt)!,
      })),
      subscriptionPayments: subscriptionPayments.map(p => ({
        id: p.id, plan: p.plan, amount: p.amount,
        phone: p.phone ?? "", mpesaRef: p.mpesaRef ?? "",
        status: p.status, createdAt: iso(p.createdAt)!,
        userName:  p.subscription.user.name  ?? p.subscription.user.email ?? "Unknown",
        userEmail: p.subscription.user.email ?? "",
      })),
    };
  },
  ["admin-payments"],
  { revalidate: REVALIDATE, tags: [ADMIN_TAG, "admin-payments"] },
);

// ── Activity ──────────────────────────────────────────────────────────────────
export const getAdminActivity = unstable_cache(
  async () => {
    const [loginLogs, activityLogs] = await Promise.all([
      prisma.loginLog.findMany({
        orderBy: { loginTime: "desc" }, take: 500,
        include: { user: { select: { name: true, email: true, image: true } } },
      }),
      prisma.activityLog.findMany({
        orderBy: { createdAt: "desc" }, take: 500,
        include: { user: { select: { name: true, email: true, image: true } } },
      }),
    ]);
    return {
      loginLogs: loginLogs.map(l => ({
        id: l.id, userId: l.userId, shopId: l.shopId ?? null,
        loginTime:  iso(l.loginTime)!,
        logoutTime: iso(l.logoutTime),
        lastSeen:   iso(l.lastSeen)!,
        duration:   l.duration ?? 0,
        userName:   l.user.name  ?? "—",
        userEmail:  l.user.email ?? "—",
        userImage:  l.user.image ?? null,
      })),
      activityLogs: activityLogs.map(l => ({
        id: l.id, userId: l.userId, shopId: l.shopId ?? null,
        action: l.action, entity: l.entity ?? null, details: l.details ?? null,
        path: l.path, createdAt: iso(l.createdAt)!,
        userName:  l.user.name  ?? "—",
        userEmail: l.user.email ?? "—",
        userImage: l.user.image ?? null,
      })),
    };
  },
  ["admin-activity"],
  { revalidate: REVALIDATE, tags: [ADMIN_TAG, "admin-activity"] },
);
