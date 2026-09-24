import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { readFile } from "node:fs/promises";

// Ad-hoc test (not meant to be committed): dispatches 2 exports in parallel
// to confirm the render-queue-worker's new maxConcurrency actually lets 2
// Cloud Run Job executions run at the same time instead of queueing behind
// each other.
loadEnvConfig(process.cwd());

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

function payloadOf(response: ToolResponse): Record<string, unknown> {
  if (response.structuredContent) return response.structuredContent;
  const text = response.content?.find((item) => item.type === "text")?.text;
  if (!text) throw new Error(`MCP response has no structured content: ${JSON.stringify(response)}`);
  return JSON.parse(text) as Record<string, unknown>;
}

function assertToolOk(name: string, response: ToolResponse): Record<string, unknown> {
  if (response.isError) throw new Error(`${name} returned an MCP error: ${JSON.stringify(response)}`);
  return payloadOf(response);
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function runOne(client: Client, admin: any, html: string, label: string) {
  const runId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const title = `Concurrency test ${label} ${runId}`;
  const idempotencyKey = `concurrency-${label}-${runId}`;

  const createdResponse = await client.callTool({
    name: "create_project_html",
    arguments: { title, html, idempotency_key: idempotencyKey },
  });
  const created = assertToolOk("create_project_html", createdResponse) as { project?: { id?: string } };
  const projectId = created.project?.id;
  if (!projectId) throw new Error(`[${label}] create_project_html did not return project.id`);

  const dispatchedAt = Date.now();
  const exportStartedResponse = await client.callTool({
    name: "create_export",
    arguments: { project_id: projectId, preset: "export-1080p", idempotency_key: `${idempotencyKey}:export` },
  });
  const exportPayload = assertToolOk("create_export", exportStartedResponse) as { export?: { jobId?: string } };
  const jobId = exportPayload.export?.jobId;
  if (!jobId) throw new Error(`[${label}] create_export did not return export.jobId`);
  console.log(JSON.stringify({ label, jobId, dispatchedAtMs: dispatchedAt }));

  const deadline = Date.now() + 10 * 60_000;
  while (Date.now() < deadline) {
    const currentResponse = await client.callTool({ name: "get_export", arguments: { job_id: jobId } });
    const current = assertToolOk("get_export", currentResponse) as { export?: { status?: string; stage?: string } };
    if (["done", "failed", "cancelled"].includes(current.export?.status ?? "")) {
      const finishedAt = Date.now();
      const row = await admin.from("render_jobs").select("public_ref, status, error_code, created_at, updated_at, finished_at").eq("public_ref", jobId).single();
      return { label, jobId, dispatchedAtMs: dispatchedAt, finishedAtMs: finishedAt, elapsedMs: finishedAt - dispatchedAt, status: current.export?.status, row: row.data };
    }
    await sleep(1_000);
  }
  throw new Error(`[${label}] export ${jobId} did not finish in time`);
}

async function main() {
  const supabaseUrl = required("NEXT_PUBLIC_SUPABASE_URL");
  const publishableKey = required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  const serviceRoleKey = required("SUPABASE_SERVICE_ROLE_KEY");
  const email = required("DEV_DEMO_EMAIL");
  const password = required("DEV_DEMO_PASSWORD");
  const endpoint = process.env.LOCAL_MCP_URL?.trim() || "http://localhost:3000/api/mcp";
  const fixturePath = "C:/Users/Admin/AppData/Local/Temp/claude/d--NextJS-neonix/cbef4988-35bd-4579-b93c-0c719ca0e11c/scratchpad/mcp-html-export-10s-demo.html";
  const html = await readFile(fixturePath, "utf8");

  const authClient = createClient(supabaseUrl, publishableKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const signedIn = await authClient.auth.signInWithPassword({ email, password });
  if (signedIn.error || !signedIn.data.session) throw signedIn.error ?? new Error("Demo login did not return a session");

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

  async function newClient() {
    const transport = new StreamableHTTPClientTransport(new URL(endpoint), {
      requestInit: { headers: { Authorization: `Bearer ${signedIn.data.session!.access_token}` } },
    });
    const client = new Client({ name: "neonix-concurrency-test", version: "1.0.0" });
    await client.connect(transport);
    return client;
  }

  const clientA = await newClient();
  const clientB = await newClient();

  try {
    const [resultA, resultB] = await Promise.all([
      runOne(clientA, admin, html, "A"),
      runOne(clientB, admin, html, "B"),
    ]);

    console.log(JSON.stringify({ ok: true, resultA, resultB }, null, 2));

    const aStart = resultA.dispatchedAtMs;
    const aEnd = resultA.finishedAtMs;
    const bStart = resultB.dispatchedAtMs;
    const bEnd = resultB.finishedAtMs;
    const overlapMs = Math.min(aEnd, bEnd) - Math.max(aStart, bStart);
    console.log(JSON.stringify({ overlapMs, ranConcurrently: overlapMs > 0 }));
  } finally {
    await clientA.close();
    await clientB.close();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
