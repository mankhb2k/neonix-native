import { HomePage } from "./_components/HomePage";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Neonix — Cloud Rendering Infrastructure for Motion Graphic Video",
  description:
    "Neonix operates distributed infrastructure and large-scale cloud rendering to turn HTML/CSS into motion graphic video — auto-scaling, cost-optimized, and built for bulk video rendering.",
  alternates: { canonical: "/" },
};

const SOFTWARE_APPLICATION_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Neonix",
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Web",
  description:
    "Neonix operates distributed infrastructure and large-scale cloud rendering to turn HTML/CSS into motion graphic video at scale.",
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
      <HomePage />
    </>
  );
}
