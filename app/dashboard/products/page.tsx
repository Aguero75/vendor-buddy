import Link from "next/link";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  PackageIcon,
  PlusIcon,
} from "@phosphor-icons/react/ssr";

import { ProductList } from "@/components/dashboard/product-list";
import { prisma } from "@/lib/prisma";

const PAGE_SIZE = 10;

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const params = await searchParams;
  const rawPage = Array.isArray(params.page) ? params.page[0] : params.page;
  const page = Math.max(1, Number.parseInt(rawPage ?? "1", 10) || 1);

  const vendor = await prisma.vendor.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true, businessName: true },
  });
  const settings = vendor
    ? await prisma.settings.findUnique({
        where: { vendorId: vendor.id },
        select: { lowStockThreshold: true },
      })
    : null;

  const [products, productCount] = vendor
    ? await Promise.all([
        prisma.product.findMany({
          where: { vendorId: vendor.id },
          orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
          skip: (page - 1) * PAGE_SIZE,
          take: PAGE_SIZE,
          select: {
            id: true,
            name: true,
            description: true,
            category: true,
            price: true,
            inStock: true,
            stock: true,
          },
        }),
        prisma.product.count({
          where: { vendorId: vendor.id },
        }),
      ])
    : [[], 0];
  const pageCount = Math.max(1, Math.ceil(productCount / PAGE_SIZE));

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
              <PackageIcon
                className="size-7 text-primary"
                weight="duotone"
                aria-hidden="true"
              />
              Products
            </h1>
            <p className="text-muted-foreground">
              Manage what customers can see and buy.
            </p>
          </div>
          <Link
            href="/dashboard/products/new"
            className="inline-flex h-8 items-center justify-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
          >
            <PlusIcon className="size-4" weight="bold" aria-hidden="true" />
            Add product
          </Link>
        </header>

        <ProductList
          lowStockThreshold={settings?.lowStockThreshold ?? 5}
          products={products.map((product) => ({
            ...product,
            price: product.price.toString(),
          }))}
        />

        {pageCount > 1 ? (
          <div className="flex items-center justify-between">
            {page > 1 ? (
              <Link
                href={`/dashboard/products?page=${page - 1}`}
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
                href={`/dashboard/products?page=${page + 1}`}
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
