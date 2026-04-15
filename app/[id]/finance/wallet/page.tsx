import { auth }     from "@/auth";
import { redirect }  from "next/navigation";
import prisma        from "@/lib/prisma";
import WalletView    from "./_components/WalletView";

export const revalidate = 0;

interface Props { params: Promise<{ id: string }> }

export default async function WalletPage({ params }: Props) {
  const { id: shopId } = await params;

  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const userId = session.user.id;

  const profile = await prisma.profile.findUnique({
    where:  { userId },
    select: { role: true, shopId: true },
  });

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
    select: { id: true, name: true, location: true },
  });
  if (!shop) redirect("/welcome");

  // ── Fetch wallet, transactions, and payments balance ──────────────────────
  const [wallet, raw, payInAgg, payOutAgg] = await Promise.all([
    prisma.wallet.findUnique({ where: { shopId }, select: { balance: true } }),

    prisma.transaction.findMany({
      where:   { shopId },
      orderBy: { createdAt: "desc" },
    }),

    prisma.payment.aggregate({ where: { shopId, direction: "in"  }, _sum: { amount: true } }),
    prisma.payment.aggregate({ where: { shopId, direction: "out" }, _sum: { amount: true } }),
  ]);

  const paymentsBalance = (payInAgg._sum.amount ?? 0) - (payOutAgg._sum.amount ?? 0);

  // ── Stats from transaction history ─────────────────────────────────────────
  const totalDeposited = raw
    .filter(t => t.type === "deposit" || t.type === "transfer_in")
    .reduce((s, t) => s + t.amount, 0);

  const totalWithdrawn = raw
    .filter(t => t.type === "withdraw" || t.type === "transfer_out")
    .reduce((s, t) => s + t.amount, 0);

  const transactions = raw.map(t => ({
    id:           t.id,
    name:         t.name,
    amount:       t.amount,
    type:         t.type as "deposit" | "withdraw" | "transfer_out" | "transfer_in",
    sourceOfMoney: t.sourceOfMoney,
    toShopName:   t.toShopName ?? null,
    fromShopName: t.fromShopName ?? null,
    authorizedBy: t.authorizedBy,
    date:         t.createdAt.toISOString().split("T")[0],
    time:         t.createdAt.toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" }),
  }));

  return (
    <WalletView
      activeShop={{ id: shop.id, name: shop.name, location: shop.location }}
      isAdmin={isAdmin}
      balance={wallet?.balance ?? 0}
      transactions={transactions}
      paymentsBalance={paymentsBalance}
      stats={{ totalDeposited, totalWithdrawn }}
    />
  );
}
