import Link from "next/link";

import { SettingsForm } from "@/components/dashboard/settings-form";
import { prisma } from "@/lib/prisma";

export default async function SettingsPage() {
  const vendor = await prisma.vendor.findFirst({
    orderBy: { createdAt: "asc" },
    select: {
      businessName: true,
      motto: true,
      whatsappNumber: true,
      logoUrl: true,
      address: true,
      mapUrl: true,
      instagramUrl: true,
      facebookUrl: true,
      tiktokUrl: true,
    },
  });

  if (!vendor) {
    return (
      <main className="min-h-screen px-5 py-10 sm:px-8">
        <p className="text-muted-foreground">
          Vendor settings are unavailable.
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-muted/30 px-5 py-10 sm:px-8">
      <div className="mx-auto max-w-3xl space-y-8">
        <header className="space-y-3">
          <Link
            href="/dashboard"
            className="inline-flex h-8 items-center justify-center rounded-lg px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            ← Dashboard
          </Link>
          <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">
            Keep your storefront identity and checkout contact details current.
          </p>
        </header>
        <div className="rounded-xl border border-border bg-card p-5 sm:p-8">
          <SettingsForm settings={vendor} />
        </div>
      </div>
    </main>
  );
}
