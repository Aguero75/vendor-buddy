import {
  hasValidPaystackSignature,
  verifyAndMarkReceiptPaid,
} from "@/lib/paystack";

export async function POST(request: Request) {
  const body = await request.text();
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

  if (event.event !== "charge.success") {
    return Response.json({ received: true });
  }

  const reference = event.data?.reference;
  if (typeof reference !== "string" || reference.length > 100) {
    return Response.json(
      { error: "Invalid payment reference." },
      { status: 400 },
    );
  }

  try {
    await verifyAndMarkReceiptPaid(reference);
    return Response.json({ received: true });
  } catch {
    return Response.json(
      { error: "Payment verification failed." },
      { status: 500 },
    );
  }
}
