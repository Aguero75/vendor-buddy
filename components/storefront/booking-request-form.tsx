"use client";

import { CalendarDays, CheckCircle2, Send } from "lucide-react";
import { useCallback, useRef, useState, useTransition } from "react";

import { sendBookingRequest } from "@/lib/actions/bookings";
import { TurnstileWidget } from "@/components/storefront/turnstile-widget";

export function BookingRequestForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const [isPending, startTransition] = useTransition();
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();

  const handleTurnstileTokenChange = useCallback((token: string) => {
    setTurnstileToken(token);
  }, []);

  function handleSubmit(formData: FormData) {
    setMessage("");
    startTransition(async () => {
      const result = await sendBookingRequest(formData);

      setTurnstileToken("");
      setTurnstileResetKey((key) => key + 1);

      if (!result.ok) {
        setMessage(result.message);
        return;
      }

      formRef.current?.reset();
      setSent(true);
    });
  }

  return (
    <section
      aria-labelledby="booking-heading"
      className="relative overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-9"
    >
      <div
        className="pointer-events-none absolute -right-14 -top-20 size-56 rounded-full bg-accent/30 blur-3xl"
        aria-hidden="true"
      />
      <div className="relative mx-auto max-w-3xl">
        <div className="mb-7 flex items-start gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <CalendarDays className="size-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Make it a date
            </p>
            <h2
              id="booking-heading"
              className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl"
            >
              Planning an event?
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
              Tell us a little about it and we’ll get back to you about your
              booking.
            </p>
          </div>
        </div>

        {sent ? (
          <div
            className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-900"
            role="status"
          >
            <CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
            <div>
              <p className="font-semibold">Request sent successfully</p>
              <p className="mt-1">
                Thanks for reaching out. We’ll be in touch using the email you
                provided.
              </p>
            </div>
          </div>
        ) : (
          <form
            ref={formRef}
            action={handleSubmit}
            className="grid gap-5 sm:grid-cols-2"
          >
            <input
              type="hidden"
              name="turnstileToken"
              value={turnstileToken}
            />
            <label className="space-y-2">
              <span className="text-sm font-medium">Your name</span>
              <input
                required
                name="name"
                type="text"
                autoComplete="name"
                maxLength={100}
                placeholder="e.g. Ada Okafor"
                className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/20"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium">Email address</span>
              <input
                required
                name="email"
                type="email"
                autoComplete="email"
                maxLength={254}
                placeholder="you@example.com"
                className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/20"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium">Event date</span>
              <input
                required
                name="eventDate"
                type="date"
                className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/20"
              />
            </label>
            <label
              className="absolute -left-[10000px] top-auto size-px overflow-hidden"
              aria-hidden="true"
            >
              Leave this field empty
              <input
                name="companyWebsite"
                type="text"
                tabIndex={-1}
                autoComplete="off"
              />
            </label>
            <label className="space-y-2 sm:col-span-2">
              <span className="text-sm font-medium">A little about the event</span>
              <textarea
                required
                name="description"
                maxLength={1000}
                rows={4}
                placeholder="What are you celebrating, and what would you like us to know?"
                className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/20"
              />
              <span className="block text-xs text-muted-foreground">
                Up to 1,000 characters.
              </span>
            </label>
            <div className="space-y-2 sm:col-span-2">
              {turnstileSiteKey ? (
                <>
                  <TurnstileWidget
                    key={turnstileResetKey}
                    siteKey={turnstileSiteKey}
                    onTokenChange={handleTurnstileTokenChange}
                  />
                  <p className="text-xs text-muted-foreground">
                    Complete the security check before sending your request.
                  </p>
                </>
              ) : (
                <p className="text-sm text-destructive" role="alert">
                  The security check is not configured, so booking requests
                  cannot currently be sent.
                </p>
              )}
            </div>
            {message ? (
              <p className="text-sm text-destructive sm:col-span-2" role="alert">
                {message}
              </p>
            ) : null}
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={isPending || !turnstileSiteKey || !turnstileToken}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Send className="size-4" aria-hidden="true" />
                {isPending ? "Sending request…" : "Send booking request"}
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
