"use server";

import { OtpPurpose, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { checkAdmin } from "@/lib/auth";
import { esc, sendEmail } from "@/lib/email";
import { checkOtp, issueOtp } from "@/lib/otp";
import { naira } from "@/lib/range";
import { restoreStock } from "@/lib/receipts";
import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/lib/actions/products";

const VOID_REASONS = ["Refunded", "Entered by mistake", "Other"] as const;

async function getAdminVendor() {
  const admin = await checkAdmin();
  if (!admin.authorized) return null;
  const vendor = await prisma.vendor.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return vendor ? { vendor, userId: admin.userId } : null;
}

export async function requestVoid(
  receiptId: string,
  reason: string,
): Promise<ActionResult> {
  const context = await getAdminVendor();
  if (!context) {
    return { ok: false, message: "You are not authorized to manage receipts." };
  }
  if (!VOID_REASONS.includes(reason as (typeof VOID_REASONS)[number])) {
    return { ok: false, message: "Pick a valid reason." };
  }

  const [settings, receipt] = await Promise.all([
    prisma.settings.findUnique({
      where: { vendorId: context.vendor.id },
      select: { ownerEmail: true },
    }),
    prisma.receipt.findFirst({
      where: { id: receiptId, vendorId: context.vendor.id },
      include: { lineItems: true },
    }),
  ]);
  if (!settings?.ownerEmail) {
    return { ok: false, message: "Set the owner email in Settings first." };
  }
  if (!process.env.OTP_SECRET || process.env.OTP_SECRET.length < 32) {
    return { ok: false, message: "Receipt confirmation is not configured." };
  }
  if (!receipt || receipt.status === "VOIDED") {
    return { ok: false, message: "Receipt not found or already voided." };
  }

  const otp = await issueOtp({
    vendorId: context.vendor.id,
    purpose: OtpPurpose.VOID_RECEIPT,
    targetId: receipt.id,
    payload: reason,
    requestedBy: context.userId,
  });
  if (!otp.ok) return { ok: false, message: otp.error };

  const items = receipt.lineItems
    .map(
      (line) =>
        `<li>${line.quantity} × ${esc(line.nameSnapshot)}</li>`,
    )
    .join("");
  try {
    await sendEmail(
      settings.ownerEmail,
      `Code ${otp.code}: void a receipt`,
      `<p>A request was made to void this receipt.</p>
       <ul>
         <li>Amount: ${esc(naira(Number(receipt.total)))}</li>
         <li>Method: ${esc(receipt.method)}</li>
         <li>Customer: ${esc(receipt.customerName ?? receipt.phone ?? "n/a")}</li>
         <li>Reason: ${esc(reason)}</li>
         <li>Items: <ul>${items}</ul></li>
       </ul>
       <p>Your code: <strong>${otp.code}</strong> (valid for 10 minutes).</p>
       <p>If you did not expect this request, do not share the code.</p>`,
    );
  } catch (error) {
    await prisma.securityOtp.updateMany({
      where: { id: otp.otpId, usedAt: null },
      data: { expiresAt: new Date() },
    });
    console.error("Void confirmation email failed.", error);
    return { ok: false, message: "Could not send the email. Try again." };
  }
  return { ok: true };
}

export async function confirmVoid(
  receiptId: string,
  code: string,
): Promise<ActionResult> {
  const context = await getAdminVendor();
  if (!context) {
    return { ok: false, message: "You are not authorized to manage receipts." };
  }
  if (typeof code !== "string" || !/^\d{6}$/.test(code.trim())) {
    return { ok: false, message: "Enter the 6-digit code." };
  }
  const checked = await checkOtp({
    vendorId: context.vendor.id,
    purpose: OtpPurpose.VOID_RECEIPT,
    targetId: receiptId,
    code: code.trim(),
  });
  if (!checked.ok) return { ok: false, message: checked.error };

  try {
    await prisma.$transaction(async (tx) => {
      const consumed = await tx.securityOtp.updateMany({
        where: { id: checked.otp.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      if (!consumed.count) throw new Error("Code already used.");

      const voided = await tx.receipt.updateMany({
        where: {
          id: receiptId,
          vendorId: context.vendor.id,
          status: { not: "VOIDED" },
        },
        data: {
          status: "VOIDED",
          voidedAt: new Date(),
          voidedBy: context.userId,
          voidReason: checked.otp.payload,
        },
      });
      if (!voided.count) throw new Error("Receipt already voided.");

      const receipt = await tx.receipt.findUniqueOrThrow({
        where: { id: receiptId },
        select: { stockApplied: true },
      });
      if (receipt.stockApplied) await restoreStock(tx, receiptId);
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      console.error("Receipt void transaction failed.", error.code);
    } else if (error instanceof Error) {
      return { ok: false, message: error.message };
    }
    return { ok: false, message: "Could not void the receipt. Try again." };
  }

  revalidatePath("/");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/products");
  revalidatePath("/dashboard/receipts");
  return { ok: true };
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function requestEmailChange(
  newEmailValue: string,
): Promise<ActionResult> {
  const context = await getAdminVendor();
  if (!context) {
    return { ok: false, message: "You are not authorized to manage settings." };
  }
  const newEmail = newEmailValue.trim().toLowerCase();
  if (newEmail.length > 254 || !emailPattern.test(newEmail)) {
    return { ok: false, message: "Enter a valid email address." };
  }
  const settings = await prisma.settings.findUnique({
    where: { vendorId: context.vendor.id },
    select: { ownerEmail: true },
  });
  if (!settings?.ownerEmail) {
    return { ok: false, message: "Set an owner email before changing it." };
  }
  if (!process.env.OTP_SECRET || process.env.OTP_SECRET.length < 32) {
    return { ok: false, message: "Email confirmation is not configured." };
  }
  if (settings.ownerEmail.toLowerCase() === newEmail) {
    return { ok: false, message: "That is already the owner email." };
  }

  const otp = await issueOtp({
    vendorId: context.vendor.id,
    purpose: OtpPurpose.CHANGE_EMAIL,
    targetId: context.vendor.id,
    payload: newEmail,
    requestedBy: context.userId,
    twoCodes: true,
  });
  if (!otp.ok) return { ok: false, message: otp.error };
  try {
    await sendEmail(
      settings.ownerEmail,
      "Confirm owner email change",
      `<p>A request was made to change the store owner email to ${esc(newEmail)}.</p>
       <p>Code: <strong>${otp.code}</strong> (valid for 10 minutes).</p>`,
    );
    await sendEmail(
      newEmail,
      "Confirm your new store email",
      `<p>Use this code to confirm the new address: <strong>${otp.code2}</strong></p>`,
    );
  } catch (error) {
    await prisma.securityOtp.updateMany({
      where: { id: otp.otpId, usedAt: null },
      data: { expiresAt: new Date() },
    });
    console.error("Owner email change email delivery failed.", error);
    return { ok: false, message: "Could not send the emails. Try again." };
  }
  return { ok: true };
}

export async function confirmEmailChange(
  code: string,
  code2: string,
): Promise<ActionResult> {
  const context = await getAdminVendor();
  if (!context) {
    return { ok: false, message: "You are not authorized to manage settings." };
  }
  if (!/^\d{6}$/.test(code.trim()) || !/^\d{6}$/.test(code2.trim())) {
    return { ok: false, message: "Enter both 6-digit codes." };
  }
  const checked = await checkOtp({
    vendorId: context.vendor.id,
    purpose: OtpPurpose.CHANGE_EMAIL,
    targetId: context.vendor.id,
    code: code.trim(),
    code2: code2.trim(),
  });
  if (!checked.ok) return { ok: false, message: checked.error };
  if (!checked.otp.payload) {
    return { ok: false, message: "The email change request is invalid." };
  }

  const prior = await prisma.settings.findUnique({
    where: { vendorId: context.vendor.id },
    select: { ownerEmail: true },
  });
  try {
    await prisma.$transaction(async (tx) => {
      const used = await tx.securityOtp.updateMany({
        where: { id: checked.otp.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      if (!used.count) throw new Error("Code already used.");
      await tx.settings.update({
        where: { vendorId: context.vendor.id },
        data: { ownerEmail: checked.otp.payload },
      });
    });
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Could not update the owner email.",
    };
  }
  if (prior?.ownerEmail) {
    await sendEmail(
      prior.ownerEmail,
      "Your store email was changed",
      `<p>The owner email is now ${esc(checked.otp.payload)}.</p>`,
    ).catch((error: unknown) => {
      console.error("Owner email change notice failed.", error);
    });
  }
  revalidatePath("/dashboard/settings");
  return { ok: true };
}

export async function markReceiptReviewed(
  receiptId: string,
): Promise<ActionResult> {
  const context = await getAdminVendor();
  if (!context) {
    return { ok: false, message: "You are not authorized to manage receipts." };
  }
  const result = await prisma.receipt.updateMany({
    where: {
      id: receiptId,
      vendorId: context.vendor.id,
      needsReview: true,
      reviewedAt: null,
    },
    data: {
      needsReview: false,
      reviewedAt: new Date(),
      reviewedBy: context.userId,
    },
  });
  if (!result.count) {
    return { ok: false, message: "This payment has already been reviewed." };
  }
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/receipts");
  return { ok: true };
}
