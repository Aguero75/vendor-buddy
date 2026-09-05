"use client";

import { useState } from "react";
import Image from "next/image";
import { toast } from "react-toastify";

import { useCart } from "@/lib/cart-context";

type Product = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  price: string;
  imageUrl: string | null;
  inStock: boolean;
};

function formatPrice(price: string) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(Number(price));
}

/**
 * Renders a product image with a smooth fade-in once fully loaded, so
 * images never "pop" or flicker into place as they finish downloading.
 * `priority` should be set for images likely to appear above the fold
 * (the first row or two of the grid) so the browser fetches them early
 * instead of lazy-loading them at the last moment.
 */
function ProductImage({
  imageUrl,
  alt,
  priority,
}: {
  imageUrl: string;
  alt: string;
  priority: boolean;
}) {
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <Image
      src={imageUrl}
      alt={alt}
      fill
      unoptimized
      priority={priority}
      loading={priority ? undefined : "lazy"}
      quality={90}
      sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
      onLoad={() => setIsLoaded(true)}
      className={`object-cover transition-opacity duration-500 ease-out ${
        isLoaded ? "opacity-100" : "opacity-0"
      }`}
    />
  );
}

export function ProductGrid({ products }: { products: Product[] }) {
  const { addItem, totalItems } = useCart();
  if (products.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-16 text-center">
        <h2 className="text-xl font-semibold">Nothing here yet</h2>
        <p className="mt-2 text-muted-foreground">
          Try another category or check back soon.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((product, index) => (
        <article
          key={product.id}
          className={`overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-transform hover:-translate-y-0.5 ${
            product.inStock ? "" : "opacity-75"
          }`}
        >
          <div className="relative aspect-4/3 overflow-hidden bg-muted">
            {product.imageUrl ? (
              <ProductImage
                imageUrl={product.imageUrl}
                alt={product.name}
                priority={index < 3}
              />
            ) : (
              <div className="flex h-full items-end bg-[linear-gradient(135deg,#d8e1d5,#f0c8a8)] p-5">
                <span className="text-sm font-medium text-foreground/70">
                  {product.category ?? "Fresh from the kitchen"}
                </span>
              </div>
            )}
            {!product.inStock ? (
              <span className="absolute left-3 top-3 rounded-full bg-foreground/85 px-3 py-1 text-xs font-semibold text-background">
                Out of stock
              </span>
            ) : null}
          </div>

          <div className="space-y-4 p-5">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                {product.category ?? "Uncategorized"}
              </p>
              <h2 className="text-xl font-semibold tracking-tight">
                {product.name}
              </h2>
              {product.description ? (
                <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">
                  {product.description}
                </p>
              ) : null}
            </div>

            <div className="flex items-center justify-between gap-4">
              <p className="text-lg font-semibold">
                {formatPrice(product.price)}
              </p>
              <button
                type="button"
                disabled={!product.inStock}
                onClick={() => {
                  if (addItem(product)) {
                    toast.success("Added to cart");
                  } else {
                    toast.warning(
                      "Cart's getting full — check out or split into another order",
                    );
                  }
                }}
                className="rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-background transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
              >
                {product.inStock
                  ? totalItems > 0
                    ? "Add to cart"
                    : "Buy now"
                  : "Unavailable"}
              </button>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
