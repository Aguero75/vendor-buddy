"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "react-toastify";

import { Button } from "@/components/ui/button";
import { createReceipt } from "@/lib/actions/receipts";

type ProductOption = {
  id: string;
  name: string;
  price: string;
};

type ReceiptLine = {
  key: number;
  productId: string;
  name: string;
  quantity: number;
  unitPrice: string;
};

function newLine(key: number): ReceiptLine {
  return { key, productId: "", name: "", quantity: 1, unitPrice: "" };
}

export function ReceiptForm({ products }: { products: ProductOption[] }) {
  const router = useRouter();
  const [lines, setLines] = useState<ReceiptLine[]>([newLine(1)]);
  const [nextKey, setNextKey] = useState(2);
  const [isPending, startTransition] = useTransition();

  function updateLine(key: number, changes: Partial<ReceiptLine>) {
    setLines((currentLines) =>
      currentLines.map((line) =>
        line.key === key ? { ...line, ...changes } : line,
      ),
    );
  }

  function selectProduct(key: number, productId: string) {
    const product = products.find((item) => item.id === productId);
    updateLine(key, {
      productId,
      name: product?.name ?? "",
      unitPrice: product?.price ?? "",
    });
  }

  function handleSubmit(formData: FormData) {
    formData.set(
      "lines",
      JSON.stringify(
        lines.map(({ productId, name, quantity, unitPrice }) => ({
          productId: productId || undefined,
          name,
          quantity,
          unitPrice,
        })),
      ),
    );

    startTransition(async () => {
      const result = await createReceipt(formData);

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success("Receipt saved");
      router.push("/dashboard/receipts");
      router.refresh();
    });
  }

  const total = lines.reduce(
    (sum, line) => sum + Number(line.unitPrice || 0) * line.quantity,
    0,
  );

  return (
    <form action={handleSubmit} className="space-y-7">
      <label className="block max-w-md space-y-2">
        <span className="text-sm font-medium">Customer name (optional)</span>
        <input
          name="customerName"
          placeholder="e.g. Ada"
          className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/20"
        />
      </label>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-semibold">Items</h2>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setLines((currentLines) => [...currentLines, newLine(nextKey)]);
              setNextKey((currentKey) => currentKey + 1);
            }}
          >
            Add item
          </Button>
        </div>

        {lines.map((line, index) => (
          <div
            key={line.key}
            className="grid gap-4 rounded-xl border border-border p-4 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_120px_120px_auto] sm:items-end"
          >
            <label className="space-y-2">
              <span className="text-sm font-medium">Product</span>
              <select
                value={line.productId}
                onChange={(event) =>
                  selectProduct(line.key, event.target.value)
                }
                className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/20"
              >
                <option value="">Custom item</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium">Name</span>
              <input
                required
                value={line.name}
                onChange={(event) =>
                  updateLine(line.key, { name: event.target.value })
                }
                placeholder="Item name"
                className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/20"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium">Quantity</span>
              <input
                required
                min="1"
                step="1"
                type="number"
                value={line.quantity}
                onChange={(event) =>
                  updateLine(line.key, {
                    quantity: Number(event.target.value),
                  })
                }
                className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/20"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium">Price (NGN)</span>
              <input
                required
                min="0.01"
                step="0.01"
                type="number"
                value={line.unitPrice}
                onChange={(event) =>
                  updateLine(line.key, { unitPrice: event.target.value })
                }
                placeholder="0.00"
                className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/20"
              />
            </label>

            <Button
              type="button"
              variant="ghost"
              onClick={() =>
                setLines((currentLines) =>
                  currentLines.length === 1
                    ? currentLines
                    : currentLines.filter((item) => item.key !== line.key),
                )
              }
              disabled={lines.length === 1}
              aria-label={`Remove item ${index + 1}`}
            >
              Remove
            </Button>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-5">
        <p className="text-lg font-semibold">
          Total: NGN{" "}
          {total.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
        </p>
        <Button type="submit" disabled={isPending} size="lg">
          {isPending ? "Saving..." : "Save receipt"}
        </Button>
      </div>
    </form>
  );
}
