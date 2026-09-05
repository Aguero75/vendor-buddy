"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { SalesAnalytics } from "@/lib/analytics";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(value);
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value?: number; name?: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  const value = Number(payload[0]?.value ?? 0);
  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2 text-sm shadow-sm">
      <p className="text-muted-foreground">{label}</p>
      <p className="font-semibold">{formatCurrency(value)}</p>
    </div>
  );
}

export function SalesAnalytics({ analytics }: { analytics: SalesAnalytics }) {
  const hasSales = analytics.dailySales.some((day) => day.total > 0);
  const hasProducts = analytics.topProducts.length > 0;

  return (
    <section className="space-y-5" aria-labelledby="analytics-heading">
      <div>
        <p className="text-sm text-muted-foreground">Receipt data</p>
        <h2
          id="analytics-heading"
          className="text-2xl font-semibold tracking-tight"
        >
          Sales overview
        </h2>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
          <div className="flex items-baseline justify-between gap-4">
            <div>
              <h3 className="font-semibold">Daily sales</h3>
              <p className="mt-1 text-sm text-muted-foreground">Last 7 days</p>
            </div>
            {!hasSales ? (
              <span className="text-sm text-muted-foreground">
                No sales yet
              </span>
            ) : null}
          </div>
          <div className="mt-5 h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={analytics.dailySales}
                margin={{ top: 8, right: 8, left: 8, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value: number) =>
                    formatCurrency(value).replace(/\.00$/, "")
                  }
                  width={72}
                />
                <Tooltip
                  content={<ChartTooltip />}
                  cursor={{ fill: "var(--muted)" }}
                />
                <Bar
                  dataKey="total"
                  name="Sales"
                  fill="var(--primary)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
          <div>
            <h3 className="font-semibold">Top-selling products</h3>
            <p className="mt-1 text-sm text-muted-foreground">By units sold</p>
          </div>
          {!hasProducts ? (
            <div className="flex h-72 items-center justify-center text-center text-sm text-muted-foreground">
              No receipt items to chart yet.
            </div>
          ) : (
            <div className="mt-5 h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={analytics.topProducts}
                  layout="vertical"
                  margin={{ top: 8, right: 12, left: 8, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={110}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip
                    cursor={{ fill: "var(--muted)" }}
                    formatter={(value) => [`${value} units`, "Sold"]}
                  />
                  <Bar
                    dataKey="quantity"
                    name="Sold"
                    fill="var(--secondary-foreground)"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
