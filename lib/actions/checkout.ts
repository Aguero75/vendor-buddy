"use server";

import { randomBytes } from "node:crypto";
import { PaymentMethod, Prisma } from "@prisma/client";

import type { ActionResult } from "@/lib/actions/products";
import { getNgnPerUsd } from "@/lib/fx";
import { initializePaystackTransaction } from "@/lib/paystack";
import { customerKeyOf, HOLD_MINUTES } from "@/lib/receipts";
import { prisma } from "@/lib/prisma";

type CheckoutItem = { id: string; quantity: number };

function parseCheckoutItems(value: unknown): CheckoutItem[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 15) {
    return null;
  }
  const quantities = new Map<string, number>();
  let totalQuantity = 0;
  for (const candidate of value) {
    if (!candidate || typeof candidate !== "object") return null;
    const entry = candidate as Record<string, unknown>;
    const id = typeof entry.id === "string" ? entry.id.trim() : "";
    const quantity = entry.quantity;
    if (!id || id.length > 100 || !Number.isInteger(quantity) || Number(quantity) < 1 || Number(quantity) > 99) {
      return null;
    }
    const sum = (quantities.get(id) ?? 0) + Number(quantity);
    if (sum > 99) return null;
    quantities.set(id, sum);
    totalQuantity += Number(quantity);
    if (totalQuantity > 99) return null;
  }
  return Array.from(quantities, ([id, quantity]) => ({ id, quantity }));
}

function parseCustomer(emailValue: unknown, phoneValue: unknown) {
  const email =
    typeof emailValue === "string" ? emailValue.trim().toLowerCase() : "";
  const rawPhone = typeof phoneValue === "string" ? phoneValue.trim() : "";
  const phone = rawPhone.replace(/[\s().-]/g, "");
  if (
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    !/^\+?\d{7,15}$/.test(phone)
  ) {
    return null;
  }
  return { email, phone };
}

type NowPaymentsInvoice = {
  invoice_url?: string;
  id?: string;
};

async function initializeCryptoInvoice(input: {
  orderId: string;
  vendorId: string;
  email: string;
  amount: Prisma.Decimal;
}) {
  const apiKey = process.env.NOWPAYMENTS_API_KEY;
  if (!apiKey) throw new Error("NOWPayments is not configured.");
  const baseUrl = process.env.NOWPAYMENTS_BASE_URL ?? "https://api.nowpayments.io";
  const base = new URL(baseUrl);
  if (base.protocol !== "https:" && process.env.NODE_ENV === "production") {
    throw new Error("NOWPAYMENTS_BASE_URL must use HTTPS in production.");
  }
  const priceCurrency = (
    process.env.NOWPAYMENTS_PRICE_CURRENCY ?? "usd"
  ).toLowerCase();
  if (!["usd", "ngn"].includes(priceCurrency)) {
    throw new Error("NOWPAYMENTS_PRICE_CURRENCY must be usd or ngn.");
  }

  let invoiceAmount = input.amount;
  let fxRate: number | undefined;
  if (priceCurrency === "usd") {
    fxRate = await getNgnPerUsd(input.vendorId);
    invoiceAmount = new Prisma.Decimal(
      (Number(input.amount) / fxRate).toFixed(2),
    );
    if (invoiceAmount.lessThanOrEqualTo(0)) {
      throw new Error("Order amount is too small for crypto checkout.");
    }
  }
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) throw new Error("NEXT_PUBLIC_SITE_URL is not configured.");
  const response = await fetch(`${base.origin}/v1/invoice`, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      price_amount: Number(invoiceAmount),
      price_currency: priceCurrency,
      order_id: input.orderId,
      order_description: `Vendor Buddy order ${input.orderId}`,
      ipn_callback_url: new URL("/api/nowpayments/webhook", siteUrl).toString(),
      success_url: new URL(
        `/checkout/success?ref=${encodeURIComponent(input.orderId)}`,
        siteUrl,
      ).toString(),
      cancel_url: new URL("/checkout?failed=1", siteUrl).toString(),
      ...(input.email ? { customer_email: input.email } : {}),
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const invoice = (await response.json()) as NowPaymentsInvoice;
  if (!response.ok || !invoice.invoice_url || !invoice.id) {
    throw new Error("NOWPayments could not create the invoice.");
  }
  const url = new URL(invoice.invoice_url);
  if (url.protocol !== "https:" || url.hostname !== "nowpayments.io" && !url.hostname.endsWith(".nowpayments.io")) {
    throw new Error("NOWPayments returned an unexpected invoice URL.");
  }
  await prisma.receipt.update({
    where: { id: input.orderId },
    data: {
      nowpaymentsId: invoice.id,
      invoiceAmount,
      invoiceCurrency: priceCurrency,
      fxRate:
        fxRate === undefined
          ? null
          : new Prisma.Decimal(fxRate.toFixed(4)),
    },
  });
  return url.toString();
}

export async function startCheckout(
  rawItems: unknown,
  emailValue: unknown,
  phoneValue: unknown,
  methodValue: unknown = "PAYSTACK",
): Promise<ActionResult<{ authorizationUrl: string }>> {
  const items = parseCheckoutItems(rawItems);
  const customer = parseCustomer(emailValue, phoneValue);
  if (methodValue !== "PAYSTACK" && methodValue !== "CRYPTO") {
    return { ok: false, message: "Select a valid payment method." };
  }
  const method =
    methodValue === "CRYPTO" ? PaymentMethod.CRYPTO : PaymentMethod.PAYSTACK;

  if (!items) {
    return { ok: false, message: "Your cart is empty or invalid. Review it and try again." };
  }
  if (!customer) {
    return { ok: false, message: "Enter a valid email address and phone number." };
  }
  if (
    method === PaymentMethod.PAYSTACK &&
    (!process.env.PAYSTACK_SECRET_KEY?.trim() ||
      !process.env.NEXT_PUBLIC_SITE_URL?.trim())
  ) {
    return {
      ok: false,
      message: "Paystack checkout is not configured. Check the server environment settings.",
    };
  }
  if (method === PaymentMethod.CRYPTO && !process.env.NOWPAYMENTS_API_KEY) {
    return { ok: false, message: "Crypto checkout is not currently available." };
  }

  let receiptId: string | undefined;
  try {
    const vendor = await prisma.vendor.findFirst({
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (!vendor) {
      return { ok: false, message: "This storefront is not ready to accept orders." };
    }

    const itemIds = items.map((item) => item.id).sort();
    const reference = `VB-${randomBytes(16).toString("hex").toUpperCase()}`;
    const receipt = await prisma.$transaction(async (tx) => {
      const products = await tx.$queryRaw<
        {
          id: string;
          name: string;
          price: Prisma.Decimal;
          stock: number | null;
          inStock: boolean;
        }[]
      >`SELECT "id", "name", "price", "stock", "inStock" FROM "Product"
        WHERE "vendorId" = ${vendor.id}
          AND "id" IN (${Prisma.join(itemIds)})
        ORDER BY "id" FOR UPDATE`;
      if (products.length !== items.length) {
        throw new Error("A cart item is no longer available.");
      }

      const held = await tx.receiptLineItem.groupBy({
        by: ["productId"],
        where: {
          vendorId: vendor.id,
          productId: { in: itemIds },
          receipt: {
            status: "PENDING",
            createdAt: {
              gt: new Date(Date.now() - HOLD_MINUTES * 60_000),
            },
          },
        },
        _sum: { quantity: true },
      });
      const heldByProduct = new Map(
        held.map((line) => [line.productId, line._sum.quantity ?? 0]),
      );
      const productById = new Map(products.map((product) => [product.id, product]));
      for (const item of items) {
        const product = productById.get(item.id);
        if (!product || !product.inStock) {
          throw new Error("A cart item is no longer available.");
        }
        if (product.stock !== null) {
          const available = product.stock - (heldByProduct.get(item.id) ?? 0);
          if (item.quantity > available) {
            throw new Error(
              available <= 0
                ? `${product.name} is sold out right now.`
                : `Only ${available} of ${product.name} available right now.`,
            );
          }
        }
      }

      const total = items.reduce((sum, item) => {
        const product = productById.get(item.id)!;
        return sum.add(product.price.mul(item.quantity));
      }, new Prisma.Decimal(0));
      if (
        total.lessThanOrEqualTo(0) ||
        total.greaterThan("99999999.99") ||
        !Number.isSafeInteger(Number(total.mul(100).toFixed(0)))
      ) {
        throw new Error("This order total cannot be processed.");
      }
      return tx.receipt.create({
        data: {
          vendorId: vendor.id,
          email: customer.email,
          phone: customer.phone,
          customerKey: customerKeyOf(customer),
          paystackRef:
            method === PaymentMethod.PAYSTACK ? reference : null,
          method,
          status: "PENDING",
          total,
          lineItems: {
            create: items.map((item) => {
              const product = productById.get(item.id)!;
              return {
                vendorId: vendor.id,
                productId: product.id,
                nameSnapshot: product.name,
                quantity: item.quantity,
                unitPrice: product.price,
              };
            }),
          },
        },
        select: { id: true, total: true },
      });
    });
    receiptId = receipt.id;

    const authorizationUrl =
      method === PaymentMethod.PAYSTACK
        ? await initializePaystackTransaction({
            email: customer.email,
            amountKobo: Number(receipt.total.mul(100).toFixed(0)),
            reference,
          })
        : await initializeCryptoInvoice({
            orderId: receipt.id,
            vendorId: vendor.id,
            email: customer.email,
            amount: receipt.total,
          });
    return { ok: true, data: { authorizationUrl } };
  } catch (error) {
    if (receiptId) {
      try {
        await prisma.receipt.updateMany({
          where: { id: receiptId, status: "PENDING" },
          data: { status: "FAILED" },
        });
      } catch (cleanupError) {
        console.error("Failed to release pending checkout after initialization error.", {
          receiptId,
          cleanupError,
        });
      }
    }
    console.error("Checkout initialization failed.", error);
    const message =
      error instanceof Error &&
      /available|sold out|Only \d+/.test(error.message)
        ? error.message
        : "Couldn't start payment. Your cart is unchanged; try again.";
    return { ok: false, message };
  }
}
