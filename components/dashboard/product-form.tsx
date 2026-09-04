"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "react-toastify";

import { Button } from "@/components/ui/button";
import { createProduct, updateProduct } from "@/lib/actions/products";

type ProductFormProps = {
  categories: string[];
  product?: {
    id: string;
    name: string;
    description: string | null;
    category: string | null;
    price: string;
    imageUrl: string | null;
  };
};

export function ProductForm({ categories, product }: ProductFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isEditing = Boolean(product);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = product
        ? await updateProduct(formData)
        : await createProduct(formData);

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success("Product saved");
      router.push("/dashboard/products");
      router.refresh();
    });
  }

  return (
    <form action={handleSubmit} className="space-y-6">
      {product ? <input type="hidden" name="id" value={product.id} /> : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="space-y-2 sm:col-span-2">
          <span className="text-sm font-medium">Product name</span>
          <input
            required
            name="name"
            defaultValue={product?.name}
            placeholder="e.g. Jollof Rice Tray"
            className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/20"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium">Price (NGN)</span>
          <input
            required
            min="0.01"
            step="0.01"
            type="number"
            name="price"
            defaultValue={product?.price}
            placeholder="0.00"
            className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/20"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium">Category</span>
          <input
            name="category"
            list="product-categories"
            defaultValue={product?.category ?? ""}
            placeholder="Choose or type a category"
            className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/20"
          />
          <datalist id="product-categories">
            {categories.map((category) => (
              <option key={category} value={category} />
            ))}
          </datalist>
        </label>

        <label className="space-y-2 sm:col-span-2">
          <span className="text-sm font-medium">Description</span>
          <textarea
            name="description"
            defaultValue={product?.description ?? ""}
            placeholder="A short description customers will understand"
            rows={4}
            className="w-full resize-y rounded-lg border border-input bg-background px-3 py-3 text-sm outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/20"
          />
        </label>

        <label className="space-y-2 sm:col-span-2">
          <span className="text-sm font-medium">Image URL</span>
          <input
            type="url"
            name="imageUrl"
            defaultValue={product?.imageUrl ?? ""}
            placeholder="https://..."
            className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/20"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-5">
        <Button type="submit" disabled={isPending} size="lg">
          {isPending ? "Saving..." : isEditing ? "Save changes" : "Add product"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="lg"
          onClick={() => router.push("/dashboard/products")}
          disabled={isPending}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
