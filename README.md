# Vendor Buddy

Vendor Buddy is a simple storefront and sales workspace for small vendors. Customers browse products, build a cart, and pay through Paystack's hosted checkout. Vendors manage products, stock, receipts, analytics, business details, and media from a protected dashboard.

This project is deployed as one instance per vendor. Each deployment has its own database, domain, and admin account; it is not a shared marketplace.

## Features

- Public storefront with categories, product images, stock status, and cart
- Hosted Paystack checkout with server-side price calculation and payment verification
- Signed Paystack webhook handling for payment confirmation
- Admin product management with UploadThing image uploads
- Manual and online receipts with customer/payment details and item snapshots
- Receipt search by customer, item, or total
- Paginated product and receipt lists
- Sales analytics
- Receipt image download and sharing
- Business profile, logo, address, social links, and map settings
- Single-admin Clerk authentication with sign-up locked after the first account

## Tech Stack

- Next.js 16 App Router and React 19
- TypeScript
- Tailwind CSS v4
- Clerk for authentication
- Prisma 7 with PostgreSQL/Neon
- UploadThing for product and business logo images
- Recharts for analytics

## Requirements

- Node.js 20 or newer
- npm
- PostgreSQL database, such as Neon
- Clerk application
- UploadThing application

## Local Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a local environment file:

   ```powershell
   Copy-Item .env.template .env.local
   ```

   On macOS or Linux:

   ```bash
   cp .env.template .env.local
   ```

3. Replace the values in `.env.local` with credentials from your own Clerk, Neon/Postgres, UploadThing, and Paystack projects. Use a Paystack test secret while developing and set `NEXT_PUBLIC_SITE_URL` to the public base URL that Paystack should return to. Never commit `.env.local` or real credentials.

4. Generate the Prisma client and apply migrations:

   ```bash
   npx prisma generate
   npx prisma migrate deploy
   ```

5. Optionally load the demo vendor and products:

   ```bash
   npx prisma db seed
   ```

6. Start the development server:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

The required variable names are listed in `.env.example`:

| Variable                            | Purpose                              |
| ----------------------------------- | ------------------------------------ |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk browser key                    |
| `CLERK_SECRET_KEY`                  | Clerk server key                     |
| `ADMIN_CLERK_USER_ID`               | Optional Clerk user ID or verified email for the admin |
| `DATABASE_URL`                      | PostgreSQL connection string         |
| `UPLOADTHING_TOKEN`                 | UploadThing server token             |
| `PAYSTACK_SECRET_KEY`               | Paystack server-side API key         |
| `NEXT_PUBLIC_SITE_URL`              | Public base URL for payment callbacks, canonical metadata, and the sitemap |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`    | Cloudflare Turnstile site key for the storefront booking request form |
| `TURNSTILE_SECRET_KEY`              | Server-only Turnstile secret used to verify booking form submissions |
| `NEXT_PUBLIC_TAWK_PROPERTY_ID`      | tawk.to property ID for storefront chat support |
| `NEXT_PUBLIC_TAWK_WIDGET_ID`        | tawk.to widget ID (usually `default`) |

Set `ADMIN_CLERK_USER_ID` in `.env.local` to the Clerk user ID (`user_...`) or a verified email address on the admin's Clerk account, then restart the dev server. Do not put this setting only in `.env.template` or `.env.example`; Next.js does not load those template files. When the setting is not set, the first Clerk user is treated as the admin. After an account exists, the sign-up route redirects to sign-in and the sign-in screen does not offer registration. Successful sign-in opens the dashboard; non-admin accounts are redirected to the storefront.

Create a Turnstile widget in Cloudflare and put its site key and secret in `.env.local` and your deployment environment. Booking requests are rejected unless Turnstile validation succeeds. Add the property and widget IDs from your tawk.to widget settings to enable chat; the chat launcher is positioned bottom-left to keep the bottom-right cart button unobstructed. Restart the app after changing environment variables.

## Useful Commands

```bash
npm run dev          # Start the development server
npm run lint         # Run ESLint
npx tsc --noEmit     # Type-check without emitting files
npm run build        # Create a production build
npm run start        # Serve the production build
npx prisma studio    # Inspect the database locally
```

## Main Routes

| Route                     | Purpose                                               |
| ------------------------- | ----------------------------------------------------- |
| `/`                       | Public storefront                                     |
| `/checkout`               | Customer details and payment summary                  |
| `/checkout/callback`      | Verifies Paystack payment before returning to store   |
| `/api/paystack/webhook`   | Signed Paystack payment event endpoint                |
| `/sign-in`                | Admin sign-in                                         |
| `/sign-up`                | First-account setup; redirects once an account exists |
| `/dashboard`              | Admin overview and analytics                          |
| `/dashboard/products`     | Product list, pagination, stock controls              |
| `/dashboard/products/new` | Add a product and upload its image                    |
| `/dashboard/receipts`     | Receipt history, search, and pagination               |
| `/dashboard/receipts/new` | Create a manual receipt                               |
| `/dashboard/settings`     | Business profile and media settings                   |

## Project Structure

```text
app/                    Next.js routes and API handlers
components/             Storefront, dashboard, and shared UI
lib/actions/            Server actions for products, receipts, and settings
lib/                    Auth, checkout, Paystack, Prisma, cart, and analytics helpers
prisma/                 Schema, migrations, and seed data
public/                 Static assets
proxy.ts                Clerk and UploadThing request middleware
```

## Data Model Notes

- A `Vendor` owns products, receipts, and receipt line items.
- Product stock is a manual boolean, not an inventory quantity.
- Receipt line items store name and price snapshots so historical receipts do not change when a product is edited.
- Online checkout creates a pending receipt using database prices; a verified Paystack payment changes it to paid.
- Sales analytics include paid receipts only. Manual receipts remain paid by default.
- Core records include `vendorId` so a future multi-tenant version can evolve without replacing the data model.

## Deployment

For a Vercel deployment:

1. Import the repository into Vercel.
2. Add the environment variables from `.env.local` to the Vercel project settings.
3. Use a production PostgreSQL database and run `npx prisma migrate deploy` during deployment or as a release step.
4. Set `PAYSTACK_SECRET_KEY` and `NEXT_PUBLIC_SITE_URL` in the deployment environment. Use the canonical public HTTPS URL; it is used for payment callbacks, storefront metadata, and `robots.txt`/`sitemap.xml`.
5. Configure `https://your-domain/api/paystack/webhook` as the Paystack webhook URL.
6. Configure the production URL in Clerk and UploadThing, and confirm UploadThing is configured for production.

Before a production launch, rotate any credentials exposed during development and verify that no secrets are committed to Git.
