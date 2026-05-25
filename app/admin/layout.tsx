import { redirect }   from "next/navigation";
import { auth }       from "@/auth";
import prisma         from "@/lib/prisma";
import AdminShell     from "./_components/AdminShell";
import { ReactNode }  from "react";

interface Props {
  children: ReactNode;
}

export default async function AdminLayout({ children }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const profile = await prisma.profile.findUnique({
    where:  { userId: session.user.id },
    select: { isSystemAdmin: true, fullName: true },
  });

  if (!profile?.isSystemAdmin) redirect("/");

  const adminName = profile.fullName ?? session.user.name ?? session.user.email ?? "Admin";

  return (
    <AdminShell adminName={adminName}>
      {children}
    </AdminShell>
  );
}
