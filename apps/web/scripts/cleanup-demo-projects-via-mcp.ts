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

type ToolResponse = {
  [key: string]: unknown;
  isError?: boolean;
  structuredContent?: Record<string, unknown>;
  content?: Array<{ type: string; text?: string }>;
};

type DemoProject = {
  id: string;
  title: string;
  workspace_id: string;
  deleted_at: string | null;
};

function payloadOf(response: ToolResponse): Record<string, unknown> {
  if (response.structuredContent) return response.structuredContent;
  const text = response.content?.find((item) => item.type === "text")?.text;
  if (!text) throw new Error(`MCP response has no payload: ${JSON.stringify(response)}`);
  return JSON.parse(text) as Record<string, unknown>;
}

function assertToolOk(name: string, response: ToolResponse): Record<string, unknown> {
  if (response.isError) throw new Error(`${name} failed: ${JSON.stringify(response)}`);
  return payloadOf(response);
}

async function main() {
  const supabaseUrl = required("NEXT_PUBLIC_SUPABASE_URL");
  const publishableKey = required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  const serviceRoleKey = required("SUPABASE_SERVICE_ROLE_KEY");
  const email = required("DEV_DEMO_EMAIL");
  const password = required("DEV_DEMO_PASSWORD");
  const endpoint = process.env.LOCAL_MCP_URL?.trim() || "http://localhost:3000/api/mcp";

  const authClient = createClient(supabaseUrl, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const signedIn = await authClient.auth.signInWithPassword({ email, password });
  if (signedIn.error || !signedIn.data.session || !signedIn.data.user) {
    throw signedIn.error ?? new Error("Demo login did not return a session");
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const userId = signedIn.data.user.id;
  const memberships = await admin
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userId);
  if (memberships.error) throw memberships.error;

  const workspaceIds = (memberships.data ?? []).map((item) => item.workspace_id as string);
  const beforeQuery = workspaceIds.length
    ? await admin
        .from("projects")
        .select("id, title, workspace_id, deleted_at")
        .in("workspace_id", workspaceIds)
        .is("deleted_at", null)
        .order("created_at", { ascending: true })
    : { data: [], error: null };
  if (beforeQuery.error) throw beforeQuery.error;
  const before = (beforeQuery.data ?? []) as DemoProject[];

  const transport = new StreamableHTTPClientTransport(new URL(endpoint), {
    requestInit: {
      headers: { Authorization: `Bearer ${signedIn.data.session.access_token}` },
    },
  });
  const client = new Client({ name: "neonix-demo-project-cleanup", version: "1.0.0" });
  const deleted: Array<{ id: string; title: string; result: Record<string, unknown> }> = [];

  await client.connect(transport);
  try {
    const tools = await client.listTools();
    if (!tools.tools.some((tool) => tool.name === "delete_project")) {
      throw new Error("Local MCP does not expose delete_project");
    }

    for (const project of before) {
      const response = await client.callTool({
        name: "delete_project",
        arguments: { project_id: project.id },
      });
      deleted.push({ id: project.id, title: project.title, result: assertToolOk("delete_project", response) });
    }
  } finally {
    await client.close();
  }

  const afterQuery = workspaceIds.length
    ? await admin
        .from("projects")
        .select("id, title, workspace_id, deleted_at")
        .in("workspace_id", workspaceIds)
        .is("deleted_at", null)
        .order("created_at", { ascending: true })
    : { data: [], error: null };
  if (afterQuery.error) throw afterQuery.error;
  const after = (afterQuery.data ?? []) as DemoProject[];

  const deletedStateQuery = before.length
    ? await admin
        .from("projects")
        .select("id, deleted_at")
        .in("id", before.map((project) => project.id))
    : { data: [], error: null };
  if (deletedStateQuery.error) throw deletedStateQuery.error;

  console.log(JSON.stringify({
    ok: after.length === 0 && deleted.length === before.length,
    endpoint,
    demoUserId: userId,
    beforeCount: before.length,
    deletedCount: deleted.length,
    afterActiveCount: after.length,
    deletedProjects: deleted.map(({ id, title }) => ({ id, title })),
    retentionState: deletedStateQuery.data ?? [],
    remainingActiveProjects: after,
  }, null, 2));

  if (after.length !== 0 || deleted.length !== before.length) {
    throw new Error("Demo project cleanup verification failed");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
