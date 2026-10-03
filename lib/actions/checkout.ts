"use server";

import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";

import type { ActionResult } from "@/lib/actions/products";
import { initializePaystackTransaction } from "@/lib/paystack";
import { prisma } from "@/lib/prisma";

type CheckoutItem = { id: string; quantity: number };

function parseCheckoutItems(value: unknown): CheckoutItem[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 15) {
    return null;
  }

  const items: CheckoutItem[] = [];
  const productIds = new Set<string>();
  let totalQuantity = 0;

  for (const entry of value) {
    if (!entry || typeof entry !== "object") {
      return null;
    }

    const item = entry as Record<string, unknown>;
    const id = typeof item.id === "string" ? item.id.trim() : "";
    const quantity = item.quantity;

    if (
      !id ||
      id.length > 100 ||
      productIds.has(id) ||
      !Number.isInteger(quantity) ||
      Number(quantity) < 1
    ) {
      return null;
    }

    productIds.add(id);
    totalQuantity += Number(quantity);
    if (totalQuantity > 15) {
      return null;
    }
    items.push({ id, quantity: Number(quantity) });
  }

  return items;
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

export async function startCheckout(
  rawItems: unknown,
  emailValue: unknown,
  phoneValue: unknown,
): Promise<ActionResult<{ authorizationUrl: string }>> {
  const items = parseCheckoutItems(rawItems);
  const customer = parseCustomer(emailValue, phoneValue);

  if (!items) {
    return {
      ok: false,
      message: "Your cart is empty or invalid. Review it and try again.",
    };
  }

  if (!customer) {
    return {
      ok: false,
      message: "Enter a valid email address and phone number.",
    };
  }

  if (
    !process.env.PAYSTACK_SECRET_KEY?.trim() ||
    !process.env.NEXT_PUBLIC_SITE_URL?.trim()
  ) {
    return {
      ok: false,
      message:
        process.env.NODE_ENV === "development"
          ? "Paystack checkout is not configured. Add PAYSTACK_SECRET_KEY and NEXT_PUBLIC_SITE_URL to .env.local, then restart the dev server."
          : "Online payment is temporarily unavailable. Please try again later.",
    };
  }

  try {
    const vendor = await prisma.vendor.findFirst({
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });

    if (!vendor) {
      return {
        ok: false,
        message: "This storefront is not ready to accept orders.",
      };
    }

    const products = await prisma.product.findMany({
      where: {
        vendorId: vendor.id,
        id: { in: items.map((item) => item.id) },
        inStock: true,
      },
      select: { id: true, name: true, price: true },
    });

    if (products.length !== items.length) {
      return {
        ok: false,
        message:
          "A cart item is no longer available. Review your cart and try again.",
      };
    }

    const productById = new Map(
      products.map((product) => [product.id, product]),
    );
    const total = items.reduce((sum, item) => {
      const product = productById.get(item.id)!;
      return sum.add(product.price.mul(item.quantity));
    }, new Prisma.Decimal(0));

    if (
      total.lessThanOrEqualTo(0) ||
      total.greaterThan("99999999.99") ||
      !Number.isSafeInteger(Number(total.mul(100).toFixed(0)))
    ) {
      return { ok: false, message: "This order total cannot be processed." };
    }

    const reference = `VB-${randomBytes(16).toString("hex").toUpperCase()}`;
    const amountKobo = Number(total.mul(100).toFixed(0));
    await prisma.receipt.create({
      data: {
        vendorId: vendor.id,
        email: customer.email,
        phone: customer.phone,
        paystackRef: reference,
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
    });

    const authorizationUrl = await initializePaystackTransaction({
      email: customer.email,
      amountKobo,
      reference,
    });

    return { ok: true, data: { authorizationUrl } };
  } catch {
    return {
      ok: false,
      message: "Couldn't start payment. Your cart is unchanged; try again.",
    };
  }
}
