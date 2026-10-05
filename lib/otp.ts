import "server-only";

import type { OtpPurpose } from "@prisma/client";

import { hmac, safeEqual, sixDigit } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";

const COOLDOWN_MS = 60_000;
const TTL_MS = 10 * 60_000;
const MAX_ATTEMPTS = 5;
const MAX_PER_HOUR = 5;

function hashCode(
  purpose: OtpPurpose,
  vendorId: string,
  targetId: string,
  slot: "a" | "b",
  code: string,
) {
  const secret = process.env.OTP_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("OTP_SECRET must contain at least 32 characters.");
  }
  return hmac(
    "sha256",
    secret,
    `${vendorId}:${purpose}:${targetId}:${slot}:${code}`,
  );
}

export async function issueOtp(input: {
  vendorId: string;
  purpose: OtpPurpose;
  targetId: string;
  payload?: string;
  requestedBy: string;
  twoCodes?: boolean;
}) {
  const since = new Date(Date.now() - 60 * 60_000);
  const code = sixDigit();
  const code2 = input.twoCodes ? sixDigit() : null;
  const result = await prisma.$transaction(async (tx) => {
    const [vendor] = await tx.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "Vendor" WHERE "id" = ${input.vendorId} FOR UPDATE`;
    if (!vendor) {
      throw new Error("The store was not found.");
    }
    const recent = await tx.securityOtp.findMany({
      where: {
        vendorId: input.vendorId,
        purpose: input.purpose,
        targetId: input.targetId,
        createdAt: { gt: since },
      },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    if (
      recent[0] &&
      Date.now() - recent[0].createdAt.getTime() < COOLDOWN_MS
    ) {
      return {
        ok: false as const,
        error: "Please wait a minute before requesting another code.",
      };
    }
    if (recent.length >= MAX_PER_HOUR) {
      return {
        ok: false as const,
        error: "Too many code requests. Try again later.",
      };
    }
    await tx.securityOtp.updateMany({
      where: {
        vendorId: input.vendorId,
        purpose: input.purpose,
        targetId: input.targetId,
        usedAt: null,
      },
      data: { expiresAt: new Date() },
    });
    const otp = await tx.securityOtp.create({
      data: {
        vendorId: input.vendorId,
        purpose: input.purpose,
        targetId: input.targetId,
        payload: input.payload,
        requestedBy: input.requestedBy,
        codeHash: hashCode(
          input.purpose,
          input.vendorId,
          input.targetId,
          "a",
          code,
        ),
        codeHash2: code2
          ? hashCode(
              input.purpose,
              input.vendorId,
              input.targetId,
              "b",
              code2,
            )
          : null,
        expiresAt: new Date(Date.now() + TTL_MS),
      },
    });
    return { ok: true as const, otpId: otp.id };
  });
  return result.ok ? { ...result, code, code2 } : result;
}

export async function checkOtp(input: {
  vendorId: string;
  purpose: OtpPurpose;
  targetId: string;
  code: string;
  code2?: string;
}) {
  const otp = await prisma.securityOtp.findFirst({
    where: {
      vendorId: input.vendorId,
      purpose: input.purpose,
      targetId: input.targetId,
      usedAt: null,
      expiresAt: { gt: new Date() },
      attempts: { lt: MAX_ATTEMPTS },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!otp) {
    return {
      ok: false as const,
      error: "Code expired. Request a new one.",
    };
  }

  const validFirst = safeEqual(
    hashCode(
      input.purpose,
      input.vendorId,
      input.targetId,
      "a",
      input.code,
    ),
    otp.codeHash,
  );
  const validSecond =
    !otp.codeHash2 ||
    (!!input.code2 &&
      safeEqual(
        hashCode(
          input.purpose,
          input.vendorId,
          input.targetId,
          "b",
          input.code2,
        ),
        otp.codeHash2,
      ));
  const attempt = await prisma.securityOtp.updateMany({
    where: {
      id: otp.id,
      usedAt: null,
      expiresAt: { gt: new Date() },
      attempts: { lt: MAX_ATTEMPTS },
    },
    data: { attempts: { increment: 1 } },
  });
  if (!attempt.count) {
    return {
      ok: false as const,
      error: "Code expired. Request a new one.",
    };
  }
  if (!validFirst || !validSecond) {
    return { ok: false as const, error: "Incorrect code." };
  }
  return { ok: true as const, otp };
}
