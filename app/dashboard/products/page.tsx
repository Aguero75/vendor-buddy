import Link from "next/link";

import { ProductList } from "@/components/dashboard/product-list";
import { prisma } from "@/lib/prisma";

export default async function ProductsPage() {
  const vendor = await prisma.vendor.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true, businessName: true },
  });

  const products = vendor
    ? await prisma.product.findMany({
        where: { vendorId: vendor.id },
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          name: true,
          description: true,
          category: true,
          price: true,
          inStock: true,
        },
      })
    : [];

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
            <h1 className="text-3xl font-semibold tracking-tight">Products</h1>
            <p className="text-muted-foreground">
              Manage what customers can see and buy.
            </p>
          </div>
          <Link
            href="/dashboard/products/new"
            className="inline-flex h-8 items-center justify-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
          >
            Add product
          </Link>
        </header>

        <ProductList
          products={products.map((product) => ({
            ...product,
            price: product.price.toString(),
          }))}
        />
      </div>
    </main>
  );
}
