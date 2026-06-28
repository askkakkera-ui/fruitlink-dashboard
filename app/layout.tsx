import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import SwRegister from "./sw-register";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Fruitlink — Operator Dashboard",
  description: "Monitor your fresh juice vending machines, track orders and manage alerts in real-time.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Fruitlink",
  },
  openGraph: {
    title: "Fruitlink — Operator Dashboard",
    description: "Monitor your fresh juice vending machines, track orders and manage alerts in real-time.",
    url: "https://www.fruitlinktech.in",
    siteName: "Fruitlink Technologies",
    images: [
      {
        url: "https://fpwvutdvwnvrunviporz.supabase.co/storage/v1/object/public/logos/logo.png",
        width: 1200,
        height: 630,
        alt: "Fruitlink Technologies",
      },
    ],
    type: "website",
  },
  icons: {
    icon: [
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#FE6505",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {children}
        <SwRegister />
      </body>
    </html>
  );
}
