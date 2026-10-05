import { revalidatePath } from "next/cache";

import {
  hasValidPaystackSignature,
  verifyAndMarkReceiptPaid,
} from "@/lib/paystack";

export async function POST(request: Request) {
  const body = await request.text();
  if (body.length > 64 * 1024) {
    return Response.json({ error: "Webhook payload is too large." }, { status: 413 });
  }
  const signature = request.headers.get("x-paystack-signature") ?? "";

  if (!hasValidPaystackSignature(body, signature)) {
    return Response.json({ error: "Invalid signature." }, { status: 401 });
  }

  let event: {
    event?: unknown;
    data?: { reference?: unknown };
  };

  try {
    event = JSON.parse(body) as typeof event;
  } catch {
    return Response.json({ error: "Invalid event payload." }, { status: 400 });
  }
  if (!event || typeof event !== "object" || Array.isArray(event)) {
    return Response.json({ error: "Invalid event payload." }, { status: 400 });
  }

  if (event.event !== "charge.success") {
    return Response.json({ received: true });
  }

  const reference =
    event.data && typeof event.data === "object"
      ? event.data.reference
      : undefined;
  if (typeof reference !== "string" || reference.length > 100) {
    return Response.json(
      { error: "Invalid payment reference." },
      { status: 400 },
    );
  }

  try {
    const paid = await verifyAndMarkReceiptPaid(reference);
    if (paid) {
      revalidatePath("/");
      revalidatePath("/dashboard");
      revalidatePath("/dashboard/products");
      revalidatePath("/dashboard/receipts");
    }
    return Response.json({ received: true });
  } catch (error) {
    console.error("Paystack webhook processing failed.", error);
    return Response.json(
      { error: "Payment verification failed." },
      { status: 500 },
    );
  }
}
