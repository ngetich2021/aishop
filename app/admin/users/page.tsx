import { getAdminUsers } from "@/app/admin/_lib/cache";
import UsersView          from "./_components/UsersView";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ page?: string }>;
}

export default async function AdminUsersPage({ searchParams }: Props) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10));
  const take = 20;

  const { users, total } = await getAdminUsers(page, take);

  return <UsersView users={users} page={page} total={total} perPage={take} />;
}
