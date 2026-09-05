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

  if (!name) {
    return { error: "Product name is required." };
  }

  if (!Number.isFinite(price) || price <= 0) {
    return { error: "Enter a valid price greater than zero." };
  }

  return {
    value: {
      name,
      description: description || null,
      category: category || null,
      imageUrl: imageUrl || null,
      price: new Prisma.Decimal(price.toFixed(2)),
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
      data: { ...input.value, vendorId: vendor.id },
      select: { id: true },
    });

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

    const product = await prisma.product.updateMany({
      where: { id: productId, vendorId: vendor.id },
      data: input.value,
    });

    if (product.count === 0) {
      return { ok: false, message: "Product not found." };
    }

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
      select: { inStock: true },
    });

    if (!product) {
      return { ok: false, message: "Product not found." };
    }

    const updated = await prisma.product.update({
      where: { id: productId },
      data: { inStock: !product.inStock },
      select: { inStock: true },
    });

    revalidatePath("/dashboard/products");
    return { ok: true, data: updated };
  } catch {
    return { ok: false, message: "Couldn't update stock status. Try again." };
  }
}
