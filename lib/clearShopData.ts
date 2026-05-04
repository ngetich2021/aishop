import prisma from "@/lib/prisma";

/**
 * Wipes all transactional/operational data for every shop owned by userId.
 * The shops themselves are preserved. Called when Demo+ is re-activated to
 * give the user a clean 24-hour window.
 */
export async function clearUserShopsData(userId: string): Promise<void> {
  const shops = await prisma.shop.findMany({ where: { userId }, select: { id: true } });
  const shopIds = shops.map(s => s.id);
  if (!shopIds.length) return;

  // Collect staff userIds BEFORE deleting so we can reset their profiles
  const staffRecords = await prisma.staff.findMany({
    where:  { shopId: { in: shopIds } },
    select: { userId: true },
  });
  const staffUserIds = staffRecords.map(s => s.userId);

  // Delete leaf models first, then parents (respect FK constraints)
  await prisma.saleItem.deleteMany({ where: { sale: { shopId: { in: shopIds } } } });
  await prisma.quoteItem.deleteMany({ where: { quote: { shopId: { in: shopIds } } } });
  await prisma.returnItem.deleteMany({ where: { return: { shopId: { in: shopIds } } } });
  await prisma.adjustment.deleteMany({ where: { shopId: { in: shopIds } } });
  await prisma.return.deleteMany({ where: { shopId: { in: shopIds } } });
  await prisma.sale.deleteMany({ where: { shopId: { in: shopIds } } });
  await prisma.quote.deleteMany({ where: { shopId: { in: shopIds } } });
  await prisma.product.deleteMany({ where: { shopId: { in: shopIds } } });
  await prisma.creditPayment.deleteMany({ where: { shopId: { in: shopIds } } });
  await prisma.credit.deleteMany({ where: { shopId: { in: shopIds } } });
  await prisma.expense.deleteMany({ where: { shopId: { in: shopIds } } });
  await prisma.buy.deleteMany({ where: { shopId: { in: shopIds } } });
  await prisma.asset.deleteMany({ where: { shopId: { in: shopIds } } });
  await prisma.payroll.deleteMany({ where: { shopId: { in: shopIds } } });
  await prisma.salary.deleteMany({ where: { shopId: { in: shopIds } } });
  await prisma.advance.deleteMany({ where: { shopId: { in: shopIds } } });
  await prisma.staff.deleteMany({ where: { shopId: { in: shopIds } } });
  await prisma.supplier.deleteMany({ where: { shopId: { in: shopIds } } });
  await prisma.wallet.deleteMany({ where: { shopId: { in: shopIds } } });
  await prisma.receipt.deleteMany({ where: { shopId: { in: shopIds } } });
  await prisma.payment.deleteMany({ where: { shopId: { in: shopIds } } });
  await prisma.transaction.deleteMany({ where: { shopId: { in: shopIds } } });
  await prisma.margin.deleteMany({ where: { shopId: { in: shopIds } } });
  await prisma.shopBillingLog.deleteMany({ where: { shopId: { in: shopIds } } });
  await prisma.shopBilling.deleteMany({ where: { shopId: { in: shopIds } } });
  await prisma.shopInvite.deleteMany({ where: { shopId: { in: shopIds } } });
  await prisma.role.deleteMany({ where: { shopId: { in: shopIds } } });

  // Reset profiles of deleted staff so they are no longer stuck in the old shop
  if (staffUserIds.length) {
    await prisma.profile.updateMany({
      where: { userId: { in: staffUserIds } },
      data:  { role: "user", shopId: null, designation: null, allowedRoutes: [] },
    });
  }
}
