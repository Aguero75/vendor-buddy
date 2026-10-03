import { redirect } from "next/navigation";

import { verifyAndMarkReceiptPaid } from "@/lib/paystack";

type CheckoutCallbackProps = {
  searchParams: Promise<{ reference?: string | string[] }>;
};

export default async function CheckoutCallbackPage({
  searchParams,
}: CheckoutCallbackProps) {
  const params = await searchParams;
  const reference = Array.isArray(params.reference)
    ? params.reference[0]
    : params.reference;
  let paid = false;

  if (reference && reference.length <= 100) {
    try {
      paid = await verifyAndMarkReceiptPaid(reference);
    } catch {
      paid = false;
    }
  }

  const failureUrl = reference
    ? `/checkout?failed=1&reference=${encodeURIComponent(reference)}`
    : "/checkout?failed=1";

  redirect(paid ? "/?paid=1" : failureUrl);
}
