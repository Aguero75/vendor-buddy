import { CategoryPills } from "@/components/storefront/category-pills";
import { CartDrawer } from "@/components/storefront/cart-drawer";
import { ProductGrid } from "@/components/storefront/product-grid";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
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
    select: { id: true, businessName: true, motto: true, whatsappNumber: true },
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
    <div className="flex min-h-screen flex-col">
      <SiteHeader businessName={vendor?.businessName} />
      <main className="flex-1 px-5 py-10 text-foreground sm:px-8 sm:py-16">
        <div className="shell space-y-14">
          <header className="relative overflow-hidden rounded-3xl border border-border bg-card px-6 py-10 shadow-sm sm:px-10 sm:py-14">
            <div
              className="absolute -right-16 -top-24 size-72 rounded-full bg-accent/30 blur-3xl"
              aria-hidden="true"
            />
            <div className="relative space-y-4">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                {vendor?.businessName ?? "Vendor Buddy"}
              </p>
              <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-2xl space-y-3">
                  <h1 className="font-display max-w-2xl text-5xl leading-[0.98] tracking-tight sm:text-7xl">
                    Made for your table.
                  </h1>
                  <p className="max-w-xl text-base leading-7 text-muted-foreground">
                    {vendor?.motto ??
                      "Browse the latest selection and find something good."}
                  </p>
                </div>
                <div className="rounded-2xl border border-border bg-background/75 px-4 py-3 text-sm font-semibold text-muted-foreground shadow-sm">
                  Freshly listed
                </div>
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
      <SiteFooter businessName={vendor?.businessName} />
      <CartDrawer whatsappNumber={vendor?.whatsappNumber ?? ""} />
    </div>
  );
}
