import Link from "next/link";
import { redirect } from "next/navigation";

import { CheckoutForm } from "@/components/storefront/checkout-form";
import { verifyAndMarkReceiptPaid } from "@/lib/paystack";
import { prisma } from "@/lib/prisma";

type CheckoutPageProps = {
  searchParams: Promise<{
    failed?: string | string[];
    reference?: string | string[];
  }>;
};

export default async function CheckoutPage({
  searchParams,
}: CheckoutPageProps) {
  const params = await searchParams;
  const failed = Array.isArray(params.failed)
    ? params.failed[0] === "1"
    : params.failed === "1";
  const reference = Array.isArray(params.reference)
    ? params.reference[0]
    : params.reference;

  if (failed && reference && reference.length <= 100) {
    let paymentVerified = false;

    try {
      paymentVerified = await verifyAndMarkReceiptPaid(reference);
    } catch {
      // Keep the cart available when verification is still unavailable.
    }

    if (paymentVerified) {
      redirect("/?paid=1");
    }
  }

  const vendor = await prisma.vendor.findFirst({
    orderBy: { createdAt: "asc" },
    select: { businessName: true },
  });

  return (
    <main className="min-h-screen px-5 py-10 sm:px-8 sm:py-14">
      <div className="mx-auto max-w-2xl space-y-8">
        <header className="space-y-3">
          <Link
            href="/"
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Back to {vendor?.businessName ?? "store"}
          </Link>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Secure checkout
          </p>
          <h1 className="font-display text-4xl leading-tight">Your order</h1>
        </header>

        <section className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-8">
          <CheckoutForm failed={failed} />
        </section>
      </div>
    </main>
  );
}
