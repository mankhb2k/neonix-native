import { McpClientPage } from "@/components/site/McpPage";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Neonix MCP for Grok",
  description: "Connect Grok to Neonix for editable motion video projects.",
  alternates: { canonical: "/docs/mcp/grok" },
};

export default function GrokMcpPage() {
  return <McpClientPage slug="grok" />;
}
