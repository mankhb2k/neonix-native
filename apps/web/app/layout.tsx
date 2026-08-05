import { Be_Vietnam_Pro, Fraunces } from "next/font/google";
import type { Metadata } from "next";
import "./globals.css";

const sans = Be_Vietnam_Pro({
  subsets: ["vietnamese", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

const display = Fraunces({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "MotiClip",
  description: "AI Studio — motion graphics 2.5D từ brief đến export",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" data-theme="light" className={`${sans.variable} ${display.variable}`}>
      <body>{children}</body>
    </html>
  );
}
