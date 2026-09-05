import Link from "next/link";
import { AtSign, Globe2, MapPin, MessageCircle, Music2 } from "lucide-react";

export function SiteFooter({
  businessName = "Vendor Buddy",
  address,
  mapUrl,
  whatsappNumber,
  instagramUrl,
  facebookUrl,
  tiktokUrl,
}: {
  businessName?: string;
  address?: string | null;
  mapUrl?: string | null;
  whatsappNumber?: string | null;
  instagramUrl?: string | null;
  facebookUrl?: string | null;
  tiktokUrl?: string | null;
}) {
  const socialLinks = [
    { href: instagramUrl, label: "Instagram", icon: AtSign },
    { href: facebookUrl, label: "Facebook", icon: Globe2 },
    { href: tiktokUrl, label: "TikTok", icon: Music2 },
  ].filter((link) => link.href);

  return (
    <footer className="site-footer">
      <div className="shell grid gap-10 py-10 sm:grid-cols-[1.3fr_1fr] sm:py-12 lg:grid-cols-[1.4fr_1fr_1fr]">
        <div className="space-y-4">
          <div>
            <p className="brand-mark text-sm">
              <span className="brand-mark__dot" aria-hidden="true" />
              <span>{businessName}</span>
            </p>
            <p className="mt-3 max-w-xs text-sm leading-6 text-muted-foreground">
              A simpler way to find and order what you love.
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            {new Date().getFullYear()} {businessName}. All rights reserved.
          </p>
        </div>

        <div className="space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-foreground">
            Find us
          </h2>
          <div className="space-y-3 text-sm text-muted-foreground">
            {address ? (
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
                <span>{address}</span>
              </div>
            ) : null}
            {mapUrl ? (
              <a
                href={mapUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 font-semibold text-foreground transition-colors hover:text-primary"
              >
                <MapPin className="size-4 text-primary" />
                Get directions
              </a>
            ) : null}
            {whatsappNumber ? (
              <a
                href={`https://wa.me/${whatsappNumber.replace(/\D/g, "")}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 transition-colors hover:text-foreground"
              >
                <MessageCircle className="size-4 text-primary" />
                Chat on WhatsApp
              </a>
            ) : null}
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-foreground">
            Follow along
          </h2>
          {socialLinks.length ? (
            <div className="flex flex-wrap gap-2">
              {socialLinks.map(({ href, label, icon: Icon }) => (
                <a
                  key={label}
                  href={href!}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={label}
                  className="inline-flex size-10 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                >
                  <Icon className="size-4" />
                </a>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              New updates and products are on the way.
            </p>
          )}
          <Link
            href="/"
            className="inline-flex text-sm font-semibold text-foreground transition-colors hover:text-primary"
          >
            Browse the storefront
          </Link>
        </div>
      </div>
    </footer>
  );
}
