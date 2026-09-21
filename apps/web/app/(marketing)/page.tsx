import { LandingPage } from "@/components/site/LandingPage";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "HTML to Motion Video for AI Agents",
  description:
    "Neonix is an HTML-to-motion-video compiler: it turns HTML and CSS into a real, exportable motion video. Connect Claude, ChatGPT or Grok over Remote MCP to create, preview and export motion projects.",
  alternates: { canonical: "/" },
};

const SOFTWARE_APPLICATION_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Neonix",
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Web",
  description:
    "Neonix is an HTML-to-motion-video compiler: it turns HTML and CSS into a real, exportable motion video.",
  url: "https://www.neonix.video",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
};

export default function MarketingHomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(SOFTWARE_APPLICATION_JSON_LD),
        }}
      />
      <LandingPage />
    </>
  );
}
