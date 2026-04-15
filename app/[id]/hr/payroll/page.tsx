import { auth } from "@/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import PayrollView from "./_components/PayrollView";

export const revalidate = 0;

interface Props { params: Promise<{ id: string }> }

export default async function PayrollPage({ params }: Props) {
  const { id: shopId } = await params;

  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const userId = session.user.id;

  const profile = await prisma.profile.findUnique({
    where:  { userId },
    select: { role: true, shopId: true },
  });

  const role      = (profile?.role ?? "user").toLowerCase().trim();
  const isAdmin   = role === "admin" || role === "owner";
  const isManager = role === "manager" || isAdmin;

  // Access guard
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

  const now        = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthStart   = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd     = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  // Staff list for this shop
  const staffList = await prisma.staff.findMany({
    where:   { shopId },
    select:  { id: true, fullName: true, baseSalary: true },
    orderBy: { fullName: "asc" },
  });

  // Approved/paid advances this month
  const advancesThisMonth = await prisma.advance.findMany({
    where: {
      shopId,
      status: { in: ["approved", "paid"] },
      date:   { gte: monthStart, lte: monthEnd },
    },
    select: { staffId: true, amount: true },
  });

  const advanceByStaff: Record<string, number> = {};
  for (const adv of advancesThisMonth) {
    advanceByStaff[adv.staffId] = (advanceByStaff[adv.staffId] ?? 0) + adv.amount;
  }

  // Auto-generate payroll for this month if not yet present
  const existing = await prisma.payroll.findMany({
    where:  { shopId, createdAt: { gte: monthStart, lte: monthEnd } },
    select: { staffId: true },
  });
  const existingIds = new Set(existing.map(p => p.staffId));
  const toCreate    = staffList.filter(s => !existingIds.has(s.id));

  if (toCreate.length > 0) {
    await prisma.payroll.createMany({
      data: toCreate.map(s => ({
        staffId: s.id,
        shopId,
        salary:  s.baseSalary,
        payable: Math.max(0, s.baseSalary - (advanceByStaff[s.id] ?? 0)),
        status:  "pending",
      })),
    });
  } else {
    // Refresh payable on pending records in case advances changed
    const pendingPayrolls = await prisma.payroll.findMany({
      where:  { shopId, createdAt: { gte: monthStart, lte: monthEnd }, status: "pending" },
      select: { id: true, staffId: true, salary: true },
    });
    await Promise.all(
      pendingPayrolls.map(p =>
        prisma.payroll.update({
          where: { id: p.id },
          data:  { payable: Math.max(0, p.salary - (advanceByStaff[p.staffId] ?? 0)) },
        })
      )
    );
  }

  // Fetch all payrolls
  const raw = await prisma.payroll.findMany({
    where:   { shopId },
    include: {
      staff: { select: { fullName: true } },
      shop:  { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const payrolls = raw.map(p => ({
    id:             p.id,
    staffName:      p.staff.fullName,
    staffId:        p.staffId,
    salary:         p.salary,
    payable:        p.payable,
    advances:       p.salary - p.payable,
    status:         p.status,
    shop:           p.shop.name,
    shopId:         p.shopId,
    date:           p.createdAt.toISOString().split("T")[0],
    isCurrentMonth: p.createdAt >= monthStart && p.createdAt <= monthEnd,
  }));

  const totalDue        = payrolls.filter(p => p.status === "pending").reduce((s, p) => s + p.payable, 0);
  const totalSalary     = payrolls.reduce((s, p) => s + p.salary, 0);
  const totalPayable    = payrolls.reduce((s, p) => s + p.payable, 0);
  const totalDeductions = payrolls.reduce((s, p) => s + p.advances, 0);

  return (
    <PayrollView
      activeShop={{ id: shop.id, name: shop.name, location: shop.location }}
      isManager={isManager}
      currentMonth={currentMonth}
      stats={{ totalPayrolls: payrolls.length, totalDue, totalSalary, totalPayable, totalDeductions }}
      payrolls={payrolls}
      staffList={staffList.map(s => ({ id: s.id, fullName: s.fullName }))}
    />
  );
}
