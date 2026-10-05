import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { hmac, safeEqual, sortKeys } from "@/lib/crypto";
import { notifyOwner, settlePayment, flagForReview } from "@/lib/receipts";
import { prisma } from "@/lib/prisma";

type NowPaymentsEvent = {
  order_id?: unknown;
  payment_status?: unknown;
  price_amount?: unknown;
  price_currency?: unknown;
  pay_currency?: unknown;
  actually_paid?: unknown;
  payment_id?: unknown;
};

export async function POST(request: Request) {
  const secret = process.env.NOWPAYMENTS_IPN_SECRET;
  if (!secret) {
    console.error("NOWPAYMENTS_IPN_SECRET is not configured.");
    return Response.json({ error: "Webhook is not configured." }, { status: 503 });
  }

  const raw = await request.text();
  if (raw.length > 64 * 1024) {
    return Response.json({ error: "Webhook payload is too large." }, { status: 413 });
  }
  let event: NowPaymentsEvent;
  try {
    event = JSON.parse(raw) as NowPaymentsEvent;
  } catch {
    return Response.json({ error: "Invalid event payload." }, { status: 400 });
  }
  if (!event || typeof event !== "object" || Array.isArray(event)) {
    return Response.json({ error: "Invalid event payload." }, { status: 400 });
  }
  const signature = request.headers.get("x-nowpayments-sig") ?? "";
  const expected = hmac(
    "sha512",
    secret,
    JSON.stringify(sortKeys(event)),
  );
  if (!safeEqual(signature.toLowerCase(), expected)) {
    return Response.json({ error: "Invalid signature." }, { status: 401 });
  }

  if (typeof event.order_id !== "string" || event.order_id.length > 100) {
    return Response.json({ received: true });
  }
  const receipt = await prisma.receipt.findUnique({
    where: { id: event.order_id },
    select: {
      id: true,
      vendorId: true,
      method: true,
      status: true,
      invoiceAmount: true,
      invoiceCurrency: true,
      nowpaymentsId: true,
    },
  });
  if (!receipt || receipt.method !== "CRYPTO") {
    return Response.json({ received: true });
  }

  switch (event.payment_status) {
    case "finished": {
      const actualAmount = Number(event.price_amount);
      const invoiceAmount = receipt.invoiceAmount
        ? Number(receipt.invoiceAmount)
        : NaN;
      const amountMatches =
        Number.isFinite(actualAmount) &&
        Number.isFinite(invoiceAmount) &&
        Math.abs(actualAmount - invoiceAmount) < 0.01 &&
        typeof event.price_currency === "string" &&
        event.price_currency.toLowerCase() === receipt.invoiceCurrency;
      if (!amountMatches) {
        await flagForReview(
          receipt.id,
          `NOWPayments marked the invoice finished with a mismatched amount or currency (expected ${receipt.invoiceAmount} ${receipt.invoiceCurrency}; received ${String(event.price_amount)} ${String(event.price_currency)}).`,
        );
        break;
      }

      const actuallyPaid = Number(event.actually_paid);
      const settled = await settlePayment(receipt.id, "NOWPayments", {
        nowpaymentsId:
          event.payment_id === undefined
            ? receipt.nowpaymentsId ?? undefined
            : String(event.payment_id),
        cryptoCurrency:
          typeof event.pay_currency === "string"
            ? event.pay_currency.toLowerCase()
            : undefined,
        cryptoAmount: Number.isFinite(actuallyPaid)
          ? new Prisma.Decimal(String(event.actually_paid))
          : undefined,
      });
      if (settled) {
        revalidatePath("/");
        revalidatePath("/dashboard");
        revalidatePath("/dashboard/products");
        revalidatePath("/dashboard/receipts");
      }
      break;
    }
    case "partially_paid": {
      const changed = await prisma.receipt.updateMany({
        where: { id: receipt.id, status: "PENDING" },
        data: { status: "PARTIAL" },
      });
      if (changed.count) {
        await notifyOwner(
          receipt.vendorId,
          "A crypto payment was only partly paid",
          `<p>Receipt ${receipt.id} is partially paid. Review it in the dashboard.</p>`,
        );
      }
      break;
    }
    case "failed":
    case "expired":
      await prisma.receipt.updateMany({
        where: { id: receipt.id, status: "PENDING" },
        data: { status: "FAILED" },
      });
      break;
    default:
      break;
  }
  return Response.json({ received: true });
}
