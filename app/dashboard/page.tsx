import Link from "next/link";
import {
  PlusIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react/ssr";

import { SalesAnalytics } from "@/components/dashboard/sales-analytics";
import { StockAlertsCard } from "@/components/dashboard/stock-alerts-card";
import { countAttention, getSalesAnalytics, getStockAlerts } from "@/lib/analytics";
import { prisma } from "@/lib/prisma";
import { parseRange } from "@/lib/range";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string | string[] }>;
}) {
  const params = await searchParams;
  const rawRange = Array.isArray(params.range) ? params.range[0] : params.range;
  const range = parseRange(rawRange);
  const query = new URLSearchParams();
  if (rawRange) query.set("range", rawRange);

  const vendor = await prisma.vendor.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  const [analytics, attention, stock] = vendor
    ? await Promise.all([
        getSalesAnalytics(vendor.id, range),
        countAttention(vendor.id),
        prisma.settings
          .findUnique({
            where: { vendorId: vendor.id },
            select: { lowStockThreshold: true },
          })
          .then((settings) =>
            getStockAlerts(vendor.id, settings?.lowStockThreshold ?? 5),
          ),
      ])
    : [null, { review: 0, partial: 0 }, null];

  return (
    <main className="px-5 py-10 sm:px-8 sm:py-14">
      <div className="shell space-y-10">
        <section className="relative overflow-hidden rounded-3xl bg-foreground px-6 py-9 text-background shadow-xl shadow-foreground/10 sm:px-10 sm:py-12">
          <div
            className="absolute -right-20 -top-24 size-80 rounded-full bg-primary/60 blur-3xl"
            aria-hidden="true"
          />
          <div className="relative flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
            <div className="max-w-2xl space-y-4">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">
                Vendor Buddy workspace
              </p>
              <h1 className="font-display text-5xl leading-none tracking-tight sm:text-6xl">
                Keep the good stuff moving.
              </h1>
              <p className="max-w-xl text-background/70">
                Your products, receipts, and sales story in one calm place.
              </p>
            </div>
            <Link
              href="/dashboard/receipts/new"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-accent px-4 text-sm font-bold text-accent-foreground transition-transform hover:-translate-y-0.5"
            >
              <PlusIcon className="size-4" weight="bold" aria-hidden="true" />
              New receipt
            </Link>
          </div>
        </section>
        {attention.review > 0 || attention.partial > 0 ? (
          <section
            aria-label="Payments needing attention"
            className="space-y-2"
          >
            {attention.review > 0 ? (
              <Link
                href="/dashboard/receipts?status=review"
                className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-950 transition-colors hover:bg-amber-100"
              >
                <WarningCircleIcon
                  className="size-5 shrink-0 text-amber-700"
                  weight="duotone"
                  aria-hidden="true"
                />
                {attention.review} payment{attention.review === 1 ? "" : "s"} need your review.
              </Link>
            ) : null}
            {attention.partial > 0 ? (
              <Link
                href="/dashboard/receipts?status=partial"
                className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-950 transition-colors hover:bg-amber-100"
              >
                <WarningCircleIcon
                  className="size-5 shrink-0 text-amber-700"
                  weight="duotone"
                  aria-hidden="true"
                />
                {attention.partial} crypto payment{attention.partial === 1 ? "" : "s"} {attention.partial === 1 ? "is" : "are"} partially paid.
              </Link>
            ) : null}
          </section>
        ) : null}
        {stock ? <StockAlertsCard alerts={stock.alerts} /> : null}
        {analytics ? (
          <SalesAnalytics
            analytics={analytics}
            range={range}
            pathname="/dashboard"
            query={query.toString()}
          />
        ) : null}
      </div>
    </main>
  );
}
