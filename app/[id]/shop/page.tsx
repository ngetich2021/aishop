import { redirect } from "next/navigation";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import ShopSelectClient from "./_components/ShopSelectClient";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ShopPage({ params }: Props) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user?.id) redirect("/");

  // Ownership guard — the URL id must match the logged-in user
  if (session.user.id !== id) redirect(`/${session.user.id}/shop`);

  const userId = session.user.id;
  const userName = session.user.name ?? session.user.email ?? "there";

  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { role: true, shopId: true },
  });

  const role    = (profile?.role ?? "user").toLowerCase().trim();
  const isOwner = role === "owner";

  let shops: { id: string; name: string; tel: string; location: string }[] = [];

  if (isOwner) {
    // Owners see all shops they created
    shops = await prisma.shop.findMany({
      where: { userId },
      select: { id: true, name: true, tel: true, location: true },
      orderBy: { createdAt: "asc" },
    });
  } else {
    // Other roles: only the shop they are assigned to via profile.shopId
    if (profile?.shopId) {
      const shop = await prisma.shop.findUnique({
        where: { id: profile.shopId },
        select: { id: true, name: true, tel: true, location: true },
      });
      if (shop) shops = [shop];
    }
  }

  return (
    <ShopSelectClient
      shops={shops}
      isOwner={isOwner}
      userName={userName}
      userId={userId}
    />
  );
}
