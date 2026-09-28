import { CompilerLandingPage } from "@/components/site/CompilerLandingPage";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "HTML to JSON — Structured Motion Video for AI Agents",
  description:
    "Neonix compiles HTML and CSS into structured, editable JSON — named layers and properties instead of a flattened video frame. Connect Claude, ChatGPT or Grok over Remote MCP to create, preview and export motion projects.",
  alternates: { canonical: "/html-to-json" },
};

export default function HtmlToJsonPage() {
  return <CompilerLandingPage />;
}
