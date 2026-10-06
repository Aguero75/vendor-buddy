import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, ReceiptIcon } from "@phosphor-icons/react/ssr";

import { ReceiptCard } from "@/components/dashboard/receipt-card";
import { prisma } from "@/lib/prisma";

export default async function ReceiptDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const receipt = await prisma.receipt.findUnique({
    where: { id },
    include: {
      vendor: {
        select: { businessName: true, logoUrl: true, motto: true },
      },
      lineItems: {
        orderBy: { id: "asc" },
        select: { nameSnapshot: true, quantity: true, unitPrice: true },
      },
    },
  });

  if (!receipt) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-muted/30 px-5 py-10 sm:px-8">
      <div className="mx-auto max-w-3xl space-y-8">
        <header className="space-y-3">
          <Link
            href="/dashboard/receipts"
            className="-ml-2 inline-flex h-8 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors hover:bg-muted"
          >
            <ArrowLeftIcon className="size-4" aria-hidden="true" />
            Receipts
          </Link>
          <h1 className="flex items-center gap-2 text-3xl font-semibold tracking-tight">
            <ReceiptIcon
              className="size-7 text-primary"
              weight="duotone"
              aria-hidden="true"
            />
            Receipt
          </h1>
          <p className="text-muted-foreground">
            Download and share this saved receipt.
          </p>
        </header>

        <ReceiptCard
          receipt={{
            id: receipt.id,
            businessName: receipt.vendor.businessName,
            motto: receipt.vendor.motto,
            logoUrl: receipt.vendor.logoUrl,
            customerName: receipt.customerName,
            email: receipt.email,
            phone: receipt.phone,
            paymentReference: receipt.paystackRef,
            createdAt: receipt.createdAt.toISOString(),
            total: receipt.total.toString(),
            lineItems: receipt.lineItems.map((lineItem) => ({
              ...lineItem,
              unitPrice: lineItem.unitPrice.toString(),
            })),
          }}
        />
      </div>
    </main>
  );
}
