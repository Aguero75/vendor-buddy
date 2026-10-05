import Link from "next/link";
import { redirect } from "next/navigation";

import { CheckoutForm } from "@/components/storefront/checkout-form";
import { getNgnPerUsd } from "@/lib/fx";
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
    select: { id: true, businessName: true },
  });
  const priceCurrency = (
    process.env.NOWPAYMENTS_PRICE_CURRENCY ?? "usd"
  ).toLowerCase();
  let cryptoAvailable = Boolean(process.env.NOWPAYMENTS_API_KEY);
  let cryptoFxRate: number | null = null;
  if (cryptoAvailable && priceCurrency === "usd" && vendor) {
    try {
      cryptoFxRate = await getNgnPerUsd(vendor.id);
    } catch {
      cryptoAvailable = false;
    }
  } else if (priceCurrency !== "usd" && priceCurrency !== "ngn") {
    cryptoAvailable = false;
  }

  return (
    <main className="min-h-screen px-5 py-10 sm:px-8 sm:py-14">
      <div className="mx-auto max-w-2xl space-y-8">
        <header className="space-y-3">
          <Link
            href="/"
            className="inline-flex h-9 items-center gap-2 rounded-full border border-border bg-card px-3 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <span aria-hidden="true" className="text-base leading-none">
              ←
            </span>
            Back to {vendor?.businessName ?? "store"}
          </Link>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Secure checkout
          </p>
          <h1 className="font-display text-4xl leading-tight">Your order</h1>
        </header>

        <section className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-8">
          <CheckoutForm
            failed={failed}
            cryptoAvailable={cryptoAvailable}
            cryptoFxRate={cryptoFxRate}
          />
        </section>
      </div>
    </main>
  );
}
