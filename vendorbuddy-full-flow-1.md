# Vendorbuddy: Complete Flow and Implementation Guide

Next.js (App Router) + Prisma + Neon + Clerk + UploadThing + Recharts, deployed on Vercel.

This note covers the whole website flow including the new features:

- Paystack and crypto (NOWPayments) checkout, both writing to one `Receipt` table
- Manual (walk-in) receipts as the default method
- Optional per-product inventory that decreases on every completed sale
- Low-stock badges and alerts that always match the stock number
- Dashboard analytics (summary, trend, day-of-week pie, hour of day, payment methods, best sellers, stock alerts, repeat customers)
- Receipt voiding (X icon) secured by an email OTP, with an OTP-protected owner email change
- Stock held for unpaid website orders (no overselling), and a "needs review" flag for payments that need the owner's attention
- Live naira-to-dollar rate (cached in the database) for crypto pricing, with receipts keeping their own rate

> Assumptions: your existing model and field names may differ slightly (for example `Receipt.amount` being `Float` instead of `Decimal`). Merge, don't copy blindly. Section 14 is a test checklist so you can confirm every flow before going live.

---

## 0. Final decisions

| Question | Decision | Why |
|---|---|---|
| Receipt methods | `MANUAL` (default), `PAYSTACK`, `CRYPTO` | Only website orders need payment verification |
| Deleting receipts | Soft delete: status `VOIDED`, kept in the database | A hard delete leaves no trace, which is what hides stolen funds |
| Delete protection | 6-digit email OTP to the owner email, 10 min expiry, 5 attempts, single use | Staff share the one admin login, so the login alone can't be trusted |
| Owner email | One field in Settings (the profile email) | One place to manage it |
| Changing owner email | Needs a code sent to the current email AND a code sent to the new email | Stops staff redirecting codes, and stops typos locking the vendor out |
| Lost access to owner email | Developer resets it manually in the database | Simplest recovery with no loophole |
| Stock tracking | Optional per product: `stock Int?` (`null` = not tracked) | Vendors opt in product by product |
| When stock decreases | Inside the same DB transaction that marks a receipt paid (all three methods) | Atomic: no paid receipt without its stock change |
| Alerts | Calculated from `stock` + `zeroSince`, never stored as a flag | Alert state can't drift from the quantity |
| Public stock visibility | Storefront only learns "sold out" | Vendors may not want exact counts public |
| Crypto price currency | `usd` priced with a live NGN rate, or `ngn` if NOWPayments accepts it | Receipt stays in naira; the expected invoice amount and the rate used are stored per receipt |
| Live NGN rate | Fetched on the server at checkout, cached in the database (6 hours), crypto hidden if no fresh rate | Env vars can't be changed by running code; the database can, and a stale rate never prices an order |
| Overselling | Pending website orders hold stock for 30 minutes; product rows are locked while checking out | Two customers can no longer both buy the last unit |
| Odd payments (late, mismatched, oversold) | `needsReview` flag on the receipt + instant email to the owner | Money state stays correct, and nothing disappears into server logs |
| Repeat customers | `customerKey` = phone, else email | Website orders always count; walk-ins count when a phone is captured |
| Multiple vendors | One deployment per vendor for now | Isolation by construction; real multi-tenancy only when you have many vendors |

---

## 1. Environment variables and services

```
# Database (Neon): pooled URL for the app, direct URL for migrations
DATABASE_URL=
DIRECT_URL=

# Auth and uploads
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
UPLOADTHING_TOKEN=

# App
NEXT_PUBLIC_BASE_URL=https://your-domain.com       # no trailing slash, https in production

# Paystack
PAYSTACK_SECRET_KEY=sk_test_...                    # sk_live_... in production

# NOWPayments
NOWPAYMENTS_API_KEY=
NOWPAYMENTS_IPN_SECRET=
NOWPAYMENTS_BASE_URL=https://api-sandbox.nowpayments.io   # https://api.nowpayments.io in production
NOWPAYMENTS_PRICE_CURRENCY=usd                     # "usd" = priced in USD using the live NGN rate; "ngn" if accepted (section 6.2)
FX_API_URL=https://open.er-api.com/v6/latest/USD   # optional: swap the exchange-rate source
STOCK_HOLD_MINUTES=30                              # how long an unpaid website order holds its stock

# Security + email
OTP_SECRET=                                        # long random string (openssl rand -hex 32)
RESEND_API_KEY=
EMAIL_FROM="Vendorbuddy <no-reply@your-domain.com>"
```

Prisma on Neon:

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

`package.json`: add `"postinstall": "prisma generate"` so Vercel builds the client.

Email: Resend needs a verified sending domain before it will deliver to arbitrary addresses (until then, test mail only reaches your own account email). Any transactional provider works if you swap `sendEmail`.

---

## 2. Database schema (consolidated)

```prisma
enum PaymentMethod { MANUAL PAYSTACK CRYPTO }
enum ReceiptStatus { PENDING PAID PARTIAL FAILED VOIDED }
enum OtpPurpose    { VOID_RECEIPT CHANGE_EMAIL }

model Settings {                       // single row, id = "store"
  id                   String  @id @default("store")
  businessName         String
  logoUrl              String?
  motto                String?
  ownerEmail           String?         // receives security codes
  lowStockThreshold    Int     @default(5)
  availableForBookings Boolean @default(false)
  fxRate               Decimal? @db.Decimal(14, 4)   // cached NGN per 1 USD (system-managed, not user-editable)
  fxRateAt             DateTime?
}

model Product {
  id        String   @id @default(cuid())
  name      String
  price     Decimal  @db.Decimal(12, 2)
  imageUrl  String?
  stock     Int?                       // null = not tracked, 0 = sold out
  zeroSince DateTime?                  // when stock reached 0; null otherwise
  createdAt DateTime @default(now())
  items     ReceiptItem[]
}

model Receipt {
  id              String         @id @default(cuid())   // also the Paystack reference and NOWPayments order_id
  method          PaymentMethod  @default(MANUAL)
  status          ReceiptStatus  @default(PAID)         // website orders are created as PENDING explicitly
  amount          Decimal        @db.Decimal(12, 2)     // always NGN
  customerName    String?
  email           String?
  phone           String?
  nowpaymentsId   String?
  invoiceAmount   Decimal?       @db.Decimal(14, 4)     // amount sent to NOWPayments (in invoiceCurrency)
  invoiceCurrency String?
  cryptoCurrency  String?
  cryptoAmount    Decimal?
  paidAt          DateTime?
  stockApplied    Boolean        @default(false)        // true once this receipt deducted stock
  customerKey     String?                               // phone if known, else lowercase email
  fxRate          Decimal?       @db.Decimal(14, 4)     // NGN per USD used for this crypto invoice
  needsReview     Boolean        @default(false)        // something about this payment needs the owner's attention
  reviewNote      String?
  reviewedAt      DateTime?
  reviewedBy      String?
  voidedAt        DateTime?
  voidedBy        String?                               // Clerk userId
  voidReason      String?
  createdAt       DateTime       @default(now())
  items           ReceiptItem[]

  @@index([status, paidAt])
  @@index([customerKey])
  @@index([needsReview])
}

model ReceiptItem {
  id        String   @id @default(cuid())
  receiptId String
  receipt   Receipt  @relation(fields: [receiptId], references: [id], onDelete: Cascade)
  productId String?                       // null for custom / untracked items
  product   Product? @relation(fields: [productId], references: [id], onDelete: SetNull)
  name      String
  qty       Int
  price     Decimal  @db.Decimal(12, 2)

  @@index([receiptId])
  @@index([name])
}

model SecurityOtp {
  id          String     @id @default(cuid())
  purpose     OtpPurpose
  targetId    String                      // receiptId, or "settings"
  payload     String?                     // void reason, or the requested new email
  codeHash    String
  codeHash2   String?                     // second code (email change: sent to the new address)
  requestedBy String
  expiresAt   DateTime
  attempts    Int        @default(0)
  usedAt      DateTime?
  createdAt   DateTime   @default(now())

  @@index([purpose, targetId])
}
```

Notes:
- The old `source` field (WEBSITE/MANUAL) is replaced by `method`. Drop it.
- If receipt items are currently stored as JSON, move them to `ReceiptItem` (a one-off script). Stock and best-seller queries need rows.
- Deleting a product sets `ReceiptItem.productId` to null, so old receipts stay intact.

Migration for existing data (run after `prisma migrate`):

```sql
UPDATE "Receipt" SET "method" = 'MANUAL', "status" = 'PAID', "paidAt" = "createdAt";
UPDATE "Product" SET "zeroSince" = NOW() AT TIME ZONE 'UTC' WHERE "stock" = 0;
UPDATE "Receipt" SET "customerKey" = "phone" WHERE "phone" IS NOT NULL;
-- stockApplied stays false for old receipts on purpose: they never deducted stock,
-- so voiding one later must not add stock back.
```

---

## 3. Shared server code

### 3.1 `lib/crypto.ts`

```ts
import { createHmac, timingSafeEqual, randomInt } from "crypto";

export const hmac = (algo: "sha256" | "sha512", secret: string, data: string) =>
  createHmac(algo, secret).update(data).digest("hex");

// timingSafeEqual throws if lengths differ, so compare lengths first
export function safeEqual(a: string, b: string) {
  const A = Buffer.from(a);
  const B = Buffer.from(b);
  return A.length === B.length && timingSafeEqual(A, B);
}

export function sortKeys(v: any): any {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === "object") {
    return Object.keys(v).sort().reduce((o: any, k) => ((o[k] = sortKeys(v[k])), o), {});
  }
  return v;
}

export const sixDigit = () => String(randomInt(0, 1_000_000)).padStart(6, "0");
```

### 3.2 `lib/auth.ts`

```ts
import { auth } from "@clerk/nextjs/server";

// Server actions are public POST endpoints. Protecting the page is not enough:
// EVERY admin server action must call this itself.
export async function requireAdmin() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  return userId;
}

export type Result<T = {}> = ({ ok: true } & T) | { ok: false; error: string };
export const fail = (error: string) => ({ ok: false as const, error });
```

Return `Result` objects from actions instead of throwing: Next.js hides thrown error messages in production, so the UI could never show "Incorrect code".

### 3.3 `lib/receipts.ts` (the core: payment completion, stock, review flags)

```ts
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendEmail, esc } from "@/lib/email";

type Tx = Prisma.TransactionClient;

export const HOLD_MINUTES = Number(process.env.STOCK_HOLD_MINUTES ?? 30);

// 0803 123 4567, +234 803 123 4567 and 2348031234567 all become +2348031234567
export function normalizePhone(raw: string) {
  const d = raw.replace(/\D/g, "");
  if (d.startsWith("234")) return `+${d}`;
  if (d.startsWith("0")) return `+234${d.slice(1)}`;
  return `+234${d}`;
}

// One identity per customer: phone if we have it, otherwise email (used for repeat-customer stats)
export function customerKeyOf(p: { phone?: string | null; email?: string | null }) {
  if (p.phone) return normalizePhone(p.phone);
  if (p.email) return p.email.trim().toLowerCase();
  return null;
}

// Deducts stock for tracked products. Each product row is locked first, so two sales of the
// same item are processed one after the other. Never goes below 0. Returns a description of
// any item that was short (sold more than was in stock) so the caller can flag it.
export async function decrementStock(tx: Tx, receiptId: string) {
  const items = await tx.receiptItem.findMany({
    where: { receiptId, productId: { not: null } },
    select: { productId: true, qty: true, name: true },
    orderBy: { productId: "asc" },                    // fixed order avoids deadlocks
  });
  const short: string[] = [];
  for (const i of items) {
    const [p] = await tx.$queryRaw<{ stock: number | null }[]>`
      SELECT "stock" FROM "Product" WHERE "id" = ${i.productId} FOR UPDATE`;
    if (!p || p.stock === null) continue;             // deleted or not tracked
    if (p.stock < i.qty) short.push(`${i.name} (sold ${i.qty}, only ${p.stock} in stock)`);
    const next = Math.max(p.stock - i.qty, 0);
    await tx.$executeRaw`
      UPDATE "Product"
      SET "stock" = ${next}::int,
          "zeroSince" = CASE WHEN ${next}::int = 0
                             THEN COALESCE("zeroSince", NOW() AT TIME ZONE 'UTC')
                             ELSE "zeroSince" END
      WHERE "id" = ${i.productId}`;
  }
  return short;
}

export async function restoreStock(tx: Tx, receiptId: string) {
  const items = await tx.receiptItem.findMany({
    where: { receiptId, productId: { not: null } },
    select: { productId: true, qty: true },
  });
  for (const i of items) {
    await tx.$executeRaw`
      UPDATE "Product"
      SET "stock" = "stock" + ${i.qty}, "zeroSince" = NULL
      WHERE "id" = ${i.productId} AND "stock" IS NOT NULL`;
  }
}

// Email the owner. Never throws (a failed email must not break a payment).
export async function notifyOwner(subject: string, html: string) {
  try {
    const s = await prisma.settings.findUnique({ where: { id: "store" }, select: { ownerEmail: true } });
    if (s?.ownerEmail) await sendEmail(s.ownerEmail, subject, html);
  } catch (e) {
    console.error("notifyOwner failed", e);
  }
}

// Marks a receipt as needing the owner's attention and emails them ONCE.
// Gated on needsReview = false AND reviewedAt = null: retries while the flag is open, and
// retries after the owner has already reviewed it, must not send another email or reopen it.
export async function flagForReview(receiptId: string, note: string) {
  const res = await prisma.receipt.updateMany({
    where: { id: receiptId, needsReview: false, reviewedAt: null },
    data: { needsReview: true, reviewNote: note },
  });
  if (res.count === 1)
    await notifyOwner("A payment needs your review", `<p>${esc(note)}</p><p>Receipt: ${receiptId}</p>`);
}

// ONE function completes every website payment. Idempotent: only the first call wins.
// A real payment wins over PENDING / PARTIAL / FAILED, but never over VOIDED or PAID.
export async function markPaid(
  receiptId: string,
  extra: Prisma.ReceiptUpdateManyMutationInput = {}
) {
  const result = await prisma.$transaction(async (tx) => {
    const res = await tx.receipt.updateMany({
      where: { id: receiptId, status: { in: ["PENDING", "PARTIAL", "FAILED"] } },
      data: { ...extra, status: "PAID", paidAt: new Date(), stockApplied: true },
    });
    if (res.count === 0) return { applied: false, short: [] as string[] };

    const short = await decrementStock(tx, receiptId);
    if (short.length) {
      await tx.receipt.update({
        where: { id: receiptId },
        data: {
          needsReview: true,
          reviewNote: `Oversold: ${short.join(", ")}. Check whether you can supply it or should refund.`,
        },
      });
    }
    return { applied: true, short };
  });

  if (result.short.length)
    await notifyOwner(
      "A paid order was short on stock",
      `<p>Receipt ${receiptId}: ${esc(result.short.join(", "))}.</p>`
    );
  return result.applied;
}

// What the webhooks and the success page call. If a payment arrives for a receipt that was
// already voided, the money is real: flag it for the owner instead of dropping it.
export async function settlePayment(
  receiptId: string,
  gateway: string,
  extra: Prisma.ReceiptUpdateManyMutationInput = {}
) {
  const applied = await markPaid(receiptId, extra);
  if (!applied) {
    const r = await prisma.receipt.findUnique({ where: { id: receiptId }, select: { status: true } });
    if (r?.status === "VOIDED")
      await flagForReview(
        receiptId,
        `A ${gateway} payment arrived for a receipt that was already voided. The customer's money was received. Refund it from the ${gateway} dashboard, or recreate the sale.`
      );
  }
  return applied;
}

// Walk-in / WhatsApp / bank-transfer receipts: PAID immediately, stock deducted in the same
// transaction. If the vendor sells more than the recorded stock they clearly have the goods,
// so the count simply clamps to 0 (no review flag).
export async function createManualReceipt(input: {
  customerName?: string;
  phone?: string;
  items: { productId?: string; name: string; price: number; qty: number }[];
}) {
  const lines = input.items.filter((i) => i.qty > 0 && i.price >= 0);
  if (lines.length === 0) throw new Error("Add at least one item");
  const amount = lines.reduce((s, i) => s + i.price * i.qty, 0);
  const phone = input.phone ? normalizePhone(input.phone) : null;

  return prisma.$transaction(async (tx) => {
    const receipt = await tx.receipt.create({
      data: {
        method: "MANUAL",
        status: "PAID",
        amount,
        customerName: input.customerName,
        phone,
        customerKey: customerKeyOf({ phone }),
        paidAt: new Date(),
        stockApplied: true,
        items: {
          create: lines.map((i) => ({
            productId: i.productId ?? null,
            name: i.name,
            price: i.price,
            qty: i.qty,
          })),
        },
      },
    });
    await decrementStock(tx, receipt.id);
    return receipt;
  });
}
```

### 3.4 `lib/range.ts`

```ts
export type Range = "30" | "60" | "all";

export const parseRange = (v?: string): Range => (v === "60" || v === "all" ? v : "30");

export const rangeWhere = (range: Range) =>
  range === "all" ? {} : { paidAt: { gte: new Date(Date.now() - Number(range) * 864e5) } };

export const naira = (n: number) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(n);
```

### 3.5 `lib/email.ts`

```ts
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

export async function sendEmail(to: string, subject: string, html: string) {
  const { error } = await resend.emails.send({ from: process.env.EMAIL_FROM!, to, subject, html });
  if (error) throw new Error("Could not send email");
}
```

Always run user-provided text (customer names, reasons) through `esc()` before putting it in an email.

### 3.6 `middleware.ts` (webhooks must stay public)

```ts
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtected = createRouteMatcher(["/dashboard(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtected(req)) await auth.protect();
});

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)", "/(api|trpc)(.*)"],
};
```

Do NOT add `/api/webhooks/*` to the protected matcher. Paystack and NOWPayments can't log in. Their routes are secured by signature checks instead.

### 3.7 `lib/fx.ts` (live NGN rate, cached in the database)

Why not an env variable: environment variables are set when you deploy and cannot be changed by running code, so a "live" rate can't live there. The database does the same job. The rate is fetched on the server (never in the browser, so it can't be tampered with), cached in the `Settings` row, and refreshed when older than 6 hours.

```ts
import { prisma } from "@/lib/prisma";

// The free source updates once a day, so refreshing more often only risks rate limits (HTTP 429)
const FRESH_MS = 6 * 3_600_000;
const MAX_STALE_MS = 48 * 3_600_000;       // older than this: refuse to price crypto

async function fetchRate(): Promise<number> {
  const res = await fetch(process.env.FX_API_URL ?? "https://open.er-api.com/v6/latest/USD", {
    cache: "no-store",
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`FX ${res.status}`);
  const rate = Number((await res.json())?.rates?.NGN);
  // sanity bounds: catches garbage or a unit mix-up. Widen them if the naira moves a lot.
  if (!Number.isFinite(rate) || rate < 100 || rate > 10_000) throw new Error("FX rate out of range");
  return rate;
}

export async function getNgnPerUsd(): Promise<number> {
  const s = await prisma.settings.findUniqueOrThrow({
    where: { id: "store" }, select: { fxRate: true, fxRateAt: true },
  });
  const age = s.fxRateAt ? Date.now() - s.fxRateAt.getTime() : Infinity;
  if (s.fxRate && age < FRESH_MS) return Number(s.fxRate);

  try {
    const rate = await fetchRate();
    await prisma.settings.update({ where: { id: "store" }, data: { fxRate: rate, fxRateAt: new Date() } });
    return rate;
  } catch {
    if (s.fxRate && age < MAX_STALE_MS) return Number(s.fxRate);   // brief outage: reuse the last rate
    throw new Error("No fresh exchange rate");                      // fail closed: never price on a stale rate
  }
}

// For the checkout page: is crypto available, and roughly how many dollars is this order?
export async function getCryptoQuote(totalNgn: number) {
  if (!process.env.NOWPAYMENTS_API_KEY) return { available: false as const };
  if ((process.env.NOWPAYMENTS_PRICE_CURRENCY ?? "usd").toLowerCase() === "ngn")
    return { available: true as const, estimate: null };
  try {
    const rate = await getNgnPerUsd();
    return { available: true as const, estimate: Math.round((totalNgn / rate) * 100) / 100 };
  } catch {
    return { available: false as const };           // hide the Crypto option instead of risking a wrong price
  }
}
```

On the checkout page (server component) call `getCryptoQuote(cartTotal)`:
- If `available` is false, don't show the Crypto option.
- If `estimate` exists, show "about $X USD" next to it.
- The free rate source requires attribution, so add a small "Rates By Exchange Rate API" link (to exchangerate-api.com) on that page.

What the customer pays is fixed when they click Pay: the USD amount is stored on the receipt as `invoiceAmount`, with the rate used in `fxRate`, so you can always see how an order was priced.

---

## 4. Customer flow (storefront to paid)

```
Storefront (products, "Sold out" shown if stock = 0)
  -> Cart (multiple items)
  -> /checkout: phone + email + payment method (Paystack | Crypto)
  -> startCheckout (server): re-reads prices from DB, locks products, checks stock minus holds,
     creates a PENDING receipt (which holds its stock for 30 minutes)
  -> redirect to Paystack page or NOWPayments invoice page
  -> customer pays
  -> gateway calls our webhook (source of truth) -> markPaid -> receipt PAID + stock deducted
  -> gateway redirects customer to /checkout/success?ref=<receiptId>
  -> success page shows status, clears cart when PAID, returns to homepage
```

Rules that keep this safe:
- The client never sends prices. Totals are computed on the server from the DB.
- The cart is cleared only when the receipt is `PAID`, never on redirect.
- Stock is held while payment is pending. A `PENDING` website order reserves its quantities for `STOCK_HOLD_MINUTES` (default 30). Other customers see only what's left after holds. Abandoned or failed orders release the hold automatically (no cleanup job: the hold is simply a `PENDING` receipt younger than 30 minutes).

### 4.1 `app/actions/checkout.ts`

```ts
"use server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fail, Result } from "@/lib/auth";
import { HOLD_MINUTES, customerKeyOf, normalizePhone } from "@/lib/receipts";
import { getNgnPerUsd } from "@/lib/fx";

const BASE = process.env.NEXT_PUBLIC_BASE_URL!;
const round2 = (n: number) => Math.round(n * 100) / 100;

class CheckoutError extends Error {}

const schema = z.object({
  items: z.array(z.object({ productId: z.string(), qty: z.number().int().min(1).max(99) })).min(1),
  email: z.string().email(),
  phone: z.string().min(7),
  method: z.enum(["PAYSTACK", "CRYPTO"]),
});

export async function startCheckout(
  input: z.infer<typeof schema>
): Promise<Result<{ url: string }>> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return fail("Please check your details and try again.");
  const { items, email, phone, method } = parsed.data;

  // merge duplicate lines for the same product
  const qtyById = new Map<string, number>();
  for (const i of items) qtyById.set(i.productId, (qtyById.get(i.productId) ?? 0) + i.qty);
  const ids = [...qtyById.keys()].sort();

  let receipt;
  try {
    receipt = await prisma.$transaction(async (tx) => {
      // Lock the product rows (fixed order, so no deadlocks). A second customer buying the same
      // item waits here for a moment instead of racing us to the last unit.
      const products = await tx.$queryRaw<
        { id: string; name: string; price: Prisma.Decimal; stock: number | null }[]
      >`SELECT "id", "name", "price", "stock" FROM "Product"
        WHERE "id" IN (${Prisma.join(ids)}) ORDER BY "id" FOR UPDATE`;

      // Stock already promised to other unpaid website orders (holds expire after HOLD_MINUTES)
      const held = await tx.receiptItem.groupBy({
        by: ["productId"],
        where: {
          productId: { in: ids },
          receipt: { status: "PENDING", createdAt: { gt: new Date(Date.now() - HOLD_MINUTES * 60_000) } },
        },
        _sum: { qty: true },
      });
      const heldBy = new Map(held.map((h) => [h.productId, h._sum.qty ?? 0]));

      const lines: { productId: string; name: string; price: number; qty: number }[] = [];
      for (const id of ids) {
        const p = products.find((x) => x.id === id);
        if (!p) throw new CheckoutError("A product in your cart is no longer available.");
        const qty = qtyById.get(id)!;
        if (p.stock !== null) {                          // only tracked products are limited
          const available = p.stock - (heldBy.get(id) ?? 0);
          if (available <= 0) throw new CheckoutError(`${p.name} is sold out right now.`);
          if (qty > available)
            throw new CheckoutError(`Only ${available} of ${p.name} available right now. Please reduce the quantity.`);
        }
        lines.push({ productId: p.id, name: p.name, price: Number(p.price), qty });
      }

      const total = lines.reduce((s, l) => s + l.price * l.qty, 0);
      return tx.receipt.create({
        data: {
          method,
          status: "PENDING",
          amount: total,
          email,
          phone: normalizePhone(phone),
          customerKey: customerKeyOf({ phone, email }),
          items: { create: lines },
        },
      });
    });
  } catch (e) {
    if (e instanceof CheckoutError) return fail(e.message);
    return fail("Could not place your order. Please try again.");
  }

  try {
    const total = Number(receipt.amount);
    const url =
      method === "PAYSTACK" ? await initPaystack(receipt.id, email, total) : await initCrypto(receipt.id, total);
    return { ok: true, url };
  } catch {
    // FAILED releases the stock hold immediately (only PENDING receipts hold stock)
    await prisma.receipt.update({ where: { id: receipt.id }, data: { status: "FAILED" } });
    return fail("Could not start the payment. Please try again.");
  }
}

async function initPaystack(receiptId: string, email: string, total: number) {
  const res = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      amount: Math.round(total * 100),            // kobo
      currency: "NGN",
      reference: receiptId,                        // unique, ties payment to receipt
      callback_url: `${BASE}/checkout/success?ref=${receiptId}`,
      metadata: { receiptId },
    }),
  });
  const json = await res.json();
  if (!json.status) throw new Error("Paystack init failed");
  return json.data.authorization_url as string;
}

async function initCrypto(receiptId: string, totalNgn: number) {
  const currency = (process.env.NOWPAYMENTS_PRICE_CURRENCY ?? "usd").toLowerCase();
  let priceAmount: number;
  let fxRate: number | null = null;

  if (currency === "ngn") {
    priceAmount = round2(totalNgn);
  } else {
    fxRate = await getNgnPerUsd();                 // throws if no fresh rate: checkout fails closed
    priceAmount = round2(totalNgn / fxRate);
  }
  if (!priceAmount || priceAmount <= 0) throw new Error("Bad crypto price");

  // NOWPayments enforces a minimum per coin. A very small order can be refused here,
  // which lands in the catch above and shows "Could not start the payment".
  const res = await fetch(`${process.env.NOWPAYMENTS_BASE_URL}/v1/invoice`, {
    method: "POST",
    headers: { "x-api-key": process.env.NOWPAYMENTS_API_KEY!, "Content-Type": "application/json" },
    body: JSON.stringify({
      price_amount: priceAmount,
      price_currency: currency,
      order_id: receiptId,
      order_description: "Order",
      ipn_callback_url: `${BASE}/api/webhooks/nowpayments`,
      success_url: `${BASE}/checkout/success?ref=${receiptId}`,
      cancel_url: `${BASE}/cart`,
    }),
  });
  const json = await res.json();
  if (!json.invoice_url) throw new Error("NOWPayments invoice failed");

  await prisma.receipt.update({
    where: { id: receiptId },
    data: { nowpaymentsId: String(json.id), invoiceAmount: priceAmount, invoiceCurrency: currency, fxRate },
  });
  return json.invoice_url as string;
}
```

Client side of checkout:

```tsx
const res = await startCheckout({ items, email, phone, method });
if (!res.ok) return setError(res.error);
window.location.href = res.url;        // do NOT clear the cart here
```

### 4.2 Success page: `app/checkout/success/page.tsx`

```tsx
import { prisma } from "@/lib/prisma";
import { settlePayment } from "@/lib/receipts";
import { PaymentStatus } from "@/components/payment-status";

export default async function Success({ searchParams }: { searchParams: Promise<{ ref?: string; reference?: string }> }) {
  const sp = await searchParams;
  const ref = sp.ref ?? sp.reference;
  let receipt = ref ? await prisma.receipt.findUnique({ where: { id: ref } }) : null;
  if (!receipt) return <p>We couldn't find this order.</p>;

  // Paystack: confirm right away instead of waiting for the webhook (same idempotent markPaid)
  if (receipt.method === "PAYSTACK" && receipt.status === "PENDING") {
    const r = await fetch(`https://api.paystack.co/transaction/verify/${receipt.id}`, {
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
      cache: "no-store",
    });
    const j = await r.json();
    if (j.status && j.data?.status === "success" && j.data.amount === Math.round(Number(receipt.amount) * 100)) {
      await settlePayment(receipt.id, "Paystack");
      receipt = (await prisma.receipt.findUnique({ where: { id: receipt.id } }))!;
    }
  }

  return <PaymentStatus receiptId={receipt.id} status={receipt.status} method={receipt.method} />;
}
```

`components/payment-status.tsx`:

```tsx
"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart";            // your existing cart store

export function PaymentStatus({ receiptId, status, method }: { receiptId: string; status: string; method: string }) {
  const router = useRouter();
  const { clearCart } = useCart();

  useEffect(() => {
    if (status === "PAID") {
      clearCart();
      const t = setTimeout(() => router.push("/"), 4000);   // back to the homepage
      return () => clearTimeout(t);
    }
    if (status === "PENDING" || status === "PARTIAL") {
      // webhook may still be on its way (always the case for crypto): re-check every 5s, max 10 min
      let n = 0;
      const t = setInterval(() => (++n > 120 ? clearInterval(t) : router.refresh()), 5000);
      return () => clearInterval(t);
    }
  }, [status, router, clearCart]);

  if (status === "PAID") return <p>Payment received. Thank you! Taking you back to the store...</p>;
  if (status === "PARTIAL") return <p>We received part of your crypto payment. The store will contact you.</p>;
  if (status === "FAILED") return <p>The payment did not go through. Please try again.</p>;
  return <p>{method === "CRYPTO" ? "Waiting for network confirmation. This can take a few minutes..." : "Confirming your payment..."}</p>;
}
```

---

## 5. Paystack

### 5.1 Webhook: `app/api/webhooks/paystack/route.ts`

```ts
import { prisma } from "@/lib/prisma";
import { hmac, safeEqual } from "@/lib/crypto";
import { settlePayment, flagForReview } from "@/lib/receipts";

export async function POST(req: Request) {
  const raw = await req.text();                                   // raw body is required for the signature
  const sig = req.headers.get("x-paystack-signature") ?? "";
  if (!safeEqual(sig, hmac("sha512", process.env.PAYSTACK_SECRET_KEY!, raw)))
    return new Response("Invalid signature", { status: 401 });

  const event = JSON.parse(raw);
  if (event.event === "charge.success") {
    const d = event.data;
    const receipt = await prisma.receipt.findUnique({ where: { id: d.reference } });
    if (receipt && receipt.method === "PAYSTACK") {
      const amountOk = d.currency === "NGN" && d.amount === Math.round(Number(receipt.amount) * 100);  // kobo
      if (amountOk) {
        await settlePayment(receipt.id, "Paystack");
      } else {
        // money arrived but doesn't match the order: leave it PENDING and tell the owner
        await flagForReview(
          receipt.id,
          `Paystack payment didn't match the order (expected ${receipt.amount} NGN, got ${d.amount / 100} ${d.currency}, reference ${d.reference}).`
        );
      }
    }
  }
  return new Response("ok");                                       // always 200 so Paystack stops retrying
}
```

### 5.2 Going live checklist

1. Dashboard: complete Settings > Compliance. Starter business needs a government ID, BVN and contact details, all in the same person's name. Registered businesses need the CAC Business Name or company documents and BVN consent through NIBSS iGree. Add your settlement bank account.
2. After activation, copy live keys from Settings > API Keys & Webhooks.
3. In Vercel, replace `PAYSTACK_SECRET_KEY` with the `sk_live_...` key and redeploy.
4. In the Paystack dashboard, set the live webhook URL to `https://your-domain.com/api/webhooks/paystack` (test and live webhook URLs are set separately). It must be HTTPS.
5. Make a real small payment (about ₦100) to yourself and confirm: receipt `PAID`, stock decreased, success page redirected home.

---

## 6. Crypto with NOWPayments

### 6.1 Webhook: `app/api/webhooks/nowpayments/route.ts`

```ts
import { prisma } from "@/lib/prisma";
import { hmac, safeEqual, sortKeys } from "@/lib/crypto";
import { settlePayment, flagForReview, notifyOwner } from "@/lib/receipts";

export async function POST(req: Request) {
  const raw = await req.text();
  const body = JSON.parse(raw);
  const sig = req.headers.get("x-nowpayments-sig") ?? "";

  const expected = hmac("sha512", process.env.NOWPAYMENTS_IPN_SECRET!, JSON.stringify(sortKeys(body)));
  if (!safeEqual(sig, expected)) return new Response("Invalid signature", { status: 401 });

  const receipt = await prisma.receipt.findUnique({ where: { id: String(body.order_id) } });
  if (!receipt || receipt.method !== "CRYPTO") return new Response("ok");   // ack so they stop retrying

  switch (body.payment_status) {
    case "finished": {
      const amountOk =
        receipt.invoiceAmount !== null &&
        String(body.price_currency).toLowerCase() === receipt.invoiceCurrency &&
        Math.abs(Number(body.price_amount) - Number(receipt.invoiceAmount)) < 0.01;
      if (!amountOk) {
        // money arrived but doesn't match the invoice: keep it PENDING and tell the owner
        await flagForReview(
          receipt.id,
          `Crypto payment finished but the amount didn't match the invoice (expected ${receipt.invoiceAmount} ${receipt.invoiceCurrency}, got ${body.price_amount} ${body.price_currency}).`
        );
        break;
      }
      await settlePayment(receipt.id, "NOWPayments", {
        nowpaymentsId: String(body.payment_id ?? receipt.nowpaymentsId ?? ""),
        cryptoCurrency: body.pay_currency,
        cryptoAmount: body.actually_paid,
      });
      break;
    }
    case "partially_paid": {
      const res = await prisma.receipt.updateMany({
        where: { id: receipt.id, status: "PENDING" }, data: { status: "PARTIAL" },
      });
      if (res.count === 1)                                                   // first time only: no duplicate emails
        await notifyOwner("A crypto payment was only partly paid", `<p>Receipt ${receipt.id}. Review it in Receipts &gt; Partial.</p>`);
      break;
    }
    case "failed":
    case "expired":
      await prisma.receipt.updateMany({ where: { id: receipt.id, status: "PENDING" }, data: { status: "FAILED" } });
      break;
    default:
      break;                                                                 // waiting, confirming, confirmed, sending: no change
  }
  return new Response("ok");
}
```

Why it is safe:
- The signature is checked first (HMAC-SHA512 of the key-sorted JSON using the IPN secret).
- `settlePayment` is idempotent, so retried webhooks never double-deduct stock.
- The paid amount is compared with the invoice amount stored at checkout, in the invoice currency. A mismatch is flagged for the owner, never silently accepted.
- A payment for a voided receipt is flagged and emailed instead of vanishing.
- A `PARTIAL` receipt can still become `PAID` if the customer tops up.

### 6.2 Pricing currency: NGN directly, or USD with the live rate

NOWPayments' invoice endpoint takes a fiat `price_currency`, but I could not confirm NGN is accepted. Test it in the sandbox:

1. Create a sandbox account and API key at the sandbox site, and set `NOWPAYMENTS_BASE_URL=https://api-sandbox.nowpayments.io`.
2. Set `NOWPAYMENTS_PRICE_CURRENCY=ngn` and create an invoice. If you get an `invoice_url`, you're done: no exchange rate is involved at all.
3. If it errors, set `NOWPAYMENTS_PRICE_CURRENCY=usd`. Checkout then converts with the live rate from `lib/fx.ts` (section 3.7) and stores `invoiceAmount` and `fxRate` on the receipt.

How the rate stays honest in USD mode:
- Refreshed on the server at checkout, cached in the database, at most 6 hours old normally. The free source updates once a day, so "real time" isn't available from it; that's fine for pricing, because the customer's USD amount is fixed at checkout.
- If the source is down, the last rate is reused for up to 48 hours. Beyond that the Crypto option disappears from checkout until a fresh rate is available. A stale rate never prices an order.
- The receipt always stays in naira. The rate used is stored with it for your records.
- The vendor's own risk is the naira value when they convert the crypto they receive, which is outside the website's control.
- If the vendor wants a cushion (for example 1%), multiply `priceAmount` by `1.01` in `initCrypto`.

### 6.3 Vendor setup and go-live

- The vendor needs their own NOWPayments account with a payout wallet and any KYC they require. Put their API key and IPN secret in the app's env vars.
- In the NOWPayments dashboard, set the IPN secret to match `NOWPAYMENTS_IPN_SECRET`.
- Switch `NOWPAYMENTS_BASE_URL` to `https://api.nowpayments.io` and use live keys only after the sandbox test passes.
- `finished` can arrive minutes after the customer pays. The success page already polls for that.

---

## 7. Admin: products, stock and manual receipts

### 7.1 Product form (stock is optional)

Field label: "Stock quantity (optional)". Helper text: "Leave empty if you don't track this item".

```ts
// actions/products.ts
"use server";
import { z } from "zod";

const productSchema = z.object({
  name: z.string().min(1),
  price: z.coerce.number().positive(),
  imageUrl: z.string().url().optional(),
  // z.coerce.number() turns "" into 0, which would mean "sold out". Handle empty explicitly.
  stock: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.coerce.number().int().min(0).optional()
  ),
});

// editing a name must not reset the 30-day clock: zeroSince only changes when the stock value changes
function nextZeroSince(prev: { stock: number | null; zeroSince: Date | null }, next: number | null) {
  if (next !== 0) return null;
  return prev.stock === 0 ? prev.zeroSince ?? new Date() : new Date();
}

export async function createProduct(formData: FormData) {
  await requireAdmin();
  const { stock, ...rest } = productSchema.parse(Object.fromEntries(formData));
  await prisma.product.create({
    data: { ...rest, stock: stock ?? null, zeroSince: stock === 0 ? new Date() : null },
  });
}

export async function updateProduct(id: string, formData: FormData) {
  await requireAdmin();
  const { stock, ...rest } = productSchema.parse(Object.fromEntries(formData));
  const prev = await prisma.product.findUniqueOrThrow({ where: { id } });
  await prisma.product.update({
    where: { id },
    data: { ...rest, stock: stock ?? null, zeroSince: nextZeroSince(prev, stock ?? null) },
  });
}
```

- Clearing the field turns tracking off. Changing the number is how the vendor restocks.
- Restocking (stock above 0) sets `zeroSince = null`, which is the only thing that resets the 30-day alert silence.

### 7.2 Stock badge (products list)

Shown only when the product is tracked and `stock <= lowStockThreshold`:

```tsx
export function StockBadge({ stock, threshold }: { stock: number | null; threshold: number }) {
  if (stock === null || stock > threshold) return null;
  return stock === 0
    ? <Badge variant="destructive">Sold out</Badge>
    : <Badge className="bg-amber-500 text-white">Low · {stock}</Badge>;
}
```

The "Sold out" badge stays visible at 0 even after alert notifications go quiet (it is a status, not a notification).

### 7.3 Storefront rules

- Send the storefront only `soldOut: product.stock === 0`, never the exact count.
- Sold-out products show "Sold out" and the add-to-cart button is disabled.
- `startCheckout` re-checks stock and replies "Only N left of X" if the cart quantity is too high.
- Untracked products behave exactly as before.

### 7.4 Manual receipt form (walk-ins, WhatsApp, bank transfer)

- Each line is a product picker (search the product list). Picking a product fills the name and price (price stays editable). A "Custom item" option allows free text with no `productId`.
- Next to the picker, show remaining stock for tracked products, and warn (not block) if the quantity is more than the stock. The vendor knows what is on the shelf.
- Stock only decreases for lines linked to a product.
- Customer phone is optional but encouraged. Label it "Customer phone (optional, helps you see repeat customers)". Typing digits suggests returning customers (autofills the name), which makes capturing it quicker than skipping it:

```ts
"use server";
export async function suggestCustomers(prefix: string) {
  await requireAdmin();
  const digits = prefix.replace(/\D/g, "");
  if (digits.length < 3) return [];
  return prisma.receipt.findMany({
    where: { phone: { contains: digits } },
    distinct: ["phone"],
    select: { phone: true, customerName: true },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
}
```

```ts
"use server";
export async function submitManualReceipt(input: {
  customerName?: string; phone?: string;
  items: { productId?: string; name: string; price: number; qty: number }[];
}): Promise<Result<{ id: string }>> {
  await requireAdmin();
  try {
    const r = await createManualReceipt(input);
    return { ok: true, id: r.id };
  } catch (e: any) {
    return fail(e.message ?? "Could not save the receipt");
  }
}
```

After saving, the existing receipt image/PDF generation continues to work as before.

---

## 8. Receipts page

Default view shows paid receipts only. Filter chips: Paid (default), Needs review, Partial, Pending, Failed, Voided. Search and pagination (10 per page) work with the filter.

```ts
const PAGE = 10;
const STATUS = { paid: "PAID", partial: "PARTIAL", pending: "PENDING", failed: "FAILED", voided: "VOIDED" } as const;

const page = Math.max(1, Number(sp.page) || 1);
const q = sp.q?.trim();
const filter =
  sp.status === "review"
    ? { needsReview: true }                                   // any status, flagged for the owner
    : { status: STATUS[(sp.status as keyof typeof STATUS) ?? "paid"] ?? "PAID" };

const where: Prisma.ReceiptWhereInput = {
  ...filter,
  ...(q && {
    OR: [
      { customerName: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { phone: { contains: q } },
    ],
  }),
};

const [rows, total] = await Promise.all([
  prisma.receipt.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE, include: { items: true } }),
  prisma.receipt.count({ where }),
]);
```

Row display:
- Method badge (Manual / Paystack / Crypto). Crypto rows also show the coin and amount paid.
- Voided rows are greyed out with the reason and date.
- The X button appears on every non-voided row.
- The sales-by-day pie (section 10) sits above the list, with its range toggle.
- Rows with `needsReview` show an amber note (the `reviewNote`) and a Mark reviewed button (section 8.6).

### 8.1 Voiding with an OTP (the X icon)

Why void and not delete: a voided receipt disappears from the normal list and from all analytics (analytics only count `PAID`), but stays in the database with who voided it, when, and why. Staff can't hide money with no trace, and the owner can open the Voided filter to review.

Flow:
1. Click X, pick a reason (Refunded / Entered by mistake / Other), tap Send code.
2. A 6-digit code goes to the owner email. The email shows the receipt amount, customer, items, reason and time, so the owner can see exactly what they are approving.
3. The dialog switches to a code box (with Resend after 60 seconds).
4. Correct code: the receipt becomes `VOIDED` and stock is restored, in one transaction.

### 8.2 `lib/otp.ts`

```ts
import { prisma } from "@/lib/prisma";
import { hmac, safeEqual, sixDigit } from "@/lib/crypto";
import type { OtpPurpose } from "@prisma/client";

const COOLDOWN_MS = 60_000;
const TTL_MS = 10 * 60_000;
const MAX_ATTEMPTS = 5;
const MAX_PER_HOUR = 5;

const h = (purpose: string, targetId: string, slot: "a" | "b", code: string) =>
  hmac("sha256", process.env.OTP_SECRET!, `${purpose}:${targetId}:${slot}:${code}`);

export async function issueOtp(p: {
  purpose: OtpPurpose; targetId: string; payload?: string; requestedBy: string; twoCodes?: boolean;
}) {
  const recent = await prisma.securityOtp.findMany({
    where: { purpose: p.purpose, targetId: p.targetId, createdAt: { gt: new Date(Date.now() - 3_600_000) } },
    orderBy: { createdAt: "desc" },
  });
  if (recent[0] && Date.now() - recent[0].createdAt.getTime() < COOLDOWN_MS)
    return { ok: false as const, error: "Please wait a minute before requesting another code." };
  if (recent.length >= MAX_PER_HOUR)
    return { ok: false as const, error: "Too many code requests. Try again later." };

  const code = sixDigit();
  const code2 = p.twoCodes ? sixDigit() : null;

  await prisma.$transaction([
    // expire older unused codes so only the newest one works
    prisma.securityOtp.updateMany({
      where: { purpose: p.purpose, targetId: p.targetId, usedAt: null },
      data: { expiresAt: new Date() },
    }),
    prisma.securityOtp.create({
      data: {
        purpose: p.purpose, targetId: p.targetId, payload: p.payload, requestedBy: p.requestedBy,
        codeHash: h(p.purpose, p.targetId, "a", code),
        codeHash2: code2 ? h(p.purpose, p.targetId, "b", code2) : null,
        expiresAt: new Date(Date.now() + TTL_MS),
      },
    }),
  ]);
  return { ok: true as const, code, code2 };
}

export async function checkOtp(p: { purpose: OtpPurpose; targetId: string; code: string; code2?: string }) {
  const otp = await prisma.securityOtp.findFirst({
    where: { purpose: p.purpose, targetId: p.targetId, usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!otp || otp.attempts >= MAX_ATTEMPTS)
    return { ok: false as const, error: "Code expired. Request a new one." };

  await prisma.securityOtp.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });

  const okA = safeEqual(h(p.purpose, p.targetId, "a", p.code), otp.codeHash);
  const okB = !otp.codeHash2 || (!!p.code2 && safeEqual(h(p.purpose, p.targetId, "b", p.code2), otp.codeHash2));
  if (!okA || !okB) return { ok: false as const, error: "Incorrect code." };
  return { ok: true as const, otp };
}
```

The code is never returned to the browser and only its hash is stored.

### 8.3 `actions/void-receipt.ts`

```ts
"use server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, fail, Result } from "@/lib/auth";
import { issueOtp, checkOtp } from "@/lib/otp";
import { restoreStock } from "@/lib/receipts";
import { sendEmail, esc } from "@/lib/email";
import { naira } from "@/lib/range";

const REASONS = ["Refunded", "Entered by mistake", "Other"];

export async function requestVoid(receiptId: string, reason: string): Promise<Result> {
  const userId = await requireAdmin();
  if (!REASONS.includes(reason)) return fail("Pick a reason.");

  const settings = await prisma.settings.findUnique({ where: { id: "store" } });
  if (!settings?.ownerEmail) return fail("Set the owner email in Settings first.");

  const receipt = await prisma.receipt.findUnique({ where: { id: receiptId }, include: { items: true } });
  if (!receipt || receipt.status === "VOIDED") return fail("Receipt not found.");

  const otp = await issueOtp({ purpose: "VOID_RECEIPT", targetId: receiptId, payload: reason, requestedBy: userId });
  if (!otp.ok) return fail(otp.error);

  try {
    await sendEmail(
      settings.ownerEmail,
      `Code ${otp.code}: void a receipt`,
      `<p>A request was made to <b>void a receipt</b>.</p>
       <ul>
         <li>Amount: ${naira(Number(receipt.amount))}</li>
         <li>Method: ${receipt.method}</li>
         <li>Customer: ${esc(receipt.customerName ?? receipt.phone ?? "n/a")}</li>
         <li>Items: ${receipt.items.map((i) => `${i.qty} x ${esc(i.name)}`).join(", ")}</li>
         <li>Reason given: ${esc(reason)}</li>
         <li>Time: ${new Date().toLocaleString("en-NG", { timeZone: "Africa/Lagos" })}</li>
       </ul>
       <p>Your code: <b style="font-size:20px">${otp.code}</b> (valid 10 minutes).</p>
       <p>If you did not expect this, do not share the code.</p>`
    );
  } catch {
    return fail("Could not send the email. Try again.");
  }
  return { ok: true };
}

export async function confirmVoid(receiptId: string, code: string): Promise<Result> {
  const userId = await requireAdmin();
  const check = await checkOtp({ purpose: "VOID_RECEIPT", targetId: receiptId, code: code.trim() });
  if (!check.ok) return fail(check.error);

  try {
    await prisma.$transaction(async (tx) => {
      const used = await tx.securityOtp.updateMany({
        where: { id: check.otp.id, usedAt: null }, data: { usedAt: new Date() },
      });
      if (used.count === 0) throw new Error("Code already used.");

      const res = await tx.receipt.updateMany({
        where: { id: receiptId, status: { not: "VOIDED" } },
        data: { status: "VOIDED", voidedAt: new Date(), voidedBy: userId, voidReason: check.otp.payload },
      });
      if (res.count === 0) throw new Error("Receipt already voided.");

      const r = await tx.receipt.findUniqueOrThrow({ where: { id: receiptId }, select: { stockApplied: true } });
      if (r.stockApplied) await restoreStock(tx, receiptId);
    });
  } catch (e: any) {
    return fail(e.message ?? "Could not void the receipt.");
  }
  return { ok: true };
}
```

### 8.4 `components/void-receipt-button.tsx`

```tsx
"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { requestVoid, confirmVoid } from "@/actions/void-receipt";

export function VoidReceiptButton({ receiptId, label }: { receiptId: string; label: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"reason" | "code">("reason");
  const [reason, setReason] = useState("Refunded");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const reset = () => { setStep("reason"); setCode(""); setError(""); };

  const sendCode = () => start(async () => {
    const r = await requestVoid(receiptId, reason);
    if (!r.ok) return setError(r.error);
    setError(""); setStep("code");
  });

  const confirm = () => start(async () => {
    const r = await confirmVoid(receiptId, code);
    if (!r.ok) return setError(r.error);
    setOpen(false); reset(); router.refresh();
  });

  return (
    <>
      <button aria-label={`Void receipt ${label}`} onClick={() => { reset(); setOpen(true); }}
              className="text-muted-foreground hover:text-destructive"><X size={16} /></button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Void receipt {label}</DialogTitle></DialogHeader>
          {step === "reason" ? (
            <div className="space-y-3">
              <select value={reason} onChange={(e) => setReason(e.target.value)} className="w-full border rounded p-2">
                <option>Refunded</option><option>Entered by mistake</option><option>Other</option>
              </select>
              <p className="text-sm text-muted-foreground">A code will be sent to the owner's email.</p>
              <button disabled={pending} onClick={sendCode} className="w-full rounded bg-primary text-primary-foreground p-2">
                {pending ? "Sending..." : "Send code"}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <input inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                     placeholder="6-digit code" className="w-full border rounded p-2 tracking-widest text-center" />
              <button disabled={pending || code.length !== 6} onClick={confirm} className="w-full rounded bg-destructive text-white p-2">
                {pending ? "Checking..." : "Void receipt"}
              </button>
              <button disabled={pending} onClick={sendCode} className="text-sm underline">Resend code</button>
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </DialogContent>
      </Dialog>
    </>
  );
}
```

### 8.5 Closing the loopholes (important)

- Saved receipts are read-only. Editing the amount or items of a saved receipt hides funds as effectively as deleting it. A correction means void + create a new one.
- Webhook idempotency: `markPaid` never moves a `VOIDED` receipt back to `PAID`.
- The owner email must be an inbox the staff cannot open. The Settings field shows a warning: "Use an email only you can open."
- Don't offer any hard-delete action in the UI or in any other server action.

### 8.6 Needs review (late, mismatched or oversold payments)

A receipt is flagged (`needsReview = true` with a plain-language `reviewNote`) and the owner is emailed once, instantly, when:
- a payment arrives for a receipt that was already voided (the money is real);
- a Paystack or crypto payment arrives but its amount doesn't match the order or invoice;
- a paid website order was short on stock (sold more than was left, for example when a hold had expired).

A receipt is flagged only once: after the owner marks it reviewed, a repeated webhook can't reopen it or send another email. The flag never changes the receipt's money status. A paid receipt stays paid; the flag only asks the owner to decide (refund from the gateway, fulfil late, or restore the sale). The dashboard shows a strip with the count, linking to the "Needs review" filter.

```ts
"use server";
export async function markReviewed(receiptId: string): Promise<Result> {
  const userId = await requireAdmin();
  await prisma.receipt.updateMany({
    where: { id: receiptId, needsReview: true },
    data: { needsReview: false, reviewedAt: new Date(), reviewedBy: userId },
  });
  return { ok: true };
}
```

Clearing the flag doesn't need an OTP: the owner was already emailed when it was raised, so staff clearing it can't hide it from them. The `reviewNote`, `reviewedAt` and `reviewedBy` stay on the receipt as a record.

---

## 9. Settings: owner email and low-stock level

Fields: business name, logo, motto, bookings toggle, **owner email**, **low stock alert level** (default 5).

Only the owner email needs special handling. Everything else saves normally.

Rules:
- First time (no owner email yet, store onboarding): save directly. Receipt voiding stays disabled until it is set.
- Later changes: don't save. Start a verified change that needs two codes. The code to the CURRENT email proves the owner approves, and the code to the NEW address proves it is typed correctly and reachable.

```ts
"use server";
const emailSchema = z.string().trim().toLowerCase().email();

export async function requestEmailChange(newEmailRaw: string): Promise<Result> {
  const userId = await requireAdmin();
  const parsed = emailSchema.safeParse(newEmailRaw);
  if (!parsed.success) return fail("Enter a valid email.");
  const newEmail = parsed.data;

  const s = await prisma.settings.findUniqueOrThrow({ where: { id: "store" } });
  if (!s.ownerEmail) return fail("No current email to verify against.");   // first-time set uses saveOwnerEmail
  if (s.ownerEmail.toLowerCase() === newEmail) return fail("That is already your email.");

  const otp = await issueOtp({
    purpose: "CHANGE_EMAIL", targetId: "settings", payload: newEmail, requestedBy: userId, twoCodes: true,
  });
  if (!otp.ok) return fail(otp.error);

  try {
    await sendEmail(s.ownerEmail, `Code ${otp.code}: change your store email`,
      `<p>A request was made to change your store email to <b>${esc(newEmail)}</b>.</p>
       <p>Code: <b>${otp.code}</b> (valid 10 minutes). If this wasn't you, ignore this email.</p>`);
    await sendEmail(newEmail, `Code ${otp.code2}: confirm your new store email`,
      `<p>Use this code to confirm this address: <b>${otp.code2}</b></p>`);
  } catch {
    return fail("Could not send the emails. Check the new address and try again.");
  }
  return { ok: true };
}

export async function confirmEmailChange(code: string, code2: string): Promise<Result> {
  await requireAdmin();
  const check = await checkOtp({ purpose: "CHANGE_EMAIL", targetId: "settings", code: code.trim(), code2: code2.trim() });
  if (!check.ok) return fail(check.error);

  const before = await prisma.settings.findUniqueOrThrow({ where: { id: "store" } });
  try {
    await prisma.$transaction(async (tx) => {
      const used = await tx.securityOtp.updateMany({ where: { id: check.otp.id, usedAt: null }, data: { usedAt: new Date() } });
      if (used.count === 0) throw new Error("Code already used.");
      // the new address comes from the saved OTP row, never from the browser
      await tx.settings.update({ where: { id: "store" }, data: { ownerEmail: check.otp.payload! } });
    });
  } catch (e: any) {
    return fail(e.message);
  }
  if (before.ownerEmail)
    await sendEmail(before.ownerEmail, "Your store email was changed",
      `<p>Your store email was changed to <b>${esc(check.otp.payload!)}</b>.</p>`).catch(() => {});
  return { ok: true };
}
```

UI: when the owner email field changes and Save is pressed, call `requestEmailChange`, then show a dialog with two code boxes ("Code sent to your current email", "Code sent to the new email") and call `confirmEmailChange`.

Recovery if the vendor loses the old inbox: you (the developer) update `Settings.ownerEmail` directly in the database (Prisma Studio or SQL) after verifying the vendor's identity yourself.

---

## 10. Dashboard analytics

All queries count only `status = PAID` and respect one `?range=30|60|all` toggle shown in the page header. Weekday and hour are always computed in Nigeria time (Africa/Lagos): Vercel runs in UTC, and without this a sale at 11:30pm Saturday lands on Sunday.

### 10.1 `lib/analytics.ts`

```ts
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { Range, rangeWhere } from "@/lib/range";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const dayFmt = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "Africa/Lagos" });
const hourFmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: "Africa/Lagos" });

const paid = (range: Range): Prisma.ReceiptWhereInput => ({ status: "PAID", ...rangeWhere(range) });

// 1. Summary cards with comparison to the previous period
export async function getSummary(range: Range) {
  const agg = (where: Prisma.ReceiptWhereInput) =>
    prisma.receipt.aggregate({ where: { status: "PAID", ...where }, _sum: { amount: true }, _count: { _all: true } });

  const cur = await agg(rangeWhere(range));
  const revenue = Number(cur._sum.amount ?? 0);
  const sales = cur._count._all;
  const aov = sales ? revenue / sales : 0;

  let change: { revenue: number | null; sales: number | null; aov: number | null } | null = null;
  if (range !== "all") {
    const days = Number(range);
    const now = Date.now();
    const prev = await agg({ paidAt: { gte: new Date(now - 2 * days * 864e5), lt: new Date(now - days * 864e5) } });
    const pRev = Number(prev._sum.amount ?? 0), pSales = prev._count._all, pAov = pSales ? pRev / pSales : 0;
    const pct = (a: number, b: number) => (b ? ((a - b) / b) * 100 : null);
    change = { revenue: pct(revenue, pRev), sales: pct(sales, pSales), aov: pct(aov, pAov) };
  }
  return { revenue, sales, aov, change };
}

// 2 + 3. Day-of-week pie and hour-of-day bars from one query
export async function getTimeBuckets(range: Range) {
  const rows = await prisma.receipt.findMany({ where: paid(range), select: { paidAt: true, amount: true } });
  const byDay = DAYS.map((day) => ({ day, sales: 0, revenue: 0 }));
  const byHour = Array.from({ length: 24 }, (_, hour) => ({ hour, sales: 0 }));
  for (const r of rows) {
    if (!r.paidAt) continue;
    const d = byDay[DAYS.indexOf(dayFmt.format(r.paidAt))];
    d.sales += 1; d.revenue += Number(r.amount);
    byHour[Number(hourFmt.format(r.paidAt))].sales += 1;
  }
  return { byDay, byHour };
}

// 4. Revenue by payment method
export async function getByMethod(range: Range) {
  const rows = await prisma.receipt.groupBy({
    by: ["method"], where: paid(range), _sum: { amount: true }, _count: { _all: true },
  });
  return rows.map((r) => ({ method: r.method, revenue: Number(r._sum.amount ?? 0), sales: r._count._all }));
}

// 5. Daily revenue, bucketed by the Nigeria-local paid date
export async function getDailyRevenue(range: Range) {
  const since = range === "all" ? null : new Date(Date.now() - Number(range) * 864e5);
  const rows = await prisma.$queryRaw<{ date: string; revenue: number; sales: bigint }[]>`
    SELECT to_char((("paidAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Africa/Lagos')::date, 'YYYY-MM-DD') AS date,
           SUM("amount")::float8 AS revenue,
           COUNT(*) AS sales
    FROM "Receipt"
    WHERE "status" = 'PAID'
      AND "paidAt" IS NOT NULL
      ${since ? Prisma.sql`AND "paidAt" >= ${since}` : Prisma.empty}
    GROUP BY 1
    ORDER BY 1`;
  return rows.map((r) => ({ date: r.date, revenue: Number(r.revenue), sales: Number(r.sales) }));
}

// 6. Best-selling items (the "most sold item" chart)
export async function getBestSellers(range: Range) {
  const rows = await prisma.receiptItem.groupBy({
    by: ["name"], where: { receipt: paid(range) },
    _sum: { qty: true }, orderBy: { _sum: { qty: "desc" } }, take: 8,
  });
  return rows.map((r) => ({ name: r.name, qty: r._sum.qty ?? 0 }));
}

// 7. Stock alerts (derived, never stored)
export async function getStockAlerts(threshold: number) {
  const tracked = await prisma.product.count({ where: { stock: { not: null } } });
  if (tracked === 0) return { tracked, alerts: [] };                      // feature unused: hide the card entirely

  const cutoff = new Date(Date.now() - 30 * 864e5);
  const alerts = await prisma.product.findMany({
    where: {
      stock: { not: null, lte: threshold },
      OR: [
        { stock: { gt: 0 } },
        // at 0: alert for 30 days, then goes quiet until restocked (restock clears zeroSince)
        { stock: 0, OR: [{ zeroSince: null }, { zeroSince: { gte: cutoff } }] },
      ],
    },
    orderBy: { stock: "asc" },
    select: { id: true, name: true, stock: true },
  });
  return { tracked, alerts };
}

// 8. Repeat and top customers (identified by phone, else email)
export async function getCustomers(range: Range) {
  const [rows, totalPaid] = await Promise.all([
    prisma.receipt.groupBy({
      by: ["customerKey"],
      where: { ...paid(range), customerKey: { not: null } },
      _count: { _all: true }, _sum: { amount: true },
      orderBy: { _sum: { amount: "desc" } },
    }),
    prisma.receipt.count({ where: paid(range) }),
  ]);
  const identified = rows.reduce((s, r) => s + r._count._all, 0);
  const repeat = rows.filter((r) => r._count._all > 1).length;
  return {
    customers: rows.length,
    repeatRate: rows.length ? repeat / rows.length : 0,
    coverage: totalPaid ? identified / totalPaid : 0,               // share of sales we can attribute to a customer
    top: rows.slice(0, 5).map((r) => ({
      customer: r.customerKey!, orders: r._count._all, total: Number(r._sum.amount ?? 0),
    })),
  };
}

// Needs attention: crypto underpayments and flagged payments
export async function countAttention() {
  const [partial, review] = await Promise.all([
    prisma.receipt.count({ where: { status: "PARTIAL" } }),
    prisma.receipt.count({ where: { needsReview: true } }),
  ]);
  return { partial, review };
}
```

Alert rules in plain words:
- Alert (and badge) starts when tracked stock is at or below the alert level (default 5).
- At 0 it keeps alerting for 30 days from `zeroSince`, then goes quiet.
- Any restock (stock above 0) clears `zeroSince`, so alerts start fresh. If the new quantity is still at or below the level, it alerts again at once.
- Nothing is stored about "alert on/off", so it always matches the quantity.

### 10.2 Range toggle: `components/param-toggle.tsx`

```tsx
"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

export function ParamToggle({ param, value, options }: {
  param: string; value: string; options: { v: string; label: string }[];
}) {
  const pathname = usePathname();
  const sp = useSearchParams();
  const href = (v: string) => {
    const p = new URLSearchParams(sp.toString());
    p.set(param, v);
    p.delete("page");                      // keep search/status params, reset pagination
    return `${pathname}?${p.toString()}`;
  };
  return (
    <div className="flex gap-1 text-sm">
      {options.map((o) => (
        <Link key={o.v} href={href(o.v)} scroll={false}
              className={`rounded border px-2 py-1 ${value === o.v ? "bg-primary text-primary-foreground" : ""}`}>
          {o.label}
        </Link>
      ))}
    </div>
  );
}

export const RANGE_OPTIONS = [
  { v: "30", label: "30 days" }, { v: "60", label: "60 days" }, { v: "all", label: "All time" },
];
```

If the build complains about `useSearchParams`, wrap the toggle in `<Suspense>`.

### 10.3 Chart components

Day-of-week pie (used on the dashboard AND the receipts page):

```tsx
"use client";
import { useState } from "react";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";

const COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4", "#a855f7", "#64748b"];
type Row = { day: string; sales: number; revenue: number };

export function SalesByDayPie({ data }: { data: Row[] }) {
  const [metric, setMetric] = useState<"sales" | "revenue">("sales");
  const rows = data.filter((d) => d[metric] > 0);
  const best = [...rows].sort((a, b) => b[metric] - a[metric])[0];
  return (
    <div className="rounded-xl border p-4 space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Best sales days</h3>
        <select value={metric} onChange={(e) => setMetric(e.target.value as any)} className="text-sm border rounded px-2 py-1">
          <option value="sales">Number of sales</option><option value="revenue">Revenue (₦)</option>
        </select>
      </div>
      {rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">No sales in this period</p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">Your best day is <b>{best.day}</b></p>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={rows} dataKey={metric} nameKey="day" outerRadius={90} label>
                {rows.map((r) => <Cell key={r.day} fill={COLORS[data.findIndex((d) => d.day === r.day)]} />)}
              </Pie>
              <Tooltip /><Legend />
            </PieChart>
          </ResponsiveContainer>
        </>
      )}
    </div>
  );
}
```

Other cards (same card wrapper style, each fed by one function above):

```tsx
// Summary cards
export function SummaryCards({ s }: { s: Awaited<ReturnType<typeof getSummary>> }) {
  const Delta = ({ v }: { v: number | null | undefined }) =>
    v == null ? null : <span className={v >= 0 ? "text-green-600" : "text-red-600"}>{v >= 0 ? "↑" : "↓"} {Math.abs(v).toFixed(0)}% vs previous period</span>;
  const cards = [
    { t: "Revenue", v: naira(s.revenue), d: s.change?.revenue },
    { t: "Sales", v: String(s.sales), d: s.change?.sales },
    { t: "Average order", v: naira(s.aov), d: s.change?.aov },
  ];
  return <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">{cards.map((c) => (
    <div key={c.t} className="rounded-xl border p-4"><p className="text-sm text-muted-foreground">{c.t}</p>
      <p className="text-2xl font-semibold">{c.v}</p><p className="text-xs"><Delta v={c.d} /></p></div>))}</div>;
}

// Sales by hour: BarChart, XAxis dataKey="hour" tickFormatter={(h) => `${h % 12 || 12}${h < 12 ? "am" : "pm"}`}, Bar dataKey="sales"
// Payment methods: Pie donut (innerRadius={50}) from getByMethod, dataKey="revenue" nameKey="method"
// Daily revenue: responsive BarChart, XAxis dataKey="date", Bar dataKey="revenue".
// Hovering a bar shows the full date and revenue; use compact date ticks and fit the chart to its card on narrow screens.
// Sales by hour: responsive 24-hour chart with compact 12a/3p-style ticks, contained within its card on narrow screens.
// Best sellers: horizontal BarChart from getBestSellers, dataKey="qty" nameKey="name"
```

Stock alerts and customers cards:

```tsx
export function StockAlertsCard({ alerts }: { alerts: { id: string; name: string; stock: number | null }[] }) {
  if (alerts.length === 0) return null;
  return (
    <div className="rounded-xl border p-4">
      <h3 className="font-semibold mb-2">Restock soon</h3>
      <ul className="space-y-1 text-sm">
        {alerts.map((p) => (
          <li key={p.id} className="flex justify-between">
            <span>{p.name}</span>
            <span className={p.stock === 0 ? "text-red-600 font-medium" : "text-amber-600"}>
              {p.stock === 0 ? "Out of stock" : `${p.stock} left`}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
// Customers card: "{Math.round(repeatRate*100)}% of customers bought more than once" + top 5 table.
// Add the note "Based on {Math.round(coverage*100)}% of sales (those with a phone number or email)".
// If coverage < 0.7, add the hint "Add a phone number on walk-in receipts to see more of your repeat customers".
```

### 10.4 Dashboard page

```tsx
export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ range?: string; view?: string }> }) {
  const sp = await searchParams;                    // Next 14: searchParams is a plain object, skip the await
  const range = parseRange(sp.range);
  const settings = await prisma.settings.findUniqueOrThrow({ where: { id: "store" } });

  const [summary, time, methods, dailyRevenue, best, stock, customers, attention] = await Promise.all([
    getSummary(range), getTimeBuckets(range), getByMethod(range), getDailyRevenue(range),
    getBestSellers(range), getStockAlerts(settings.lowStockThreshold), getCustomers(range), countAttention(),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Overview</h1>
        <ParamToggle param="range" value={range} options={RANGE_OPTIONS} />
      </div>
      {attention.review > 0 && <a href="/dashboard/receipts?status=review" className="block rounded border border-amber-400 bg-amber-50 p-3 text-sm">
        {attention.review} payment(s) need your review.</a>}
      {attention.partial > 0 && <a href="/dashboard/receipts?status=partial" className="block rounded border border-amber-400 bg-amber-50 p-3 text-sm">
        {attention.partial} crypto payment(s) were only partly paid.</a>}
      <SummaryCards s={summary} />
      {/* revenue trend */}
      {/* grid: SalesByDayPie, hour bars, method donut, best sellers */}
      {stock.tracked > 0 && <StockAlertsCard alerts={stock.alerts} />}
      {/* customers card */}
    </div>
  );
}
```

Layout order: summary cards, revenue trend, a grid (best sales days, hour of day, payment methods, best sellers), stock alerts, top customers.

Receipts page: header with `ParamToggle` for range, `<SalesByDayPie data={(await getTimeBuckets(range)).byDay} />`, then the filtered, searchable, paginated list from section 8.

---

## 11. Admin overview (what each page does)

| Page | What it does |
|---|---|
| `/dashboard` | Analytics (section 10) |
| `/dashboard/products` | Add/edit products with optional stock, stock badges (only when at or below the alert level), pagination 10 per page |
| `/dashboard/receipts` | Search, filter by status, pagination, day-of-week pie, X to void with OTP, create manual receipt |
| `/dashboard/settings` | Business name, logo, motto, bookings toggle, owner email (OTP to change), low-stock alert level |
| Storefront `/` | Product grid, sold-out state, cart, "book us for event" form (if enabled), WhatsApp/social links |

Existing features stay as they are: single admin account per store, UploadThing image upload for products, receipt image/PDF generation, the bookings form.

---

## 12. Security checklist

- Every admin server action calls `requireAdmin()` (section 3.2). Page-level protection alone isn't enough.
- Webhooks verify signatures on the raw body before doing anything, and respond 200 to acknowledged-but-ignored events.
- Prices come from the database, never from the browser.
- All gateway secrets are server-only env vars (no `NEXT_PUBLIC_` prefix).
- OTPs: crypto-random, hashed with an HMAC secret, 10-minute expiry, 5 attempts, single use, resend cooldown, hourly cap, older codes expire when a new one is issued.
- Emails escape user-provided text with `esc()`.
- No hard delete of receipts anywhere.
- Owner email change needs both codes; a voided receipt is never revived by a late webhook.
- Product rows are locked while checking out and while deducting stock, so concurrent sales are processed one at a time.
- Anything odd about a payment (late, mismatched, oversold) is flagged and emailed to the owner once; nothing is only logged.
- A missing or stale exchange rate hides the Crypto option rather than pricing on a bad number.

---

## 13. Build order

1. Prisma schema + migration (section 2), then the two SQL backfill statements.
2. Shared libs (section 3): crypto, auth, receipts, range, email, middleware.
3. Product form with optional stock, stock badge, storefront sold-out handling.
4. Manual receipts through `createManualReceipt` with the product picker.
5. Checkout action, success page, Paystack webhook. Test in Paystack test mode (section 14).
6. NOWPayments checkout and webhook, with the live rate cache (`lib/fx.ts`) if you price in USD. Test in the sandbox.
7. Dashboard analytics and the receipts-page pie.
8. Owner email setting, OTP library, void flow with the X button, email-change flow.
9. Full test checklist (section 14), then Paystack/NOWPayments live keys.

---

## 14. Test checklist (run all of these before going live)

**A. Paystack (test mode)**
1. Add a product with stock 6. Add 1 to the cart, check out with Paystack using one of Paystack's documented test cards.
2. Expect: redirect to the success page, "Payment received", cart cleared, back on the homepage. Receipt is `PAID`, `paidAt` set, stock is 5, the product shows the "Low · 5" badge.
3. Webhook locally or on a preview URL: set the test webhook URL in the Paystack dashboard. Resend the same event: stock must NOT drop again.
4. Abandon a payment (close the Paystack page): receipt stays `PENDING` (visible under the Pending filter), stock unchanged, analytics unchanged.

**B. Crypto (NOWPayments sandbox)**
1. Check out with Crypto, complete the sandbox payment.
2. Expect: receipt `PENDING` while confirming, then `PAID` after `finished`. Success page polls and flips by itself. Stock decreases once, `cryptoCurrency` and `cryptoAmount` filled in.
3. Test a partial payment: receipt becomes `PARTIAL`, appears on the dashboard attention strip, stock unchanged.
4. Send a webhook with a bad signature: 401 and no change.
5. Quick signature check script for local webhook testing (`sign.mjs`):
```js
import { createHmac } from "crypto";
const sort = (v) => Array.isArray(v) ? v.map(sort) : v && typeof v === "object"
  ? Object.keys(v).sort().reduce((o, k) => ((o[k] = sort(v[k])), o), {}) : v;
const body = { order_id: "RECEIPT_ID", payment_status: "finished", price_amount: 10, price_currency: "usd", pay_currency: "btc", actually_paid: 0.0002, payment_id: 1 };
console.log(createHmac("sha512", process.env.NOWPAYMENTS_IPN_SECRET).update(JSON.stringify(sort(body))).digest("hex"));
// then: curl -X POST localhost:3000/api/webhooks/nowpayments -H "x-nowpayments-sig: <hash>" -d '<same body, key order irrelevant>'
```
Use the receipt's real `invoiceAmount` and currency in `body` so the amount check passes.

**C. Manual receipts and stock**
1. Create a manual receipt picking a tracked product (qty 2). Expect `PAID` immediately, stock down by 2.
2. A custom (free-typed) item and an untracked product: stock unchanged for those lines.
3. Take a tracked product from 6 to 0 via sales. Badge turns "Sold out", the dashboard card shows "Out of stock", the storefront shows Sold out and blocks add-to-cart.

**D. Alert timing**
1. In the database, set that product's `zeroSince` to 31 days ago. Expect: the dashboard alert disappears, the "Sold out" badge remains.
2. Edit only its name (stock still 0): the alert stays silent (clock not reset).
3. Set stock to 3: `zeroSince` is cleared and the alert returns ("3 left"). Set stock to 20: no badge, no alert.
4. Clear the stock field: tracking off, no badge. If no product is tracked, the alert card is hidden.

**E. Void with OTP**
1. Click X, pick a reason, send the code. The owner email shows amount, customer, items, reason.
2. Wrong code: "Incorrect code." Five wrong tries: code locked, must request a new one. Wait out 10 minutes: expired.
3. Resend within 60 seconds: blocked. A new code invalidates the previous one.
4. Correct code: receipt moves to Voided, disappears from analytics, stock restored (only if `stockApplied` was true). Old receipts from before inventory existed do NOT add stock back.
5. Replay a webhook for the voided receipt: it stays `VOIDED`.
6. Using the same code twice fails.

**F. Owner email change**
1. Change the email in Settings: two emails arrive (current address and new address) with different codes.
2. Only with both codes does the change apply. The old address receives a "changed" notice.
3. Changing the email without being able to read the current inbox is impossible.

**G. Analytics**
1. Compare dashboard totals against a manual sum of paid receipts for the selected range.
2. Make a sale at 11:30pm Lagos time: it counts toward that day, not the next.
3. Void a receipt: totals and charts drop accordingly. Switch range 30 / 60 / All and the weekly/monthly trend toggle.

**H. Stock holds (no overselling)**
1. Product with stock 1. Start a checkout in one browser (stop at the payment page, don't pay), then try to checkout the same product in another browser. Expect "sold out right now".
2. Wait 30 minutes (or set the receipt's `createdAt` back 31 minutes in the database): the second customer can now buy it.
3. Pay the first order, then the stock is 0 and the holds no longer matter.
4. Make the payment page fail (wrong Paystack key): the receipt goes `FAILED` and the hold is released at once.
5. Two simultaneous checkouts for the last unit (two tabs, click Pay together): exactly one succeeds.
6. Force a short-stock payment: let a hold expire, let someone else buy the last unit, then pay the first order. Expect the receipt `PAID` with a "needs review" flag, stock 0 (not negative), and an email to the owner.

**I. Odd payments**
1. Void a pending crypto receipt, then send a `finished` webhook for it. Expect: stays `VOIDED`, flagged for review, owner emailed once (resend the webhook: no second email).
2. Send a `finished` webhook with the wrong `price_amount`: receipt not paid, flagged with the expected vs received amounts.
3. Mark reviewed on a flagged receipt: flag clears and `reviewedBy`/`reviewedAt` are set; it no longer counts on the dashboard strip.

**J. Exchange rate (USD pricing mode)**
1. Clear `fxRate` in Settings and open checkout: a rate is fetched and stored, "about $X USD" appears.
2. Block the rate URL (set `FX_API_URL` to a wrong address) with a rate under 6 hours old: checkout still works with the cached rate. With a rate 49+ hours old: the Crypto option is hidden.
3. Check a crypto receipt: `invoiceAmount` equals `amount / fxRate` (to 2 decimals) and the NOWPayments invoice shows that amount.

**K. Customers**
1. A website order stores `customerKey` as the normalised phone. A manual receipt without a phone has no key and is excluded from repeat stats, but counted in the "coverage" percentage.
2. Enter `0803...` and `+234803...` for the same person: they become one customer.

---

## 15. Earlier limits and how each was handled

| Earlier limit | Fix | Where |
|---|---|---|
| Two customers could pay for the last unit | Unpaid website orders hold stock for 30 minutes; product rows are locked at checkout and when deducting | 4.1, 3.3 |
| Payment on a voided receipt only logged | `needsReview` flag, one email to the owner, dashboard strip, Needs review filter | 3.3, 6.1, 8.6 |
| Stale USD rate | Live rate cached in the database (not an env var), refreshed on the server, fail-closed, stored per receipt | 3.7, 4.1, 6.2 |
| Repeat stats needed a phone | `customerKey` = phone or email, coverage % shown, phone suggestions on the manual form | 2, 3.3, 7.4, 10.1 |
| Single vendor only | One deployment per vendor (below) | this section |

### Multiple vendors: recommended approach

Don't build multi-tenancy yet. Run **one deployment per vendor**: the same repo, deployed separately for each vendor, each with its own Neon database, Clerk application, Paystack and NOWPayments keys, and env vars.

- Isolation is by construction: a bug can never show one vendor another's receipts or customers, and a leak of one vendor's keys exposes only that vendor.
- Each vendor's payments settle straight into their own Paystack and crypto accounts, which is what they expect (and you never hold their money).
- Updating all vendors is a `git push` per project, which is manageable for the first several vendors.
- Make the repo easy to clone: keep every vendor-specific value in env vars or the `Settings` row (no hardcoded names or colours), and add a one-time setup script that creates the `Settings` row (`id = "store"`) and the owner email.
- Check Vercel's current terms before hosting vendors' commercial stores on its free Hobby plan, which is intended for non-commercial use. Either deploy under each vendor's own account or use a paid plan.

Move to true multi-tenancy (one app, many stores) only when managing many separate deployments becomes the painful part. At that point:
1. Add `storeId` to `Settings` (as its key), `Product`, `Receipt`, `SecurityOtp`, and index it.
2. Resolve the store per request from the domain/subdomain, and the signed-in admin's store from Clerk (organizations work well for this).
3. Wrap Prisma in a client extension that adds `storeId` to every query's `where` (and sets it on every create), so no query can forget it:
```ts
export const dbFor = (storeId: string) =>
  prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          (args as any).where = { ...(args as any).where, storeId };
          return query(args);
        },
      },
    },
  });
```
4. The raw SQL in this guide (stock locking and updates, the revenue trend, anything in `$queryRaw`) is NOT covered by that extension. Each one needs `AND "storeId" = ...` added by hand.
5. Webhooks must find the store from the receipt (`order_id`) and verify with that store's own secret, so gateway keys move into the database per store (encrypted).

### Remaining limits

- The free exchange-rate source updates once a day, so the USD price of a crypto order can lag the market by up to a day. The dollar amount is fixed at checkout either way, and the naira receipt is unaffected.
- A paid order that was short on stock is flagged, not auto-refunded. The vendor decides, because only they know if the goods exist.
- Repeat-customer stats can only see customers who gave a phone number or email.
