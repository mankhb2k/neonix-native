import { McpClientPage } from "@/components/site/McpPage";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Neonix MCP for Claude",
  description: "Connect Claude to Neonix for editable motion video projects.",
  alternates: { canonical: "/docs/mcp/claude" },
};

export default function ClaudeMcpPage() {
  return <McpClientPage slug="claude" />;
}
