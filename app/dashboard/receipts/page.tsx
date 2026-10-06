import Link from "next/link";
import { Prisma, ReceiptStatus } from "@prisma/client";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  ReceiptIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react/ssr";

import { MarkReviewedButton } from "@/components/dashboard/mark-reviewed-button";
import { SalesAnalytics } from "@/components/dashboard/sales-analytics";
import { VoidReceiptButton } from "@/components/dashboard/void-receipt-button";
import { getSalesAnalytics } from "@/lib/analytics";
import { prisma } from "@/lib/prisma";
import { parseRange } from "@/lib/range";

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
  searchParams: Promise<{
    page?: string | string[];
    q?: string | string[];
    status?: string | string[];
    range?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const rawPage = Array.isArray(params.page) ? params.page[0] : params.page;
  const rawSearch = Array.isArray(params.q) ? params.q[0] : params.q;
  const rawStatus = Array.isArray(params.status)
    ? params.status[0]
    : params.status;
  const rawRange = Array.isArray(params.range) ? params.range[0] : params.range;
  const range = parseRange(rawRange);
  const search = rawSearch?.trim() ?? "";
  const analyticsQuery = new URLSearchParams();
  if (search) analyticsQuery.set("q", search);
  if (rawStatus) analyticsQuery.set("status", rawStatus);
  if (rawRange) analyticsQuery.set("range", rawRange);
  const statuses = {
    paid: ReceiptStatus.PAID,
    pending: ReceiptStatus.PENDING,
    partial: ReceiptStatus.PARTIAL,
    failed: ReceiptStatus.FAILED,
    voided: ReceiptStatus.VOIDED,
  } as const;
  const status =
    rawStatus === "review"
      ? "review"
      : Object.hasOwn(statuses, rawStatus ?? "")
        ? (rawStatus as keyof typeof statuses)
        : "paid";
  const page = Math.max(1, Number.parseInt(rawPage ?? "1", 10) || 1);
  const numericSearch = Number.parseFloat(search.replace(/,/g, ""));
  const searchTotal = Number.isFinite(numericSearch)
    ? new Prisma.Decimal(numericSearch.toFixed(2))
    : null;

  const vendor = await prisma.vendor.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true, businessName: true },
  });
  const receiptWhere: Prisma.ReceiptWhereInput | null = vendor
    ? {
        vendorId: vendor.id,
        ...(status === "review"
          ? { needsReview: true }
          : { status: statuses[status as keyof typeof statuses] }),
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
                  email: {
                    contains: search,
                    mode: "insensitive" as const,
                  },
                },
                { phone: { contains: search } },
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
                ...(searchTotal
                  ? [{ total: searchTotal }]
                  : []),
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
    ? await getSalesAnalytics(vendor.id, range)
    : null;

  return (
    <main className="min-h-screen bg-muted/30 px-5 py-10 sm:px-8">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeftIcon className="size-4" aria-hidden="true" />
              Dashboard
            </Link>
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
              {vendor?.businessName ?? "Vendor Buddy"}
            </p>
            <h1 className="flex items-center gap-2 text-3xl font-semibold tracking-tight">
              <ReceiptIcon
                className="size-7 text-primary"
                weight="duotone"
                aria-hidden="true"
              />
              Receipts
            </h1>
            <p className="text-muted-foreground">
              Create and review saved sales.
            </p>
          </div>
          <Link
            href="/dashboard/receipts/new"
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
          >
            <PlusIcon className="size-4" weight="bold" aria-hidden="true" />
            New receipt
          </Link>
        </header>

        {analytics ? (
          <SalesAnalytics
            analytics={analytics}
            range={range}
            pathname="/dashboard/receipts"
            query={analyticsQuery.toString()}
          />
        ) : null}

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
          <label>
            <span className="sr-only">Filter receipts by status</span>
            <select
              name="status"
              defaultValue={status}
              className="h-11 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/20"
            >
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="partial">Partial</option>
              <option value="failed">Failed</option>
              <option value="voided">Voided</option>
              <option value="review">Needs review</option>
            </select>
          </label>
          <button
            type="submit"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
          >
            <MagnifyingGlassIcon className="size-4" aria-hidden="true" />
            Search
          </button>
          {search || status !== "paid" ? (
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
              <article
                key={receipt.id}
                className={`rounded-xl border border-border bg-card p-5 sm:p-6 ${
                  receipt.status === "VOIDED" ? "opacity-70" : ""
                }`}
              >
                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                  <div>
                    <Link
                      href={`/dashboard/receipts/${receipt.id}`}
                      className="font-semibold hover:underline"
                    >
                      {receipt.customerName ||
                        receipt.email ||
                        "Walk-in customer"}
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      {receipt.createdAt.toLocaleString()}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full bg-muted px-2 py-1 font-medium">
                        {receipt.method}
                      </span>
                      <span className="rounded-full bg-muted px-2 py-1 font-medium">
                        {receipt.status}
                      </span>
                      {receipt.needsReview ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 font-medium text-amber-900">
                          <WarningCircleIcon
                            className="size-3.5"
                            weight="duotone"
                            aria-hidden="true"
                          />
                          Needs review
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <p className="text-lg font-semibold">
                      {formatPrice(receipt.total.toString())}
                    </p>
                    {receipt.status !== "VOIDED" ? (
                      <VoidReceiptButton receiptId={receipt.id} />
                    ) : null}
                  </div>
                </div>
                {receipt.needsReview && receipt.reviewNote ? (
                  <div className="mt-4 flex flex-col justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 sm:flex-row sm:items-center">
                    <p>{receipt.reviewNote}</p>
                    <MarkReviewedButton receiptId={receipt.id} />
                  </div>
                ) : null}
                {receipt.status === "VOIDED" && receipt.voidReason ? (
                  <p className="mt-3 text-sm text-muted-foreground">
                    Voided: {receipt.voidReason}
                  </p>
                ) : null}
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
              </article>
            ))}
          </div>
        )}

        {pageCount > 1 ? (
          <div className="flex items-center justify-between">
            {page > 1 ? (
              <Link
                href={`/dashboard/receipts?${new URLSearchParams({
                  ...(search ? { q: search } : {}),
                  ...(status !== "paid" ? { status } : {}),
                  page: String(page - 1),
                }).toString()}`}
                className="inline-flex items-center gap-1 text-sm font-medium hover:underline"
              >
                <ArrowLeftIcon className="size-4" aria-hidden="true" />
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
                  ...(status !== "paid" ? { status } : {}),
                  page: String(page + 1),
                }).toString()}`}
                className="inline-flex items-center gap-1 text-sm font-medium hover:underline"
              >
                Next
                <ArrowRightIcon className="size-4" aria-hidden="true" />
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
