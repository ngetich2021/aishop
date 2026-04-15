import { auth } from "@/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { autoGenerateSalariesAction } from "./_components/actions";
import SalaryView from "./_components/SalaryView";

export const revalidate = 0;

interface Props { params: Promise<{ id: string }> }

export default async function SalaryPage({ params }: Props) {
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
  const isStaff   = !isManager;

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

  // Auto-generate salary records for current month (idempotent)
  await autoGenerateSalariesAction(shopId);

  const now          = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthStart   = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd     = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  // Paid advances this month per staff
  const paidAdvances = await prisma.advance.findMany({
    where: {
      shopId,
      status: { in: ["approved", "paid"] },
      date:   { gte: monthStart, lte: monthEnd },
    },
    select: { staffId: true, amount: true },
  });

  const advanceByStaff: Record<string, number> = {};
  for (const adv of paidAdvances) {
    advanceByStaff[adv.staffId] = (advanceByStaff[adv.staffId] ?? 0) + adv.amount;
  }

  // Latest payroll record per staff (to know paid status)
  const payrollRecords = await prisma.payroll.findMany({
    where:  { shopId },
    select: { staffId: true, status: true, payable: true },
    orderBy: { createdAt: "desc" },
  });
  const payrollByStaff: Record<string, { status: string; payable: number }> = {};
  for (const pr of payrollRecords) {
    if (!payrollByStaff[pr.staffId]) payrollByStaff[pr.staffId] = { status: pr.status, payable: pr.payable };
  }

  // Staff list
  const staffList = await prisma.staff.findMany({
    where:   { shopId },
    select:  { id: true, fullName: true, baseSalary: true },
    orderBy: { fullName: "asc" },
  });

  // Salary records
  const raw = await prisma.salary.findMany({
    where:   { shopId },
    include: {
      staff: { select: { fullName: true, baseSalary: true } },
      shop:  { select: { name: true } },
    },
    orderBy: [{ month: "desc" }, { createdAt: "desc" }],
  });

  const salaries = raw.map(s => {
    const advances       = advanceByStaff[s.staffId] ?? 0;
    const payroll        = payrollByStaff[s.staffId];
    const effectiveStatus = payroll?.status === "paid" ? "paid" : s.status;
    const netPayable      = Math.max(0, s.amount - advances);
    return {
      id:             s.id,
      staffName:      s.staff.fullName,
      staffId:        s.staffId,
      amount:         s.amount,
      advances,
      netPayable,
      month:          s.month,
      status:         effectiveStatus,
      shop:           s.shop.name,
      shopId:         s.shopId,
      date:           s.createdAt.toISOString().split("T")[0],
      isCurrentMonth: s.month === currentMonth,
    };
  });

  const totalAmount    = salaries.reduce((sum, s) => sum + s.amount, 0);
  const pendingAmount  = salaries.filter(s => s.status === "pending").reduce((sum, s) => sum + s.netPayable, 0);
  const paidCount      = salaries.filter(s => s.status === "paid").length;
  const totalDeductions = salaries.reduce((sum, s) => sum + s.advances, 0);

  return (
    <SalaryView
      activeShop={{ id: shop.id, name: shop.name, location: shop.location }}
      isStaff={isStaff}
      isAdmin={isAdmin}
      isManager={isManager}
      currentMonth={currentMonth}
      stats={{ totalSalaries: salaries.length, totalAmount, pendingAmount, paidCount, totalDeductions }}
      salaries={salaries}
      staffList={staffList}
    />
  );
}
