import { HubFrame } from "@/components/hub/HubFrame";
import { McpWorkspace } from "@/components/hub/McpWorkspace";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "MCP | Neonix",
  description: "Connect Claude, ChatGPT, and Grok to Neonix through MCP.",
};

export default function McpPage() {
  return (
    <HubFrame>
      <McpWorkspace />
    </HubFrame>
  );
}
