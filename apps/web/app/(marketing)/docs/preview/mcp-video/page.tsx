import type { Metadata } from "next";
import { McpVideoPreviewLab } from "@/components/docs/McpVideoPreviewLab";

export const metadata: Metadata = {
  title: "MCP video preview lab",
  description: "Test the Neonix MCP Apps video preview UI without connecting a chat host.",
  robots: { index: false, follow: false },
};

export default function McpVideoPreviewPage() {
  return <McpVideoPreviewLab />;
}
