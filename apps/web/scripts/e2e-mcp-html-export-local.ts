import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

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

type ExportPayload = {
  export?: {
    jobId?: string;
    projectId?: string;
    status?: string;
    progress?: number;
    stage?: string;
    error?: string | null;
    outputKey?: string | null;
    metrics?: Record<string, unknown> | null;
    createdAt?: number;
    updatedAt?: number;
  };
  created?: boolean;
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

function redactUrl(value: string): string {
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`;
  } catch {
    return "invalid-url";
  }
}

async function main() {
  const supabaseUrl = required("NEXT_PUBLIC_SUPABASE_URL");
  const publishableKey = required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  const serviceRoleKey = required("SUPABASE_SERVICE_ROLE_KEY");
  const email = required("DEV_DEMO_EMAIL");
  const password = required("DEV_DEMO_PASSWORD");
  const endpoint = process.env.LOCAL_MCP_URL?.trim() || "http://localhost:3000/api/mcp";
  const fixturePath = resolve(process.cwd(), "e2e/fixtures/mcp-html-export-2s.html");
  const html = await readFile(fixturePath, "utf8");
  const requestedProjectId = process.env.LOCAL_MCP_PROJECT_ID?.trim();
  const updateExisting = process.env.LOCAL_MCP_UPDATE_EXISTING?.trim().toLowerCase() === "true";
  const runId = Date.now().toString(36);
  const title = `Local MCP HTML export 2s ${runId}`;
  const idempotencyKey = `local-mcp-html-export-2s-${runId}`;
  const exportIdempotencyKey = `${idempotencyKey}:export-1080p`;
  const timeoutMilliseconds = Number(process.env.LOCAL_MCP_EXPORT_TIMEOUT_MS ?? 10 * 60_000);
  const pollMilliseconds = Math.max(500, Number(process.env.LOCAL_MCP_EXPORT_POLL_MS ?? 2_000));
  const startedAt = Date.now();

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
  const transport = new StreamableHTTPClientTransport(new URL(endpoint), {
    requestInit: {
      headers: { Authorization: `Bearer ${signedIn.data.session.access_token}` },
    },
  });
  const client = new Client({ name: "neonix-local-html-export-e2e", version: "1.0.0" });
  const statusHistory: Array<{ at: string; status: string; stage?: string; progress?: number }> = [];

  await client.connect(transport);
  try {
    const listed = await client.listTools();
    const toolNames = new Set(listed.tools.map((tool) => tool.name));
    const requiredTools = ["create_project_html", "create_export", "get_export", "get_export_download_url"];
    const missingTools = requiredTools.filter((name) => !toolNames.has(name));
    if (missingTools.length > 0) throw new Error(`Local MCP is missing tools: ${missingTools.join(", ")}`);
    if (toolNames.has("create_project")) throw new Error("Legacy create_project is still public on local MCP");

    let projectId = requestedProjectId;
    let creationMode: "created" | "reused" = "created";
    if (projectId) {
      const existingHtmlResponse = await client.callTool({ name: "get_project_html", arguments: { project_id: projectId } });
      const existingHtml = assertToolOk("get_project_html", existingHtmlResponse) as {
        html?: string;
        project?: { currentRevisionNo?: number };
        htmlRevision?: { revisionNo?: number };
      };
      if (typeof existingHtml.html !== "string") throw new Error(`Existing project ${projectId} has no HTML source`);
      if (existingHtml.html !== html) {
        if (!updateExisting) {
          throw new Error(`Existing project ${projectId} does not match ${basename(fixturePath)}; use LOCAL_MCP_UPDATE_EXISTING=true to update it.`);
        }
        const updatedResponse = await client.callTool({
          name: "update_project_html",
          arguments: {
            project_id: projectId,
            html,
            expected_html_revision_no: Number(existingHtml.htmlRevision?.revisionNo ?? 1),
            expected_protocol_revision_no: Number(existingHtml.project?.currentRevisionNo ?? 1),
          },
        });
        assertToolOk("update_project_html", updatedResponse);
        creationMode = "reused";
      }
      if (creationMode === "created") creationMode = "reused";
    } else {
      const createdResponse = await client.callTool({
        name: "create_project_html",
        arguments: { title, html, idempotency_key: idempotencyKey },
      });
      const created = assertToolOk("create_project_html", createdResponse) as {
        project?: { id?: string; currentRevisionNo?: number; sourceFormat?: string };
      };
      projectId = created.project?.id;
      if (!projectId) throw new Error(`create_project_html did not return project.id: ${JSON.stringify(createdResponse)}`);
    }

    const project = await admin.from("projects").select("id, title, source_format, current_revision_no").eq("id", projectId).single();
    if (project.error) throw project.error;
    const [protocolRevision, htmlRevision] = await Promise.all([
      admin.from("project_revisions").select("id, project_id, revision_no, source_schema_version").eq("project_id", projectId).eq("revision_no", project.data.current_revision_no).single(),
      admin.from("project_html_revisions").select("id, project_id, revision_no, document_schema_version").eq("project_id", projectId).eq("revision_no", project.data.current_revision_no).single(),
    ]);
    if (protocolRevision.error) throw protocolRevision.error;
    if (htmlRevision.error) throw htmlRevision.error;

    const exportStartedResponse = await client.callTool({
      name: "create_export",
      arguments: {
        project_id: projectId,
        preset: "export-1080p",
        idempotency_key: exportIdempotencyKey,
      },
    });
    let exportPayload = assertToolOk("create_export", exportStartedResponse) as ExportPayload;
    const initialExport = exportPayload.export;
    const jobId = initialExport?.jobId;
    if (!jobId) throw new Error(`create_export did not return export.jobId: ${JSON.stringify(exportStartedResponse)}`);

    const recordStatus = (job: NonNullable<ExportPayload["export"]>) => {
      const last = statusHistory.at(-1);
      if (!last || last.status !== job.status || last.stage !== job.stage || last.progress !== job.progress) {
        statusHistory.push({ at: new Date().toISOString(), status: job.status ?? "unknown", stage: job.stage, progress: job.progress });
        console.log(JSON.stringify(statusHistory.at(-1)));
      }
    };
    recordStatus(initialExport);

    const deadline = Date.now() + timeoutMilliseconds;
    while (Date.now() < deadline) {
      const currentResponse = await client.callTool({ name: "get_export", arguments: { job_id: jobId } });
      exportPayload = assertToolOk("get_export", currentResponse) as ExportPayload;
      const current = exportPayload.export;
      if (!current) throw new Error(`get_export returned no export: ${JSON.stringify(currentResponse)}`);
      recordStatus(current);
      if (["done", "failed", "cancelled"].includes(current.status ?? "")) break;
      await sleep(pollMilliseconds);
    }

    const finalExport = exportPayload.export;
    if (!finalExport || finalExport.status !== "done") {
      throw new Error(`Export did not complete: ${JSON.stringify({ jobId, finalExport, statusHistory })}`);
    }

    const downloadResponse = await client.callTool({
      name: "get_export_download_url",
      arguments: { job_id: jobId },
    });
    const download = assertToolOk("get_export_download_url", downloadResponse) as { jobId?: string; url?: string; expiresAt?: string };
    if (!download.url) throw new Error(`get_export_download_url did not return a URL: ${JSON.stringify(downloadResponse)}`);

    const head = await fetch(download.url, { method: "HEAD", signal: AbortSignal.timeout(30_000) });
    let downloadCheck = head;
    if (!head.ok) {
      // Some signed object endpoints reject HEAD while allowing a ranged GET.
      // Read only the first byte range so the E2E does not download the video.
      downloadCheck = await fetch(download.url, {
        headers: { Range: "bytes=0-1023" },
        signal: AbortSignal.timeout(30_000),
      });
    }
    const contentType = downloadCheck.headers.get("content-type");
    if (!downloadCheck.ok && downloadCheck.status !== 206) {
      throw new Error(`Download URL verification returned HTTP ${downloadCheck.status}`);
    }
    const verifiedUrl = downloadCheck.ok || downloadCheck.status === 206;
    const renderJob = await admin.from("render_jobs").select("public_ref, project_id, status, output_key, error_code, finished_at").eq("public_ref", jobId).single();
    if (renderJob.error) throw renderJob.error;

    const elapsedMilliseconds = Date.now() - startedAt;
    console.log(JSON.stringify({
      ok: true,
      endpoint,
      fixture: basename(fixturePath),
      composition: { width: 640, height: 360, fps: 30, expectedDurationSeconds: 2 },
      project: {
        id: projectId,
        creationMode,
        title: project.data.title,
        sourceFormat: project.data.source_format,
        currentRevisionNo: project.data.current_revision_no,
        protocolRevisionId: protocolRevision.data.id,
        htmlRevisionId: htmlRevision.data.id,
      },
      export: {
        jobId,
        status: finalExport.status,
        outputKey: finalExport.outputKey,
        metrics: finalExport.metrics,
        statusHistory,
      },
      download: {
        jobId: download.jobId,
        url: redactUrl(download.url),
        expiresAt: download.expiresAt,
        headStatus: head.status,
        rangedGetStatus: downloadCheck.status,
        contentType,
        verified: verifiedUrl,
      },
      databaseRenderJob: renderJob.data,
      elapsedMilliseconds,
    }, null, 2));
  } finally {
    await client.close();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
