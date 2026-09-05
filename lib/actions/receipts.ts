"use server";

import { auth } from "@clerk/nextjs/server";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/lib/actions/products";

type ReceiptLineInput = {
  productId?: string;
  name: string;
  quantity: number;
  unitPrice: number;
};

async function getAuthorizedVendor() {
  await auth.protect();
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

  if (!Array.isArray(parsedLines) || parsedLines.length === 0) {
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
    const productId = value.productId ? String(value.productId) : undefined;

    if (
      !name ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      !Number.isFinite(unitPrice) ||
      unitPrice <= 0
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
      select: { id: true, name: true },
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

    const total = parsed.lines.reduce(
      (sum, line) => sum + line.quantity * line.unitPrice,
      0,
    );
    const customerName = String(formData.get("customerName") ?? "").trim();

    const receipt = await prisma.receipt.create({
      data: {
        vendorId: vendor.id,
        customerName: customerName || null,
        total: new Prisma.Decimal(total.toFixed(2)),
        lineItems: {
          create: parsed.lines.map((line) => ({
            vendorId: vendor.id,
            productId: line.productId ?? null,
            nameSnapshot: line.productId
              ? productMap.get(line.productId)!.name
              : line.name,
            quantity: line.quantity,
            unitPrice: new Prisma.Decimal(line.unitPrice.toFixed(2)),
          })),
        },
      },
      select: { id: true },
    });

    revalidatePath("/dashboard/receipts");
    return { ok: true, data: receipt };
  } catch {
    return { ok: false, message: "Couldn't save receipt. Try again." };
  }
}
