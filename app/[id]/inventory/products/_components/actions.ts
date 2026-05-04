"use server";

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { v2 as cloudinary } from "cloudinary";
import { planGuardCreate, planGuardMutate } from "@/lib/plan-guard";

export type ActionResult = { success: boolean; error?: string; newId?: string };

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key:    process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

async function getSessionAndRole() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const profile = await prisma.profile.findUnique({
    where:  { userId: session.user.id },
    select: { role: true },
  });
  const role    = (profile?.role ?? "owner").toLowerCase().trim();
  const isOwner = role === "owner";
  return { userId: session.user.id, isOwner };
}

async function uploadImage(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        {
          folder:          "inventory/products",
          resource_type:   "image",
          allowed_formats: ["jpg", "png", "jpeg", "webp"],
          transformation:  [{ width: 800, height: 800, crop: "limit" }],
        },
        (err, result) => {
          if (err || !result) reject(err ?? new Error("Upload failed"));
          else resolve((result as { secure_url: string }).secure_url);
        }
      )
      .end(buffer);
  });
}

function revalidateProducts(shopId: string) {
  revalidatePath(`/${shopId}/inventory/products`);
}

// ── PRODUCT ───────────────────────────────────────────────────────────────────

export async function saveProductAction(
  _: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const productId  = formData.get("productId")?.toString() ?? null;
  const formShopId = formData.get("shopId")?.toString() ?? null;

  // For edits, shopId may not be in formData — fetch from DB
  let guardShopId = formShopId;
  if (productId && !guardShopId) {
    const p = await prisma.product.findUnique({ where: { id: productId }, select: { shopId: true } });
    guardShopId = p?.shopId ?? null;
  }
  if (!guardShopId) return { success: false, error: "Shop not specified" };

  const guard = productId
    ? await planGuardMutate(guardShopId)
    : await planGuardCreate(guardShopId, "products");
  if (!guard.ok) return { success: false, error: guard.error };

  const ctx = await getSessionAndRole();
  if (!ctx) return { success: false, error: "Unauthorized" };
  const { userId, isOwner } = ctx;

  const shopId       = guardShopId;
  const productName  = formData.get("productName")?.toString().trim() ?? "";
  const serialNo     = formData.get("serialNo")?.toString().trim() || null;
  const quantity     = Number(formData.get("quantity")  || 0);
  const outOfStockLimit = Number(formData.get("outOfStockLimit") || 5);
  const buyingPrice  = Number(formData.get("buyingPrice")  || 0);
  const sellingPrice = Number(formData.get("sellingPrice") || 0);
  const discount     = Number(formData.get("discount") || 0);
  const subCategoryId = formData.get("subCategoryId")?.toString() ?? null;
  const imageFile    = formData.get("image") as File | null;

  if (!productName || !subCategoryId || sellingPrice <= 0)
    return { success: false, error: "Name, subcategory and valid selling price are required" };
  if (sellingPrice <= buyingPrice)
    return { success: false, error: "Selling price must exceed buying price" };
  if (outOfStockLimit < 0)
    return { success: false, error: "Out-of-stock limit cannot be negative" };

  let imageUrl: string | undefined;
  if (imageFile && imageFile.size > 0) {
    try { imageUrl = await uploadImage(imageFile); }
    catch { return { success: false, error: "Image upload failed" }; }
  }

  try {
    if (productId) {
      // ── EDIT ─────────────────────────────────────────────────────────────
      const existing = await prisma.product.findUnique({
        where:  { id: productId },
        select: { shopId: true, shop: { select: { userId: true } } },
      });
      if (!existing) return { success: false, error: "Product not found" };
      if (!isOwner && existing.shop.userId !== userId)
        return { success: false, error: "Not authorised to edit this product" };

      await prisma.product.update({
        where: { id: productId },
        data:  {
          productName, serialNo, outOfStockLimit,
          buyingPrice, sellingPrice, discount, subCategoryId,
          ...(imageUrl ? { imageUrl } : {}),
        },
      });
      revalidateProducts(existing.shopId);
    } else {
      // ── CREATE ────────────────────────────────────────────────────────────
      const shop = await prisma.shop.findUnique({ where: { id: shopId }, select: { userId: true } });
      if (!shop) return { success: false, error: "Shop not found" };
      if (!isOwner && shop.userId !== userId)
        return { success: false, error: "Not authorised to add products to this shop" };

      await prisma.product.create({
        data: {
          productName, serialNo, quantity, outOfStockLimit,
          buyingPrice, sellingPrice, discount, subCategoryId,
          shopId, imageUrl: imageUrl ?? null,
        },
      });
      revalidateProducts(shopId);
    }
    return { success: true };
  } catch (err) {
    console.error("[saveProductAction]", err);
    return { success: false, error: productId ? "Update failed" : "Create failed" };
  }
}

export async function deleteProductAction(id: string, shopId: string): Promise<ActionResult> {
  const guard = await planGuardMutate(shopId);
  if (!guard.ok) return { success: false, error: guard.error };

  const ctx = await getSessionAndRole();
  if (!ctx) return { success: false, error: "Unauthorized" };
  const { userId, isOwner } = ctx;

  try {
    const existing = await prisma.product.findUnique({
      where:  { id },
      select: { shopId: true, shop: { select: { userId: true } } },
    });
    if (!existing) return { success: false, error: "Product not found" };
    if (!isOwner && existing.shop.userId !== userId)
      return { success: false, error: "Not your product" };

    await prisma.product.delete({ where: { id } });
    revalidateProducts(shopId);
    return { success: true };
  } catch {
    return { success: false, error: "Delete failed — product may be referenced by a sale" };
  }
}

// ── CATEGORY ──────────────────────────────────────────────────────────────────

export async function saveCategoryAction(
  _: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const shopId = formData.get("shopId")?.toString() ?? "";
  const id     = formData.get("id")?.toString() ?? null;

  const guard = await planGuardMutate(shopId);
  if (!guard.ok) return { success: false, error: guard.error };

  const ctx = await getSessionAndRole();
  if (!ctx) return { success: false, error: "Unauthorized" };
  if (!ctx.isOwner) return { success: false, error: "Owners only" };

  const name = formData.get("name")?.toString().trim() ?? "";
  if (!name) return { success: false, error: "Name required" };

  const userId = ctx.userId;

  try {
    let categoryId = id;
    if (id) {
      await prisma.category.update({ where: { id }, data: { name } });
    } else {
      const created = await prisma.category.create({ data: { name, userId } });
      categoryId = created.id;
    }
    if (shopId) revalidateProducts(shopId);
    return { success: true, newId: categoryId! };
  } catch {
    return { success: false, error: id ? "Update failed" : "Create failed — name may already exist" };
  }
}

export async function deleteCategoryAction(id: string, shopId: string): Promise<ActionResult> {
  const ctx = await getSessionAndRole();
  if (!ctx) return { success: false, error: "Unauthorized" };
  if (!ctx.isOwner) return { success: false, error: "Owners only" };

  try {
    await prisma.category.delete({ where: { id } });
    revalidateProducts(shopId);
    return { success: true };
  } catch {
    return { success: false, error: "Delete failed — category has subcategories" };
  }
}

// ── SUBCATEGORY ───────────────────────────────────────────────────────────────

export async function saveSubCategoryAction(
  _: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const ctx = await getSessionAndRole();
  if (!ctx) return { success: false, error: "Unauthorized" };
  if (!ctx.isOwner) return { success: false, error: "Owners only" };

  const id         = formData.get("id")?.toString() ?? null;
  const name       = formData.get("name")?.toString().trim() ?? "";
  const categoryId = formData.get("categoryId")?.toString() ?? "";
  const shopId     = formData.get("shopId")?.toString() ?? "";

  if (!name || !categoryId) return { success: false, error: "Name and category required" };

  const userId = ctx.userId;

  try {
    let subId = id;
    if (id) {
      await prisma.subCategory.update({ where: { id }, data: { name, categoryId } });
    } else {
      const created = await prisma.subCategory.create({ data: { name, categoryId, userId } });
      subId = created.id;
    }
    if (shopId) revalidateProducts(shopId);
    return { success: true, newId: subId! };
  } catch {
    return { success: false, error: id ? "Update failed" : "Create failed — name may already exist" };
  }
}

export async function deleteSubCategoryAction(id: string, shopId: string): Promise<ActionResult> {
  const ctx = await getSessionAndRole();
  if (!ctx) return { success: false, error: "Unauthorized" };
  if (!ctx.isOwner) return { success: false, error: "Owners only" };

  try {
    await prisma.subCategory.delete({ where: { id } });
    revalidateProducts(shopId);
    return { success: true };
  } catch {
    return { success: false, error: "Delete failed — subcategory has products" };
  }
}
