"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { checkAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; message: string };

type ProductInput =
  | {
      value: {
        name: string;
        description: string | null;
        category: string | null;
        imageUrl: string | null;
        price: Prisma.Decimal;
        stock: number | null;
      };
    }
  | { error: string };

async function getAuthorizedVendor() {
  const admin = await checkAdmin();

  if (!admin.authorized) {
    return null;
  }

  return prisma.vendor.findFirst({ orderBy: { createdAt: "asc" } });
}

function getProductInput(formData: FormData): ProductInput {
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const imageUrl = String(formData.get("imageUrl") ?? "").trim();
  const price = Number(formData.get("price"));
  const rawStock = String(formData.get("stock") ?? "").trim();
  const stock = rawStock === "" ? null : Number(rawStock);

  if (!name) {
    return { error: "Product name is required." };
  }

  if (
    !Number.isFinite(price) ||
    price <= 0 ||
    price > 99_999_999.99
  ) {
    return { error: "Enter a valid price greater than zero." };
  }

  if (
    stock !== null &&
    (!Number.isSafeInteger(stock) || stock < 0 || stock > 1_000_000_000)
  ) {
    return { error: "Stock must be a whole number between 0 and 1,000,000,000." };
  }

  return {
    value: {
      name,
      description: description || null,
      category: category || null,
      imageUrl: imageUrl || null,
      price: new Prisma.Decimal(price.toFixed(2)),
      stock,
    },
  };
}

export async function createProduct(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const vendor = await getAuthorizedVendor();

    if (!vendor) {
      return { ok: false, message: "Set up a vendor before adding products." };
    }

    const input = getProductInput(formData);

    if ("error" in input) {
      return { ok: false, message: input.error };
    }

    const product = await prisma.product.create({
      data: {
        ...input.value,
        vendorId: vendor.id,
        inStock: input.value.stock === null || input.value.stock > 0,
        zeroSince: input.value.stock === 0 ? new Date() : null,
      },
      select: { id: true },
    });

    revalidatePath("/");
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/products");
    return { ok: true, data: product };
  } catch {
    return { ok: false, message: "Couldn't save product. Try again." };
  }
}

export async function updateProduct(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const vendor = await getAuthorizedVendor();
    const productId = String(formData.get("id") ?? "");

    if (!vendor || !productId) {
      return { ok: false, message: "Product not found." };
    }

    const input = getProductInput(formData);

    if ("error" in input) {
      return { ok: false, message: input.error };
    }

    const updated = await prisma.$transaction(async (tx) => {
      const [existing] = await tx.$queryRaw<
        { inStock: boolean; stock: number | null; zeroSince: Date | null }[]
      >`SELECT "inStock", "stock", "zeroSince" FROM "Product"
        WHERE "id" = ${productId} AND "vendorId" = ${vendor.id}
        FOR UPDATE`;
      if (!existing) return false;

      await tx.product.update({
        where: { id: productId },
        data: {
          ...input.value,
          inStock:
            input.value.stock === null
              ? existing.stock === null
                ? existing.inStock
                : true
              : input.value.stock > 0,
          zeroSince:
            input.value.stock !== 0
              ? null
              : existing.stock === 0 && existing.zeroSince
                ? existing.zeroSince
                : new Date(),
        },
      });
      return true;
    });

    if (!updated) {
      return { ok: false, message: "Product not found." };
    }

    revalidatePath("/");
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/products");
    revalidatePath(`/dashboard/products/${productId}`);
    return { ok: true, data: { id: productId } };
  } catch {
    return { ok: false, message: "Couldn't save product. Try again." };
  }
}

export async function deleteProduct(productId: string): Promise<ActionResult> {
  try {
    const vendor = await getAuthorizedVendor();

    if (!vendor) {
      return { ok: false, message: "Product not found." };
    }

    const product = await prisma.product.deleteMany({
      where: { id: productId, vendorId: vendor.id },
    });

    if (product.count === 0) {
      return { ok: false, message: "Product not found." };
    }

    revalidatePath("/");
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/products");
    return { ok: true };
  } catch {
    return { ok: false, message: "Couldn't delete product. Try again." };
  }
}

export async function toggleProductStock(
  productId: string,
): Promise<ActionResult<{ inStock: boolean }>> {
  try {
    const vendor = await getAuthorizedVendor();

    if (!vendor) {
      return { ok: false, message: "Product not found." };
    }

    const product = await prisma.product.findFirst({
      where: { id: productId, vendorId: vendor.id },
      select: { inStock: true, stock: true },
    });

    if (!product) {
      return { ok: false, message: "Product not found." };
    }
    if (product.stock !== null) {
      return {
        ok: false,
        message: "Set the tracked quantity in Edit product instead.",
      };
    }

    const updated = await prisma.product.update({
      where: { id: productId },
      data: { inStock: !product.inStock },
      select: { inStock: true },
    });

    revalidatePath("/");
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/products");
    return { ok: true, data: updated };
  } catch {
    return { ok: false, message: "Couldn't update stock status. Try again." };
  }
}
