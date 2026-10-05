import { Prisma } from "@prisma/client";

import type { Range } from "@/lib/range";
import { prisma } from "@/lib/prisma";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function paidWhere(vendorId: string, range: Range): Prisma.ReceiptWhereInput {
  return {
    vendorId,
    status: "PAID",
    ...(range === "all"
      ? {}
      : { paidAt: { gte: new Date(Date.now() - Number(range) * 86_400_000) } }),
  };
}

export async function getSummary(vendorId: string, range: Range) {
  const aggregate = (where: Prisma.ReceiptWhereInput) =>
    prisma.receipt.aggregate({
      where: { vendorId, status: "PAID", ...where },
      _sum: { total: true },
      _count: { _all: true },
    });

  const current = await aggregate(
    range === "all"
      ? {}
      : {
          paidAt: {
            gte: new Date(Date.now() - Number(range) * 86_400_000),
          },
        },
  );
  const revenue = Number(current._sum.total ?? 0);
  const sales = current._count._all;
  const aov = sales ? revenue / sales : 0;

  let change: {
    revenue: number | null;
    sales: number | null;
    aov: number | null;
  } | null = null;
  if (range !== "all") {
    const days = Number(range);
    const now = new Date();
    const previous = await aggregate({
      paidAt: {
        gte: new Date(now.getTime() - 2 * days * 86_400_000),
        lt: new Date(now.getTime() - days * 86_400_000),
      },
    });
    const previousRevenue = Number(previous._sum.total ?? 0);
    const previousSales = previous._count._all;
    const previousAov = previousSales ? previousRevenue / previousSales : 0;
    const percentChange = (value: number, prior: number) =>
      prior ? ((value - prior) / prior) * 100 : null;
    change = {
      revenue: percentChange(revenue, previousRevenue),
      sales: percentChange(sales, previousSales),
      aov: percentChange(aov, previousAov),
    };
  }

  return { revenue, sales, aov, change };
}

export async function getTimeBuckets(vendorId: string, range: Range) {
  const since =
    range === "all"
      ? null
      : new Date(Date.now() - Number(range) * 86_400_000);
  const rows = await prisma.$queryRaw<
    { weekday: number; hour: number; sales: bigint; revenue: number }[]
  >`
    SELECT
      EXTRACT(DOW FROM (("paidAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Africa/Lagos'))::int AS weekday,
      EXTRACT(HOUR FROM (("paidAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Africa/Lagos'))::int AS hour,
      COUNT(*) AS sales,
      SUM("total")::float8 AS revenue
    FROM "Receipt"
    WHERE "vendorId" = ${vendorId}
      AND "status" = 'PAID'
      AND "paidAt" IS NOT NULL
      ${since ? Prisma.sql`AND "paidAt" >= ${since}` : Prisma.empty}
    GROUP BY 1, 2
  `;

  const byDay = DAYS.map((day) => ({ day, sales: 0, revenue: 0 }));
  const byHour = Array.from({ length: 24 }, (_, hour) => ({ hour, sales: 0 }));
  for (const row of rows) {
    const sales = Number(row.sales);
    byDay[row.weekday].sales += sales;
    byDay[row.weekday].revenue += Number(row.revenue ?? 0);
    byHour[row.hour].sales += sales;
  }
  return { byDay, byHour };
}

export async function getByMethod(vendorId: string, range: Range) {
  const rows = await prisma.receipt.groupBy({
    by: ["method"],
    where: paidWhere(vendorId, range),
    _sum: { total: true },
    _count: { _all: true },
  });
  return rows.map((row) => ({
    method: row.method,
    revenue: Number(row._sum.total ?? 0),
    sales: row._count._all,
  }));
}

export async function getDailyRevenue(vendorId: string, range: Range) {
  const since =
    range === "all"
      ? null
      : new Date(Date.now() - Number(range) * 86_400_000);
  const rows = await prisma.$queryRaw<
    { date: string; revenue: number; sales: bigint }[]
  >`
    SELECT
      to_char(
        (("paidAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Africa/Lagos')::date,
        'YYYY-MM-DD'
      ) AS date,
      SUM("total")::float8 AS revenue,
      COUNT(*) AS sales
    FROM "Receipt"
    WHERE "vendorId" = ${vendorId}
      AND "status" = 'PAID'
      AND "paidAt" IS NOT NULL
      ${since ? Prisma.sql`AND "paidAt" >= ${since}` : Prisma.empty}
    GROUP BY 1
    ORDER BY 1
  `;
  return rows.map((row) => ({
    date: row.date,
    revenue: Number(row.revenue ?? 0),
    sales: Number(row.sales),
  }));
}

export async function getBestSellers(vendorId: string, range: Range) {
  const rows = await prisma.receiptLineItem.groupBy({
    by: ["nameSnapshot"],
    where: {
      vendorId,
      receipt: { is: paidWhere(vendorId, range) },
    },
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: "desc" } },
    take: 8,
  });
  return rows.map((row) => ({
    name: row.nameSnapshot,
    qty: row._sum.quantity ?? 0,
  }));
}

export async function getStockAlerts(vendorId: string, threshold: number) {
  const tracked = await prisma.product.count({
    where: { vendorId, stock: { not: null } },
  });
  if (tracked === 0) return { tracked, alerts: [] };

  const cutoff = new Date(Date.now() - 30 * 86_400_000);
  const alerts = await prisma.product.findMany({
    where: {
      vendorId,
      stock: { not: null, lte: threshold },
      OR: [
        { stock: { gt: 0 } },
        { stock: 0, OR: [{ zeroSince: null }, { zeroSince: { gte: cutoff } }] },
      ],
    },
    orderBy: [{ stock: "asc" }, { name: "asc" }],
    select: { id: true, name: true, stock: true },
  });
  return { tracked, alerts };
}

function maskCustomerKey(customerKey: string) {
  if (customerKey.includes("@")) {
    const [name, domain] = customerKey.split("@");
    return `${name.slice(0, 1)}***@${domain}`;
  }
  return `Phone ending ${customerKey.replace(/\D/g, "").slice(-4)}`;
}

export async function getCustomers(vendorId: string, range: Range) {
  const [rows, totalPaid] = await Promise.all([
    prisma.receipt.groupBy({
      by: ["customerKey"],
      where: { ...paidWhere(vendorId, range), customerKey: { not: null } },
      _count: { _all: true },
      _sum: { total: true },
      orderBy: { _sum: { total: "desc" } },
    }),
    prisma.receipt.count({ where: paidWhere(vendorId, range) }),
  ]);
  const identifiedSales = rows.reduce((sum, row) => sum + row._count._all, 0);
  const repeatCustomers = rows.filter((row) => row._count._all > 1).length;
  return {
    customers: rows.length,
    repeatRate: rows.length ? repeatCustomers / rows.length : 0,
    coverage: totalPaid ? identifiedSales / totalPaid : 0,
    top: rows.slice(0, 5).map((row) => ({
      customer: maskCustomerKey(row.customerKey ?? ""),
      orders: row._count._all,
      total: Number(row._sum.total ?? 0),
    })),
  };
}

export async function getSalesAnalytics(
  vendorId: string,
  range: Range,
) {
  const [summary, time, methods, dailyRevenue, bestSellers, customers] =
    await Promise.all([
      getSummary(vendorId, range),
      getTimeBuckets(vendorId, range),
      getByMethod(vendorId, range),
      getDailyRevenue(vendorId, range),
      getBestSellers(vendorId, range),
      getCustomers(vendorId, range),
    ]);
  return { summary, ...time, methods, dailyRevenue, bestSellers, customers };
}

export async function countAttention(vendorId: string) {
  const [partial, review] = await Promise.all([
    prisma.receipt.count({ where: { vendorId, status: "PARTIAL" } }),
    prisma.receipt.count({ where: { vendorId, needsReview: true } }),
  ]);
  return { partial, review };
}

export type SalesAnalytics = Awaited<ReturnType<typeof getSalesAnalytics>>;
