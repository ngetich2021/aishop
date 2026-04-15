"use server";

import { auth } from "@/auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import * as z from "zod";

export type ActionResult = { success: boolean; error?: string };

// ── SELECT SHOP ───────────────────────────────────────────────────────────────
export async function selectQuoteShopAction(shopId: string) {
  const cookieStore = await cookies();
  cookieStore.set("active_shop_id", shopId, { path: "/", httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 7 });
  redirect("/sale/quote");
}

// ── SAVE QUOTE ────────────────────────────────────────────────────────────────
const quoteItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().min(1),
  price: z.number().min(0),
  discount: z.number().default(0),
});

const quoteSchema = z.object({
  shopId: z.string().min(1, "Shop required"),
  customerName: z.string().optional(),
  customerContact: z.string().optional(),
  items: z.array(quoteItemSchema).min(1, "At least one item required"),
});

const splitSchema = z.object({
  method: z.string().min(1),
  amount: z.number().min(0),
});

const convertSchema = z.object({
  paymentMethod: z.string().min(1, "Payment method required"),
  downPayment: z.number().min(0).default(0),
  dueDate: z.string().optional(),
  customerName: z.string().optional(),
  customerContact: z.string().optional(),
  splits: z.array(splitSchema).default([]),
});

export async function saveQuoteAction(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };
  const userId = session.user.id;

  const [staffRecord, profile] = await Promise.all([
    prisma.staff.findUnique({ where: { userId }, select: { id: true, shopId: true } }),
    prisma.profile.findUnique({ where: { userId }, select: { shopId: true, role: true } }),
  ]);

  if (!staffRecord) return { success: false, error: "Your account is not linked to a staff record." };

  const role    = profile?.role?.toLowerCase().trim() ?? "staff";
  const isAdmin = role === "admin" || role === "owner";

  // Admin/owner cannot sell — only staff can
  if (isAdmin) return { success: false, error: "Admins and owners cannot create sales. Only staff can sell." };

  const submittedShopId = formData.get("shopId")?.toString() ?? "";
  const resolvedShopId  = profile?.shopId ?? staffRecord.shopId ?? submittedShopId;
  if (!resolvedShopId) return { success: false, error: "Shop not assigned." };

  // Verify staff belongs to this shop
  const staffInShop = await prisma.staff.findFirst({
    where: { userId, shopId: resolvedShopId },
    select: { id: true },
  });
  if (!staffInShop) return { success: false, error: "You are not assigned to this shop." };

  const quoteId = formData.get("quoteId")?.toString() ?? null;
  const itemsRaw = formData.get("itemsJson")?.toString();
  let items: z.infer<typeof quoteItemSchema>[] = [];
  try { items = JSON.parse(itemsRaw ?? "[]"); } catch { return { success: false, error: "Invalid items data" }; }

  const raw = {
    shopId: resolvedShopId,
    customerName: formData.get("customerName")?.toString() ?? "",
    customerContact: formData.get("customerContact")?.toString() ?? "",
    items,
  };

  try {
    const validated = quoteSchema.parse(raw);

    for (const item of validated.items) {
      const product = await prisma.product.findUnique({ where: { id: item.productId }, select: { quantity: true, productName: true, shopId: true } });
      if (!product) return { success: false, error: "Product not found" };
      if (product.shopId !== resolvedShopId) return { success: false, error: "Product does not belong to the selected shop" };
      if (product.quantity < item.quantity) return { success: false, error: `Insufficient stock for "${product.productName}" (available: ${product.quantity})` };
    }

    const totalAmount = validated.items.reduce((sum, item) => sum + (item.price - item.discount) * item.quantity, 0);
    const itemsJson   = JSON.stringify(validated.items);

    if (quoteId) {
      await prisma.$transaction([
        prisma.quoteItem.deleteMany({ where: { quoteId } }),
        prisma.quote.update({
          where: { id: quoteId },
          data: {
            soldById: staffRecord.id,
            itemsJson,
            amount: totalAmount,
            customerName: validated.customerName ?? "",
            customerContact: validated.customerContact ?? "",
            shopId: validated.shopId,
            quoteItems: {
              create: validated.items.map(item => ({
                productId: item.productId,
                quantity:  item.quantity,
                price:     item.price,
                discount:  item.discount,
              })),
            },
          },
        }),
      ]);
    } else {
      await prisma.quote.create({
        data: {
          soldById: staffRecord.id,
          itemsJson,
          amount: totalAmount,
          customerName: validated.customerName ?? "",
          customerContact: validated.customerContact ?? "",
          shopId: validated.shopId,
          quoteItems: {
            create: validated.items.map(item => ({
              productId: item.productId,
              quantity:  item.quantity,
              price:     item.price,
              discount:  item.discount,
            })),
          },
        },
      });
    }

    revalidatePath(`/${resolvedShopId}/sales/quote`, "page");
    return { success: true };
  } catch (err) {
    if (err instanceof z.ZodError) return { success: false, error: err.issues[0]?.message ?? "Validation failed" };
    console.error(err);
    return { success: false, error: quoteId ? "Update failed" : "Create failed" };
  }
}

export async function deleteQuoteAction(id: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };
  try {
    const quote = await prisma.quote.findUnique({ where: { id }, select: { shopId: true } });
    await prisma.$transaction([
      prisma.quoteItem.deleteMany({ where: { quoteId: id } }),
      prisma.quote.delete({ where: { id } }),
    ]);
    if (quote?.shopId) revalidatePath(`/${quote.shopId}/sales/quote`, "page");
    return { success: true };
  } catch {
    return { success: false, error: "Delete failed" };
  }
}

export async function convertQuoteToSaleAction(
  quoteId: string,
  paymentMethod: string,
  downPayment = 0,
  dueDate?: string,
  customerName?: string,
  customerContact?: string,
  splits: { method: string; amount: number }[] = []
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  try {
    convertSchema.parse({ paymentMethod, downPayment, dueDate, customerName, customerContact, splits });
  } catch {
    return { success: false, error: "Payment method required to convert quote to sale." };
  }

  const hasCredit   = paymentMethod === "credit" || splits.some(s => s.method === "credit");
  const creditSplit = splits.find(s => s.method === "credit");
  const cashSplits  = splits.filter(s => s.method !== "credit");

  try {
    const quote = await prisma.quote.findUnique({
      where:   { id: quoteId },
      include: { quoteItems: { select: { productId: true, quantity: true, price: true, discount: true } } },
    });

    if (!quote) return { success: false, error: "Quote not found" };

    // Resolve the userId from the Staff record stored in quote.soldById
    const staffRecord = await prisma.staff.findUnique({
      where:  { id: quote.soldById },
      select: { userId: true },
    });
    const soldByUserId = staffRecord?.userId ?? quote.soldById;

    await prisma.$transaction(async (tx) => {
      for (const item of quote.quoteItems) {
        const product = await tx.product.findUnique({
          where:  { id: item.productId },
          select: { quantity: true, productName: true },
        });
        if (!product) throw new Error("Product not found");
        if (product.quantity < item.quantity)
          throw new Error(`Insufficient stock for "${product.productName}" (available: ${product.quantity})`);
        await tx.product.update({
          where: { id: item.productId },
          data:  { quantity: { decrement: item.quantity } },
        });
      }

      const storedMethod = splits.length > 0 ? splits[0].method : paymentMethod;

      const newSale = await tx.sale.create({
        data: {
          soldById:      soldByUserId,
          totalAmount:   quote.amount,
          paymentMethod: storedMethod,
          shopId:        quote.shopId,
          saleItems: {
            create: quote.quoteItems.map(item => ({
              productId: item.productId,
              quantity:  item.quantity,
              price:     item.price,
              discount:  item.discount,
            })),
          },
        },
      });

      const saleCode = newSale.id.slice(-8).toUpperCase();

      if (hasCredit) {
        const nonCreditPaid = cashSplits.reduce((s, sp) => s + sp.amount, 0) || downPayment;

        for (const sp of cashSplits) {
          if (sp.amount > 0) {
            await tx.payment.create({
              data: {
                amount:          sp.amount,
                method:          sp.method,
                transactionCode: `PAY-${saleCode}-${sp.method.toUpperCase()}`,
                shopId:          quote.shopId,
              },
            });
          }
        }

        if (nonCreditPaid > 0 && cashSplits.length === 0 && downPayment > 0) {
          await tx.payment.create({
            data: {
              amount:          downPayment,
              method:          "credit_downpayment",
              transactionCode: `PAY-${saleCode}-CREDIT_DOWNPAYMENT`,
              shopId:          quote.shopId,
            },
          });
        }

        const creditAmount =
          creditSplit?.amount ??
          (splits.length === 0 ? quote.amount - nonCreditPaid : 0);
        if (creditAmount > 0) {
          await tx.payment.create({
            data: {
              amount:          creditAmount,
              method:          "credit",
              transactionCode: `PAY-${saleCode}-CREDIT`,
              shopId:          quote.shopId,
            },
          });
        }

        await tx.credit.create({
          data: {
            amount:        quote.amount,
            downPayment:   nonCreditPaid,
            dueDate:       dueDate ? new Date(`${dueDate}T00:00:00.000Z`) : null,
            status:
              nonCreditPaid >= quote.amount ? "paid" :
              nonCreditPaid > 0             ? "partial" : "pending",
            customerName:  customerName   ?? quote.customerName  ?? null,
            customerPhone: customerContact ?? null,
            shopId:        quote.shopId,
          },
        });
      } else if (splits.length > 1) {
        for (const sp of splits) {
          if (sp.amount > 0) {
            await tx.payment.create({
              data: {
                amount:          sp.amount,
                method:          sp.method,
                transactionCode: `PAY-${saleCode}-${sp.method.toUpperCase()}`,
                shopId:          quote.shopId,
              },
            });
          }
        }
      } else {
        await tx.payment.create({
          data: {
            amount:          quote.amount,
            method:          paymentMethod,
            transactionCode: `PAY-${saleCode}`,
            shopId:          quote.shopId,
          },
        });
      }

      await tx.quoteItem.deleteMany({ where: { quoteId } });
      await tx.quote.delete({ where: { id: quoteId } });
    });

    const sid = quote.shopId;
    revalidatePath(`/${sid}/sales/quote`, "page");
    revalidatePath(`/${sid}/sales/sold`,  "page");
    revalidatePath(`/${sid}/finance/credit`);
    revalidatePath(`/${sid}/finance/payments`);
    revalidatePath(`/${sid}/dashboard`);
    return { success: true };
  } catch (err) {
    if (err instanceof Error) return { success: false, error: err.message };
    console.error(err);
    return { success: false, error: "Conversion failed" };
  }
}
