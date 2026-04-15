import { auth } from "@/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import AdvanceView from "./_components/AdvanceView";

export const revalidate = 0;

interface Props { params: Promise<{ id: string }> }

export default async function AdvancePage({ params }: Props) {
  const { id: shopId } = await params;

  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const userId = session.user.id;

  const [profile, staffRecord] = await Promise.all([
    prisma.profile.findUnique({
      where:  { userId },
      select: { role: true, shopId: true, fullName: true },
    }),
    prisma.staff.findFirst({
      where:  { userId, shopId },
      select: { id: true, fullName: true, baseSalary: true },
    }),
  ]);

  const role      = (profile?.role ?? "user").toLowerCase().trim();
  const isAdmin   = role === "admin" || role === "owner";
  const isManager = role === "manager" || isAdmin;

  // ── access guard ─────────────────────────────────────────────────────────
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

  const isStaff = !!staffRecord && !isManager;

  // Managers see ALL advances; staff see only their own
  const raw = await prisma.advance.findMany({
    where: {
      shopId,
      ...(isStaff && staffRecord ? { staffId: staffRecord.id } : {}),
    },
    include: {
      staff: { select: { fullName: true, baseSalary: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const advances = raw.map(a => ({
    id:              a.id,
    staffId:         a.staffId,
    staffName:       a.staff.fullName,
    baseSalary:      a.staff.baseSalary,
    amount:          a.amount,
    date:            a.date.toISOString().split("T")[0],
    reason:          a.reason ?? null,
    status:          a.status,
    transactionCode: a.transactionCode ?? null,
    shopId:          a.shopId,
    shop:            shop.name,
    createdAt:       a.createdAt.toISOString().split("T")[0],
  }));

  const totalAdvance   = advances.reduce((s, a) => s + a.amount, 0);
  const pendingAdvance = advances
    .filter(a => a.status === "requested" || a.status === "approved")
    .reduce((s, a) => s + a.amount, 0);
  const approvedCount  = advances.filter(a => a.status === "approved").length;

  // Staff list for manager to assign advances
  const staffList = isManager
    ? await prisma.staff.findMany({
        where:   { shopId },
        select:  { id: true, fullName: true, baseSalary: true },
        orderBy: { fullName: "asc" },
      })
    : [];

  return (
    <AdvanceView
      shopId={shopId}
      activeShop={{ id: shop.id, name: shop.name, location: shop.location }}
      isStaff={isStaff}
      isAdmin={isAdmin}
      isManager={isManager}
      currentStaff={staffRecord ?? null}
      stats={{ totalAdvances: advances.length, totalAdvance, pendingAdvance, approvedCount }}
      advances={advances}
      staffList={staffList}
    />
  );
}
