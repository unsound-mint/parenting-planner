import type { Metadata } from "next";
import { Figtree, Fraunces, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { HelpWorker } from "@/components/help/help-worker";
import { PRODUCT_NAME, PRODUCT_TAGLINE } from "@/lib/product";

// Headings: Fraunces with its soft axis (text-display, text-headline, text-title in globals.css).
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["SOFT", "WONK", "opsz"],
});

// UI and running text.
const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
});

// Values are set in mono.
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: PRODUCT_NAME,
  description: PRODUCT_TAGLINE,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${figtree.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
        <HelpWorker />
      </body>
    </html>
  );
}
