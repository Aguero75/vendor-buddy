import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { ReceiptStatus } from "@prisma/client";

import { flagForReview, settlePayment } from "@/lib/receipts";
import { prisma } from "@/lib/prisma";

const PAYSTACK_API_URL = "https://api.paystack.co";

type PaystackEnvelope<T> = {
  status?: boolean;
  message?: string;
  data?: T;
};

type PaystackInitializeData = {
  authorization_url?: string;
  reference?: string;
};

type PaystackVerifyData = {
  status?: string;
  reference?: string;
  amount?: number;
  currency?: string;
};

function getPaystackSecret() {
  const secret = process.env.PAYSTACK_SECRET_KEY;

  if (!secret) {
    throw new Error("PAYSTACK_SECRET_KEY is not configured.");
  }

  return secret;
}

export async function initializePaystackTransaction({
  email,
  amountKobo,
  reference,
}: {
  email: string;
  amountKobo: number;
  reference: string;
}) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (!siteUrl) {
    throw new Error("NEXT_PUBLIC_SITE_URL is not configured.");
  }

  const response = await fetch(`${PAYSTACK_API_URL}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getPaystackSecret()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      amount: amountKobo,
      reference,
      callback_url: new URL("/checkout/callback", siteUrl).toString(),
    }),
    cache: "no-store",
  });
  const result =
    (await response.json()) as PaystackEnvelope<PaystackInitializeData>;
  const authorizationUrl = result.data?.authorization_url;

  if (
    !response.ok ||
    !result.status ||
    result.data?.reference !== reference ||
    !authorizationUrl
  ) {
    throw new Error(result.message || "Paystack could not initialize payment.");
  }

  const hostedUrl = new URL(authorizationUrl);
  if (
    hostedUrl.protocol !== "https:" ||
    hostedUrl.hostname !== "checkout.paystack.com"
  ) {
    throw new Error("Paystack returned an invalid checkout URL.");
  }

  return hostedUrl.toString();
}

export function hasValidPaystackSignature(body: string, signature: string) {
  const secret = process.env.PAYSTACK_SECRET_KEY;

  if (!secret || !/^[\da-f]{128}$/i.test(signature)) {
    return false;
  }

  const expected = createHmac("sha512", secret).update(body).digest();
  const received = Buffer.from(signature, "hex");

  return (
    received.length === expected.length && timingSafeEqual(received, expected)
  );
}

export async function verifyAndMarkReceiptPaid(reference: string) {
  const response = await fetch(
    `${PAYSTACK_API_URL}/transaction/verify/${encodeURIComponent(reference)}`,
    {
      headers: { Authorization: `Bearer ${getPaystackSecret()}` },
      cache: "no-store",
    },
  );
  const result =
    (await response.json()) as PaystackEnvelope<PaystackVerifyData>;

  if (!response.ok || !result.status) {
    throw new Error(result.message || "Paystack could not verify payment.");
  }

  const payment = result.data;
  if (
    payment?.status !== "success" ||
    payment.reference !== reference ||
    payment.currency !== "NGN" ||
    typeof payment.amount !== "number" ||
    !Number.isSafeInteger(payment.amount)
  ) {
    return false;
  }

  const receipt = await prisma.receipt.findUnique({
    where: { paystackRef: reference },
    select: { id: true, status: true, total: true, method: true },
  });

  if (!receipt || receipt.method !== "PAYSTACK") {
    return false;
  }

  if (!receipt.total.mul(100).equals(payment.amount)) {
    await flagForReview(
      receipt.id,
      `Paystack reported a successful charge for ${payment.amount / 100} NGN, but the expected order total is ${receipt.total} NGN.`,
    );
    return false;
  }

  if (receipt.status === ReceiptStatus.PAID) {
    return true;
  }

  return settlePayment(receipt.id, "Paystack");
}
