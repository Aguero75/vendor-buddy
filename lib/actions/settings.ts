"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/lib/actions/products";

function isValidWhatsAppNumber(value: string) {
  const normalized = value.replace(/[\s()-]/g, "");
  return /^\+?[0-9]{10,15}$/.test(normalized);
}

export async function saveSettings(formData: FormData): Promise<ActionResult> {
  try {
    await auth.protect();
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

    await prisma.vendor.update({
      where: { id: vendor.id },
      data: {
        businessName,
        motto: motto || null,
        whatsappNumber: whatsappNumber.replace(/[\s()-]/g, ""),
        logoUrl: logoUrl || null,
      },
    });

    revalidatePath("/");
    revalidatePath("/dashboard/settings");
    return { ok: true };
  } catch {
    return { ok: false, message: "Couldn't update settings. Try again." };
  }
}
