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

  // Non-owners (staff/manager/admin) go straight to their assigned shop
  if (!isOwner) {
    if (profile?.shopId) {
      redirect(`/${profile.shopId}/dashboard`);
    }
    // No shop assigned yet — show a holding page
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 max-w-md w-full p-10 text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center mx-auto">
            <svg className="w-7 h-7 text-blue-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
            </svg>
          </div>
          <h1 className="text-xl font-black text-gray-900">Waiting for shop access</h1>
          <p className="text-sm text-gray-500">
            You haven&apos;t been assigned to a shop yet. Ask your shop owner to send you an invite link.
          </p>
          <p className="text-xs text-gray-400">Signed in as <span className="font-semibold">{userName}</span></p>
        </div>
      </div>
    );
  }

  // Owners see all their shops
  const shops = await prisma.shop.findMany({
    where:   { userId },
    select:  { id: true, name: true, tel: true, location: true },
    orderBy: { createdAt: "asc" },
  });

  const subscription = await prisma.userSubscription.findUnique({
    where:  { userId },
    select: { plan: true, status: true },
  });
  const plan = subscription?.plan ?? "demo";

  return (
    <ShopSelectClient
      shops={shops}
      isOwner={isOwner}
      userName={userName}
      userId={userId}
      plan={plan}
    />
  );
}
