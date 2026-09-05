import Link from "next/link";

export function SiteFooter({
  businessName = "Vendor Buddy",
}: {
  businessName?: string;
}) {
  return (
    <footer className="site-footer">
      <div className="shell flex flex-col gap-5 py-8 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="brand-mark text-sm">
            <span className="brand-mark__dot" aria-hidden="true" />
            <span>{businessName}</span>
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            A simpler way to sell what you make.
          </p>
        </div>
        <div className="flex items-center gap-5 text-sm text-muted-foreground">
          <Link href="/" className="hover:text-foreground">
            Storefront
          </Link>
          <Link href="/dashboard" className="hover:text-foreground">
            Admin
          </Link>
        </div>
      </div>
    </footer>
  );
}
