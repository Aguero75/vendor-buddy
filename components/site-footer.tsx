import Link from "next/link";
import Image from "next/image";
import facebook from "@/public/facebook-color-svgrepo-com.svg";
import instagram from "@/public/instagram-1-svgrepo-com.svg";
import tiktok from "@/public/tiktok-logo-logo-svgrepo-com.svg";
import whatsapp from "@/public/whatsapp-svgrepo-com.svg";
import location from "@/public/location-svgrepo-com (1).svg";
import direction from "@/public/location-pin-svgrepo-com.svg";

export function SiteFooter({
  businessName = "Vendor Buddy by Tony",
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
    { href: instagramUrl, label: "Instagram", icon: instagram },
    { href: facebookUrl, label: "Facebook", icon: facebook },
    { href: tiktokUrl, label: "TikTok", icon: tiktok },
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
              A simpler way to find and order what you love with ease.
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
          <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-foreground">
            easily by visiting our social pages
          </h2>
          <div className="space-y-4 text-sm text-muted-foreground">
            {address ? (
              <div className="flex items-start gap-3">
                <Image
                  src={direction}
                  alt="Get directions"
                  className="size-4"
                />
                <span className="min-w-0 leading-6">{address}</span>
              </div>
            ) : null}
            {mapUrl ? (
              <a
                href={mapUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 font-semibold text-foreground transition-colors hover:text-primary"
              >
                <Image src={location} alt="location pin" className="size-4" />
                Get directions
              </a>
            ) : null}
            {whatsappNumber ? (
              <a
                href={`https://wa.me/${whatsappNumber.replace(/\D/g, "")}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 transition-colors hover:text-foreground"
              >
                <Image src={whatsapp} alt={whatsappNumber} className="size-4" />
                Book us for events on WhatsApp
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
                  <Image src={Icon} alt={label} className="size-4" />
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
