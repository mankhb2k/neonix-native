import { Be_Vietnam_Pro, Fraunces, Roboto_Mono } from "next/font/google";
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

const mono = Roboto_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-roboto-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "NeonVideo",
  description: "AI Studio — neon / cyber motion graphics từ brief đến export",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      data-theme="dark"
      className={`${sans.variable} ${display.variable} ${mono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
