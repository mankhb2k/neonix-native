export type McpClientSlug = "chatgpt" | "claude" | "grok";

export type McpClient = {
  slug: McpClientSlug;
  name: string;
  description: string;
  logoSrc: string;
};

export const MCP_ENDPOINT = "https://www.neonix.video/api/mcp";

export const MCP_CLIENTS: McpClient[] = [
  {
    slug: "claude",
    name: "Claude",
    description: "Create and refine motion projects from a conversation.",
    logoSrc: "/logo/claude-logo.svg",
  },
  {
    slug: "grok",
    name: "Grok",
    description: "Give Grok a secure connection to your Neonix workspace.",
    logoSrc: "/logo/grok-logo.svg",
  },
  {
    slug: "chatgpt",
    name: "ChatGPT",
    description: "Turn structured intent into editable motion and exports.",
    logoSrc: "/logo/openai-logo.svg",
  },
];
