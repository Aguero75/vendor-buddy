import Link from "next/link";

import { SalesAnalytics } from "@/components/dashboard/sales-analytics";
import { getSalesAnalytics } from "@/lib/analytics";
import { prisma } from "@/lib/prisma";

export default async function DashboardPage() {
  const vendor = await prisma.vendor.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  const analytics = vendor
    ? await getSalesAnalytics(vendor.id)
    : { dailySales: [], topProducts: [] };

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
              className="inline-flex h-10 items-center justify-center rounded-lg bg-accent px-4 text-sm font-bold text-accent-foreground transition-transform hover:-translate-y-0.5"
            >
              New receipt
            </Link>
          </div>
        </section>
        <SalesAnalytics analytics={analytics} />
      </div>
    </main>
  );
}
