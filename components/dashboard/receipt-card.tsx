"use client";

import domToImage from "dom-to-image-more";
import Image from "next/image";
import { useRef, useState } from "react";
import { toast } from "react-toastify";

import { Button } from "@/components/ui/button";

type ReceiptCardData = {
  id: string;
  businessName: string;
  motto: string | null;
  logoUrl: string | null;
  customerName: string | null;
  createdAt: string;
  total: string;
  lineItems: {
    nameSnapshot: string;
    quantity: number;
    unitPrice: string;
  }[];
};

function formatPrice(value: string) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function dataUrlToBlob(dataUrl: string) {
  const [header, encoded] = dataUrl.split(",");
  const binary = window.atob(encoded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  const mimeType = header.match(/data:(.*?);base64/)?.[1] ?? "image/png";
  return new Blob([bytes], { type: mimeType });
}

export function ReceiptCard({ receipt }: { receipt: ReceiptCardData }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isWorking, setIsWorking] = useState(false);

  async function createImage() {
    if (!cardRef.current) {
      throw new Error("Receipt is not ready.");
    }

    return domToImage.toPng(cardRef.current, {
      bgcolor: "#ffffff",
      cacheBust: true,
      pixelRatio: 2,
      ignoreCSSRuleErrors: true,
    });
  }

  async function downloadReceipt(showToast = true) {
    const dataUrl = await createImage();
    const link = document.createElement("a");
    link.download = `receipt-${receipt.id}.png`;
    link.href = dataUrl;
    link.click();

    if (showToast) {
      toast.success("Receipt downloaded");
    }

    return dataUrl;
  }

  async function handleDownload() {
    setIsWorking(true);
    try {
      await downloadReceipt();
    } catch {
      toast.error("Couldn't download receipt — try again");
    } finally {
      setIsWorking(false);
    }
  }

  async function handleShare() {
    setIsWorking(true);
    try {
      const dataUrl = await createImage();
      const file = new File(
        [dataUrlToBlob(dataUrl)],
        `receipt-${receipt.id}.png`,
        {
          type: "image/png",
        },
      );
      const shareData = {
        title: `Receipt from ${receipt.businessName}`,
        text: `Receipt for ${receipt.customerName || "customer"}`,
        files: [file],
      };

      if (!navigator.share || !navigator.canShare?.({ files: [file] })) {
        await downloadReceipt(false);
        toast.info("Sharing isn't supported here — downloaded instead");
        return;
      }

      await navigator.share(shareData);
      toast.success("Receipt shared");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      toast.error("Couldn't share receipt — try again");
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <div className="space-y-5">
      <div
        ref={cardRef}
        className="relative mx-auto max-w-xl overflow-hidden rounded-3xl border border-white/50 bg-white/55 p-6 text-[#25231f] shadow-[0_8px_40px_rgba(37,35,31,0.14)] backdrop-blur-xl sm:p-10"
      >
        <div
          className="pointer-events-none absolute -left-16 -top-20 size-64 rounded-full bg-gradient-to-br from-amber-200/50 via-orange-100/40 to-transparent blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-24 -right-16 size-72 rounded-full bg-gradient-to-tr from-stone-200/50 via-amber-100/30 to-transparent blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/40 via-transparent to-white/10"
          aria-hidden="true"
        />

        <div className="relative">
          <div className="flex items-start justify-between gap-5 border-b border-[#e5e0d7]/80 pb-6">
            <div className="space-y-2">
              {receipt.logoUrl ? (
                <Image
                  src={receipt.logoUrl}
                  alt={`${receipt.businessName} logo`}
                  width={72}
                  height={72}
                  unoptimized
                  crossOrigin="anonymous"
                  className="size-16 rounded-lg object-cover"
                />
              ) : null}
              <h2 className="text-2xl font-semibold">{receipt.businessName}</h2>
              {receipt.motto ? (
                <p className="max-w-md text-sm text-[#6f6a60]">
                  {receipt.motto}
                </p>
              ) : null}
            </div>
            <div className="text-right text-sm text-[#6f6a60]">
              <p className="font-medium text-[#25231f]">Receipt</p>
              <p>{new Date(receipt.createdAt).toLocaleString()}</p>
            </div>
          </div>

          <div className="border-b border-[#e5e0d7]/80 py-5 text-sm">
            <span className="text-[#6f6a60]">Customer: </span>
            {receipt.customerName || "Walk-in customer"}
          </div>

          <ul className="divide-y divide-[#e5e0d7]/80 text-sm">
            {receipt.lineItems.map((lineItem, index) => (
              <li
                key={`${lineItem.nameSnapshot}-${index}`}
                className="flex justify-between gap-4 py-4"
              >
                <span>
                  {lineItem.quantity} × {lineItem.nameSnapshot}
                </span>
                <span className="font-medium">
                  {formatPrice(
                    (Number(lineItem.unitPrice) * lineItem.quantity).toString(),
                  )}
                </span>
              </li>
            ))}
          </ul>

          <div className="flex justify-between border-t-2 border-[#25231f] pt-5 text-lg font-semibold">
            <span>Total</span>
            <span>{formatPrice(receipt.total)}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button type="button" onClick={handleDownload} disabled={isWorking}>
          Download PNG
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={handleShare}
          disabled={isWorking}
        >
          Share
        </Button>
      </div>
    </div>
  );
}
