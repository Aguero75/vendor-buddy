"use client";

import Link from "next/link";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type YAxisTickContentProps,
} from "recharts";

import type { SalesAnalytics } from "@/lib/analytics";
import { naira, type Range } from "@/lib/range";

const COLORS = [
  "#6366f1",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#06b6d4",
  "#a855f7",
  "#64748b",
];
const RANGE_OPTIONS: { value: Range; label: string }[] = [
  { value: "30", label: "30 days" },
  { value: "60", label: "60 days" },
  { value: "all", label: "All time" },
];

function percentChange(value: number | null) {
  if (value === null) return "No previous period data";
  return `${value >= 0 ? "↑" : "↓"} ${Math.abs(value).toFixed(0)}% vs previous period`;
}

function formatHour(hour: number) {
  return `${hour % 12 || 12}${hour < 12 ? "a" : "p"}`;
}

function rangeLabel(range: Range) {
  return RANGE_OPTIONS.find((option) => option.value === range)?.label ?? "30 days";
}

function parseIsoDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

function formatDailyTick(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(parseIsoDate(value));
}

function formatCompactNaira(value: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatFullDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "full",
    timeZone: "UTC",
  }).format(parseIsoDate(value));
}

function formatRevenue(value: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(value);
}

function productInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

function BestSellerTick({
  x,
  y,
  payload,
  textAnchor,
  fill,
}: YAxisTickContentProps) {
  const name = String(payload.value ?? "");

  return (
    <>
      <text
        x={x}
        y={y}
        textAnchor={textAnchor}
        dominantBaseline="central"
        fill={fill}
        className="top-seller-label-short"
        aria-label={name}
      >
        {productInitials(name)}
      </text>
      <text
        x={x}
        y={y}
        textAnchor={textAnchor}
        dominantBaseline="central"
        fill={fill}
        className="top-seller-label-full"
        aria-label={name}
      >
        {name}
      </text>
    </>
  );
}

export function SalesAnalytics({
  analytics,
  range,
  pathname,
  query,
}: {
  analytics: SalesAnalytics;
  range: Range;
  pathname: string;
  query: string;
}) {
  const [dayMetric, setDayMetric] = useState<"sales" | "revenue">("sales");
  const [summaryHidden, setSummaryHidden] = useState(false);
  const activeDayRows = analytics.byDay.filter((day) => day[dayMetric] > 0);
  const bestDay = [...activeDayRows].sort(
    (a, b) => b[dayMetric] - a[dayMetric],
  )[0];
  const params = new URLSearchParams(query);
  params.delete("page");
  params.delete("view");

  function href(value: string) {
    const next = new URLSearchParams(params);
    next.set("range", value);
    return `${pathname}?${next.toString()}`;
  }

  const summaryCards = [
    {
      label: "Revenue",
      value: naira(analytics.summary.revenue),
      change: analytics.summary.change?.revenue,
    },
    {
      label: "Paid sales",
      value: String(analytics.summary.sales),
      change: analytics.summary.change?.sales,
    },
    {
      label: "Average order",
      value: naira(analytics.summary.aov),
      change: analytics.summary.change?.aov,
    },
  ];

  return (
    <section className="space-y-5" aria-labelledby="analytics-heading">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Paid receipt data</p>
          <div className="flex items-center gap-2">
            <h2
              id="analytics-heading"
              className="text-2xl font-semibold tracking-tight"
            >
              Sales overview
            </h2>
            <button
              type="button"
              onClick={() => setSummaryHidden((hidden) => !hidden)}
              aria-label={
                summaryHidden
                  ? "Show sales overview totals"
                  : "Hide sales overview totals"
              }
              aria-pressed={summaryHidden}
              title={
                summaryHidden
                  ? "Show sales overview totals"
                  : "Hide sales overview totals"
              }
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {summaryHidden ? (
                <Eye className="size-4" aria-hidden="true" />
              ) : (
                <EyeOff className="size-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
        <nav
          aria-label="Analytics date range"
          className="flex w-fit gap-1 rounded-lg border border-border bg-card p-1 text-sm"
        >
          {RANGE_OPTIONS.map((option) => (
            <Link
              key={option.value}
              href={href(option.value)}
              scroll={false}
              aria-current={range === option.value ? "page" : undefined}
              className={`rounded-md px-3 py-1.5 transition-colors ${
                range === option.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {option.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {summaryCards.map((card) => (
          <article
            key={card.label}
            className="rounded-xl border border-border bg-card p-4"
          >
            <p className="text-sm text-muted-foreground">{card.label}</p>
            <p className="mt-1 text-2xl font-semibold" aria-live="polite">
              {summaryHidden ? "********" : card.value}
            </p>
            {range === "all" ? (
              <p className="mt-1 text-xs text-muted-foreground">
                All recorded paid sales
              </p>
            ) : (
              <p
                className={`mt-1 text-xs ${
                  card.change === null || card.change === undefined
                    ? "text-muted-foreground"
                    : card.change >= 0
                      ? "text-green-700"
                      : "text-red-700"
                }`}
              >
                {percentChange(card.change ?? null)}
              </p>
            )}
          </article>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <article className="min-w-0 overflow-hidden rounded-xl border border-border bg-card p-5 sm:p-6">
          <div>
            <h3 className="font-semibold">Daily revenue</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Paid sales by day · {rangeLabel(range).toLowerCase()}
            </p>
          </div>
          {analytics.dailyRevenue.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-center text-sm text-muted-foreground">
              No paid sales in this period.
            </div>
          ) : (
            <div className="mt-4 h-64 w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={analytics.dailyRevenue}
                  margin={{ top: 8, right: 4, left: 0, bottom: 0 }}
                  barCategoryGap="18%"
                >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDailyTick}
                  interval={Math.max(
                    0,
                    Math.ceil(analytics.dailyRevenue.length / 5) - 1,
                  )}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 10 }}
                  minTickGap={4}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={formatCompactNaira}
                  width={54}
                  tick={{ fontSize: 10 }}
                />
                <Tooltip
                  labelFormatter={(label) => formatFullDate(String(label))}
                  formatter={(value) => [
                    formatRevenue(Number(value)),
                    "Revenue",
                  ]}
                />
                <Bar
                  dataKey="revenue"
                  name="Revenue"
                  fill="var(--primary)"
                  radius={[4, 4, 0, 0]}
                />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </article>

        <article className="rounded-xl border border-border bg-card p-5 sm:p-6">
          <div>
            <h3 className="font-semibold">Top-selling products</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Units sold in {rangeLabel(range).toLowerCase()}
            </p>
          </div>
          {analytics.bestSellers.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-center text-sm text-muted-foreground">
              No receipt items to chart yet.
            </div>
          ) : (
            <div className="mt-4 h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={analytics.bestSellers}
                  layout="vertical"
                  margin={{ top: 4, right: 12, left: 8, bottom: 0 }}
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
                    width={140}
                    tickLine={false}
                    axisLine={false}
                    tick={BestSellerTick}
                  />
                  <Tooltip
                    labelFormatter={(name) => String(name)}
                    formatter={(value) => [`${value} units`, "Sold"]}
                  />
                  <Bar
                    dataKey="qty"
                    name="Sold"
                    fill="var(--secondary-foreground)"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </article>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <article className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold">Best sales days</h3>
            <label>
              <span className="sr-only">Measure best sales days by</span>
              <select
                value={dayMetric}
                onChange={(event) =>
                  setDayMetric(event.target.value as "sales" | "revenue")
                }
                className="rounded-md border border-input bg-background px-2 py-1 text-xs"
              >
                <option value="sales">Number of sales</option>
                <option value="revenue">Revenue</option>
              </select>
            </label>
          </div>
          {activeDayRows.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No sales in this period.
            </p>
          ) : (
            <>
              <p className="mt-2 text-sm text-muted-foreground">
                Your best day is <strong>{bestDay?.day}</strong>
              </p>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart
                    data={analytics.byDay}
                    margin={{ top: 12, right: 24, bottom: 12, left: 24 }}
                  >
                    <PolarGrid
                      gridType="polygon"
                      stroke="var(--border)"
                      strokeOpacity={0.8}
                    />
                    <PolarAngleAxis
                      dataKey="day"
                      tick={{
                        fill: "var(--muted-foreground)",
                        fontSize: 11,
                        fontWeight: 600,
                      }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <PolarRadiusAxis
                      angle={90}
                      domain={[0, "auto"]}
                      tick={false}
                      axisLine={false}
                    />
                    <Tooltip
                      formatter={(value) =>
                        dayMetric === "revenue"
                          ? [naira(Number(value)), "Revenue"]
                          : [Number(value), "Sales"]
                      }
                    />
                    <Radar
                      dataKey={dayMetric}
                      name={dayMetric === "revenue" ? "Revenue" : "Sales"}
                      stroke="#6366f1"
                      strokeWidth={2}
                      fill="#6366f1"
                      fillOpacity={0.28}
                      dot={{ r: 3, fill: "#6366f1", strokeWidth: 0 }}
                      activeDot={{ r: 5, fill: "#6366f1", stroke: "white" }}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </article>

        <article className="min-w-0 overflow-hidden rounded-xl border border-border bg-card p-5">
          <h3 className="font-semibold">Sales by hour</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Lagos time · all 24 hours
          </p>
          <div className="mt-3 h-56 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart
                data={analytics.byHour}
                startAngle={-90}
                endAngle={270}
                margin={{ top: 12, right: 18, bottom: 12, left: 18 }}
              >
                <PolarGrid
                  gridType="circle"
                  radialLines={false}
                  stroke="var(--border)"
                  strokeOpacity={0.8}
                />
                <PolarAngleAxis
                  dataKey="hour"
                  tickFormatter={formatHour}
                  tick={{
                    fill: "var(--muted-foreground)",
                    fontSize: 9,
                    fontWeight: 500,
                  }}
                  tickLine={false}
                  axisLine={false}
                />
                <PolarRadiusAxis
                  angle={90}
                  domain={[0, "auto"]}
                  tick={false}
                  axisLine={false}
                />
                <Tooltip
                  labelFormatter={(hour) =>
                    `${formatHour(Number(hour))} · Lagos time`
                  }
                  formatter={(value) => [Number(value), "Sales"]}
                />
                <Radar
                  dataKey="sales"
                  name="Sales"
                  stroke="var(--primary)"
                  strokeWidth={2}
                  fill="var(--primary)"
                  fillOpacity={0.28}
                  dot={{ r: 2, fill: "var(--primary)", strokeWidth: 0 }}
                  activeDot={{ r: 4, fill: "var(--primary)", stroke: "white" }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="rounded-xl border border-border bg-card p-5">
          <h3 className="font-semibold">Payment methods</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Revenue by payment method
          </p>
          {analytics.methods.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">
              No paid sales in this period.
            </p>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={analytics.methods}
                    dataKey="revenue"
                    nameKey="method"
                    innerRadius={48}
                    outerRadius={78}
                    paddingAngle={2}
                  >
                    {analytics.methods.map((row, index) => (
                      <Cell
                        key={row.method}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => [naira(Number(value)), "Revenue"]}
                    labelFormatter={(method) =>
                      String(method).toLowerCase().replace(/^./, (s) => s.toUpperCase())
                    }
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
          <ul className="space-y-1 text-sm">
            {analytics.methods.map((row, index) => (
              <li
                key={row.method}
                className="flex items-center justify-between gap-2"
              >
                <span className="flex items-center gap-2">
                  <span
                    className="size-2 rounded-full"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  {row.method.toLowerCase().replace(/^./, (s) => s.toUpperCase())}
                </span>
                <span>{naira(row.revenue)}</span>
              </li>
            ))}
          </ul>
        </article>
      </div>

      <article className="rounded-xl border border-border bg-card p-5 sm:p-6">
        <div>
          <h3 className="font-semibold">Repeat customers</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {Math.round(analytics.customers.repeatRate * 100)}% of identified
            customers bought more than once.
          </p>
          <p className="text-xs text-muted-foreground">
            Based on {Math.round(analytics.customers.coverage * 100)}% of paid
            sales (those with a phone number or email).
          </p>
          {analytics.customers.coverage < 0.7 ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Add a phone number on walk-in receipts to see more of your repeat
              customers.
            </p>
          ) : null}
        </div>
        {analytics.customers.top.length ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-80 text-left text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th className="pb-2 font-medium">Customer</th>
                  <th className="pb-2 font-medium">Orders</th>
                  <th className="pb-2 text-right font-medium">Paid total</th>
                </tr>
              </thead>
              <tbody>
                {analytics.customers.top.map((customer) => (
                  <tr key={customer.customer} className="border-t border-border">
                    <td className="py-2">{customer.customer}</td>
                    <td className="py-2">{customer.orders}</td>
                    <td className="py-2 text-right">{naira(customer.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            Customer purchase history will appear when paid receipts include a
            phone number or email.
          </p>
        )}
      </article>
    </section>
  );
}
