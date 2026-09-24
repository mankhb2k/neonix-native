import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

loadEnvConfig(process.cwd());
const required = (name: string) => { const v = process.env[name]?.trim(); if (!v) throw new Error(`Missing ${name}`); return v; };

async function main() {
  const supabaseUrl = required("NEXT_PUBLIC_SUPABASE_URL");
  const publishableKey = required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  const email = required("DEV_DEMO_EMAIL");
  const password = required("DEV_DEMO_PASSWORD");
  const endpoint = "http://localhost:3000/api/mcp";

  const authClient = createClient(supabaseUrl, publishableKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const signedIn = await authClient.auth.signInWithPassword({ email, password });
  if (signedIn.error || !signedIn.data.session) throw signedIn.error ?? new Error("no session");

  const transport = new StreamableHTTPClientTransport(new URL(endpoint), {
    requestInit: { headers: { Authorization: `Bearer ${signedIn.data.session.access_token}` } },
  });
  const client = new Client({ name: "cleanup", version: "1.0.0" });
  await client.connect(transport);
  try {
    const ids = process.argv.slice(2);
    let ok = 0;
    let failed = 0;
    for (const projectId of ids) {
      const res = await client.callTool({ name: "delete_project", arguments: { project_id: projectId } });
      if (res.isError) { failed += 1; console.log(projectId, "FAILED", JSON.stringify(res)); }
      else { ok += 1; }
    }
    console.log(JSON.stringify({ ok, failed, total: ids.length }));
  } finally {
    await client.close();
  }
}
void main().catch((e) => { console.error(e); process.exitCode = 1; });
