import { auth } from "@clerk/nextjs/server";
import { Resend } from "resend";

import { prisma } from "@/lib/prisma";

function isValidEmail(value: unknown): value is string {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request: Request) {
  try {
    await auth.protect();

    const body = (await request.json()) as {
      email?: unknown;
      image?: unknown;
    };
    const email = body.email;
    const image = body.image;

    if (!isValidEmail(email)) {
      return Response.json(
        { ok: false, message: "Enter a valid email address." },
        { status: 400 },
      );
    }

    if (
      typeof image !== "string" ||
      !image.startsWith("data:image/png;base64,") ||
      image.length > 5_000_000
    ) {
      return Response.json(
        { ok: false, message: "The receipt image is invalid or too large." },
        { status: 400 },
      );
    }

    const receiptId = request.headers.get("x-receipt-id");
    if (!receiptId) {
      return Response.json(
        { ok: false, message: "Receipt was not specified." },
        { status: 400 },
      );
    }

    const vendor = await prisma.vendor.findFirst({
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    const receipt = vendor
      ? await prisma.receipt.findFirst({
          where: { id: receiptId, vendorId: vendor.id },
          include: { vendor: { select: { businessName: true } } },
        })
      : null;

    if (!receipt) {
      return Response.json(
        { ok: false, message: "Receipt could not be found." },
        { status: 404 },
      );
    }

    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL;
    if (!apiKey || !from) {
      return Response.json(
        { ok: false, message: "Email service is not configured." },
        { status: 503 },
      );
    }

    const resend = new Resend(apiKey);
    const result = await resend.emails.send({
      from,
      to: email,
      subject: `Receipt from ${receipt.vendor.businessName}`,
      text: "Your receipt is attached as a PNG.",
      attachments: [
        {
          filename: `receipt-${receipt.id}.png`,
          content: image.replace("data:image/png;base64,", ""),
        },
      ],
    });

    if (result.error) {
      return Response.json(
        { ok: false, message: "Email provider rejected the receipt." },
        { status: 502 },
      );
    }

    return Response.json({ ok: true });
  } catch {
    return Response.json(
      { ok: false, message: "Couldn't send receipt email." },
      { status: 500 },
    );
  }
}
