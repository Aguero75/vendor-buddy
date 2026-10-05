"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { toast } from "react-toastify";

import {
  confirmVoid,
  requestVoid,
} from "@/lib/actions/receipt-security";

const reasons = ["Refunded", "Entered by mistake", "Other"];

export function VoidReceiptButton({
  receiptId,
}: {
  receiptId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(reasons[0]);
  const [codeRequested, setCodeRequested] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [code, setCode] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((remaining) => remaining - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  function sendCode() {
    startTransition(async () => {
      const result = await requestVoid(receiptId, reason);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setCodeRequested(true);
      setResendIn(60);
      toast.success("A confirmation code was sent to the owner email");
    });
  }

  function confirm() {
    startTransition(async () => {
      const result = await confirmVoid(receiptId, code);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setOpen(false);
      setCode("");
      router.refresh();
      toast.success("Receipt voided and tracked stock restored");
    });
  }

  return (
    <>
      <button
        type="button"
        aria-label="Void receipt"
        onClick={() => setOpen(true)}
        className="inline-flex size-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-destructive/40 hover:bg-destructive/5 hover:text-destructive"
      >
        <X className="size-4" />
      </button>
      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 px-4 backdrop-blur-sm"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !pending) {
              setOpen(false);
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="void-receipt-title"
            className="w-full max-w-md space-y-5 rounded-2xl border border-border bg-card p-6 shadow-xl"
          >
            <div>
              <h2 id="void-receipt-title" className="text-lg font-semibold">
                Void this receipt?
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                This keeps an audit record. If stock was deducted, the quantity will be restored.
              </p>
            </div>
            {!codeRequested ? (
              <>
                <label className="block space-y-2">
                  <span className="text-sm font-medium">Reason</span>
                  <select
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/20"
                  >
                    {reasons.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => setOpen(false)}
                    className="h-10 rounded-lg px-3 text-sm font-medium hover:bg-muted disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={sendCode}
                    className="h-10 rounded-lg bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-50"
                  >
                    {pending ? "Sending…" : "Send code"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <label className="block space-y-2">
                  <span className="text-sm font-medium">
                    6-digit code sent to the owner email
                  </span>
                  <input
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    maxLength={6}
                    value={code}
                    onChange={(event) =>
                      setCode(event.target.value.replace(/\D/g, ""))
                    }
                    className="h-11 w-full rounded-lg border border-input bg-background px-3 text-center text-lg tracking-[0.35em] outline-none focus:border-ring focus:ring-3 focus:ring-ring/20"
                  />
                </label>
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="flex items-center text-xs text-muted-foreground">
                    {resendIn > 0
                      ? `Resend available in ${resendIn}s`
                      : ""}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={pending || resendIn > 0}
                      onClick={sendCode}
                      className="h-10 rounded-lg px-3 text-sm font-medium text-muted-foreground hover:bg-muted disabled:opacity-50"
                    >
                      Resend code
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => setOpen(false)}
                      className="h-10 rounded-lg px-3 text-sm font-medium hover:bg-muted disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={pending || code.length !== 6}
                      onClick={confirm}
                      className="h-10 rounded-lg bg-destructive px-4 text-sm font-semibold text-destructive-foreground disabled:opacity-50"
                    >
                      {pending ? "Verifying…" : "Confirm void"}
                    </button>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      ) : null}
    </>
  );
}
