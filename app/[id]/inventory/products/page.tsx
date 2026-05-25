import { redirect }           from "next/navigation";
import { auth }               from "@/auth";
import prisma                  from "@/lib/prisma";
import ProductsView            from "./_components/ProductsView";
import { getProductsPageData } from "@/lib/shop-cache";

export const dynamic = "force-dynamic";

interface Props { params: Promise<{ id: string }> }

export default async function ProductsPage({ params }: Props) {
  const { id: shopId } = await params;

  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const userId = session.user.id;

  const profile = await prisma.profile.findUnique({
    where:  { userId },
    select: { role: true, shopId: true },
  });

  const role    = (profile?.role ?? "owner").toLowerCase().trim();
  const isOwner = role === "owner";

  if (isOwner) {
    const owned = await prisma.shop.findUnique({ where: { id: shopId }, select: { userId: true } });
    if (!owned || owned.userId !== userId) redirect("/welcome");
  } else {
    if (profile?.shopId !== shopId) redirect("/welcome");
  }

  const shop = await prisma.shop.findUnique({ where: { id: shopId }, select: { id: true, name: true, location: true } });
  if (!shop) redirect("/welcome");

  const { stats, products, categories, subCategories } = await getProductsPageData(shopId, userId);

  return (
    <ProductsView
      shopId={shopId}
      activeShop={shop}
      isOwner={isOwner}
      stats={stats}
      products={products}
      categories={categories}
      subCategories={subCategories}
    />
  );
}
