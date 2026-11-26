import type { Metadata, Viewport } from "next";
import { Sora } from "next/font/google";
import "./globals.css";
import { MobileNav } from "@/components/mobile-nav";
import { ServiceWorkerRegister } from "@/components/service-worker-register";

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Crave — Kulinarische Intelligenz",
  description: "KI-gestützte Rezeptideen für jeden Appetit.",
  applicationName: "Crave",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Crave",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/apple-icon",
  },
};

// Mobile-first PWA: exact device width; content under the notch is handled via safe-area insets.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#fcfbf6",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="de"
      className={`${sora.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        {/* Im Layout statt pro Seite: bleibt beim Seitenwechsel stehen, damit der Aktiv-Indikator gleiten kann. */}
        <MobileNav />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
