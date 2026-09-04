# Vendor Buddy v1 — Planning

See `vendor-buddy-project-context.md` for the reasoning behind each decision below, `vendor-buddy-architecture.md` for how the pieces fit together technically, and `vendor-buddy-build-phases.md` for the phase-by-phase build sequence.

## 1. Feature breakdown

### Public storefront

- Product catalog grid: image, name, price, category, in-stock status
- **Category filter pills** above the grid: "All" + one pill per distinct category present in the vendor's catalog (derived from products, not a managed list). Products with no category fall under "All" only, or an "Uncategorized" pill if at least one such product exists.
- Product detail
- Cart: add/remove items, adjust quantity, view running total, persists in memory for the session (no login required for customers)
- "Buy Now" / Checkout: builds a formatted WhatsApp message from cart contents, opens `wa.me` link to vendor's number
- Out-of-stock products show disabled/greyed buy action
- Vendor branding: business name, logo, motto shown on storefront (from Settings)
- Toast feedback on cart actions (see section 4a)

### Admin dashboard (Clerk-protected, single account only)

- **Overview** — landing page after login, quick summary (e.g. today's/week's sales at a glance)
- **Manage Products** — add / edit (price, category, quantity label, description, image) / delete / toggle in-stock. Category field is a combobox: pick an existing category used elsewhere in the catalog, or type a new one.
- **Receipts** — generate a receipt via dropdown (select product + quantity, editable price, or "custom item"), view receipt history, download/share/email each receipt
- **Settings** — business name, logo upload, motto, WhatsApp number, admin email
- Toast feedback on every create/update/delete/toggle/save action (see section 4a)

### Receipt generation flow

1. Admin opens "New Receipt"
2. Selects product from dropdown (auto-fills name + price) or adds a custom line item
3. Sets quantity, adjusts price if it was bargained
4. Can add multiple line items to one receipt
5. Saves → receipt persists to DB, feeds analytics → success/error toast
6. From the saved receipt: **Download** (image, via `dom-to-image-more`), **Share to WhatsApp** (Web Share API, falls back to download on unsupported browsers), **Email** (prompts for address, sends via Resend) — each action confirms or reports failure via toast

### Analytics (Overview / Receipts page)

- Daily sales total (bar chart)
- Top-selling products (bar chart)
- Powered entirely by saved Receipt records — nothing derived from the cart/checkout flow
- Category is not part of analytics in v1 (no "sales by category" chart) — kept out to avoid scope creep; revisit in v2 if vendors ask for it

## 2. Data model (Prisma schema, conceptual)

Every table includes `vendorId` even though v1 only ever has one vendor per database — keeps the door open for multi-tenant later without a rewrite.

```
Vendor
- id
- businessName
- logoUrl
- motto
- whatsappNumber
- createdAt

Product
- id
- vendorId
- name
- description
- category (string, nullable — free text, no FK; see project-context.md for why)
- price
- imageUrl
- inStock (boolean)
- createdAt
- updatedAt

Receipt
- id
- vendorId
- customerName (optional)
- total
- createdAt

ReceiptLineItem
- id
- receiptId
- productId (nullable — null if custom item)
- nameSnapshot (name at time of sale, in case product is later edited/deleted)
- quantity
- unitPrice (the actual/bargained price, not necessarily Product.price)
```

Note on `nameSnapshot` / storing price at time of sale: receipts should never silently change if a vendor edits or deletes a product later — the receipt is a historical record. Snapshot the name and price into the line item at creation time rather than joining live to `Product`. Category is deliberately **not** snapshotted onto the line item — it's a catalog-organization detail, not a sale-record detail, so receipts don't need it.

## 3. Route structure (Next.js App Router)

```
/                          → public storefront (catalog), supports ?category=<name> query param for filtering
/cart                      → cart review (optional, or handled as a slide-over on "/")
/sign-in                   → Clerk sign-in
/dashboard                 → Overview
/dashboard/products        → Manage Products
/dashboard/products/new    → Add product (includes category combobox)
/dashboard/products/[id]   → Edit product (includes category combobox)
/dashboard/receipts        → Receipt history + "New Receipt"
/dashboard/receipts/[id]   → View/share/email a single receipt
/dashboard/settings        → Business name, logo, motto, WhatsApp number
```

No new routes for categories — filtering is a query param on the existing storefront route, and category selection is a field within the existing product form. This is deliberate: see project-context.md's note on categories not being a first-class managed entity.

## 4. Cart → WhatsApp message format

Keep the encoded URL comfortably under ~1,500 characters.

- ≤5 items: name (truncated ~25–30 chars) + qty + price per line, plus total
- > 5 items: name + qty only per line, single total at bottom
- Hard cap cart at ~12–15 items with a UI nudge to check out or split the order
- Always `encodeURIComponent()` before measuring length, not the raw string

### 4a. Toast notification matrix

One `<ToastContainer />` mounted once at the root layout (`react-toastify@11.1.0`). Toasts are for **confirming an action the user just took**, not for passive/background state. Clerk's own sign-in/sign-up error states are left alone — no duplicate toasts on top of Clerk's UI.

| Surface    | Trigger                                   | Toast type | Example message                          |
|------------|--------------------------------------------|------------|-------------------------------------------|
| Storefront | Item added to cart                         | success    | "Added to cart"                           |
| Storefront | Item removed from cart                     | info       | "Removed from cart"                       |
| Storefront | Cart hits the ~12–15 item cap               | warning    | "Cart's getting full — check out or split into another order" |
| Storefront | WhatsApp checkout link fails to open        | error      | "Couldn't open WhatsApp — try again"      |
| Admin      | Product created / updated                  | success    | "Product saved"                           |
| Admin      | Product create/update fails (validation, network) | error | "Couldn't save product — check the fields and try again" |
| Admin      | Product deleted                            | success    | "Product deleted"                         |
| Admin      | Stock toggled                              | success    | "Marked in stock" / "Marked out of stock" |
| Admin      | Settings saved                             | success    | "Settings updated"                        |
| Admin      | Settings save fails                        | error      | "Couldn't update settings — try again"    |
| Admin      | Receipt saved                              | success    | "Receipt saved"                           |
| Admin      | Receipt save fails                         | error      | "Couldn't save receipt — try again"       |
| Admin      | Receipt image downloaded                   | success    | "Receipt downloaded"                      |
| Admin      | Share sheet unsupported → fell back to download | info  | "Sharing isn't supported here — downloaded instead" |
| Admin      | Receipt emailed successfully               | success    | "Receipt sent"                            |
| Admin      | Receipt email fails (Resend error, bad address) | error | "Couldn't send email — check the address and try again" |
| Admin      | Image upload (product/logo) succeeds       | success    | "Image uploaded"                          |
| Admin      | Image upload fails                         | error      | "Upload failed — try a different image"   |

Exact wording can flex during build; the trigger/type pairing is what matters and should stay consistent across admin and storefront.

## 5. Build order (suggested)

Superseded by the detailed phase breakdown in `vendor-buddy-build-phases.md`, which adds verification checkpoints per phase. Summary:

1. **Scaffold** — Next.js + TypeScript + Tailwind v4 + shadcn/ui init, Prisma + Neon connected, Clerk auth wired with single-account enforcement, `react-toastify` installed with root `<ToastContainer />`
2. **Admin: Products CRUD (incl. category)** — get the dashboard's product management fully working first, including the category combobox and toasts on every mutation; everything else depends on having real product data
3. **Public storefront** — catalog display pulling from the same Product table, in-stock toggle respected, category filter pills wired to the query param
4. **Cart + WhatsApp checkout** — client-side cart state, message formatting/truncation logic, `wa.me` handoff, cart toasts
5. **Settings page** — business name/logo/motto/WhatsApp number (needed before receipts, since receipts show vendor branding), save toast
6. **Receipt generator** — dropdown + custom item, save to DB, receipt history list, save toast
7. **Receipt actions** — download as image (`dom-to-image-more`, mind the CORS/`crossOrigin` gotcha on the logo), Web Share API for WhatsApp (+ desktop fallback), Resend email integration, toasts on each
8. **Analytics** — Recharts on Overview/Receipts, driven by saved Receipt data
9. **Polish** — empty states, mobile responsiveness pass (vendors will mostly use this on phones), loading states, toast wording pass

## 6. Stack & exact versions

See `vendor-buddy-project-context.md` for the full list and reasoning. Pin these in `package.json` at project init:

```
next@16.3.3
react@19
react-dom@19
typescript
tailwindcss@4
@clerk/nextjs@7.8.0
prisma@7.10.0
@prisma/client@7.10.0
uploadthing@7.7.4
@uploadthing/react@7.3.3
resend@6.25.0
recharts@3.10.1
dom-to-image-more
react-toastify@11.1.0
```

Verify with `npm view <package> version` before running `npm install` — these shift often; treat this list as "correct as of Sept 2026," not permanently pinned. `dom-to-image-more` is left unpinned above deliberately — check its current version at install time.

## 7. Explicitly deferred to v2+

- Paystack integration for fixed-price/on-demand vendors
- Multi-tenant single deployment
- Numeric inventory / stock decrement
- Automated WhatsApp send via Business API
- Category as a managed entity (dedicated table, rename/merge/reorder UI, category-level analytics)
