import Image from "next/image";

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

export function ProductGrid({ products }: { products: Product[] }) {
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
      {products.map((product) => (
        <article
          key={product.id}
          className={`overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-transform hover:-translate-y-0.5 ${
            product.inStock ? "" : "opacity-75"
          }`}
        >
          <div className="relative aspect-[4/3] overflow-hidden bg-muted">
            {product.imageUrl ? (
              <Image
                src={product.imageUrl}
                alt={product.name}
                fill
                unoptimized
                sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                className="object-cover"
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
                className="rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-background transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
              >
                {product.inStock ? "Buy now" : "Unavailable"}
              </button>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
