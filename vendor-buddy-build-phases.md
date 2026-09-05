# Vendor Buddy v1 — Phased Build Plan

Companion to `vendor-buddy-project-context.md`, `vendor-buddy-planning.md`, and `vendor-buddy-architecture.md`. Each phase below has a goal, what to build, what it depends on, and a **verification checklist** — the point of the checklist is to catch a broken assumption (wrong env var, missing CORS attribute, wrong Server Action shape) before it's buried under three more phases of code built on top of it. Don't start a phase until the previous phase's checklist passes.

---

### Phase 0 — Scaffold & environment verification

**Build:**

- `next@16.3.3` + TypeScript + Tailwind v4 + shadcn/ui init
- Prisma connected to a real Neon database (not just configured — an actual successful `prisma db push` or migration against it)
- Clerk installed and wired, one test sign-in working
- `react-toastify@11.1.0` installed, `<ToastContainer />` added to the root layout, and one throwaway `toast.success("It works")` button to confirm it renders

**Depends on:** nothing.

**Verify before moving on:**

- [ ] `npx prisma studio` (or equivalent) shows the Neon DB is actually reachable, not just that the connection string is set
- [ ] A Clerk sign-in round-trip succeeds end-to-end (not just that the component renders)
- [ ] The throwaway toast actually appears on screen, confirming `ToastContainer` placement works before any real feature depends on it
- [ ] `npm view` was actually run for every pinned package to confirm the versions in planning.md's stack list still resolve

---

### Phase 1 — Database schema

**Build:**

- Full `prisma/schema.prisma`: `Vendor`, `Product` (including nullable `category` field), `Receipt`, `ReceiptLineItem` — exactly as specified in planning.md section 2
- Seed script that creates one `Vendor` row and a handful of `Product` rows across at least two different categories plus one with `category = null`, so category-filtering logic has real mixed data to test against from Phase 3 onward

**Depends on:** Phase 0 (working Neon connection).

**Verify before moving on:**

- [ ] Migration applies cleanly to a fresh database (not just to a DB that already has manually-added columns from experimentation)
- [ ] Seed data includes: a product with a category, a different product with a different category, and a product with `category = null` — this specific mix is what later exposes bugs in the "distinct categories" query and the "Uncategorized" pill logic
- [ ] `vendorId` is present on every table per the multi-tenant-readiness decision, even though only one vendor row exists

---

### Phase 2 — Auth: single-admin enforcement

**Build:**

- `/dashboard/*` route guard via Clerk middleware/layout
- Sign-up disabled or gated so a second admin account can't be created
- Public storefront routes explicitly excluded from the auth matcher

**Depends on:** Phase 0.

**Verify before moving on:**

- [ ] Visiting `/dashboard` while signed out redirects to sign-in
- [ ] Visiting `/` (storefront) while signed out works with no auth prompt at all
- [ ] Attempting to create a second admin account is actually blocked, not just "not exposed in the UI" — check for a route or API path that could still allow it

---

### Phase 3 — Admin: Products CRUD (including category)

**Build:**

- Server Actions: create, update, delete, toggle-in-stock — each returning the `{ ok, data | message }` shape from architecture.md
- Product form with category combobox (suggests existing categories from the vendor's own products, accepts free text)
- Products list page with category shown per row
- Toasts wired for every action per the matrix in planning.md section 4a (success and at least one failure path each — e.g. submit with a missing required field, and simulate a DB error if feasible)

**Depends on:** Phase 1 (schema + seed data), Phase 2 (route protection).

**Verify before moving on:**

- [ ] Creating a product with a brand-new category string works, and that category then appears as a suggestion the next time the combobox opens
- [ ] Editing a product to change its category doesn't affect any other product
- [ ] Deleting the only product using a given category means that category no longer appears anywhere (nothing orphaned, because nothing was ever a separate row)
- [ ] Every one of: create success, create failure, update success, update failure, delete success, toggle-stock success produces the correct toast from the matrix — check this one by one, not just "toasts show up somewhere"

---

### Phase 4 — Public storefront + category filter

**Build:**

- Catalog grid pulling from `Product`, respecting `inStock`
- Category filter pills derived from distinct category values in the vendor's catalog, driven by `?category=` query param
- "Uncategorized" pill only appears if at least one product has `category = null`

**Depends on:** Phase 3 (real product data with mixed categories to filter against).

**Verify before moving on:**

- [ ] Selecting a category pill filters the grid and updates the URL; reloading that URL preserves the filter (confirms it's not just client-side-only state)
- [ ] "All" shows every product regardless of category, including uncategorized ones
- [ ] Out-of-stock products still show but with the buy action disabled/greyed, in every category view, not just the unfiltered one
- [ ] Deleting the last product in a category (from the dashboard, Phase 3) makes that pill disappear from the storefront on next load

---

### Phase 5 — Cart + WhatsApp checkout

**Build:**

- `CartProvider` (React Context, in-memory only)
- Add/remove/adjust-quantity UI
- WhatsApp message formatting/truncation logic (planning.md section 4), `wa.me` handoff
- Toasts: add-to-cart, remove-from-cart, cart-cap-reached, checkout-link-fails

**Depends on:** Phase 4 (real catalog to add items from).

**Verify before moving on:**

- [ ] Adding the same product twice increments quantity rather than creating a duplicate line
- [ ] Refreshing the page clears the cart (confirms it's genuinely in-memory, not accidentally persisted)
- [ ] The ≤5-items and >5-items message formats both produce a `wa.me` URL that, once `encodeURIComponent`-ed, stays under ~1,500 characters — test with a cart at the ~12–15 item cap specifically, since that's the worst case
- [ ] Adding item #13+ triggers the cap warning toast rather than silently allowing unlimited items

---

### Phase 6 — Settings page

**Build:**

- Business name, logo upload (UploadThing), motto, WhatsApp number form
- Save Server Action + toast (success/failure)

**Depends on:** Phase 2 (route protection). Independent of Phases 3–5, but must be done before Phase 7, since receipts render vendor branding.

**Verify before moving on:**

- [ ] Uploaded logo URL is retrievable and renders correctly on the storefront immediately after save (no stale cache issue)
- [ ] Saving with an invalid WhatsApp number format is rejected with a specific error toast, not a silent no-op
- [ ] The logo `<img>` used elsewhere (storefront, receipts) is confirmed to load from the UploadThing URL saved here — this is the value Phase 8's CORS handling depends on being correct

---

### Phase 7 — Receipt generator

**Build:**

- "New Receipt" flow: product dropdown (autofills name/price) or custom item, quantity, editable price, multiple line items per receipt
- Save Server Action persisting `Receipt` + `ReceiptLineItem` rows with `nameSnapshot`/`unitPrice` snapshotted at save time
- Receipt history list
- Save toast (success/failure)

**Depends on:** Phase 3 (products to select from), Phase 6 (vendor branding needs to exist for receipts to look right, even though the receipt row itself doesn't need it yet).

**Verify before moving on:**

- [ ] After saving a receipt, edit or delete the product it referenced — the saved receipt's line item still shows the original name and price, proving the snapshot actually decoupled from live `Product` data
- [ ] A receipt with only a custom item (no `productId`) saves and displays correctly
- [ ] A receipt with a mix of catalog items and a custom item in the same receipt saves correctly

---

### Phase 8 — Receipt actions: export, share, email

**Build:**

- `<ReceiptCard />` component rendering the saved receipt with vendor branding
- `dom-to-image-more` export to PNG, **with `crossOrigin="anonymous"` on the logo `<img>` tag** — this is the single most likely silent failure in the whole app, verify it explicitly, don't assume
- Download action
- Share action via `navigator.share`, with `navigator.canShare` fallback to download
- Email action via a Resend-backed Server Action / route handler
- Toasts for all three actions per the matrix, including the "shared unsupported, fell back to download" info toast

**Depends on:** Phase 7 (a real saved receipt to export), Phase 6 (real logo URL to test the CORS behavior against — testing this with a placeholder image won't catch the bug).

**Verify before moving on:**

- [ ] Export a receipt for a vendor with a logo actually uploaded via UploadThing (not a local/placeholder image) and confirm the logo appears in the exported PNG — this is the specific check that catches a missing `crossOrigin` attribute
- [ ] Test the share action on both a mobile browser (where `navigator.share` with files should work) and a desktop browser (where it should cleanly fall back to download with the correct info toast, not throw)
- [ ] Send a test email and confirm the attachment is a valid, openable PNG, not a corrupted or empty file
- [ ] Deliberately send to a malformed email address and confirm the specific error toast appears rather than a generic failure or a silent no-op

---

### Phase 9 — Analytics

**Build:**

- Daily sales total and top-selling-products bar charts (Recharts) on Overview/Receipts, driven entirely by saved `Receipt`/`ReceiptLineItem` data

**Depends on:** Phase 7 (needs real receipt data to chart).

**Verify before moving on:**

- [ ] Charts update after a new receipt is saved without a full page reload being required (or confirm a reload is the intended behavior, and that it does refresh correctly)
- [ ] A day with zero receipts renders an empty/zero state on the chart rather than an error or a broken axis

---

### Phase 10 — Polish

**Build:**

- Empty states (no products yet, no receipts yet, no categories yet)
- Mobile responsiveness pass across storefront and dashboard (vendors will mostly use this on phones)
- Loading states for in-flight Server Actions (separate from, and not replaced by, toasts — see architecture.md section 6)
- Final toast wording pass across the full matrix for consistency
- clean Navbar with modern design and look that matches the project
- clean footer with links and texts that make absolute sense to the project
- the navbar and footer also can be seen in the admin page if necessary
- check the full design , colors , fonts and look and make sure everything is posh , sleek and very modern layout and designs

**Depends on:** all previous phases.

**Verify before moving on:**

- [ ] Every list/grid in the app (products, receipts, category pills) has a deliberate empty state, not a blank area
- [ ] A full walkthrough on an actual mobile device (or accurate emulation) of: browse storefront → filter by category → add to cart → checkout, and separately: admin login → add product with category → generate receipt → export/share/email
- [ ] No action anywhere in the app fails silently — every Server Action's failure path was actually triggered once during this phase and confirmed to produce a toast, not just reviewed in code

---

## Notes on using this plan for code generation

- Treat each phase as a separate build/review cycle rather than generating the whole app in one pass — the verification checklist is only useful if it's actually run before moving to the next phase's code.
- If a phase's checklist fails, fix it in that phase before writing any code for the next one. A category bug caught in Phase 4 is a small fix; the same bug discovered in Phase 10 means retesting everything downstream that touched categories.
- Phases 3–8 are the ones most worth being strict about, since they're where Server Actions, toasts, and the category/receipt-export decisions all intersect — that's also where the project-context.md decisions (snapshotting, CORS, stateless cart) are easiest to accidentally violate under time pressure.
