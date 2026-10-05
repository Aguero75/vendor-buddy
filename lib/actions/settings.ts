"use server";

import { revalidatePath } from "next/cache";

import { checkAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/lib/actions/products";

function isValidWhatsAppNumber(value: string) {
  const normalized = value.replace(/[\s()-]/g, "");
  return /^\+?[0-9]{10,15}$/.test(normalized);
}

type OptionalUrlResult = { value: string | null; error?: string };

function getOptionalHttpsUrl(formData: FormData, name: string) {
  const value = String(formData.get(name) ?? "").trim();

  if (!value) {
    return { value: null } satisfies OptionalUrlResult;
  }

  try {
    const parsed = new URL(value);

    if (parsed.protocol !== "https:") {
      return { value: null, error: `${name} must use HTTPS.` };
    }

    return { value } satisfies OptionalUrlResult;
  } catch {
    return { value: null, error: `${name} must be a valid URL.` };
  }
}

export async function saveSettings(formData: FormData): Promise<ActionResult> {
  try {
    const admin = await checkAdmin();

    if (!admin.authorized) {
      return {
        ok: false,
        message: "You are not authorized to manage this vendor.",
      };
    }

    const vendor = await prisma.vendor.findFirst({
      orderBy: { createdAt: "asc" },
    });

    if (!vendor) {
      return { ok: false, message: "Vendor settings could not be found." };
    }

    const businessName = String(formData.get("businessName") ?? "").trim();
    const motto = String(formData.get("motto") ?? "").trim();
    const whatsappNumber = String(formData.get("whatsappNumber") ?? "").trim();
    const logoUrl = String(formData.get("logoUrl") ?? "").trim();
    const address = String(formData.get("address") ?? "").trim();
    const ownerEmail = String(formData.get("ownerEmail") ?? "")
      .trim()
      .toLowerCase();
    const lowStockThreshold = Number(formData.get("lowStockThreshold"));
    const availableForBookings = formData
      .getAll("availableForBookings")
      .includes("true");
    const currentSettings = await prisma.settings.findUnique({
      where: { vendorId: vendor.id },
      select: { ownerEmail: true },
    });

    if (ownerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail)) {
      return { ok: false, message: "Enter a valid owner email address." };
    }
    if (
      currentSettings?.ownerEmail &&
      ownerEmail &&
      currentSettings.ownerEmail.toLowerCase() !== ownerEmail
    ) {
      return {
        ok: false,
        message:
          "Use the Change email verification flow to update this address.",
      };
    }

    if (!businessName) {
      return { ok: false, message: "Business name is required." };
    }
    if (
      !Number.isSafeInteger(lowStockThreshold) ||
      lowStockThreshold < 0 ||
      lowStockThreshold > 1_000_000
    ) {
      return {
        ok: false,
        message: "Low-stock threshold must be a whole number from 0 to 1,000,000.",
      };
    }
    if (availableForBookings && !currentSettings?.ownerEmail && !ownerEmail) {
      return {
        ok: false,
        message: "Add an owner email before accepting booking requests.",
      };
    }

    if (!isValidWhatsAppNumber(whatsappNumber)) {
      return {
        ok: false,
        message: "Enter a valid WhatsApp number with 10 to 15 digits.",
      };
    }

    if (logoUrl) {
      try {
        const parsedLogoUrl = new URL(logoUrl);

        if (parsedLogoUrl.protocol !== "https:") {
          return { ok: false, message: "Logo URL must use HTTPS." };
        }
      } catch {
        return { ok: false, message: "The uploaded logo URL is invalid." };
      }
    }

    const mapUrl = getOptionalHttpsUrl(formData, "mapUrl");
    const instagramUrl = getOptionalHttpsUrl(formData, "instagramUrl");
    const facebookUrl = getOptionalHttpsUrl(formData, "facebookUrl");
    const tiktokUrl = getOptionalHttpsUrl(formData, "tiktokUrl");
    const urlError = [mapUrl, instagramUrl, facebookUrl, tiktokUrl].find(
      (result) => "error" in result,
    );

    if (urlError && "error" in urlError) {
      return {
        ok: false,
        message: urlError.error ?? "One of the links is invalid.",
      };
    }

    await prisma.$transaction(async (tx) => {
      await tx.vendor.update({
        where: { id: vendor.id },
        data: {
          businessName,
          motto: motto || null,
          whatsappNumber: whatsappNumber.replace(/[\s()-]/g, ""),
          logoUrl: logoUrl || null,
          address: address || null,
          mapUrl: mapUrl.value,
          instagramUrl: instagramUrl.value,
          facebookUrl: facebookUrl.value,
          tiktokUrl: tiktokUrl.value,
        },
      });
      await tx.settings.upsert({
        where: { vendorId: vendor.id },
        update: {
          lowStockThreshold,
          availableForBookings,
          ...(ownerEmail && !currentSettings?.ownerEmail
            ? { ownerEmail }
            : {}),
        },
        create: {
          vendorId: vendor.id,
          lowStockThreshold,
          availableForBookings,
          ownerEmail: ownerEmail || null,
        },
      });
    });

    revalidatePath("/");
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/settings");
    return { ok: true };
  } catch (error) {
    console.error("Store settings update failed.", error);
    return { ok: false, message: "Couldn't update settings. Try again." };
  }
}
