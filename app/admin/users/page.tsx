import prisma    from "@/lib/prisma";
import UsersView from "./_components/UsersView";

export const revalidate = 0;

interface Props {
  searchParams: Promise<{ page?: string }>;
}

export default async function AdminUsersPage({ searchParams }: Props) {
  const { page: pageParam } = await searchParams;
  const page  = Math.max(1, parseInt(pageParam ?? "1", 10));
  const take  = 20;
  const skip  = (page - 1) * take;

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take,
      skip,
      include: {
        profile:      { select: { role: true, fullName: true, email: true } },
        subscription: { select: { plan: true, status: true, proBalance: true } },
        _count:       { select: { shops: true } },
      },
    }),
    prisma.user.count(),
  ]);

  const serialized = users.map(u => ({
    id:         u.id,
    name:       u.name ?? "—",
    email:      u.email ?? "—",
    image:      u.image ?? null,
    createdAt:  u.createdAt.toISOString(),
    role:       u.profile?.role ?? "user",
    fullName:   u.profile?.fullName ?? null,
    plan:       u.subscription?.plan ?? "demo",
    subStatus:  u.subscription?.status ?? "active",
    proBalance: u.subscription?.proBalance ?? 0,
    shopCount:  u._count.shops,
  }));

  return (
    <UsersView
      users={serialized}
      page={page}
      total={total}
      perPage={take}
    />
  );
}
