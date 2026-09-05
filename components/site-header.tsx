import Link from "next/link";
import { ShoppingBag } from "lucide-react";

export function SiteHeader({
  businessName = "Vendor Buddy",
}: {
  businessName?: string;
}) {
  return (
    <header className="site-header">
      <div className="shell flex h-20 items-center justify-between gap-6">
        <Link
          href="/"
          className="brand-mark"
          aria-label={`${businessName} home`}
        >
          <span className="brand-mark__dot" aria-hidden="true" />
          <span>{businessName}</span>
        </Link>
        <nav className="flex items-center gap-2" aria-label="Main navigation">
          <Link href="/" className="icon-link" aria-label="View storefront">
            <ShoppingBag className="size-4" />
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function DashboardHeader() {
  return (
    <header className="site-header site-header--admin">
      <div className="shell flex min-h-20 flex-wrap items-center justify-between gap-4 py-3">
        <Link
          href="/dashboard"
          className="brand-mark"
          aria-label="Vendor Buddy dashboard"
        >
          <span className="brand-mark__dot" aria-hidden="true" />
          <span>Vendor Buddy</span>
          <span className="brand-mark__tag">Workspace</span>
        </Link>
        <nav
          className="flex w-full items-center gap-1 overflow-x-auto pb-1 sm:w-auto sm:pb-0"
          aria-label="Admin navigation"
        >
          <Link href="/dashboard" className="nav-link">
            Overview
          </Link>
          <Link href="/dashboard/products" className="nav-link">
            Products
          </Link>
          <Link href="/dashboard/receipts" className="nav-link">
            Receipts
          </Link>
          <Link href="/dashboard/settings" className="nav-link">
            Settings
          </Link>
        </nav>
      </div>
    </header>
  );
}
