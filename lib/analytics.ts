import { prisma } from "@/lib/prisma";

export type SalesAnalytics = {
  dailySales: { label: string; date: string; total: number }[];
  topProducts: { name: string; quantity: number; revenue: number }[];
};

function startOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function formatDayLabel(date: Date) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(date);
}

export async function getSalesAnalytics(
  vendorId: string,
): Promise<SalesAnalytics> {
  const today = startOfDay(new Date());
  const firstDay = new Date(today);
  firstDay.setDate(firstDay.getDate() - 6);
  const endOfToday = new Date(today);
  endOfToday.setDate(endOfToday.getDate() + 1);

  const [receipts, lineItems] = await Promise.all([
    prisma.receipt.findMany({
      where: {
        vendorId,
        createdAt: { gte: firstDay, lt: endOfToday },
      },
      select: { createdAt: true, total: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.receiptLineItem.findMany({
      where: { vendorId },
      select: { nameSnapshot: true, quantity: true, unitPrice: true },
    }),
  ]);

  const dailyTotals = new Map<string, number>();
  for (const receipt of receipts) {
    const date = startOfDay(receipt.createdAt);
    const key = date.toISOString().slice(0, 10);
    dailyTotals.set(key, (dailyTotals.get(key) ?? 0) + Number(receipt.total));
  }

  const dailySales = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(firstDay);
    date.setDate(firstDay.getDate() + index);
    const key = date.toISOString().slice(0, 10);

    return {
      date: key,
      label: formatDayLabel(date),
      total: Number((dailyTotals.get(key) ?? 0).toFixed(2)),
    };
  });

  const productTotals = new Map<
    string,
    { name: string; quantity: number; revenue: number }
  >();
  for (const lineItem of lineItems) {
    const current = productTotals.get(lineItem.nameSnapshot) ?? {
      name: lineItem.nameSnapshot,
      quantity: 0,
      revenue: 0,
    };
    current.quantity += lineItem.quantity;
    current.revenue += lineItem.quantity * Number(lineItem.unitPrice);
    productTotals.set(lineItem.nameSnapshot, current);
  }

  const topProducts = Array.from(productTotals.values())
    .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue)
    .slice(0, 5)
    .map((product) => ({
      ...product,
      revenue: Number(product.revenue.toFixed(2)),
    }));

  return { dailySales, topProducts };
}
