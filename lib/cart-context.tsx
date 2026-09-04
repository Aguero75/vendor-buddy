"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

export const MAX_CART_ITEMS = 15;

export type CartProduct = {
  id: string;
  name: string;
  price: string;
};

export type CartLine = CartProduct & {
  quantity: number;
};

type CartContextValue = {
  lines: CartLine[];
  totalItems: number;
  total: number;
  addItem: (product: CartProduct) => boolean;
  removeItem: (productId: string) => void;
  setQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const totalItems = lines.reduce((sum, line) => sum + line.quantity, 0);
  const total = lines.reduce(
    (sum, line) => sum + Number(line.price) * line.quantity,
    0,
  );

  function addItem(product: CartProduct) {
    if (totalItems >= MAX_CART_ITEMS) {
      return false;
    }

    setLines((currentLines) => {
      const existingLine = currentLines.find((line) => line.id === product.id);

      if (existingLine) {
        return currentLines.map((line) =>
          line.id === product.id
            ? { ...line, quantity: line.quantity + 1 }
            : line,
        );
      }

      return [...currentLines, { ...product, quantity: 1 }];
    });

    return true;
  }

  function removeItem(productId: string) {
    setLines((currentLines) =>
      currentLines.filter((line) => line.id !== productId),
    );
  }

  function setQuantity(productId: string, quantity: number) {
    setLines((currentLines) => {
      if (quantity <= 0) {
        return currentLines.filter((line) => line.id !== productId);
      }

      const otherItems = currentLines.reduce(
        (sum, line) => (line.id === productId ? sum : sum + line.quantity),
        0,
      );
      const allowedQuantity = Math.max(1, MAX_CART_ITEMS - otherItems);

      return currentLines.map((line) => {
        if (line.id !== productId) {
          return line;
        }

        return { ...line, quantity: Math.min(quantity, allowedQuantity) };
      });
    });
  }

  return (
    <CartContext.Provider
      value={{
        lines,
        totalItems,
        total,
        addItem,
        removeItem,
        setQuantity,
        clearCart: () => setLines([]),
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error("useCart must be used inside a CartProvider.");
  }

  return context;
}
