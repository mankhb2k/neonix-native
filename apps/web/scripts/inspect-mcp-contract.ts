import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

loadEnvConfig(process.cwd(), false);

const required = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
};

async function main() {
  const supabase = createClient(required("NEXT_PUBLIC_SUPABASE_URL"), required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const signedIn = await supabase.auth.signInWithPassword({
    email: required("DEV_DEMO_EMAIL"),
    password: required("DEV_DEMO_PASSWORD"),
  });
  if (signedIn.error || !signedIn.data.session) throw signedIn.error ?? new Error("Demo login failed");

  const endpoint = process.env.MCP_INSPECT_ENDPOINT?.trim() || process.env.MCP_SERVER_URL?.trim() || "http://localhost:3000/api/mcp";
  const transport = new StreamableHTTPClientTransport(new URL(endpoint), {
    requestInit: { headers: { Authorization: `Bearer ${signedIn.data.session.access_token}` } },
  });
  const client = new Client({ name: "neonix-mcp-contract-inspector", version: "1.0.0" });
  await client.connect(transport);
  try {
    const tools = await client.listTools();
    const createHtml = tools.tools.find((tool) => tool.name === "create_project_html");
    const capabilities = tools.tools.find((tool) => tool.name === "get_capabilities");
    const resources = await client.listResources();
    const prompts = await client.listPrompts();
    console.log(JSON.stringify({
      endpoint,
      toolNames: tools.tools.map((tool) => tool.name),
      legacyCreateProjectPresent: tools.tools.some((tool) => tool.name === "create_project"),
      createProjectHtml: createHtml ? {
        description: createHtml.description,
        inputSchema: createHtml.inputSchema,
        outputSchema: createHtml.outputSchema,
        annotations: createHtml.annotations,
        meta: createHtml._meta,
      } : null,
      getCapabilities: capabilities ? {
        description: capabilities.description,
        inputSchema: capabilities.inputSchema,
        outputSchema: capabilities.outputSchema,
      } : null,
      resources: resources.resources.map((resource) => ({ uri: resource.uri, name: resource.name, mimeType: resource.mimeType })),
      prompts: prompts.prompts.map((prompt) => ({ name: prompt.name, title: prompt.title, description: prompt.description })),
    }, null, 2));
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
