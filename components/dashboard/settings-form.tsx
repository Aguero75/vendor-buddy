"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { UploadButton } from "@uploadthing/react";
import { FloppyDiskIcon } from "@phosphor-icons/react";

import type { OurFileRouter } from "@/app/api/uploadthing/core";
import { Button } from "@/components/ui/button";
import { saveSettings } from "@/lib/actions/settings";
import {
  confirmEmailChange,
  requestEmailChange,
} from "@/lib/actions/receipt-security";

type SettingsFormProps = {
  settings: {
    businessName: string;
    motto: string | null;
    whatsappNumber: string;
    logoUrl: string | null;
    address: string | null;
    mapUrl: string | null;
    instagramUrl: string | null;
    facebookUrl: string | null;
    tiktokUrl: string | null;
    ownerEmail: string | null;
    lowStockThreshold: number;
    availableForBookings: boolean;
  };
};

export function SettingsForm({ settings }: SettingsFormProps) {
  const router = useRouter();
  const [logoUrl, setLogoUrl] = useState(settings.logoUrl ?? "");
  const [ownerEmail, setOwnerEmail] = useState(settings.ownerEmail ?? "");
  const [newOwnerEmail, setNewOwnerEmail] = useState(settings.ownerEmail ?? "");
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailCodesRequested, setEmailCodesRequested] = useState(false);
  const [currentCode, setCurrentCode] = useState("");
  const [newCode, setNewCode] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    formData.set("logoUrl", logoUrl);
    formData.set("ownerEmail", ownerEmail);

    startTransition(async () => {
      const result = await saveSettings(formData);

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success("Settings updated");
    });
  }

  function handleRequestEmailChange() {
    startTransition(async () => {
      const result = await requestEmailChange(newOwnerEmail);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setEmailCodesRequested(true);
      toast.success("Verification codes sent to both email addresses");
    });
  }

  function handleConfirmEmailChange() {
    startTransition(async () => {
      const result = await confirmEmailChange(currentCode, newCode);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setOwnerEmail(newOwnerEmail.trim().toLowerCase());
      setEmailDialogOpen(false);
      setEmailCodesRequested(false);
      setCurrentCode("");
      setNewCode("");
      router.refresh();
      toast.success("Owner email updated");
    });
  }

  return (
    <form action={handleSubmit} className="space-y-7">
      <input type="hidden" name="logoUrl" value={logoUrl} />
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="space-y-2 sm:col-span-2">
          <span className="text-sm font-medium">Business name</span>
          <input
            required
            name="businessName"
            defaultValue={settings.businessName}
            className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/20"
          />
        </label>

        <label className="space-y-2 sm:col-span-2">
          <span className="text-sm font-medium">Motto</span>
          <input
            name="motto"
            defaultValue={settings.motto ?? ""}
            placeholder="A short line customers will remember"
            className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/20"
          />
        </label>

        <label className="space-y-2 sm:col-span-2">
          <span className="text-sm font-medium">WhatsApp number</span>
          <input
            required
            name="whatsappNumber"
            defaultValue={settings.whatsappNumber}
            placeholder="+2348012345678"
            className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/20"
          />
          <span className="block text-xs text-muted-foreground">
            Include the country code so customer checkout links work everywhere.
          </span>
        </label>

        <label className="space-y-2 sm:col-span-2">
          <span className="text-sm font-medium">Address</span>
          <input
            name="address"
            defaultValue={settings.address ?? ""}
            placeholder="12 Market Street, Lagos"
            className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/20"
          />
        </label>

        <label className="space-y-2 sm:col-span-2">
          <span className="text-sm font-medium">Map link</span>
          <input
            name="mapUrl"
            type="url"
            defaultValue={settings.mapUrl ?? ""}
            placeholder="https://maps.google.com/..."
            className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/20"
          />
        </label>
      </div>

      <div className="space-y-4 border-t border-border pt-6">
        <div>
          <h2 className="font-semibold">Social links</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Add the profiles customers can use to keep up with your business.
          </p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          {[
            {
              name: "instagramUrl",
              label: "Instagram",
              value: settings.instagramUrl,
            },
            {
              name: "facebookUrl",
              label: "Facebook",
              value: settings.facebookUrl,
            },
            { name: "tiktokUrl", label: "TikTok", value: settings.tiktokUrl },
          ].map(({ name, label, value }) => (
            <label key={name} className="space-y-2">
              <span className="text-sm font-medium">{label}</span>
              <input
                name={name}
                type="url"
                defaultValue={value ?? ""}
                placeholder="https://..."
                className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/20"
              />
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-3 border-t border-border pt-6">
        <div>
          <h2 className="font-semibold">Business logo</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload a square image up to 8MB.
          </p>
        </div>
        {logoUrl ? (
          <div className="relative size-24 overflow-hidden rounded-xl border border-border bg-muted">
            <Image
              src={logoUrl}
              alt="Business logo preview"
              fill
              unoptimized
              crossOrigin="anonymous"
              className="object-cover"
            />
          </div>
        ) : null}
        <UploadButton<OurFileRouter, "logoUploader">
          endpoint="logoUploader"
          onClientUploadComplete={(files) => {
            const uploadedUrl = files[0]?.ufsUrl;

            if (uploadedUrl) {
              setLogoUrl(uploadedUrl);
              toast.success("Image uploaded");
            }
          }}
          onUploadError={(error) => {
            toast.error(
              error.message || "Upload failed — try a different image",
            );
          }}
          appearance={{
            button:
              "rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-muted",
            allowedContent: "text-xs text-muted-foreground",
          }}
        />
      </div>

      <div className="grid gap-5 border-t border-border pt-6 sm:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-medium">Owner email for security codes</span>
          <input
            type="email"
            name="ownerEmail"
            maxLength={254}
            value={ownerEmail}
            onChange={(event) => setOwnerEmail(event.target.value)}
            disabled={Boolean(settings.ownerEmail)}
            placeholder="owner@example.com"
            className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/20 disabled:opacity-70"
          />
          <span className="block text-xs text-muted-foreground">
            Used to approve receipt voids and store email changes. Add it now; changing it later requires codes from both inboxes.
          </span>
        </label>
        {settings.ownerEmail ? (
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => {
                setNewOwnerEmail(settings.ownerEmail ?? "");
                setEmailCodesRequested(false);
                setEmailDialogOpen(true);
              }}
              className="h-11 rounded-lg border border-border px-4 text-sm font-medium transition-colors hover:bg-muted"
            >
              Change owner email
            </button>
          </div>
        ) : null}
        <label className="space-y-2">
          <span className="text-sm font-medium">Low-stock alert level</span>
          <input
            type="number"
            name="lowStockThreshold"
            min="0"
            max="1000000"
            step="1"
            defaultValue={settings.lowStockThreshold}
            className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/20"
          />
          <span className="block text-xs text-muted-foreground">
            Tracked products at or below this number show a low-stock badge.
          </span>
        </label>
      </div>

      <div className="space-y-3 border-t border-border pt-6">
        <div>
          <h2 className="font-semibold">Event bookings</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Show a booking request form on your storefront. Requests are sent to
            your owner email.
          </p>
        </div>
        <label className="flex items-start gap-3 rounded-lg border border-border bg-background p-4">
          <input type="hidden" name="availableForBookings" value="false" />
          <input
            type="checkbox"
            name="availableForBookings"
            value="true"
            defaultChecked={settings.availableForBookings}
            className="mt-0.5 size-4 accent-primary"
          />
          <span>
            <span className="block text-sm font-medium">
              Accept event booking requests
            </span>
            <span className="mt-1 block text-xs text-muted-foreground">
              Turn this off any time to remove the form from your storefront.
            </span>
          </span>
        </label>
      </div>

      <div className="border-t border-border pt-5">
        <Button
          type="submit"
          disabled={isPending}
          size="lg"
          className="gap-2"
        >
          <FloppyDiskIcon
            className="size-4"
            weight="duotone"
            aria-hidden="true"
          />
          {isPending ? "Saving..." : "Save settings"}
        </Button>
      </div>

      {emailDialogOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 px-4 backdrop-blur-sm"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isPending) {
              setEmailDialogOpen(false);
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="change-owner-email-title"
            className="w-full max-w-md space-y-5 rounded-2xl border border-border bg-card p-6 shadow-xl"
          >
            <div>
              <h2
                id="change-owner-email-title"
                className="text-lg font-semibold"
              >
                Change owner email
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                A code will be sent to the current address and another to the new address.
              </p>
            </div>
            {!emailCodesRequested ? (
              <>
                <label className="block space-y-2">
                  <span className="text-sm font-medium">New email address</span>
                  <input
                    type="email"
                    value={newOwnerEmail}
                    maxLength={254}
                    onChange={(event) => setNewOwnerEmail(event.target.value)}
                    className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/20"
                  />
                </label>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => setEmailDialogOpen(false)}
                    className="h-10 rounded-lg px-3 text-sm font-medium hover:bg-muted disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={handleRequestEmailChange}
                    className="h-10 rounded-lg bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-50"
                  >
                    {isPending ? "Sending…" : "Send codes"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <label className="block space-y-2">
                  <span className="text-sm font-medium">Code sent to current email</span>
                  <input
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={currentCode}
                    onChange={(event) => setCurrentCode(event.target.value.replace(/\D/g, ""))}
                    className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm tracking-[0.3em] outline-none focus:border-ring focus:ring-3 focus:ring-ring/20"
                  />
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-medium">Code sent to new email</span>
                  <input
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={newCode}
                    onChange={(event) => setNewCode(event.target.value.replace(/\D/g, ""))}
                    className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm tracking-[0.3em] outline-none focus:border-ring focus:ring-3 focus:ring-ring/20"
                  />
                </label>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => setEmailDialogOpen(false)}
                    className="h-10 rounded-lg px-3 text-sm font-medium hover:bg-muted disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={handleConfirmEmailChange}
                    className="h-10 rounded-lg bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-50"
                  >
                    {isPending ? "Verifying…" : "Confirm change"}
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      ) : null}
    </form>
  );
}
