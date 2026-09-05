import Link from "next/link";
import { Prisma } from "@prisma/client";

import { SalesAnalytics } from "@/components/dashboard/sales-analytics";
import { getSalesAnalytics } from "@/lib/analytics";
import { prisma } from "@/lib/prisma";

const PAGE_SIZE = 10;

function formatPrice(value: string) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(Number(value));
}

export default async function ReceiptsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[]; q?: string | string[] }>;
}) {
  const params = await searchParams;
  const rawPage = Array.isArray(params.page) ? params.page[0] : params.page;
  const rawSearch = Array.isArray(params.q) ? params.q[0] : params.q;
  const search = rawSearch?.trim() ?? "";
  const page = Math.max(1, Number.parseInt(rawPage ?? "1", 10) || 1);
  const numericSearch = Number.parseFloat(search.replace(/,/g, ""));
  const searchTotal = Number.isFinite(numericSearch)
    ? new Prisma.Decimal(numericSearch.toFixed(2))
    : null;

  const vendor = await prisma.vendor.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true, businessName: true },
  });
  const receiptWhere = vendor
    ? {
        vendorId: vendor.id,
        ...(search
          ? {
              OR: [
                {
                  customerName: {
                    contains: search,
                    mode: "insensitive" as const,
                  },
                },
                {
                  lineItems: {
                    some: {
                      nameSnapshot: {
                        contains: search,
                        mode: "insensitive" as const,
                      },
                    },
                  },
                },
                ...(searchTotal ? [{ total: searchTotal }] : []),
              ],
            }
          : {}),
      }
    : null;

  const [receipts, receiptCount] = receiptWhere
    ? await Promise.all([
        prisma.receipt.findMany({
          where: receiptWhere,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          skip: (page - 1) * PAGE_SIZE,
          take: PAGE_SIZE,
          include: {
            lineItems: {
              orderBy: { id: "asc" },
              select: {
                nameSnapshot: true,
                quantity: true,
                unitPrice: true,
              },
            },
          },
        }),
        prisma.receipt.count({
          where: receiptWhere,
        }),
      ])
    : [[], 0];
  const pageCount = Math.max(1, Math.ceil(receiptCount / PAGE_SIZE));
  const analytics = vendor
    ? await getSalesAnalytics(vendor.id)
    : { dailySales: [], topProducts: [] };

  return (
    <main className="min-h-screen bg-muted/30 px-5 py-10 sm:px-8">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <Link
              href="/dashboard"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              ← Dashboard
            </Link>
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
              {vendor?.businessName ?? "Vendor Buddy"}
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">Receipts</h1>
            <p className="text-muted-foreground">
              Create and review saved sales.
            </p>
          </div>
          <Link
            href="/dashboard/receipts/new"
            className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
          >
            New receipt
          </Link>
        </header>

        <SalesAnalytics analytics={analytics} />

        <form
          method="get"
          className="flex flex-col gap-3 sm:flex-row sm:items-center"
        >
          <label className="flex-1">
            <span className="sr-only">Search receipts</span>
            <input
              name="q"
              defaultValue={search}
              placeholder="Search customer, item, or total"
              className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/20"
            />
          </label>
          <button
            type="submit"
            className="inline-flex h-11 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
          >
            Search
          </button>
          {search ? (
            <Link
              href="/dashboard/receipts"
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Clear
            </Link>
          ) : null}
        </form>

        {receipts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center">
            <h2 className="text-xl font-semibold">
              {search ? "No matching receipts" : "No receipts yet"}
            </h2>
            <p className="mt-2 text-muted-foreground">
              {search
                ? "Try a different customer, item, or total."
                : "Save your first receipt to start your history."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {receipts.map((receipt) => (
              <Link
                key={receipt.id}
                href={`/dashboard/receipts/${receipt.id}`}
                className="block rounded-xl border border-border bg-card p-5 transition-colors hover:border-foreground/30 sm:p-6"
              >
                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                  <div>
                    <p className="font-semibold">
                      {receipt.customerName || "Walk-in customer"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {receipt.createdAt.toLocaleString()}
                    </p>
                  </div>
                  <p className="text-lg font-semibold">
                    {formatPrice(receipt.total.toString())}
                  </p>
                </div>
                <ul className="mt-4 divide-y divide-border border-t border-border text-sm">
                  {receipt.lineItems.map((lineItem, index) => (
                    <li
                      key={`${receipt.id}-${lineItem.nameSnapshot}-${index}`}
                      className="flex justify-between gap-4 py-3"
                    >
                      <span>
                        {lineItem.quantity} × {lineItem.nameSnapshot}
                      </span>
                      <span className="text-muted-foreground">
                        {formatPrice(
                          (
                            Number(lineItem.unitPrice) * lineItem.quantity
                          ).toString(),
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </Link>
            ))}
          </div>
        )}

        {pageCount > 1 ? (
          <div className="flex items-center justify-between">
            {page > 1 ? (
              <Link
                href={`/dashboard/receipts?${new URLSearchParams({
                  ...(search ? { q: search } : {}),
                  page: String(page - 1),
                }).toString()}`}
                className="text-sm font-medium hover:underline"
              >
                Previous
              </Link>
            ) : (
              <span />
            )}

            <span className="text-sm text-muted-foreground">
              Page {page} of {pageCount}
            </span>

            {page < pageCount ? (
              <Link
                href={`/dashboard/receipts?${new URLSearchParams({
                  ...(search ? { q: search } : {}),
                  page: String(page + 1),
                }).toString()}`}
                className="text-sm font-medium hover:underline"
              >
                Next
              </Link>
            ) : (
              <span />
            )}
          </div>
        ) : null}
      </div>
    </main>
  );
}
