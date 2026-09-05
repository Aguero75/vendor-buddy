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

    if (!businessName) {
      return { ok: false, message: "Business name is required." };
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

    await prisma.vendor.update({
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

    revalidatePath("/");
    revalidatePath("/dashboard/settings");
    return { ok: true };
  } catch {
    return { ok: false, message: "Couldn't update settings. Try again." };
  }
}
