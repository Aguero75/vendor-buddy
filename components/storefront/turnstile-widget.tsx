"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

type TurnstileOptions = {
  sitekey: string;
  theme: "auto";
  size: "normal" | "compact";
  callback: (token: string) => void;
  "expired-callback": () => void;
  "error-callback": () => void;
};

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: TurnstileOptions) => string;
      remove: (widgetId: string) => void;
    };
  }
}

export function TurnstileWidget({
  siteKey,
  onTokenChange,
}: {
  siteKey: string;
  onTokenChange: (token: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const widgetSizeRef = useRef<TurnstileOptions["size"] | null>(null);
  const [scriptReady, setScriptReady] = useState(false);

  useEffect(() => {
    if (!scriptReady || !containerRef.current || !window.turnstile) {
      return;
    }

    const container = containerRef.current;
    const turnstile = window.turnstile;
    const renderWidget = () => {
      const size = container.clientWidth < 300 ? "compact" : "normal";
      if (widgetIdRef.current && widgetSizeRef.current === size) {
        return;
      }

      if (widgetIdRef.current) {
        onTokenChange("");
        turnstile.remove(widgetIdRef.current);
      }
      widgetIdRef.current = turnstile.render(container, {
        sitekey: siteKey,
        theme: "auto",
        size,
        callback: onTokenChange,
        "expired-callback": () => onTokenChange(""),
        "error-callback": () => onTokenChange(""),
      });
      widgetSizeRef.current = size;
    };
    const observer = new ResizeObserver(renderWidget);
    observer.observe(container);
    renderWidget();

    return () => {
      observer.disconnect();
      if (widgetIdRef.current) {
        turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
        widgetSizeRef.current = null;
      }
    };
  }, [onTokenChange, scriptReady, siteKey]);

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onReady={() => setScriptReady(true)}
      />
      <div ref={containerRef} aria-label="Security check" />
    </>
  );
}
