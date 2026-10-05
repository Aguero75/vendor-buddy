export type Range = "30" | "60" | "all";

export function parseRange(value?: string): Range {
  return value === "60" || value === "all" ? value : "30";
}

export function rangeWhere(range: Range) {
  return range === "all"
    ? {}
    : { gte: new Date(Date.now() - Number(range) * 86_400_000) };
}

export function naira(value: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(value);
}
