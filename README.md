# Vendor Buddy

Vendor Buddy is a simple storefront and sales workspace for small vendors. Customers browse products, build a cart, and send an order through WhatsApp. Vendors manage products, stock, receipts, analytics, business details, and media from a protected dashboard.

This project is deployed as one instance per vendor. Each deployment has its own database, domain, and admin account; it is not a shared marketplace.

## Features

- Public storefront with categories, product images, stock status, and cart
- WhatsApp checkout message generation
- Admin product management with UploadThing image uploads
- Manual receipt creation with custom prices and line items
- Receipt search by customer, item, or total
- Paginated product and receipt lists
- Sales analytics
- Receipt image download, sharing, and email delivery
- Business profile, logo, address, social links, and map settings
- Single-admin Clerk authentication with sign-up locked after the first account

## Tech Stack

- Next.js 16 App Router and React 19
- TypeScript
- Tailwind CSS v4
- Clerk for authentication
- Prisma 7 with PostgreSQL/Neon
- UploadThing for product and business logo images
- Resend for emailed receipts
- Recharts for analytics

## Requirements

- Node.js 20 or newer
- npm
- PostgreSQL database, such as Neon
- Clerk application
- UploadThing application
- Resend account if receipt email is required

## Local Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a local environment file:

   ```powershell
   Copy-Item .env.example .env.local
   ```

   On macOS or Linux:

   ```bash
   cp .env.example .env.local
   ```

3. Replace the values in `.env.local` with credentials from your own Clerk, Neon/Postgres, UploadThing, and Resend projects. Never commit `.env.local` or real credentials.

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

| Variable                            | Purpose                                    |
| ----------------------------------- | ------------------------------------------ |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk browser key                          |
| `CLERK_SECRET_KEY`                  | Clerk server key                           |
| `ADMIN_CLERK_USER_ID`               | Optional explicit admin user ID            |
| `DATABASE_URL`                      | PostgreSQL connection string               |
| `UPLOADTHING_TOKEN`                 | UploadThing server token                   |
| `RESEND_API_KEY`                    | Resend API key for emailed receipts        |
| `RESEND_FROM_EMAIL`                 | Verified sender address for receipt emails |

When `ADMIN_CLERK_USER_ID` is not set, the first Clerk user is treated as the admin. After an account exists, the sign-up route redirects to sign-in and the sign-in screen does not offer registration.

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
lib/                    Auth, Prisma, cart, analytics, and messaging helpers
prisma/                 Schema, migrations, and seed data
public/                 Static assets
proxy.ts                Clerk and UploadThing request middleware
```

## Data Model Notes

- A `Vendor` owns products, receipts, and receipt line items.
- Product stock is a manual boolean, not an inventory quantity.
- Receipt line items store name and price snapshots so historical receipts do not change when a product is edited.
- Checkout does not create an order in the database; it builds a WhatsApp message.
- Core records include `vendorId` so a future multi-tenant version can evolve without replacing the data model.

## Deployment

For a Vercel deployment:

1. Import the repository into Vercel.
2. Add the environment variables from `.env.local` to the Vercel project settings.
3. Use a production PostgreSQL database and run `npx prisma migrate deploy` during deployment or as a release step.
4. Configure the production URL in Clerk and UploadThing.
5. Confirm that the UploadThing and Resend sender domains are configured for production.

Before a production launch, rotate any credentials exposed during development and verify that no secrets are committed to Git.
