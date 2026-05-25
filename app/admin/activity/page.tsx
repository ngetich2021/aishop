import prisma       from "@/lib/prisma";
import ActivityView from "./_components/ActivityView";

export const revalidate = 0;

export default async function AdminActivityPage() {
  const [loginLogs, activityLogs] = await Promise.all([
    prisma.loginLog.findMany({
      orderBy: { loginTime: "desc" },
      take:    500,
      include: {
        user: { select: { name: true, email: true, image: true } },
      },
    }),
    prisma.activityLog.findMany({
      orderBy: { createdAt: "desc" },
      take:    500,
      include: {
        user: { select: { name: true, email: true, image: true } },
      },
    }),
  ]);

  return (
    <ActivityView
      loginLogs={loginLogs.map(l => ({
        id:          l.id,
        userId:      l.userId,
        shopId:      l.shopId ?? null,
        loginTime:   l.loginTime.toISOString(),
        logoutTime:  l.logoutTime?.toISOString() ?? null,
        lastSeen:    l.lastSeen.toISOString(),
        duration:    l.duration ?? 0,
        userName:    l.user.name ?? "—",
        userEmail:   l.user.email ?? "—",
        userImage:   l.user.image ?? null,
      }))}
      activityLogs={activityLogs.map(l => ({
        id:        l.id,
        userId:    l.userId,
        shopId:    l.shopId ?? null,
        action:    l.action,
        entity:    l.entity ?? null,
        details:   l.details ?? null,
        path:      l.path,
        createdAt: l.createdAt.toISOString(),
        userName:  l.user.name ?? "—",
        userEmail: l.user.email ?? "—",
        userImage: l.user.image ?? null,
      }))}
    />
  );
}
