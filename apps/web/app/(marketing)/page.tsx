import { LandingPage } from "@/components/site/LandingPage";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Neonix — Neon Cyberpunk Video Generator",
  description:
    "Create neon motion videos with Claude and Remote MCP. Build music visualizers, cyberpunk stories, glowing titles, and editable motion templates.",
};

export default function MarketingHomePage() {
  return <LandingPage />;
}
