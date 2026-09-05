import Link from "next/link";

export default function DashboardPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="space-y-5 text-center">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Vendor Buddy
        </p>
        <h1 className="text-4xl font-semibold tracking-tight">
          Admin dashboard
        </h1>
        <p className="text-muted-foreground">You are signed in.</p>
        <Link
          href="/dashboard/products"
          className="inline-flex h-8 items-center justify-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
        >
          Manage products
        </Link>
        <Link
          href="/dashboard/settings"
          className="ml-2 inline-flex h-8 items-center justify-center rounded-lg border border-border px-3 text-sm font-medium transition-colors hover:bg-muted"
        >
          Settings
        </Link>
      </div>
    </main>
  );
}
