import "server-only";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

const FRESH_MS = 6 * 60 * 60 * 1000;
const MAX_STALE_MS = 48 * 60 * 60 * 1000;

async function fetchRate() {
  const response = await fetch(
    process.env.FX_API_URL ?? "https://open.er-api.com/v6/latest/USD",
    { cache: "no-store", signal: AbortSignal.timeout(5_000) },
  );
  if (!response.ok) {
    throw new Error(
      `Exchange-rate service returned ${response.status}.`,
    );
  }
  const payload: unknown = await response.json();
  const rate =
    payload && typeof payload === "object" && "rates" in payload
      ? Number((payload as { rates?: { NGN?: number } }).rates?.NGN)
      : NaN;
  if (!Number.isFinite(rate) || rate < 100 || rate > 10_000) {
    throw new Error("Exchange rate is outside the configured safety bounds.");
  }
  return rate;
}

export async function getNgnPerUsd(vendorId: string) {
  const settings = await prisma.settings.findUnique({
    where: { vendorId },
    select: { id: true, fxRate: true, fxRateAt: true },
  });
  if (!settings) throw new Error("Store settings are unavailable.");
  const age = settings.fxRateAt
    ? Date.now() - settings.fxRateAt.getTime()
    : Number.POSITIVE_INFINITY;
  if (settings.fxRate && age >= 0 && age < FRESH_MS) {
    return Number(settings.fxRate);
  }

  try {
    const rate = await fetchRate();
    await prisma.settings.update({
      where: { id: settings.id },
      data: { fxRate: new Prisma.Decimal(rate.toFixed(4)), fxRateAt: new Date() },
    });
    return rate;
  } catch (error) {
    if (settings.fxRate && age >= 0 && age < MAX_STALE_MS) {
      return Number(settings.fxRate);
    }
    throw new Error("No sufficiently fresh exchange rate is available.", {
      cause: error,
    });
  }

}
