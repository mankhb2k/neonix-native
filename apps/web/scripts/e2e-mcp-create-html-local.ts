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

const htmlFixture = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="neonix-document" content='{"kind":"neonix-html-document","schemaVersion":2,"composition":{"width":1920,"height":1080,"fps":30,"background":"#0b1220","colorSpace":"srgb"} }'>
    <style>
      html, body { width: 1920px; height: 1080px; margin: 0; overflow: hidden; }
      body { background: #0b1220; font-family: Inter, sans-serif; }
      .stage { position: absolute; inset: 0; background: linear-gradient(135deg, #0b1220, #20385a); }
      h1 { position: absolute; left: 160px; top: 180px; color: #f4f8ff; font-size: 72px; }
    </style>
  </head>
  <body><main class="stage"><h1>Local MCP HTML smoke test</h1></main></body>
</html>`;

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
  const before = await admin
    .from("projects")
    .select("id")
    .eq("created_by", signedIn.data.user.id)
    .is("deleted_at", null);
  if (before.error) throw before.error;

  const transport = new StreamableHTTPClientTransport(new URL(endpoint), {
    requestInit: {
      headers: { Authorization: `Bearer ${signedIn.data.session.access_token}` },
    },
  });
  const client = new Client({ name: "neonix-local-e2e", version: "1.0.0" });
  await client.connect(transport);

  try {
    const tools = await client.listTools();
    const names = new Set(tools.tools.map((tool) => tool.name));
    if (!names.has("create_project_html")) throw new Error("create_project_html is not registered");
    if (names.has("create_project")) throw new Error("Legacy create_project is still public");

    const idempotencyKey = `local-mcp-html-${Date.now()}`;
    const callParams = {
      name: "create_project_html",
      arguments: {
        title: "Local MCP HTML smoke test",
        html: htmlFixture,
        idempotency_key: idempotencyKey,
      },
    } as const;
    const created = await client.callTool(callParams);
    if (created.isError) {
      throw new Error(`create_project_html returned an MCP error: ${JSON.stringify(created)}`);
    }

    const payload = created.structuredContent as {
      project?: { id?: string; currentRevisionNo?: number; sourceFormat?: string };
      protocolRevision?: { id?: string };
      htmlRevision?: { id?: string };
    } | undefined;
    const projectId = payload?.project?.id;
    if (!projectId) throw new Error(`MCP response did not contain project.id: ${JSON.stringify(created)}`);

    const [project, protocolRevision, htmlRevision] = await Promise.all([
      admin.from("projects").select("id, title, source_format, current_revision_no").eq("id", projectId).single(),
      admin.from("project_revisions").select("id, project_id, revision_no, source_schema_version").eq("project_id", projectId).eq("revision_no", 1).single(),
      admin.from("project_html_revisions").select("id, project_id, revision_no, document_schema_version").eq("project_id", projectId).eq("revision_no", 1).single(),
    ]);
    if (project.error) throw project.error;
    if (protocolRevision.error) throw protocolRevision.error;
    if (htmlRevision.error) throw htmlRevision.error;

    const readBack = await client.callTool({
      name: "get_project_html",
      arguments: { project_id: projectId },
    });
    if (readBack.isError) throw new Error(`get_project_html read-back failed: ${JSON.stringify(readBack)}`);

    console.log(JSON.stringify({
      endpoint,
      userId: signedIn.data.user.id,
      toolContract: { createProjectHtml: true, legacyCreateProject: false },
      beforeProjectCount: before.data.length,
      created: {
        projectId,
        title: project.data.title,
        sourceFormat: project.data.source_format,
        currentRevisionNo: project.data.current_revision_no,
        protocolRevisionId: protocolRevision.data.id,
        htmlRevisionId: htmlRevision.data.id,
      },
      readBack: { ok: true },
    }, null, 2));
  } finally {
    await client.close();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
