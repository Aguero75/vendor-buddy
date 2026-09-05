# Vendor Buddy — Project Context

## What this is

A free storefront tool for small Nigerian vendors. Each vendor gets their own deployed instance of the app: a public storefront page showing their product catalog, and a private admin dashboard to manage it. Customers browse, build a cart, and check out via WhatsApp — there's no in-app payment processing in MVP v1.

## Why it exists

Most small vendors sell through WhatsApp/Instagram DMs with no organized catalog, no receipts, and no sales tracking. Vendor Buddy gives them a simple, professional storefront without asking them to learn a dashboard, integrate a payment gateway, or change how they actually close sales (which stays on WhatsApp, where the back-and-forth/bargaining already happens).

## Who it's for

Individual small vendors (fashion, food, crafts, made-to-order goods) who currently sell informally. Not a marketplace — no vendor discovers other vendors through the app.

## Architecture decision: one instance per vendor

Each vendor gets their own separate deployment (own Vercel project, own Neon database, own domain/subdomain) rather than one shared multi-tenant platform. This was chosen deliberately for v1:

- Simpler auth — no vendor-scoping needed, "only one admin account" is just "does a user already exist"
- No cross-vendor data isolation risk
- Fastest path to something real and testable

**Known tradeoff:** this doesn't scale past a handful of vendors without becoming a manual deploy pipeline (new DB, new domain, new env vars per vendor). Acceptable for validating the idea with the first 5–10 vendors. If it takes off, the path to multi-tenant is a routing/auth change, not a schema rewrite — because every core table includes a `vendorId` field from day one even though v1 only ever has one vendor per database.

## Key product decisions and the reasoning behind them

**Cart is a stateless message-builder, not an order system.**
Prices on WhatsApp are routinely renegotiated (bargaining is normal in this market), so a cart total is never guaranteed to match what's actually paid. Rather than create "pending order" rows that the admin has to edit anyway, the cart exists purely to help the customer compose a clear WhatsApp message. Nothing is written to the database at checkout.

**Receipts are manual, but fast — a dropdown, not a form.**
Since sales aren't confirmed until the WhatsApp conversation concludes, receipt creation is a deliberate manual step by the admin, done after the fact. To keep it fast despite being manual, the admin picks the product from a dropdown (populated from the existing catalog) and quantity, rather than retyping product details. Price pre-fills from the catalog but stays editable per receipt, since bargained prices vary sale to sale. A "custom item" option exists alongside the dropdown for off-catalog or bundled sales.

**Stock is a boolean, not a quantity.**
Many vendors are made-to-order — they don't hold fixed inventory counts, so a numeric stock count would constantly be wrong. Stock is a simple in-stock/out-of-stock toggle the vendor flips manually. This means there's no automatic stock decrement tied to receipts (there's no quantity to decrement against) — it's a fully separate, manually maintained field. The storefront respects this toggle by disabling/hiding the buy action on out-of-stock items.

**Products carry a category, but categories aren't a separate managed entity.**
Vendors sell across visually or functionally distinct groups (e.g. "Shoes" vs "Bags", or "Small Chops" vs "Drinks"), and a flat catalog grid gets hard to scan past a dozen or so items. Rather than build a full category CRUD (create/rename/delete/reorder category records — a second admin surface with its own edge cases), `category` is a plain text field on `Product`. The admin product form uses a combobox that suggests categories already used elsewhere in the vendor's own catalog, or lets them type a new one — this keeps naming consistent in practice (no separate "Shoes" vs "shoe" vs "Shoe " typos most of the time) without the overhead of a dedicated table. The storefront reads distinct category values off existing products and renders them as filter pills; there's no scenario where a vendor "manages categories" independent of a product that uses them. If a vendor deletes every product in a category, that category simply stops appearing — there's nothing orphaned to clean up.

**Sharing a receipt uses the OS share sheet, not the WhatsApp Business API.**
There's no way to open WhatsApp with an image pre-attached to a specific contact via a simple link — that's a platform limitation. The Web Share API (`navigator.share` with a file) is used instead: it opens the device's native share sheet, the vendor picks WhatsApp and a contact from there. Works well on mobile (where vendors will mostly use this); desktop has inconsistent support, so a fallback (e.g. plain download) is needed there.

**Receipt images are rendered client-side from the actual React component, not server-side.**
`dom-to-image-more` (the actively maintained fork of the now-stale `html-to-image`) renders the real receipt component — styled with Tailwind, logo, line items, total — into a PNG. What's on screen is what gets exported, so visual polish is a CSS problem, not a rendering-fidelity problem. **Known gotcha:** the vendor logo is served from UploadThing's CDN, a different origin than the app; without `crossOrigin="anonymous"` on the `<img>` tag, the browser will taint the canvas and silently produce a blank/broken logo in the exported image. UploadThing sends CORS headers by default, so this is purely a client-side attribute to remember, not a backend fix. `@vercel/og` (server-side, Satori-based) is the documented fallback if `dom-to-image-more` ever causes rendering headaches in practice, but isn't needed to start — it only supports flexbox layouts and requires fonts as raw buffers, which is more setup than this simple layout warrants.

**Every state-changing action gives the user visible feedback via a toast, not just a UI state change.**
Because both the customer-facing cart and the admin dashboard involve actions with real consequences (a saved receipt, a sent email, an item added to a cart the customer can't see persist anywhere else), silent success/failure is a bad experience — the person is left guessing whether anything happened. `react-toastify` provides a single, consistent, non-blocking notification pattern for both surfaces (storefront and dashboard) rather than ad hoc inline banners or `alert()` calls. This is a UX/feedback layer only — it doesn't change what data is stored or how; see `vendor-buddy-architecture.md` for where toasts hook into the code.

## Stack

- Next.js (App Router) — `next@16.3.3` (Active LTS)
- React 19 (ships with Next 16)
- TypeScript
- Tailwind CSS v4
- shadcn/ui (component registry, not a versioned dependency — installed via CLI per component)
- Clerk — `@clerk/nextjs@7.8.0` (auth; single admin account per instance)
- Prisma — `prisma@7.10.0` / `@prisma/client@7.10.0` (avoid the 8.0 release candidate — not stable yet)
- Neon (serverless Postgres)
- UploadThing — `uploadthing@7.7.4` / `@uploadthing/react@7.3.3` (product images, vendor logo)
- Recharts — `recharts@3.10.1` (sales analytics charts)
- `dom-to-image-more` (receipt → PNG export for download/share/email; actively maintained fork of `html-to-image` — pin whatever is current at install time)
- `react-toastify@11.1.0` (toast notifications for admin + customer feedback)
- Vercel (hosting/deploy)

> Note: JS package versions move fast. Confirm exact current versions with `npm view <package> version` at the time you actually run `npm install`, rather than trusting this file months later.

## Explicitly out of scope for v1

- Payment gateway integration (Paystack) — planned for v2, only for vendors selling fixed-price, on-demand products
- Multi-tenant single deployment serving many vendors
- Automated WhatsApp sending (Business API) — sharing is user-initiated via OS share sheet
- Numeric inventory tracking — boolean stock only
- Order/checkout state persisted server-side
- Category as a first-class managed entity (no separate category table, no create/rename/delete/reorder UI for categories — they're just a field on `Product`, inferred from whatever values are in use)
