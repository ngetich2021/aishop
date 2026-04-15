import { redirect } from "next/navigation";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import ProductsView from "./_components/ProductsView";

export const revalidate = 0;

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ProductsPage({ params }: Props) {
  const { id: shopId } = await params;

  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const userId = session.user.id;

  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { role: true, shopId: true },
  });

  const role    = (profile?.role ?? "owner").toLowerCase().trim();
  const isOwner = role === "owner";

  // Verify shop access
  if (isOwner) {
    const owned = await prisma.shop.findUnique({ where: { id: shopId }, select: { userId: true } });
    if (!owned || owned.userId !== userId) redirect(`/welcome`);
  } else {
    if (profile?.shopId !== shopId) redirect(`/welcome`);
  }

  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    select: { id: true, name: true, location: true },
  });
  if (!shop) redirect("/welcome");

  const [products, categories, subCategories, saleItems, returnItems] = await Promise.all([
    prisma.product.findMany({
      where: { shopId },
      include: { subCategory: { include: { category: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.subCategory.findMany({
      include: { category: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.saleItem.findMany({
      where: { sale: { shopId } },
      select: { quantity: true, productId: true },
    }),
    prisma.returnItem.findMany({
      where: { return: { shopId } },
      select: { quantity: true, productId: true },
    }),
  ]);

  // Per-product sold / returned aggregates
  const soldMap = saleItems.reduce<Record<string, number>>((acc, s) => {
    acc[s.productId] = (acc[s.productId] ?? 0) + s.quantity;
    return acc;
  }, {});
  const returnMap = returnItems.reduce<Record<string, number>>((acc, r) => {
    acc[r.productId] = (acc[r.productId] ?? 0) + r.quantity;
    return acc;
  }, {});

  const totalSold     = saleItems.reduce((s, x) => s + x.quantity, 0);
  const totalReturned = returnItems.reduce((s, x) => s + x.quantity, 0);
  const productValue  = products.reduce((s, p) => s + p.quantity * p.buyingPrice, 0);
  const outOfStock    = products.filter((p) => p.quantity <= p.outOfStockLimit).length;
  const slowSelling   = products.filter((p) => (soldMap[p.id] ?? 0) < 3).length;

  const formattedProducts = products.map((p) => ({
    id:            p.id,
    name:          p.productName,
    serialNo:      p.serialNo ?? "",
    image:         p.imageUrl,
    category:      p.subCategory.category.name,
    subcategory:   p.subCategory.name,
    price:         p.sellingPrice,
    discount:      p.discount,
    quantity:      p.quantity,
    shopId:        p.shopId,
    buyingPrice:   p.buyingPrice,
    subCategoryId: p.subCategoryId,
    categoryId:    p.subCategory.categoryId,
    outOfStockLimit: p.outOfStockLimit,
    totalSold:     soldMap[p.id] ?? 0,
    totalReturned: returnMap[p.id] ?? 0,
  }));

  const formattedSubCategories = subCategories.map((s) => ({
    id:         s.id,
    name:       s.name,
    categoryId: s.categoryId,
    category:   { name: s.category.name },
  }));

  return (
    <ProductsView
      shopId={shopId}
      activeShop={shop}
      isOwner={isOwner}
      stats={{ totalProducts: products.length, productValue, totalSold, totalReturned, outOfStock, slowSelling }}
      products={formattedProducts}
      categories={categories}
      subCategories={formattedSubCategories}
    />
  );
}
