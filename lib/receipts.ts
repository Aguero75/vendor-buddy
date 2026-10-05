import "server-only";

import { Prisma } from "@prisma/client";

import { esc, sendEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";

type Transaction = Prisma.TransactionClient;

const holdMinutes = Number(process.env.STOCK_HOLD_MINUTES ?? 30);
export const HOLD_MINUTES =
  Number.isInteger(holdMinutes) && holdMinutes >= 5 && holdMinutes <= 120
    ? holdMinutes
    : 30;

export function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("234")) return `+${digits}`;
  if (digits.startsWith("0")) return `+234${digits.slice(1)}`;
  if (value.trim().startsWith("+")) return `+${digits}`;
  return `+234${digits}`;
}

export function customerKeyOf(customer: {
  phone?: string | null;
  email?: string | null;
}) {
  if (customer.phone) return normalizePhone(customer.phone);
  if (customer.email) return customer.email.trim().toLowerCase();
  return null;
}

export async function decrementStock(tx: Transaction, receiptId: string) {
  const lines = await tx.receiptLineItem.findMany({
    where: { receiptId, productId: { not: null } },
    select: {
      vendorId: true,
      productId: true,
      nameSnapshot: true,
      quantity: true,
    },
    orderBy: [{ productId: "asc" }, { id: "asc" }],
  });
  const shortages: string[] = [];

  for (const line of lines) {
    if (!line.productId) continue;
    const [product] = await tx.$queryRaw<
      { stock: number | null; zeroSince: Date | null }[]
    >`SELECT "stock", "zeroSince" FROM "Product"
      WHERE "id" = ${line.productId} AND "vendorId" = ${line.vendorId}
      FOR UPDATE`;
    if (!product || product.stock === null) continue;

    if (product.stock < line.quantity) {
      shortages.push(
        `${line.nameSnapshot} (sold ${line.quantity}, only ${product.stock} in stock)`,
      );
    }
    const next = Math.max(product.stock - line.quantity, 0);
    await tx.product.update({
      where: { id: line.productId },
      data: {
        stock: next,
        inStock: next > 0,
        zeroSince:
          next === 0 ? (product.zeroSince ?? new Date()) : null,
      },
    });
  }
  return shortages;
}

export async function restoreStock(tx: Transaction, receiptId: string) {
  const lines = await tx.receiptLineItem.findMany({
    where: { receiptId, productId: { not: null } },
    select: { vendorId: true, productId: true, quantity: true },
    orderBy: [{ productId: "asc" }, { id: "asc" }],
  });
  for (const line of lines) {
    if (!line.productId) continue;
    const [product] = await tx.$queryRaw<
      { stock: number | null }[]
    >`SELECT "stock" FROM "Product"
      WHERE "id" = ${line.productId} AND "vendorId" = ${line.vendorId}
      FOR UPDATE`;
    if (!product || product.stock === null) continue;
    const next = product.stock + line.quantity;
    await tx.product.update({
      where: { id: line.productId },
      data: { stock: next, inStock: next > 0, zeroSince: null },
    });
  }
}

export async function notifyOwner(
  vendorId: string,
  subject: string,
  html: string,
) {
  try {
    const settings = await prisma.settings.findUnique({
      where: { vendorId },
      select: { ownerEmail: true },
    });
    if (settings?.ownerEmail) {
      await sendEmail(settings.ownerEmail, subject, html);
    }
  } catch (error) {
    console.error("Owner notification delivery failed.", error);
  }
}

export async function flagForReview(receiptId: string, note: string) {
  const receipt = await prisma.receipt.findUnique({
    where: { id: receiptId },
    select: { vendorId: true },
  });
  if (!receipt) return;

  const changed = await prisma.receipt.updateMany({
    where: {
      id: receiptId,
      needsReview: false,
      reviewedAt: null,
    },
    data: { needsReview: true, reviewNote: note },
  });
  if (changed.count === 1) {
    await notifyOwner(
      receipt.vendorId,
      "A payment needs your review",
      `<p>${esc(note)}</p><p>Receipt: ${esc(receiptId)}</p>`,
    );
  }
}

export async function markPaid(
  receiptId: string,
  extra: {
    nowpaymentsId?: string;
    cryptoCurrency?: string;
    cryptoAmount?: Prisma.Decimal | number;
  } = {},
) {
  const result = await prisma.$transaction(async (tx) => {
    const changed = await tx.receipt.updateMany({
      where: {
        id: receiptId,
        status: { in: ["PENDING", "PARTIAL", "FAILED"] },
      },
      data: {
        ...extra,
        status: "PAID",
        paidAt: new Date(),
        stockApplied: true,
      },
    });
    if (!changed.count) return { vendorId: null, shortages: [] as string[] };

    const receipt = await tx.receipt.findUniqueOrThrow({
      where: { id: receiptId },
      select: { vendorId: true },
    });
    const shortages = await decrementStock(tx, receiptId);
    if (shortages.length) {
      await tx.receipt.update({
        where: { id: receiptId },
        data: {
          needsReview: true,
          reviewNote: `Oversold: ${shortages.join(", ")}. Confirm supply or refund.`,
        },
      });
    }
    return { vendorId: receipt.vendorId, shortages };
  });

  if (result.vendorId && result.shortages.length) {
    await notifyOwner(
      result.vendorId,
      "A paid order was short on stock",
      `<p>Receipt ${esc(receiptId)}: ${esc(result.shortages.join(", "))}.</p>`,
    );
  }
  if (result.vendorId) {
    return true;
  }
  return false;
}

export async function settlePayment(
  receiptId: string,
  gateway: string,
  extra: Parameters<typeof markPaid>[1] = {},
) {
  const applied = await markPaid(receiptId, extra);
  if (!applied) {
    const receipt = await prisma.receipt.findUnique({
      where: { id: receiptId },
      select: { status: true },
    });
    if (receipt?.status === "VOIDED") {
      await flagForReview(
        receiptId,
        `A ${gateway} payment arrived after this receipt was voided. Review the payment in ${gateway}.`,
      );
    }
  }
  return applied;
}

export async function createManualReceipt(input: {
  vendorId: string;
  customerName?: string;
  email?: string;
  phone?: string;
  items: {
    productId?: string;
    name: string;
    quantity: number;
    unitPrice: Prisma.Decimal;
  }[];
}) {
  const total = input.items.reduce(
    (sum, line) => sum.add(line.unitPrice.mul(line.quantity)),
    new Prisma.Decimal(0),
  );
  const phone = input.phone?.trim() ? normalizePhone(input.phone) : null;
  const email = input.email?.trim().toLowerCase() || null;

  const result = await prisma.$transaction(async (tx) => {
    const receipt = await tx.receipt.create({
      data: {
        vendorId: input.vendorId,
        customerName: input.customerName?.trim() || null,
        email,
        phone,
        customerKey: customerKeyOf({ phone, email }),
        method: "MANUAL",
        status: "PAID",
        paidAt: new Date(),
        total,
        stockApplied: true,
        lineItems: {
          create: input.items.map((line) => ({
            vendorId: input.vendorId,
            productId: line.productId ?? null,
            nameSnapshot: line.name,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
          })),
        },
      },
      select: { id: true },
    });
    const shortages = await decrementStock(tx, receipt.id);
    if (shortages.length) {
      await tx.receipt.update({
        where: { id: receipt.id },
        data: {
          needsReview: true,
          reviewNote: `Oversold: ${shortages.join(", ")}. Confirm supply or refund.`,
        },
      });
    }
    return { ...receipt, shortages };
  });
  if (result.shortages.length) {
    await notifyOwner(
      input.vendorId,
      "A manual sale was short on stock",
      `<p>Receipt ${esc(result.id)}: ${esc(result.shortages.join(", "))}.</p>`,
    );
  }
  return { id: result.id };
}
