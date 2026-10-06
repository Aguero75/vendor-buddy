"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, ShoppingBag, X } from "lucide-react";
import { usePathname } from "next/navigation";
import {
  GearSixIcon,
  HouseIcon,
  ListIcon,
  PackageIcon,
  ReceiptIcon,
  XIcon,
} from "@phosphor-icons/react";

import { SignOutButton } from "@/components/dashboard/sign-out-button";

export function SiteHeader({
  businessName = "Vendor Buddy",
}: {
  businessName?: string;
}) {
  const [open, setOpen] = useState(false);

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

        <nav
          className="hidden items-center gap-2 sm:flex"
          aria-label="Main navigation"
        >
          <Link href="/" className="icon-link" aria-label="View storefront">
            <ShoppingBag className="size-4" />
          </Link>
        </nav>

        <button
          type="button"
          className="icon-link sm:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((prev) => !prev)}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {open && (
        <nav
          className="flex flex-col gap-1 border-t border-black/10 px-6 py-3 sm:hidden"
          aria-label="Main navigation"
        >
          <Link
            href="/"
            className="nav-link flex items-center gap-2"
            onClick={() => setOpen(false)}
          >
            <ShoppingBag className="size-4" />
            <span>Storefront</span>
          </Link>
        </nav>
      )}
    </header>
  );
}

const dashboardLinks = [
  { href: "/dashboard", label: "Overview", icon: HouseIcon },
  { href: "/dashboard/products", label: "Products", icon: PackageIcon },
  { href: "/dashboard/receipts", label: "Receipts", icon: ReceiptIcon },
  { href: "/dashboard/settings", label: "Settings", icon: GearSixIcon },
];

export function DashboardHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  function isActive(href: string) {
    return href === "/dashboard"
      ? pathname === href
      : pathname === href || pathname.startsWith(`${href}/`);
  }

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
          <span className="brand-mark__tag">Workspace Overview</span>
        </Link>

        <nav
          className="hidden items-center gap-1 overflow-x-auto sm:flex"
          aria-label="Admin navigation"
        >
          {dashboardLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive(link.href) ? "page" : undefined}
              className={`nav-link ${isActive(link.href) ? "bg-background/10 text-background" : ""}`}
            >
              <link.icon
                className="size-4 shrink-0 text-accent"
                weight="duotone"
                aria-hidden="true"
              />
              {link.label}
            </Link>
          ))}
          <SignOutButton />
        </nav>

        <button
          type="button"
          className="icon-link sm:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((prev) => !prev)}
        >
          {open ? (
            <XIcon className="size-5" weight="bold" aria-hidden="true" />
          ) : (
            <ListIcon className="size-5" weight="duotone" aria-hidden="true" />
          )}
        </button>
      </div>

      {open && (
        <nav
          className="flex flex-col gap-1 border-t border-black/10 px-6 py-3 sm:hidden"
          aria-label="Admin navigation"
        >
          {dashboardLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive(link.href) ? "page" : undefined}
              className={`nav-link ${isActive(link.href) ? "bg-background/10 text-background" : ""}`}
              onClick={() => setOpen(false)}
            >
              <link.icon
                className="size-4 shrink-0 text-accent"
                weight="duotone"
                aria-hidden="true"
              />
              {link.label}
            </Link>
          ))}
          <SignOutButton />
        </nav>
      )}
    </header>
  );
}
