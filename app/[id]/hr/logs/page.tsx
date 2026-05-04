import { auth } from "@/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import LogsClient from "./_components/LogsClient";

export const revalidate = 0;

interface Props { params: Promise<{ id: string }> }

const LOG_LIMIT = 300; // max rows per table — keeps payload sane for large shops

export default async function LogsPage({ params }: Props) {
  const { id: shopId } = await params;

  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const userId = session.user.id;

  // Access guard — only staff/managers of this shop or owner
  const profile = await prisma.profile.findUnique({
    where:  { userId },
    select: { role: true, shopId: true },
  });

  const role    = (profile?.role ?? "user").toLowerCase().trim();
  const isOwner = role === "admin" || role === "owner";

  if (isOwner) {
    const owned = await prisma.shop.findUnique({ where: { id: shopId }, select: { userId: true } });
    if (!owned || owned.userId !== userId) redirect("/welcome");
  } else {
    if (profile?.shopId !== shopId) redirect("/welcome");
  }

  const shop = await prisma.shop.findUnique({
    where:  { id: shopId },
    select: { id: true, name: true, userId: true },
  });
  if (!shop) redirect("/welcome");

  // ── Collect userIds that belong to this shop (owner + all active staff) ─────
  const staffRows = await prisma.staff.findMany({
    where:  { shopId },
    select: { userId: true },
  });
  const shopUserIds = Array.from(new Set([shop.userId, ...staffRows.map(s => s.userId)]));

  // ── LoginLogs — scoped to this shop's users ───────────────────────────────
  const rawLogin = await prisma.loginLog.findMany({
    where:   { userId: { in: shopUserIds } },
    orderBy: { loginTime: "desc" },
    take:    LOG_LIMIT,
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
    },
  });

  const logs = rawLogin.map(log => ({
    id:        log.id,
    userId:    log.userId,
    loginTime: log.loginTime.toISOString(),
    lastSeen:  log.lastSeen.toISOString(),
    duration:  log.duration ?? 0,
    user: {
      id:    log.user.id,
      name:  log.user.name  ?? "Unknown",
      email: log.user.email ?? "—",
      image: log.user.image ?? null,
    },
  }));

  // ── ActivityLogs — scoped to this shop ───────────────────────────────────
  // Include entries explicitly tagged with shopId OR entries from shop users
  // without a shopId tag (e.g. page-view logs from lib/log-activity.ts).
  const rawActivity = await prisma.activityLog.findMany({
    where: {
      OR: [
        { shopId },
        { shopId: null, userId: { in: shopUserIds } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take:    LOG_LIMIT,
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
    },
  });

  const activityLogs = rawActivity.map(a => ({
    id:        a.id,
    userId:    a.userId,
    action:    a.action,
    entity:    a.entity   ?? null,
    entityId:  a.entityId ?? null,
    path:      a.path,
    method:    a.method,
    createdAt: a.createdAt.toISOString(),
    user: {
      id:    a.user.id,
      name:  a.user.name  ?? "Unknown",
      email: a.user.email ?? "—",
      image: a.user.image ?? null,
    },
  }));

  // ── Stats ─────────────────────────────────────────────────────────────────
  const totalSessions = logs.length;
  const longSessions  = logs.filter(l => l.duration > 3600).length;
  const nonZero       = logs.filter(l => l.duration > 0);
  const avgDuration   = nonZero.length
    ? Math.round(nonZero.reduce((a, b) => a + b.duration, 0) / nonZero.length)
    : 0;

  return (
    <LogsClient
      activeShop={shop}
      stats={{ totalSessions, longSessions, avgDuration }}
      logs={logs}
      activityLogs={activityLogs}
      capped={rawLogin.length === LOG_LIMIT || rawActivity.length === LOG_LIMIT}
    />
  );
}
