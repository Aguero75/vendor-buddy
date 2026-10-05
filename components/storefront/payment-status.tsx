"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useCart } from "@/lib/cart-context";

export function PaymentStatus({
  receiptId,
  status,
  method,
}: {
  receiptId: string;
  status: string;
  method: string;
}) {
  const router = useRouter();
  const { clearCart, isHydrated } = useCart();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (status === "PAID") {
      if (isHydrated) clearCart();
      const timer = setTimeout(() => router.replace("/"), 4_000);
      return () => clearTimeout(timer);
    }
    if (status !== "PENDING" && status !== "PARTIAL") return;

    let checks = 0;
    const timer = setInterval(() => {
      checks += 1;
      if (checks >= 120) {
        clearInterval(timer);
        setTimedOut(true);
        return;
      }
      router.refresh();
    }, 5_000);
    return () => clearInterval(timer);
  }, [clearCart, isHydrated, router, status]);

  const copy =
    status === "PAID"
      ? "Payment received. Thank you! Taking you back to the store…"
      : status === "PARTIAL"
        ? "We received part of your crypto payment. The store will contact you if more is needed."
        : status === "FAILED"
          ? "The payment did not go through. Your cart is still available."
          : status === "VOIDED"
            ? "This order was cancelled. Contact the store if you have already paid."
            : timedOut
              ? "We are still waiting for payment confirmation. Keep this page and contact the store if you have completed payment."
              : method === "CRYPTO"
                ? "Waiting for network confirmation. This may take a few minutes…"
                : "Confirming your payment…";

  return (
    <div className="space-y-5 text-center">
      <div
        className={`mx-auto flex size-14 items-center justify-center rounded-full text-xl font-semibold ${
          status === "PAID"
            ? "bg-emerald-100 text-emerald-800"
            : status === "FAILED" || status === "VOIDED"
              ? "bg-destructive/10 text-destructive"
              : "bg-accent/30 text-foreground"
        }`}
        aria-hidden="true"
      >
        {status === "PAID" ? "✓" : status === "FAILED" ? "!" : "…"}
      </div>
      <p role="status" aria-live="polite" className="text-muted-foreground">
        {copy}
      </p>
      <p className="text-xs text-muted-foreground">
        Order reference: <span className="font-mono">{receiptId}</span>
      </p>
      {status === "FAILED" || status === "VOIDED" ? (
        <Link
          href="/checkout"
          className="inline-flex h-10 items-center justify-center rounded-lg bg-foreground px-4 text-sm font-semibold text-background"
        >
          Return to checkout
        </Link>
      ) : null}
    </div>
  );
}
