import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
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
    icon: "https://fpwvutdvwnvrunviporz.supabase.co/storage/v1/object/public/logos/logo.png",
    apple: "https://fpwvutdvwnvrunviporz.supabase.co/storage/v1/object/public/logos/logo.png",
  },
};
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={${geistSans.variable} ${geistMono.variable} h-full antialiased}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
