import Link from "next/link";
import { notFound } from "next/navigation";

import { ProductForm } from "@/components/dashboard/product-form";
import { prisma } from "@/lib/prisma";

async function getCategories() {
  const categories = await prisma.product.findMany({
    where: { category: { not: null } },
    distinct: ["category"],
    orderBy: { category: "asc" },
    select: { category: true },
  });

  return categories.flatMap((product) =>
    product.category ? [product.category] : [],
  );
}

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [product, categories] = await Promise.all([
    prisma.product.findUnique({ where: { id } }),
    getCategories(),
  ]);

  if (!product) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-muted/30 px-5 py-10 sm:px-8">
      <div className="mx-auto max-w-3xl space-y-8">
        <header className="space-y-3">
          <Link
            href="/dashboard/products"
            className="-ml-2 inline-flex h-8 items-center justify-center rounded-lg px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            ← Products
          </Link>
          <h1 className="text-3xl font-semibold tracking-tight">
            Edit product
          </h1>
          <p className="text-muted-foreground">
            Update the details shown in your catalog.
          </p>
        </header>
        <div className="rounded-xl border border-border bg-card p-5 sm:p-8">
          <ProductForm
            categories={categories}
            product={{
              id: product.id,
              name: product.name,
              description: product.description,
              category: product.category,
              price: product.price.toString(),
              imageUrl: product.imageUrl,
            }}
          />
        </div>
      </div>
    </main>
  );
}
