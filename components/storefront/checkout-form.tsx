"use client";

import Link from "next/link";
import { useState, useTransition, type FormEvent } from "react";

import { startCheckout } from "@/lib/actions/checkout";
import { useCart } from "@/lib/cart-context";

function formatPrice(price: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(price);
}

export function CheckoutForm({ failed }: { failed: boolean }) {
  const { lines, total, isHydrated } = useCart();
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState(
    failed ? "Payment wasn't completed. Your cart is still here." : "",
  );
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    startTransition(async () => {
      const result = await startCheckout(
        lines.map(({ id, quantity }) => ({ id, quantity })),
        email,
        phone,
      );

      if (!result.ok || !result.data?.authorizationUrl) {
        setError(
          result.ok ? "Couldn't start payment. Try again." : result.message,
        );
        return;
      }

      window.location.assign(result.data.authorizationUrl);
    });
  }

  if (!isHydrated) {
    return (
      <p className="py-10 text-center text-muted-foreground">
        Loading your cart…
      </p>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="space-y-4 py-8 text-center">
        <p className="text-muted-foreground">Your cart is empty.</p>
        <Link
          href="/"
          className="inline-flex h-10 items-center justify-center rounded-lg bg-foreground px-4 text-sm font-semibold text-background"
        >
          Browse products
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-7">
      <div className="space-y-4">
        <label className="block space-y-2">
          <span className="text-sm font-medium">Email address</span>
          <input
            required
            type="email"
            autoComplete="email"
            maxLength={254}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/20"
          />
        </label>
        <label className="block space-y-2">
          <span className="text-sm font-medium">Phone number</span>
          <input
            required
            type="tel"
            autoComplete="tel"
            maxLength={24}
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="e.g. 08012345678"
            className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/20"
          />
        </label>
      </div>

      <div className="space-y-3 border-y border-border py-5">
        <h2 className="font-semibold">Your order</h2>
        <ul className="space-y-3">
          {lines.map((line) => (
            <li key={line.id} className="flex justify-between gap-4 text-sm">
              <span className="min-w-0">
                {line.quantity} × {line.name}
              </span>
              <span className="shrink-0 font-medium">
                {formatPrice(Number(line.price) * line.quantity)}
              </span>
            </li>
          ))}
        </ul>
        <div className="flex justify-between pt-2 font-semibold">
          <span>Total</span>
          <span>{formatPrice(total)}</span>
        </div>
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-lg bg-foreground px-4 py-3 text-sm font-semibold text-background transition-opacity hover:opacity-85 disabled:cursor-wait disabled:opacity-60"
      >
        {isPending ? "Preparing secure payment…" : "Continue to Paystack"}
      </button>
    </form>
  );
}
