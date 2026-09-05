import Link from "next/link";

import { ReceiptForm } from "@/components/dashboard/receipt-form";
import { prisma } from "@/lib/prisma";

export default async function NewReceiptPage() {
  const vendor = await prisma.vendor.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  const products = vendor
    ? await prisma.product.findMany({
        where: { vendorId: vendor.id },
        orderBy: { name: "asc" },
        select: { id: true, name: true, price: true },
      })
    : [];

  return (
    <main className="min-h-screen bg-muted/30 px-5 py-10 sm:px-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="space-y-3">
          <Link
            href="/dashboard/receipts"
            className="-ml-2 inline-flex h-8 items-center justify-center rounded-lg px-3 text-sm font-medium transition-colors hover:bg-muted"
          >
            ← Receipts
          </Link>
          <h1 className="text-3xl font-semibold tracking-tight">New receipt</h1>
          <p className="text-muted-foreground">
            Select catalog products or add custom items, then save the sale.
          </p>
        </header>
        <div className="rounded-xl border border-border bg-card p-5 sm:p-8">
          <ReceiptForm
            products={products.map((product) => ({
              ...product,
              price: product.price.toString(),
            }))}
          />
        </div>
      </div>
    </main>
  );
}
