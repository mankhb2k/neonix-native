import { Be_Vietnam_Pro, Fraunces, Noto_Sans, Roboto_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
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

const notoSans = Noto_Sans({
  subsets: ["latin", "vietnamese"],
  weight: ["500", "600", "700"],
  variable: "--font-noto-sans",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.neonix.video"),
  title: {
    default: "Neonix",
    template: "%s | Neonix",
  },
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      className={`${sans.variable} ${display.variable} ${mono.variable} ${notoSans.variable}`}
    >
      <body>
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(ORGANIZATION_AND_WEBSITE_JSON_LD),
          }}
        />
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
