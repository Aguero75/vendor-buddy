import { CategoryPills } from "@/components/storefront/category-pills";
import { ProductGrid } from "@/components/storefront/product-grid";
import { prisma } from "@/lib/prisma";

const UNCATEGORIZED = "uncategorized";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ category?: string | string[] }>;
}) {
  const params = await searchParams;
  const categoryParam = Array.isArray(params.category)
    ? params.category[0]
    : params.category;
  const vendor = await prisma.vendor.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true, businessName: true, motto: true },
  });

  const categoryRows = vendor
    ? await prisma.product.findMany({
        where: { vendorId: vendor.id },
        select: { category: true },
        distinct: ["category"],
        orderBy: { category: "asc" },
      })
    : [];
  const categories = categoryRows.flatMap((product) =>
    product.category ? [product.category] : [],
  );
  const hasUncategorized = categoryRows.some(
    (product) => product.category === null,
  );
  const categoryFilter =
    categoryParam === UNCATEGORIZED
      ? { category: null }
      : categoryParam
        ? { category: categoryParam }
        : {};
  const products = vendor
    ? await prisma.product.findMany({
        where: { vendorId: vendor.id, ...categoryFilter },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          description: true,
          category: true,
          price: true,
          imageUrl: true,
          inStock: true,
        },
      })
    : [];

  return (
    <main className="min-h-screen bg-[#f8f6f1] px-5 py-8 text-foreground sm:px-8 sm:py-12">
      <div className="mx-auto max-w-6xl space-y-10">
        <header className="space-y-4 border-b border-foreground/10 pb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            {vendor?.businessName ?? "Vendor Buddy"}
          </p>
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl space-y-3">
              <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
                Made for your table.
              </h1>
              <p className="max-w-xl text-base leading-7 text-muted-foreground">
                {vendor?.motto ??
                  "Browse the latest selection and find something good."}
              </p>
            </div>
            <div className="rounded-xl border border-foreground/10 bg-background/70 px-4 py-3 text-sm text-muted-foreground">
              Browse the menu
            </div>
          </div>
        </header>

        <section className="space-y-5" aria-labelledby="catalog-heading">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">The selection</p>
              <h2
                id="catalog-heading"
                className="text-2xl font-semibold tracking-tight"
              >
                Shop by category
              </h2>
            </div>
            <p className="text-sm text-muted-foreground">
              {products.length} {products.length === 1 ? "item" : "items"}
            </p>
          </div>
          <CategoryPills
            categories={categories}
            hasUncategorized={hasUncategorized}
            selectedCategory={categoryParam}
          />
          <ProductGrid
            products={products.map((product) => ({
              ...product,
              price: product.price.toString(),
            }))}
          />
        </section>
      </div>
    </main>
  );
}
