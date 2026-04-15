"use server";

import { revalidatePath } from "next/cache";
import prisma             from "@/lib/prisma";
import { resolveActor, logActivity, capturePayment } from "@/lib/actions";

export type ActionResult = { success: boolean; error?: string; saleId?: string };

type PaymentLine = { method: string; amount: number };

function revalidate(shopId: string) {
  revalidatePath(`/${shopId}/sales/sold`,       "page");
  revalidatePath(`/${shopId}/finance/payments`, "page");
  revalidatePath(`/${shopId}/finance/credit`,   "page");
  revalidatePath(`/${shopId}/inventory/stock`);
  revalidatePath(`/${shopId}/dashboard`);
}

// ── CREATE SALE ───────────────────────────────────────────────────────────────
export async function createSaleAction(
  shopId: string,
  data: {
    items: { productId: string; quantity: number; price: number; discount: number }[];
    payments: PaymentLine[];
    customerName?:  string;
    customerPhone?: string;
    creditDueDate?: string; // ISO date string — required when any payment method is "credit"
  },
): Promise<ActionResult> {
  const actor = await resolveActor(shopId);
  if (!actor) return { success: false, error: "Unauthorized." };

  if (!data.items?.length) return { success: false, error: "Add at least one item." };
  if (!data.payments?.length) return { success: false, error: "Add at least one payment method." };

  const totalPaid   = data.payments.reduce((s, p) => s + p.amount, 0);
  const totalAmount = data.items.reduce(
    (s, i) => s + (i.price - i.discount) * i.quantity, 0,
  );
  if (totalPaid < totalAmount)
    return { success: false, error: `Payment KSh ${totalPaid.toLocaleString()} < total KSh ${totalAmount.toLocaleString()}.` };

  const creditPmt   = data.payments.find(p => p.method === "credit");
  const creditAmt   = creditPmt?.amount ?? 0;
  const cashPmts    = data.payments.filter(p => p.method !== "credit");
  const downPayment = cashPmts.reduce((s, p) => s + p.amount, 0);

  if (creditAmt > 0 && !data.customerName?.trim())
    return { success: false, error: "Customer name is required for credit sales." };
  if (creditAmt > 0 && !data.creditDueDate)
    return { success: false, error: "Due date is required for credit sales." };

  try {
    const saleId = await prisma.$transaction(async (tx) => {
      // 1. Verify stock
      for (const item of data.items) {
        const product = await tx.product.findUnique({
          where:  { id: item.productId },
          select: { quantity: true, productName: true },
        });
        if (!product) throw new Error(`Product not found.`);
        if (product.quantity < item.quantity)
          throw new Error(`Insufficient stock for "${product.productName}".`);
      }

      // 2. Create the sale
      const primaryMethod = data.payments[0].method;
      const sale = await tx.sale.create({
        data: {
          shopId,
          soldById:           actor.userId,
          totalAmount,
          paymentMethod:      primaryMethod,
          paymentMethodsJson: JSON.stringify(data.payments),
          customerName:       data.customerName  || null,
          customerPhone:      data.customerPhone || null,
          status:             "completed",
          saleItems: {
            create: data.items.map((i) => ({
              productId: i.productId,
              quantity:  i.quantity,
              price:     i.price,
              discount:  i.discount,
            })),
          },
        },
      });

      // 3. Deduct stock
      for (const item of data.items) {
        await tx.product.update({
          where: { id: item.productId },
          data:  { quantity: { decrement: item.quantity } },
        });
      }

      // 4. Capture only NON-credit payments into the Payments ledger
      for (const pmt of cashPmts) {
        if (pmt.amount > 0) {
          await capturePayment(tx, {
            shopId,
            amount: pmt.amount,
            method: pmt.method,
            source: "sale",
            saleId: sale.id,
          });
        }
      }

      // 5. If any credit portion, create a Credit record
      if (creditAmt > 0) {
        await tx.credit.create({
          data: {
            shopId,
            customerName:  data.customerName!.trim(),
            customerPhone: data.customerPhone?.trim() || null,
            amount:        totalAmount,
            downPayment,
            dueDate:       new Date(data.creditDueDate!),
            status:        downPayment >= totalAmount ? "paid" : "pending",
          },
        });
      }

      return sale.id;
    });

    await logActivity({
      userId:   actor.userId,
      shopId,
      action:   "create",
      entity:   "Sale",
      entityId: saleId,
      details:  { totalAmount, items: data.items.length, payments: data.payments },
      path:     `/${shopId}/sales/sold`,
    });

    revalidate(shopId);
    return { success: true, saleId };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Sale failed." };
  }
}

// ── CANCEL SALE ───────────────────────────────────────────────────────────────
export async function cancelSaleAction(
  saleId: string,
  reason: string,
  shopId: string,
): Promise<ActionResult> {
  const actor = await resolveActor(shopId, { requireManager: true });
  if (!actor) return { success: false, error: "Managers only." };

  try {
    const sale = await prisma.sale.findUnique({
      where:   { id: saleId },
      include: { saleItems: { select: { productId: true, quantity: true } } },
    });
    if (!sale)                        return { success: false, error: "Sale not found." };
    if (sale.status === "cancelled")  return { success: false, error: "Already cancelled." };

    await prisma.$transaction(async (tx) => {
      for (const item of sale.saleItems) {
        await tx.product.update({
          where: { id: item.productId },
          data:  { quantity: { increment: item.quantity } },
        });
      }
      await tx.sale.update({
        where: { id: saleId },
        data:  { status: "cancelled", cancelReason: reason || "No reason provided" },
      });
    });

    await logActivity({
      userId:   actor.userId,
      shopId,
      action:   "cancel",
      entity:   "Sale",
      entityId: saleId,
      details:  { reason, totalAmount: sale.totalAmount },
      path:     `/${shopId}/sales/sold`,
    });

    revalidate(shopId);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Cancel failed." };
  }
}

// ── MARK PRINTED ─────────────────────────────────────────────────────────────
export async function markSalePrintedAction(
  saleId: string,
  shopId: string,
): Promise<ActionResult> {
  const actor = await resolveActor(shopId);
  if (!actor) return { success: false, error: "Unauthorized." };

  try {
    await prisma.sale.update({ where: { id: saleId }, data: { isPrinted: true } });
    revalidatePath(`/${shopId}/sales/sold`, "page");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to mark printed." };
  }
}
