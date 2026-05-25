import { auth }              from "@/auth";
import { redirect }          from "next/navigation";
import prisma                 from "@/lib/prisma";
import WalletView             from "./_components/WalletView";
import { getWalletPageData }  from "@/lib/shop-cache";

export const dynamic = "force-dynamic";

interface Props { params: Promise<{ id: string }> }

export default async function WalletPage({ params }: Props) {
  const { id: shopId } = await params;

  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const userId = session.user.id;

  const profile = await prisma.profile.findUnique({ where: { userId }, select: { role: true, shopId: true } });

  const role    = (profile?.role ?? "user").toLowerCase().trim();
  const isAdmin = role === "admin" || role === "owner";

  if (isAdmin) {
    const owned = await prisma.shop.findUnique({ where: { id: shopId }, select: { userId: true } });
    if (!owned || owned.userId !== userId) redirect("/welcome");
  } else {
    if (profile?.shopId !== shopId) redirect("/welcome");
  }

  const shop = await prisma.shop.findUnique({ where: { id: shopId }, select: { id: true, name: true, location: true } });
  if (!shop) redirect("/welcome");

  const { balance, transactions, paymentsBalance, stats } = await getWalletPageData(shopId);

  return <WalletView activeShop={{ id: shop.id, name: shop.name, location: shop.location }} isAdmin={isAdmin} balance={balance} transactions={transactions} paymentsBalance={paymentsBalance} stats={stats} />;
}
