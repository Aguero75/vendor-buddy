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
  title: "Vendor Buddy",
  description: "A simple storefront for small vendors.",
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
