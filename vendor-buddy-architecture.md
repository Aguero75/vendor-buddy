# Vendor Buddy v1 — Architecture

Companion to `vendor-buddy-project-context.md` (why) and `vendor-buddy-planning.md` (what). This doc covers how the pieces fit together technically, so the build phases in `vendor-buddy-build-phases.md` have something concrete to implement against.

## 1. Deployment topology

```
Per vendor:
  ┌─────────────────────────────┐
  │  Vercel project (1 per vendor) │
  │  ┌─────────────────────────┐ │
  │  │ Next.js App Router app  │ │
  │  │  - public storefront     │ │
  │  │  - /dashboard (Clerk)    │ │
  │  └─────────────────────────┘ │
  └──────────────┬───────────────┘
                 │
     ┌───────────┼────────────┬───────────────┬──────────────┐
     ▼           ▼            ▼               ▼              ▼
  Neon DB    Clerk (auth)  UploadThing     Resend         (client only:
 (1 per       shared        (images)      (email)          dom-to-image-more,
  vendor)     Clerk app,                                    react-toastify)
              one user per
              vendor instance
```

No shared backend between vendors. Each vendor's data, auth users, and uploaded assets are fully isolated by virtue of being separate infrastructure, not by application-level tenant scoping. This is the tradeoff documented in project-context.md — simple now, a real migration later if it scales past a handful of vendors.

## 2. Request/data flow

**Storefront (unauthenticated, read-heavy):**
`/` is a Server Component that fetches all `Product` rows for the vendor directly via Prisma at request time (no separate API layer needed — there's only one vendor, so there's no query-param tenant filtering to get wrong). Category filtering (`?category=X`) is applied either as a Prisma `where` clause server-side, or client-side against an already-fetched list — either is fine at this data scale (a small vendor's catalog is tens to low hundreds of products, not thousands), but filtering server-side via the query param is preferred so the filtered view is a real shareable/bookmarkable URL.

**Cart (client-only):**
Cart state lives in a React Context (`CartProvider`), held in memory for the tab's lifetime, not persisted to `localStorage`/`sessionStorage` or the database — this matches the "stateless message-builder" decision in project-context.md. Refreshing the page clears the cart by design; there's no requirement for it to survive a reload.

**Admin mutations (authenticated, write-heavy):**
Product CRUD, stock toggle, settings save, and receipt save are implemented as **Next.js Server Actions**, not a separate REST/route-handler API — there's no external client consuming this data, so Server Actions keep the mutation and the Prisma call co-located. Each Server Action returns a structured result rather than throwing on expected failures:

```ts
type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; message: string };
```

The calling Client Component (a small wrapper around the form) is what has access to `toast()` — Server Actions run on the server and cannot call `react-toastify` directly. The pattern is:

```tsx
// client component
async function handleSubmit(formData: FormData) {
  const result = await saveProduct(formData); // server action
  if (result.ok) {
    toast.success("Product saved");
  } else {
    toast.error(result.message);
  }
}
```

This keeps every mutation's success/failure path explicit and is what makes the toast matrix in planning.md straightforward to implement consistently — the pattern is identical for products, settings, and receipts.

## 3. Auth architecture

Clerk is configured with sign-up disabled (or gated behind a one-time invite/seed step) so a vendor instance never ends up with more than one admin account. The enforcement check is simple because there's no multi-tenancy to reason about: on sign-up attempt (if exposed at all) or in a `/dashboard` layout guard, check "does any Clerk user already exist for this instance?" — if yes, block further sign-up. `/dashboard/*` routes are wrapped in Clerk's route protection at the layout level; the public storefront routes are explicitly excluded from the auth middleware matcher.

## 4. Category design

Category is a plain nullable `String` column on `Product` — no `Category` table, no foreign key. Two things this enables cleanly:

- **Admin form:** a combobox (shadcn/ui `Command` + `Popover`, or similar) that queries `SELECT DISTINCT category FROM Product WHERE vendorId = ...` (or, more simply, derives distinct values from whatever product list is already loaded client-side for that dashboard page) to populate suggestions, while still accepting free text for a new category.
- **Storefront filter pills:** the same distinct-values query, run against only in-stock-eligible products or the full catalog (vendor's call), rendered as pills. `?category=<value>` in the URL drives both the active pill state and the server-side filter.

Because there's no separate table, there's nothing to keep in sync — a category "exists" exactly as long as at least one product uses it, and disappears from the filter pills the moment the last product using it is deleted or recategorized. This is intentional per the project-context tradeoff (simplicity over category management features like renaming-in-bulk).

## 5. Receipt image export pipeline

1. The receipt is rendered as a normal React component (`<ReceiptCard />`), styled with Tailwind, using real vendor branding data (logo, business name, motto) and the receipt's line items — this can be the same component used for the on-screen "View receipt" page, kept off-screen if needed for export-only contexts.
2. The vendor's logo `<img>` tag **must** include `crossOrigin="anonymous"` since it's served from UploadThing's CDN (a different origin) — otherwise the exported canvas is tainted and the logo silently drops out of the PNG. This is the one place in the whole app where forgetting a single attribute causes a silent, hard-to-notice visual bug, so it's called out explicitly here and again in the build phases.
3. `dom-to-image-more`'s `toPng(ref.current)` produces a data URL/blob.
4. That blob feeds three actions:
   - **Download:** trigger a browser download of the blob directly.
   - **Share:** pass the blob as a `File` into `navigator.share({ files: [...] })`; if `navigator.canShare` returns false (desktop, mostly), fall back to the download path and toast accordingly ("Sharing isn't supported here — downloaded instead").
   - **Email:** the blob (or a base64 version of it) is sent to a Server Action / route handler that calls Resend with the image as an attachment.
5. Each of the three actions resolves to a toast — success or a specific failure reason (network, unsupported API, bad email address) — per the matrix in planning.md.

## 6. Notification architecture (react-toastify)

- `<ToastContainer />` is mounted exactly once, in the root layout (`app/layout.tsx`), so both the public storefront and the authenticated dashboard share one instance — no duplicate containers, no toasts competing for the same corner of the screen from two different mounted containers.
- Toasts are triggered from Client Components only (see the Server Action pattern in section 2). Anywhere a mutation currently updates local UI state on success, the toast call sits right next to that state update, not off in a separate effect — keeps the "what happened, what did I tell the user" pairing easy to audit.
- Toasts confirm **actions**, not passive state. Loading states (a spinner while a Server Action is in flight) are a separate, non-toast UI concern — don't toast "Saving...".

## 7. Suggested folder structure

```
app/
  layout.tsx                 # root layout: <ToastContainer />, ClerkProvider, CartProvider
  page.tsx                   # storefront catalog + category pills
  cart/
  sign-in/[[...sign-in]]/
  dashboard/
    layout.tsx                # Clerk route guard
    page.tsx                  # Overview
    products/
      page.tsx
      new/page.tsx
      [id]/page.tsx
    receipts/
      page.tsx
      [id]/page.tsx
    settings/page.tsx
components/
  storefront/                 # ProductGrid, ProductCard, CategoryPills, CartDrawer
  dashboard/                  # ProductForm (incl. category combobox), ReceiptForm, ReceiptCard
  ui/                          # shadcn/ui primitives
lib/
  actions/                     # Server Actions: products.ts, receipts.ts, settings.ts
  prisma.ts
  cart-context.tsx
  whatsapp-message.ts          # cart → wa.me message formatting/truncation
  receipt-export.ts            # dom-to-image-more wrapper
prisma/
  schema.prisma
```

## 8. Error-handling conventions

- Server Actions never throw for *expected* failure modes (validation errors, "not found", third-party API errors from Resend/UploadThing) — they return `{ ok: false, message }` so the caller can toast a specific, useful message instead of a generic error boundary.
- Unexpected errors (a genuine bug, a DB connection drop) are allowed to throw and surface via Next.js error boundaries — those aren't toast-worthy, they're app-breaking, and should look different to the admin than "your save didn't go through, try again."
- This distinction is what section-by-section verification in `vendor-buddy-build-phases.md` checks for: each phase should end with both the happy path and at least one deliberate failure path (bad input, simulated network failure) producing the correct toast, not a crash.
