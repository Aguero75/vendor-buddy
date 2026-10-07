import Script from "next/script";

export function TawkChat() {
  const propertyId = process.env.NEXT_PUBLIC_TAWK_PROPERTY_ID?.trim();
  const widgetId = process.env.NEXT_PUBLIC_TAWK_WIDGET_ID?.trim();

  if (
    !propertyId ||
    !widgetId ||
    !/^[\w-]+$/.test(propertyId) ||
    !/^[\w-]+$/.test(widgetId)
  ) {
    return null;
  }

  return (
    <>
      <Script id="tawk-widget-position" strategy="afterInteractive">
        {`window.Tawk_API = window.Tawk_API || {}; window.Tawk_API.customStyle = { visibility: { desktop: { position: "bl", xOffset: "20px", yOffset: "20px" }, mobile: { position: "bl", xOffset: "12px", yOffset: "12px" } } };`}
      </Script>
      <Script
        src={`https://embed.tawk.to/${propertyId}/${widgetId}`}
        strategy="lazyOnload"
      />
    </>
  );
}
