"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "react-toastify";
import { Pencil, Power, Trash2 } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { deleteProduct, toggleProductStock } from "@/lib/actions/products";

type Product = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  price: string;
  inStock: boolean;
};

function formatPrice(price: string) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(Number(price));
}

export function ProductList({ products }: { products: Product[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleToggle(product: Product) {
    startTransition(async () => {
      const result = await toggleProductStock(product.id);

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success(
        result.data?.inStock ? "Marked in stock" : "Marked out of stock",
      );
      router.refresh();
    });
  }

  function handleDelete(product: Product) {
    if (!window.confirm(`Delete ${product.name}?`)) {
      return;
    }

    startTransition(async () => {
      const result = await deleteProduct(product.id);

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success("Product deleted");
      router.refresh();
    });
  }

  if (products.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/30 px-6 py-14 text-center">
        <h2 className="text-lg font-semibold">No products yet</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Add your first product to start building the catalog.
        </p>
        <Link
          href="/dashboard/products/new"
          className={`${buttonVariants()} mt-5`}
        >
          Add product
        </Link>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="divide-y divide-border">
        {products.map((product) => (
          <article
            key={product.id}
            className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-semibold">{product.name}</h2>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    product.inStock
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {product.inStock ? "In stock" : "Out of stock"}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {product.category ?? "Uncategorized"} ·{" "}
                {formatPrice(product.price)}
              </p>
              {product.description ? (
                <p className="max-w-2xl truncate text-sm text-muted-foreground">
                  {product.description}
                </p>
              ) : null}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Link
                href={`/dashboard/products/${product.id}`}
                aria-label={`Edit ${product.name}`}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                <Pencil />
                <span className="sr-only sm:not-sr-only">Edit</span>
              </Link>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isPending}
                onClick={() => handleToggle(product)}
                aria-label={`Toggle stock for ${product.name}`}
              >
                <Power />
                <span className="sr-only sm:not-sr-only">Stock</span>
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={isPending}
                onClick={() => handleDelete(product)}
                aria-label={`Delete ${product.name}`}
              >
                <Trash2 />
                <span className="sr-only sm:not-sr-only">Delete</span>
              </Button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
