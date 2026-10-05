import { createHmac, timingSafeEqual, randomInt } from "crypto";

export const hmac = (algo: "sha256" | "sha512", secret: string, data: string) =>
  createHmac(algo, secret).update(data).digest("hex");

// timingSafeEqual throws if lengths differ, so compare lengths first
export function safeEqual(a: string, b: string) {
  const A = Buffer.from(a);
  const B = Buffer.from(b);
  return A.length === B.length && timingSafeEqual(A, B);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, sortKeys(value[key])]),
    );
  }
  return value;
}

export const sixDigit = () => String(randomInt(0, 1_000_000)).padStart(6, "0");