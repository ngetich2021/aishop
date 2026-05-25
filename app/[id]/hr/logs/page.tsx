import { auth }             from "@/auth";
import { redirect }         from "next/navigation";
import prisma                from "@/lib/prisma";
import LogsClient            from "./_components/LogsClient";
import { getLogsPageData }   from "@/lib/shop-cache";

export const dynamic = "force-dynamic";

interface Props { params: Promise<{ id: string }> }

export default async function LogsPage({ params }: Props) {
  const { id: shopId } = await params;

  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const userId = session.user.id;

  const profile = await prisma.profile.findUnique({ where: { userId }, select: { role: true, shopId: true } });

  const role    = (profile?.role ?? "user").toLowerCase().trim();
  const isOwner = role === "admin" || role === "owner";

  if (isOwner) {
    const owned = await prisma.shop.findUnique({ where: { id: shopId }, select: { userId: true } });
    if (!owned || owned.userId !== userId) redirect("/welcome");
  } else {
    if (profile?.shopId !== shopId) redirect("/welcome");
  }

  const shop = await prisma.shop.findUnique({ where: { id: shopId }, select: { id: true, name: true, userId: true } });
  if (!shop) redirect("/welcome");

  const { logs, activityLogs, stats, capped } = await getLogsPageData(shopId);

  return <LogsClient activeShop={shop} stats={stats} logs={logs} activityLogs={activityLogs} capped={capped} />;
}
