import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { DM_Sans, Geist_Mono, Playfair_Display } from "next/font/google";
import { ToastContainer } from "react-toastify";
import { CartProvider } from "@/lib/cart-context";
import "./globals.css";
import "react-toastify/dist/ReactToastify.css";

const dmSans = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-display",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000",
  ),
  title: {
    default: "Vendor Buddy",
    template: "%s | Vendor Buddy",
  },
  description:
    "Discover products and shop directly from independent local businesses.",
  applicationName: "Vendor Buddy",
  openGraph: {
    type: "website",
    locale: "en_NG",
    siteName: "Vendor Buddy",
    title: "Vendor Buddy",
    description:
      "Discover products and shop directly from independent local businesses.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Vendor Buddy",
    description:
      "Discover products and shop directly from independent local businesses.",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <ClerkProvider>
      <html
        lang="en"
        className={`${dmSans.variable} ${playfair.variable} ${geistMono.variable} h-full antialiased`}
      >
        <body className="min-h-full flex flex-col">
          <CartProvider>{children}</CartProvider>
          <ToastContainer />
        </body>
      </html>
    </ClerkProvider>
  );
}
