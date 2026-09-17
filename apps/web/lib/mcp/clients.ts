export type McpClientSlug = "chatgpt" | "claude" | "grok";

export type McpClient = {
  slug: McpClientSlug;
  name: string;
  description: string;
  clientId: string;
  logoSrc: string;
};

export const MCP_ENDPOINT = "https://www.neonix.video/api/mcp";

export const MCP_CLIENTS: McpClient[] = [
  {
    slug: "claude",
    name: "Claude",
    description: "Create and refine motion projects from a conversation.",
    clientId: "5c365b60-7190-4e77-90c7-52af523b1d27",
    logoSrc: "/logo/claude-logo.svg",
  },
  {
    slug: "grok",
    name: "Grok",
    description: "Give Grok a secure connection to your Neonix workspace.",
    clientId: "ec4a6d6d-8b36-4c8b-897f-9a3b7982ae10",
    logoSrc: "/logo/grok-logo.svg",
  },
  {
    slug: "chatgpt",
    name: "ChatGPT",
    description: "Turn structured intent into editable motion and exports.",
    clientId: "51923cdd-fcac-4cac-adf7-fbfa414361a0",
    logoSrc: "/logo/openai-logo.svg",
  },
];
