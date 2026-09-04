"use client";

import { Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "react-toastify";

import { MAX_CART_ITEMS, useCart } from "@/lib/cart-context";
import { buildWhatsAppUrl } from "@/lib/whatsapp-message";

type CartDrawerProps = {
  whatsappNumber: string;
};

function formatPrice(price: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(price);
}

export function CartDrawer({ whatsappNumber }: CartDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { lines, totalItems, total, removeItem, setQuantity, clearCart } =
    useCart();

  function checkout() {
    if (lines.length === 0) {
      return;
    }

    try {
      const checkout = buildWhatsAppUrl(whatsappNumber, lines);

      if (!whatsappNumber || checkout.encodedLength > 1500) {
        throw new Error("Invalid checkout link");
      }

      const opened = window.open(checkout.url, "_blank", "noopener,noreferrer");

      if (!opened) {
        throw new Error("WhatsApp did not open");
      }

      clearCart();
      setIsOpen(false);
    } catch {
      toast.error("Couldn't open WhatsApp — try again");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label={`Open cart with ${totalItems} ${totalItems === 1 ? "item" : "items"}`}
        className="fixed bottom-5 right-5 z-20 inline-flex h-12 items-center gap-2 rounded-full bg-foreground px-4 text-sm font-semibold text-background shadow-lg transition-transform hover:-translate-y-0.5"
      >
        <ShoppingBag className="size-4" />
        Cart
        {totalItems > 0 ? (
          <span className="rounded-full bg-background px-2 py-0.5 text-xs text-foreground">
            {totalItems}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <div
          className="fixed inset-0 z-30"
          role="dialog"
          aria-modal="true"
          aria-label="Shopping cart"
        >
          <button
            type="button"
            aria-label="Close cart"
            className="absolute inset-0 bg-foreground/30"
            onClick={() => setIsOpen(false)}
          />
          <aside className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-background shadow-2xl">
            <header className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  Your order
                </p>
                <h2 className="text-xl font-semibold">Cart</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close cart"
                className="rounded-lg p-2 hover:bg-muted"
              >
                <X className="size-5" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-5 py-5">
              {lines.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground">
                  <ShoppingBag className="mx-auto mb-3 size-8" />
                  <p>Your cart is empty.</p>
                </div>
              ) : (
                <div className="space-y-5">
                  {lines.map((line) => (
                    <div
                      key={line.id}
                      className="flex items-start justify-between gap-4"
                    >
                      <div className="min-w-0">
                        <h3 className="truncate font-medium">{line.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {formatPrice(Number(line.price))} each
                        </p>
                        <div className="mt-2 inline-flex items-center gap-2 rounded-lg border border-border">
                          <button
                            type="button"
                            className="p-1.5 hover:bg-muted"
                            onClick={() =>
                              setQuantity(line.id, line.quantity - 1)
                            }
                            aria-label={`Decrease ${line.name} quantity`}
                          >
                            <Minus className="size-3" />
                          </button>
                          <span className="min-w-5 text-center text-sm">
                            {line.quantity}
                          </span>
                          <button
                            type="button"
                            className="p-1.5 hover:bg-muted"
                            onClick={() => {
                              if (totalItems >= MAX_CART_ITEMS) {
                                toast.warning(
                                  "Cart's getting full — check out or split into another order",
                                );
                                return;
                              }
                              setQuantity(line.id, line.quantity + 1);
                            }}
                            aria-label={`Increase ${line.name} quantity`}
                          >
                            <Plus className="size-3" />
                          </button>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-sm font-semibold">
                          {formatPrice(Number(line.price) * line.quantity)}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            removeItem(line.id);
                            toast.info("Removed from cart");
                          }}
                          aria-label={`Remove ${line.name} from cart`}
                          className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <footer className="space-y-4 border-t border-border px-5 py-5">
              <div className="flex items-center justify-between font-semibold">
                <span>Total</span>
                <span>{formatPrice(total)}</span>
              </div>
              <button
                type="button"
                disabled={lines.length === 0}
                onClick={checkout}
                className="w-full rounded-lg bg-foreground px-4 py-3 text-sm font-semibold text-background transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
              >
                Checkout on WhatsApp
              </button>
            </footer>
          </aside>
        </div>
      ) : null}
    </>
  );
}
