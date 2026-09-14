import { McpClientPage } from "@/components/site/McpPage";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Neonix MCP for ChatGPT",
  description: "Connect ChatGPT to Neonix for editable motion video projects.",
};

export default function ChatGptMcpPage() {
  return <McpClientPage slug="chatgpt" />;
}
