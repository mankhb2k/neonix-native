import type { Metadata } from "next";
import {
  HeroSection,
  ProblemSection,
  CorePromiseSection,
  UseCasesSection,
  HowItWorksSection,
  FeatureGridSection,
  NeonEffectsShowcase,
  AudioReactiveSection,
  TemplateSection,
  JsonTrustSection,
  GallerySection,
  FinalCtaSection,
} from "@/components/site/landing";

export const metadata: Metadata = {
  title: "Neonix — Neon Cyberpunk Video Generator",
  description:
    "Create neon motion videos from JSON, audio, and AI. Music visualizers, cyberpunk stories, glowing titles, and AI-first motion templates.",
};

export default function MarketingHomePage() {
  return (
    <main>
      <HeroSection />
      <ProblemSection />
      <CorePromiseSection />
      <UseCasesSection />
      <HowItWorksSection />
      <FeatureGridSection />
      <NeonEffectsShowcase />
      <AudioReactiveSection />
      <TemplateSection />
      <JsonTrustSection />
      <GallerySection />
      <FinalCtaSection />
    </main>
  );
}
