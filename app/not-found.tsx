import Link from "next/link";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex flex-1 items-center px-5 py-16 sm:px-8 sm:py-24">
        <div className="shell w-full">
          <section className="relative overflow-hidden rounded-3xl border border-border bg-card px-6 py-14 shadow-sm sm:px-12 sm:py-20">
            <div
              className="absolute -right-16 -top-24 size-72 rounded-full bg-accent/30 blur-3xl"
              aria-hidden="true"
            />
            <div className="relative max-w-xl space-y-6">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Error 404
              </p>
              <h1 className="font-display text-5xl leading-[0.98] tracking-tight sm:text-7xl">
                This page took a wrong turn.
              </h1>
              <p className="max-w-md text-base leading-7 text-muted-foreground">
                The page you are looking for is not here, but there is plenty
                more to browse.
              </p>
              <Link
                href="/"
                className="inline-flex h-11 items-center justify-center rounded-lg bg-primary px-5 text-sm font-bold text-primary-foreground transition-transform hover:-translate-y-0.5"
              >
                Back to the storefront
              </Link>
            </div>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
