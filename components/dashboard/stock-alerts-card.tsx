import Link from "next/link";
import { ArrowRightIcon, WarningCircleIcon } from "@phosphor-icons/react/ssr";

type AlertProduct = { id: string; name: string; stock: number | null };

export function StockAlertsCard({ alerts }: { alerts: AlertProduct[] }) {
  if (alerts.length === 0) return null;

  return (
    <section
      aria-labelledby="stock-alerts-heading"
      className="rounded-xl border border-border bg-card p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2
            id="stock-alerts-heading"
            className="flex items-center gap-2 font-semibold"
          >
            <WarningCircleIcon
              className="size-5 text-amber-700"
              weight="duotone"
              aria-hidden="true"
            />
            Restock soon
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Products at or below their stock alert level.
          </p>
        </div>
        <Link
          href="/dashboard/products"
          className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          Manage products
          <ArrowRightIcon className="size-4" aria-hidden="true" />
        </Link>
      </div>
      <ul className="mt-4 divide-y divide-border">
        {alerts.map((product) => (
          <li
            key={product.id}
            className="flex items-center justify-between gap-3 py-2 text-sm"
          >
            <span className="truncate">{product.name}</span>
            <span
              className={
                product.stock === 0
                  ? "shrink-0 font-medium text-red-700"
                  : "shrink-0 font-medium text-amber-700"
              }
            >
              {product.stock === 0 ? "Out of stock" : `${product.stock} left`}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
