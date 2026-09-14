import { McpPage } from "@/components/site/McpPage";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Neonix MCP — Motion infrastructure for AI agents",
  description:
    "Connect Claude, Grok, and ChatGPT to Neonix through one secure MCP server for editable motion videos.",
};

export default function DocsMcpPage() {
  return <McpPage />;
}
