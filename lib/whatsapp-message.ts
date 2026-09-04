import type { CartLine } from "@/lib/cart-context";

const SHORT_LINE_ITEM_LIMIT = 5;
const MAX_PRODUCT_NAME_LENGTH = 28;

function truncateName(name: string) {
  return name.length > MAX_PRODUCT_NAME_LENGTH
    ? `${name.slice(0, MAX_PRODUCT_NAME_LENGTH - 1)}...`
    : name;
}

function formatPrice(price: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(price);
}

export function buildWhatsAppUrl(phoneNumber: string, lines: CartLine[]) {
  const totalItems = lines.reduce((sum, line) => sum + line.quantity, 0);
  const total = lines.reduce(
    (sum, line) => sum + Number(line.price) * line.quantity,
    0,
  );
  const includePrices = totalItems <= SHORT_LINE_ITEM_LIMIT;
  const itemLines = lines.map((line) => {
    const item = `${truncateName(line.name)} x${line.quantity}`;
    return includePrices
      ? `${item} - ${formatPrice(Number(line.price))}`
      : item;
  });
  const message = [
    "Hi, I'd like to place an order:",
    ...itemLines,
    `Total: ${formatPrice(total)}`,
  ].join("\n");
  const encodedMessage = encodeURIComponent(message);
  const normalizedPhone = phoneNumber.replace(/\D/g, "");

  return {
    url: `https://wa.me/${normalizedPhone}?text=${encodedMessage}`,
    encodedLength: encodedMessage.length,
  };
}
