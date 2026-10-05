"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";

import { markReceiptReviewed } from "@/lib/actions/receipt-security";

export function MarkReviewedButton({ receiptId }: { receiptId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const result = await markReceiptReviewed(receiptId);
          if (!result.ok) {
            toast.error(result.message);
            return;
          }
          toast.success("Payment marked as reviewed");
          router.refresh();
        });
      }}
      className="h-9 rounded-lg border border-amber-300 px-3 text-sm font-medium text-amber-900 transition-colors hover:bg-amber-100 disabled:opacity-50"
    >
      {pending ? "Saving…" : "Mark reviewed"}
    </button>
  );
}
