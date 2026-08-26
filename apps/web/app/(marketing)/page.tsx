import type { Metadata } from "next";
import { LandingPage } from "@/components/site/LandingPage";

export const metadata: Metadata = {
  title: "Neonix — Neon Cyberpunk Video Generator",
  description:
    "Create neon motion videos from JSON, audio, and AI. Music visualizers, cyberpunk stories, glowing titles, and AI-first motion templates.",
};

export default function MarketingHomePage() {
  return <LandingPage />;
}
