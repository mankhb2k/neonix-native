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
  metadataBase: new URL("https://www.neonix.video"),
  title: "Neonix",
  description:
    "Neonix is an HTML-to-motion-video compiler: it turns HTML and CSS into a real, exportable motion video.",
};

const ORGANIZATION_AND_WEBSITE_JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      name: "Neonix",
      url: "https://www.neonix.video",
      logo: "https://www.neonix.video/neonix-logo.svg",
      description:
        "Neonix is an HTML-to-motion-video compiler: it turns HTML and CSS into a real, exportable motion video.",
    },
    {
      "@type": "WebSite",
      name: "Neonix",
      url: "https://www.neonix.video",
      description:
        "Neonix is an HTML-to-motion-video compiler: it turns HTML and CSS into a real, exportable motion video.",
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${display.variable} ${mono.variable}`}
    >
      <body>
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(ORGANIZATION_AND_WEBSITE_JSON_LD),
          }}
        />
        {children}
      </body>
    </html>
  );
}
