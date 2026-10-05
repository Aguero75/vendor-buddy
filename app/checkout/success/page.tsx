import Link from "next/link";
import { notFound } from "next/navigation";

import { PaymentStatus } from "@/components/storefront/payment-status";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string | string[] }>;
}) {
  const params = await searchParams;
  const reference = Array.isArray(params.ref) ? params.ref[0] : params.ref;
  if (!reference || reference.length > 100) notFound();

  const receipt = await prisma.receipt.findUnique({
    where: { id: reference },
    select: { id: true, status: true, method: true },
  });
  if (!receipt) notFound();

  return (
    <main className="min-h-screen px-5 py-10 sm:px-8 sm:py-14">
      <div className="mx-auto max-w-xl space-y-8">
        <header className="space-y-3 text-center">
          <Link
            href="/"
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Back to store
          </Link>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Order status
          </p>
          <h1 className="font-display text-4xl leading-tight">
            Thank you for your order
          </h1>
        </header>
        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <PaymentStatus
            receiptId={receipt.id}
            status={receipt.status}
            method={receipt.method}
          />
        </section>
      </div>
    </main>
  );
}
