"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";

import { useCart } from "@/lib/cart-context";

export function CheckoutOutcome({ paid }: { paid: boolean }) {
  const router = useRouter();
  const { clearCart, isHydrated } = useCart();
  const handled = useRef(false);

  useEffect(() => {
    if (!paid || !isHydrated || handled.current) {
      return;
    }

    handled.current = true;
    clearCart();
    toast.success("Payment successful. Thank you for your order.");
    router.replace("/");
  }, [clearCart, isHydrated, paid, router]);

  return null;
}
