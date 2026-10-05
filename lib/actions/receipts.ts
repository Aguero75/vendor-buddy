"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { checkAdmin } from "@/lib/auth";
import { createManualReceipt } from "@/lib/receipts";
import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/lib/actions/products";

type ReceiptLineInput = {
  productId?: string;
  name: string;
  quantity: number;
  unitPrice: number;
};

async function getAuthorizedVendor() {
  const admin = await checkAdmin();

  if (!admin.authorized) {
    return null;
  }

  return prisma.vendor.findFirst({ orderBy: { createdAt: "asc" } });
}

function parseLines(
  formData: FormData,
): { lines: ReceiptLineInput[] } | { error: string } {
  const rawLines = String(formData.get("lines") ?? "[]");
  let parsedLines: unknown;

  try {
    parsedLines = JSON.parse(rawLines);
  } catch {
    return { error: "Receipt items are invalid." };
  }

  if (
    !Array.isArray(parsedLines) ||
    parsedLines.length === 0 ||
    parsedLines.length > 50
  ) {
    return { error: "Add at least one receipt item." };
  }

  const lines: ReceiptLineInput[] = [];

  for (const line of parsedLines) {
    if (!line || typeof line !== "object") {
      return { error: "Receipt items are invalid." };
    }

    const value = line as Record<string, unknown>;
    const name = String(value.name ?? "").trim();
    const quantity = Number(value.quantity);
    const unitPrice = Number(value.unitPrice);
    const productId =
      typeof value.productId === "string" && value.productId
        ? value.productId.trim()
        : undefined;

    if (
      !name ||
      name.length > 120 ||
      (productId !== undefined && productId.length > 100) ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 99 ||
      !Number.isFinite(unitPrice) ||
      unitPrice <= 0 ||
      unitPrice > 99_999_999.99
    ) {
      return { error: "Each item needs a name, quantity, and valid price." };
    }

    lines.push({ name, quantity, unitPrice, productId });
  }

  return { lines };
}

export async function createReceipt(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const vendor = await getAuthorizedVendor();

    if (!vendor) {
      return {
        ok: false,
        message: "Set up a vendor before creating receipts.",
      };
    }

    const parsed = parseLines(formData);
    if ("error" in parsed) {
      return { ok: false, message: parsed.error };
    }

    const productIds = parsed.lines
      .map((line) => line.productId)
      .filter((productId): productId is string => Boolean(productId));
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, vendorId: vendor.id },
      select: { id: true, name: true, price: true },
    });
    const productMap = new Map(
      products.map((product) => [product.id, product]),
    );

    for (const line of parsed.lines) {
      if (line.productId && !productMap.has(line.productId)) {
        return {
          ok: false,
          message: "One of the selected products was not found.",
        };
      }
    }

    const lines = parsed.lines.map((line) => {
      const product = line.productId
        ? productMap.get(line.productId)
        : undefined;
      return {
        productId: line.productId,
        name: product?.name ?? line.name,
        quantity: line.quantity,
        unitPrice: product?.price ?? new Prisma.Decimal(line.unitPrice.toFixed(2)),
      };
    });
    const total = lines.reduce(
      (sum, line) => sum.add(line.unitPrice.mul(line.quantity)),
      new Prisma.Decimal(0),
    );
    if (
      total.lessThanOrEqualTo(0) ||
      total.greaterThan("99999999.99")
    ) {
      return { ok: false, message: "This receipt total cannot be processed." };
    }
    const customerName = String(formData.get("customerName") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const phone = String(formData.get("phone") ?? "").trim();
    if (customerName.length > 120) {
      return { ok: false, message: "Customer name must be 120 characters or fewer." };
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { ok: false, message: "Enter a valid customer email." };
    }
    if (
      phone &&
      !/^\+?\d{7,15}$/.test(phone.replace(/[\s().-]/g, ""))
    ) {
      return { ok: false, message: "Enter a valid customer phone number." };
    }

    const receipt = await createManualReceipt({
      vendorId: vendor.id,
      customerName: customerName || undefined,
      email: email || undefined,
      phone: phone || undefined,
      items: lines,
    });

    revalidatePath("/");
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/products");
    revalidatePath("/dashboard/receipts");
    return { ok: true, data: receipt };
  } catch (error) {
    console.error("Manual receipt creation failed.", error);
    return { ok: false, message: "Couldn't save receipt. Try again." };
  }
}
