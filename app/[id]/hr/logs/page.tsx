import { auth } from "@/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { logActivity } from "@/lib/log-activity";
import LogsClient from "./_components/LogsClient";

export const revalidate = 0;

interface Props { params: Promise<{ id: string }> }

export default async function LogsPage({ params }: Props) {
  const { id: shopId } = await params;

  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const userId = session.user.id;

  // Access guard — only staff/managers of this shop or admin
  const [profile] = await Promise.all([
    prisma.profile.findUnique({
      where:  { userId },
      select: { role: true, shopId: true },
    }),
  ]);

  const role    = (profile?.role ?? "user").toLowerCase().trim();
  const isAdmin = role === "admin" || role === "owner";

  if (isAdmin) {
    const owned = await prisma.shop.findUnique({ where: { id: shopId }, select: { userId: true } });
    if (!owned || owned.userId !== userId) redirect("/welcome");
  } else {
    if (profile?.shopId !== shopId) redirect("/welcome");
  }

  const shop = await prisma.shop.findUnique({
    where:  { id: shopId },
    select: { id: true, name: true },
  });
  if (!shop) redirect("/welcome");

  // Log this visit (fire-and-forget)
  void logActivity(userId, `/${shopId}/hr/logs`, "GET", "Viewed HR logs");

  // ── LoginLogs ─────────────────────────────────────────────────────────────
  const rawLogin = await prisma.loginLog.findMany({
    orderBy: { loginTime: "desc" },
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

  // ── ActivityLogs ──────────────────────────────────────────────────────────
  const rawActivity = await prisma.activityLog.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
    },
  });

  const activityLogs = rawActivity.map(a => ({
    id:        a.id,
    userId:    a.userId,
    action:    a.action,
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
    />
  );
}
