"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import { toast } from "react-toastify";
import { UploadButton } from "@uploadthing/react";

import type { OurFileRouter } from "@/app/api/uploadthing/core";
import { Button } from "@/components/ui/button";
import { saveSettings } from "@/lib/actions/settings";

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
  };
};

export function SettingsForm({ settings }: SettingsFormProps) {
  const [logoUrl, setLogoUrl] = useState(settings.logoUrl ?? "");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    formData.set("logoUrl", logoUrl);

    startTransition(async () => {
      const result = await saveSettings(formData);

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success("Settings updated");
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

      <div className="border-t border-border pt-5">
        <Button type="submit" disabled={isPending} size="lg">
          {isPending ? "Saving..." : "Save settings"}
        </Button>
      </div>
    </form>
  );
}
