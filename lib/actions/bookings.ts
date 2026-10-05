"use server";

import { esc, sendEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";

type BookingResult = { ok: true } | { ok: false; message: string };

function readField(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export async function sendBookingRequest(
  formData: FormData,
): Promise<BookingResult> {
  const name = readField(formData, "name");
  const email = readField(formData, "email").toLowerCase();
  const eventDate = readField(formData, "eventDate");
  const description = readField(formData, "description");
  const parsedEventDate = new Date(`${eventDate}T00:00:00.000Z`);

  if (readField(formData, "companyWebsite")) {
    return {
      ok: false,
      message: "We couldn't send your request. Please try again.",
    };
  }
  if (!name || name.length > 100) {
    return { ok: false, message: "Enter your name (up to 100 characters)." };
  }
  if (
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    return { ok: false, message: "Enter a valid email address." };
  }
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(eventDate) ||
    Number.isNaN(parsedEventDate.getTime()) ||
    parsedEventDate.toISOString().slice(0, 10) !== eventDate
  ) {
    return { ok: false, message: "Choose a valid event date." };
  }
  if (!description || description.length > 1000) {
    return {
      ok: false,
      message: "Add a short description (up to 1,000 characters).",
    };
  }

  try {
    const vendor = await prisma.vendor.findFirst({
      orderBy: { createdAt: "asc" },
      select: {
        businessName: true,
        settings: {
          select: { availableForBookings: true, ownerEmail: true },
        },
      },
    });

    if (!vendor?.settings?.availableForBookings) {
      return {
        ok: false,
        message: "Booking requests are currently unavailable.",
      };
    }
    if (!vendor.settings.ownerEmail) {
      return {
        ok: false,
        message: "Booking requests are temporarily unavailable. Please try again later.",
      };
    }

    const formattedDate = new Intl.DateTimeFormat("en-NG", {
      dateStyle: "long",
      timeZone: "UTC",
    }).format(new Date(`${eventDate}T12:00:00.000Z`));

    await sendEmail(
      vendor.settings.ownerEmail,
      "New event booking request",
      `<h2>New event booking request</h2>
       <p><strong>Store:</strong> ${esc(vendor.businessName)}</p>
       <p><strong>Name:</strong> ${esc(name)}</p>
       <p><strong>Email:</strong> ${esc(email)}</p>
       <p><strong>Event date:</strong> ${esc(formattedDate)}</p>
       <p><strong>Event description:</strong></p>
       <p>${esc(description).replace(/\n/g, "<br>")}</p>`,
    );

    return { ok: true };
  } catch (error) {
    console.error("Booking request delivery failed.", error);
    return {
      ok: false,
      message:
        "We couldn't send your request right now. Please try again shortly.",
    };
  }
}
