import { auth }       from "@/auth";
import { redirect }   from "next/navigation";
import prisma         from "@/lib/prisma";
import StaffView      from "./_components/StaffView";

export const revalidate = 0;

interface Props { params: Promise<{ id: string }> }

export default async function StaffPage({ params }: Props) {
  const { id: shopId } = await params;

  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const userId = session.user.id;

  const profile = await prisma.profile.findUnique({
    where:  { userId },
    select: { role: true, shopId: true, fullName: true },
  });

  const role      = (profile?.role ?? "user").toLowerCase().trim();
  const isAdmin   = role === "admin" || role === "owner";
  const isManager = role === "manager" || isAdmin;

  // ── Access guard ─────────────────────────────────────────────────────────
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

  // My own staff record (for self-service advance panel)
  const myStaffRecord = await prisma.staff.findUnique({
    where:  { userId },
    select: { id: true, baseSalary: true, shopId: true },
  });

  // ── Parallel data fetch ───────────────────────────────────────────────────
  const [staffList, rolesList, advances, salaries, candidateUsers, myAdvances] = await Promise.all([
    // Staff in this shop with their user profile
    prisma.staff.findMany({
      where:   { shopId },
      include: {
        user: {
          select: {
            id:    true,
            email: true,
            image: true,
            profile: {
              select: { designation: true, allowedRoutes: true, role: true },
            },
          },
        },
      },
      orderBy: { fullName: "asc" },
    }),

    // All designation templates (Role records)
    prisma.role.findMany({ orderBy: { name: "asc" } }),

    // Advance totals per staff member
    prisma.advance.groupBy({
      by:    ["staffId"],
      where: { shopId, status: { in: ["approved", "paid"] } },
      _sum:  { amount: true },
    }),

    // Paid salary counts per staff member
    prisma.salary.groupBy({
      by:     ["staffId"],
      where:  { shopId, status: "paid" },
      _count: { id: true },
    }),

    // Users who can be added as staff (no existing Staff record)
    prisma.user.findMany({
      where:   { staff: null },
      select:  { id: true, name: true, email: true, image: true },
      orderBy: { name: "asc" },
    }),

    // Current user's own advance history (for self-service panel)
    myStaffRecord
      ? prisma.advance.findMany({
          where:   { staffId: myStaffRecord.id, shopId },
          select:  { id: true, amount: true, date: true, reason: true, status: true, createdAt: true },
          orderBy: { createdAt: "desc" },
          take:    10,
        })
      : Promise.resolve([]),
  ]);

  // ── Build lookup maps ─────────────────────────────────────────────────────
  const advanceMap: Record<string, number> = {};
  for (const a of advances) advanceMap[a.staffId] = a._sum.amount ?? 0;

  const salaryMap: Record<string, number> = {};
  for (const s of salaries) salaryMap[s.staffId] = s._count.id;

  // ── Format staff list ─────────────────────────────────────────────────────
  const fmtStaff = staffList.map(s => ({
    id:            s.id,
    userId:        s.userId,
    fullName:      s.fullName,
    tel1:          s.tel1    ?? null,
    tel2:          s.tel2    ?? null,
    mpesaNo:       s.mpesaNo ?? null,
    baseSalary:    s.baseSalary,
    shopId:        s.shopId,
    email:         s.user.email ?? null,
    image:         s.user.image ?? null,
    designation:   s.user.profile?.designation   ?? null,
    allowedRoutes: s.user.profile?.allowedRoutes ?? [],
    profileRole:   s.user.profile?.role          ?? "staff",
    totalAdvances: advanceMap[s.id] ?? 0,
    paidSalaries:  salaryMap[s.id]  ?? 0,
    createdAt:     s.createdAt.toISOString().split("T")[0],
  }));

  const totalSalaryBill = staffList.reduce((s, m) => s + m.baseSalary, 0);

  return (
    <StaffView
      shopId={shopId}
      activeShop={{ id: shop.id, name: shop.name, location: shop.location }}
      isManager={isManager}
      isAdmin={isAdmin}
      profile={{ role, fullName: profile?.fullName ?? session.user.name ?? "User" }}
      staffList={fmtStaff}
      rolesList={rolesList.map(r => ({
        id:            r.id,
        name:          r.name,
        description:   r.description,
        allowedRoutes: r.allowedRoutes,
      }))}
      candidateUsers={candidateUsers.map(u => ({
        id:    u.id,
        name:  u.name  ?? null,
        email: u.email ?? null,
        image: u.image ?? null,
      }))}
      stats={{
        total:          fmtStaff.length,
        totalSalaryBill,
        totalAdvances:  Object.values(advanceMap).reduce((s, v) => s + v, 0),
      }}
      myStaff={myStaffRecord ? {
        id:         myStaffRecord.id,
        baseSalary: myStaffRecord.baseSalary,
        shopId:     myStaffRecord.shopId,
      } : null}
      myAdvances={myAdvances.map(a => ({
        id:        a.id,
        amount:    a.amount,
        date:      a.date.toISOString().split("T")[0],
        reason:    a.reason ?? null,
        status:    a.status,
        createdAt: a.createdAt.toISOString(),
      }))}
    />
  );
}
