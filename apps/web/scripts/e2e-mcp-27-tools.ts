import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

loadEnvConfig(process.cwd(), false);

type Json = Record<string, unknown>;
type ToolResult = {
  isError?: boolean;
  structuredContent?: Json;
  content?: Array<{ type: string; text?: string }>;
};

type CaseResult = {
  tool: string;
  status: "passed" | "failed" | "blocked";
  elapsedMs: number;
  detail?: string;
};

const EXPECTED_TOOLS = [
  "list_workspaces",
  "get_project_json",
  "apply_json_patch",
  "get_project_html",
  "update_project_html",
  "list_html_revisions",
  "get_html_revision",
  "list_assets",
  "request_asset_upload",
  "complete_asset_upload",
  "import_asset",
  "attach_asset_to_project",
  "delete_asset",
  "create_export",
  "get_export",
  "get_export_download_url",
  "cancel_export",
  "create_project_html",
  "list_projects",
  "get_project",
  "update_project",
  "delete_project",
  "open_editor",
  "open_preview",
  "get_capabilities",
  "validate_html",
  "compile_html",
] as const;

const required = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
};

const sleep = (milliseconds: number) => new Promise<void>((resolvePromise) => setTimeout(resolvePromise, milliseconds));

function payloadOf(response: ToolResult): Json {
  if (response.structuredContent) return response.structuredContent;
  const text = response.content?.find((item) => item.type === "text")?.text;
  if (!text) throw new Error(`MCP response has no structured content: ${JSON.stringify(response)}`);
  return JSON.parse(text) as Json;
}

function valueAt(value: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, part) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as Json)[part];
  }, value);
}

function stringAt(value: unknown, path: string): string | undefined {
  const item = valueAt(value, path);
  return typeof item === "string" && item.length > 0 ? item : undefined;
}

function numberAt(value: unknown, path: string): number | undefined {
  const item = valueAt(value, path);
  return typeof item === "number" && Number.isFinite(item) ? item : undefined;
}

function revisionNumber(value: unknown, path: string): number | undefined {
  return numberAt(value, `${path}.revisionNo`) ?? numberAt(value, `${path}.revision_no`);
}

function redactUrl(value: string): string {
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`;
  } catch {
    return "invalid-url";
  }
}

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

async function main() {
  const endpoint = process.env.MCP_E2E_ENDPOINT?.trim() || "http://localhost:3000/api/mcp";
  const supabase = createClient(required("NEXT_PUBLIC_SUPABASE_URL"), required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const signedIn = await supabase.auth.signInWithPassword({
    email: required("DEV_DEMO_EMAIL"),
    password: required("DEV_DEMO_PASSWORD"),
  });
  if (signedIn.error || !signedIn.data.session) throw signedIn.error ?? new Error("Demo login did not return a session");

  const transport = new StreamableHTTPClientTransport(new URL(endpoint), {
    requestInit: { headers: { Authorization: `Bearer ${signedIn.data.session.access_token}` } },
  });
  const client = new Client({ name: "neonix-mcp-27-tools-e2e", version: "1.0.0" });
  const cases: CaseResult[] = [];
  const runId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const title = `MCP 27-tool E2E ${runId}`;
  const idempotencyKey = `mcp-27-tools-${runId}`;
  const fixture = `<!doctype html>
<html>
  <head>
    <meta name="neonix-document" content='{"kind":"neonix-html-document","schemaVersion":2,"composition":{"width":320,"height":180,"fps":30,"background":"#081018","colorSpace":"srgb"}}'>
    <style>
      html, body { margin: 0; width: 320px; height: 180px; overflow: hidden; background: #081018; }
      .stage { position: relative; width: 320px; height: 180px; color: #e8f8f4; font-family: Inter; }
      .card { position: absolute; left: 24px; top: 32px; width: 272px; height: 116px; border-radius: 16px; background: linear-gradient(135deg, #0d9488, #172554); }
      h1 { position: absolute; left: 44px; top: 52px; margin: 0; font-size: 25px; font-weight: 700; }
      p { position: absolute; left: 46px; top: 94px; margin: 0; font-size: 12px; opacity: .82; }
    </style>
  </head>
  <body><main class="stage"><div class="card"></div><h1>Neonix E2E</h1><p>27 tool contract check</p></main></body>
</html>`;
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="#0d9488"/></svg>`);
  const importedUrl = process.env.MCP_E2E_IMPORT_URL?.trim() || "https://www.neonix.video/preview/image/img-alpha.png";
  const timeoutMs = Number(process.env.MCP_E2E_EXPORT_TIMEOUT_MS ?? 10 * 60_000);
  const pollMs = Math.max(500, Number(process.env.MCP_E2E_EXPORT_POLL_MS ?? 1_500));
  let projectId: string | undefined;
  let publicRef: string | undefined;
  let workspaceId: string | undefined;
  let assetId: string | undefined;
  let importedAssetId: string | undefined;
  let exportJobId: string | undefined;
  let cancelledJobId: string | undefined;
  let currentRevision = 1;
  let currentHtmlRevision = 1;
  let suiteError: string | undefined;

  await client.connect(transport);
  const call = async (tool: string, args: Json = {}): Promise<Json> => {
    const response = await client.callTool({ name: tool, arguments: args });
    if (response.isError) throw new Error(`${tool} returned MCP error: ${JSON.stringify(response)}`);
    return payloadOf(response as ToolResult);
  };
  const test = async (tool: string, action: () => Promise<unknown>, options?: { required?: boolean }) => {
    const started = Date.now();
    try {
      await action();
      cases.push({ tool, status: "passed", elapsedMs: Date.now() - started });
    } catch (error) {
      cases.push({ tool, status: options?.required === false ? "blocked" : "failed", elapsedMs: Date.now() - started, detail: errorText(error) });
      if (options?.required !== false) throw error;
    }
  };

  try {
    const listed = await client.listTools();
    const listedNames = listed.tools.map((tool) => tool.name);
    const missing = EXPECTED_TOOLS.filter((name) => !listedNames.includes(name));
    const missingTitles = listed.tools.filter((tool) => !tool.annotations?.title).map((tool) => tool.name);
    if (missing.length > 0) throw new Error(`MCP tool inventory missing: ${missing.join(", ")}`);
    if (missingTitles.length > 0) throw new Error(`MCP tool inventory missing annotations.title: ${missingTitles.join(", ")}`);
    if (listedNames.includes("create_project")) throw new Error("Legacy create_project is still public");

    await test("list_workspaces", async () => {
      const result = await call("list_workspaces");
      const workspaces = valueAt(result, "workspaces");
      if (!Array.isArray(workspaces) || workspaces.length === 0) throw new Error("No workspace returned");
      workspaceId = stringAt(workspaces[0], "id");
      if (!workspaceId) throw new Error("Workspace has no id");
    });

    await test("get_capabilities", async () => {
      const result = await call("get_capabilities");
      if (!result || typeof result !== "object") throw new Error("Capabilities payload is empty");
    });
    await test("validate_html", async () => {
      const result = await call("validate_html", { html: fixture });
      if (valueAt(result, "valid") === false) throw new Error(`HTML validation failed: ${JSON.stringify(result)}`);
    });
    await test("compile_html", async () => {
      const result = await call("compile_html", { html: fixture });
      if (!result || typeof result !== "object") throw new Error("Compile payload is empty");
    });

    await test("create_project_html", async () => {
      const result = await call("create_project_html", { workspace_id: workspaceId, title, html: fixture, idempotency_key: idempotencyKey });
      projectId = stringAt(result, "project.id");
      publicRef = stringAt(result, "project.publicRef");
      currentRevision = numberAt(result, "project.currentRevisionNo") ?? 1;
      currentHtmlRevision = numberAt(result, "htmlRevision.revisionNo") ?? 1;
      if (!projectId || !publicRef) throw new Error(`Project identity missing: ${JSON.stringify(result)}`);
    });

    const ref = () => ({ project_id: projectId });
    await test("list_projects", async () => {
      const result = await call("list_projects", { workspace_id: workspaceId, limit: 50 });
      const projects = valueAt(result, "projects");
      if (!Array.isArray(projects) || !projects.some((item) => stringAt(item, "id") === projectId)) throw new Error("Created project is not listed");
    });
    await test("get_project", async () => {
      const result = await call("get_project", ref());
      if (stringAt(result, "id") !== projectId) throw new Error("get_project returned a different project");
    });
    await test("get_project_html", async () => {
      const result = await call("get_project_html", ref());
      if (typeof result.html !== "string" || result.html.length === 0) throw new Error("HTML source is empty");
      currentHtmlRevision = revisionNumber(result, "htmlRevision") ?? currentHtmlRevision;
      currentRevision = numberAt(result, "project.currentRevisionNo") ?? numberAt(result, "project.current_revision_no") ?? currentRevision;
    });
    await test("get_project_json", async () => {
      const result = await call("get_project_json", ref());
      if (stringAt(result, "projectId") !== projectId) throw new Error("get_project_json returned a different project");
      currentRevision = numberAt(result, "revision.revisionNo") ?? currentRevision;
    });
    await test("list_html_revisions", async () => {
      const result = await call("list_html_revisions", ref());
      if (!Array.isArray(valueAt(result, "revisions"))) throw new Error("HTML revisions is not an array");
    });
    await test("get_html_revision", async () => {
      const result = await call("get_html_revision", { ...ref(), revision_no: currentHtmlRevision });
      if (revisionNumber(result, "revision") !== currentHtmlRevision) throw new Error("Wrong HTML revision returned");
    });
    await test("update_project_html", async () => {
      const updatedHtml = fixture.replace("27 tool contract check", "27 tool contract check updated");
      const result = await call("update_project_html", {
        ...ref(), html: updatedHtml,
        expected_html_revision_no: currentHtmlRevision,
        expected_protocol_revision_no: currentRevision,
      });
      currentHtmlRevision = revisionNumber(result, "htmlRevision") ?? currentHtmlRevision + 1;
      currentRevision = revisionNumber(result, "protocolRevision") ?? currentRevision + 1;
    });
    await test("update_project", async () => {
      const result = await call("update_project", { ...ref(), title: `${title} updated`, expected_revision_no: currentRevision });
      if (stringAt(result, "project.id") !== projectId) throw new Error("update_project returned a different project");
    });
    await test("apply_json_patch", async () => {
      const result = await call("apply_json_patch", {
        ...ref(),
        expected_protocol_revision_no: currentRevision,
        patch: {
          format: "motion-protocol-patch",
          formatVersion: 2,
          baseRevision: currentRevision,
          operations: [{ op: "setComposition", changes: { background: "#081018" } }],
        },
      });
      currentRevision = numberAt(result, "project.currentRevisionNo") ?? currentRevision + 1;
    });
    await test("open_editor", async () => {
      const result = await call("open_editor", ref());
      if (!stringAt(result, "editor_url")) throw new Error("Editor URL missing");
    });
    await test("open_preview", async () => {
      const result = await call("open_preview", ref());
      if (!stringAt(result, "preview_url")) throw new Error("Preview URL missing");
    });

    await test("list_assets", async () => {
      const result = await call("list_assets", { workspace_id: workspaceId });
      if (!Array.isArray(valueAt(result, "assets"))) throw new Error("Assets is not an array");
    });
    await test("request_asset_upload", async () => {
      const result = await call("request_asset_upload", {
        workspace_id: workspaceId,
        filename: `mcp-27-tools-${runId}.svg`,
        mime_type: "image/svg+xml",
        byte_size: svg.byteLength,
      });
      assetId = stringAt(result, "asset.assetId");
      const uploadUrl = stringAt(result, "uploadUrl");
      if (!assetId || !uploadUrl) throw new Error("Upload session did not return asset id and URL");
      const method = stringAt(result, "method") ?? "PUT";
      const headers = (valueAt(result, "headers") ?? {}) as Record<string, string>;
      const uploaded = await fetch(uploadUrl, { method, headers, body: svg, signal: AbortSignal.timeout(60_000) });
      if (!uploaded.ok) throw new Error(`Asset upload returned HTTP ${uploaded.status}`);
    });
    await test("complete_asset_upload", async () => {
      if (!assetId) throw new Error("Upload asset id is unavailable");
      const result = await call("complete_asset_upload", { asset_id: assetId });
      if (stringAt(result, "asset.status") !== "ready") throw new Error(`Asset is not ready: ${JSON.stringify(result)}`);
    });
    await test("import_asset", async () => {
      const result = await call("import_asset", { workspace_id: workspaceId, source_url: importedUrl, filename: `mcp-import-${runId}.png` });
      importedAssetId = stringAt(result, "asset.assetId");
      if (!importedAssetId) throw new Error("Imported asset id is missing");
    });
    await test("attach_asset_to_project", async () => {
      if (!assetId || !projectId) throw new Error("Upload asset or project id is unavailable");
      const result = await call("attach_asset_to_project", { ...ref(), asset_id: assetId });
      if (result.attached !== true) throw new Error("Asset was not attached");
    });
    await test("delete_asset", async () => {
      if (!assetId) throw new Error("Upload asset id is unavailable");
      const result = await call("delete_asset", { workspace_id: workspaceId, asset_id: assetId, replace_references: true });
      if (result.deleted !== true) throw new Error("Uploaded asset was not deleted");
      assetId = undefined;
      if (importedAssetId) {
        const imported = await call("delete_asset", { workspace_id: workspaceId, asset_id: importedAssetId, replace_references: true });
        if (imported.deleted !== true) throw new Error("Imported asset was not deleted");
        importedAssetId = undefined;
      }
    });

    const statusHistory: Array<{ status?: string; stage?: string; progress?: number }> = [];
    await test("create_export", async () => {
      const result = await call("create_export", { ...ref(), preset: "export-1080p", idempotency_key: `${idempotencyKey}:export` });
      exportJobId = stringAt(result, "export.jobId");
      if (!exportJobId) throw new Error("Export job id is missing");
      statusHistory.push({ status: stringAt(result, "export.status"), stage: stringAt(result, "export.stage"), progress: numberAt(result, "export.progress") });
    });
    await test("get_export", async () => {
      if (!exportJobId) throw new Error("Export job id is unavailable");
      const deadline = Date.now() + timeoutMs;
      let last: Json | undefined;
      while (Date.now() < deadline) {
        last = await call("get_export", { job_id: exportJobId });
        const current = valueAt(last, "export");
        const snapshot = { status: stringAt(current, "status"), stage: stringAt(current, "stage"), progress: numberAt(current, "progress") };
        const previous = statusHistory.at(-1);
        if (!previous || JSON.stringify(previous) !== JSON.stringify(snapshot)) statusHistory.push(snapshot);
        if (["done", "failed", "cancelled"].includes(snapshot.status ?? "")) break;
        await sleep(pollMs);
      }
      if (statusHistory.at(-1)?.status !== "done") throw new Error(`Export did not finish: ${JSON.stringify({ exportJobId, statusHistory, last })}`);
    });
    await test("get_export_download_url", async () => {
      if (!exportJobId) throw new Error("Export job id is unavailable");
      const result = await call("get_export_download_url", { job_id: exportJobId });
      const url = stringAt(result, "url");
      if (!url) throw new Error("Download URL is missing");
      const head = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(30_000) });
      const checked = head.ok ? head : await fetch(url, { headers: { Range: "bytes=0-1023" }, signal: AbortSignal.timeout(30_000) });
      if (!checked.ok && checked.status !== 206) throw new Error(`Download URL returned HTTP ${checked.status}`);
      const contentType = checked.headers.get("content-type") ?? "";
      if (!contentType.includes("video/mp4") && !contentType.includes("application/octet-stream")) throw new Error(`Unexpected content type: ${contentType}`);
      console.log(JSON.stringify({ downloadUrl: redactUrl(url), headStatus: head.status, rangedStatus: checked.status, contentType }));
    });
    await test("cancel_export", async () => {
      const result = await call("create_export", { ...ref(), preset: "export-1080p", idempotency_key: `${idempotencyKey}:cancel` });
      cancelledJobId = stringAt(result, "export.jobId");
      if (!cancelledJobId) throw new Error("Cancellation test job id is missing");
      const cancelled = await call("cancel_export", { job_id: cancelledJobId });
      const status = stringAt(cancelled, "export.status");
      if (!["queued", "rendering", "publishing", "cancelled", "done", "failed"].includes(status ?? "")) throw new Error(`Unexpected cancellation status: ${status}`);
    });
  } catch (error) {
    suiteError = errorText(error);
    console.error(`MCP 27-tool suite stopped: ${suiteError}`);
  } finally {
    if (assetId || importedAssetId) {
      for (const candidate of [assetId, importedAssetId]) {
        if (!candidate) continue;
        try { await call("delete_asset", { workspace_id: workspaceId, asset_id: candidate, replace_references: true }); } catch (error) { console.error(`cleanup delete_asset failed: ${errorText(error)}`); }
      }
    }
    if (projectId) {
      await test("delete_project", async () => {
        const result = await call("delete_project", { project_id: projectId });
        if (result.deleted !== true) throw new Error("Disposable project was not deleted");
      }, { required: false });
    }
    await client.close();
  }

  const expectedSet = new Set(EXPECTED_TOOLS);
  const testedSet = new Set(cases.map((item) => item.tool));
  for (const tool of EXPECTED_TOOLS) {
    if (!testedSet.has(tool)) cases.push({ tool, status: "blocked", elapsedMs: 0, detail: "Not reached because a prerequisite test failed" });
  }
  const report = {
    generatedAt: new Date().toISOString(),
    endpoint,
    expectedToolCount: expectedSet.size,
    suiteError: suiteError ?? null,
    cases,
    passed: cases.filter((item) => item.status === "passed").length,
    failed: cases.filter((item) => item.status === "failed").length + (suiteError ? 1 : 0),
    blocked: cases.filter((item) => item.status === "blocked").length,
    cleanup: { projectId, exportJobId, cancelledJobId },
  };
  const reportPath = resolve(process.cwd(), "../../docs/benchmark/results", `mcp-27-tools-e2e-${new Date().toISOString().replaceAll(":", "-")}.json`);
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ ...report, reportPath }, null, 2));
  if (report.failed > 0 || report.blocked > 0 || report.passed !== expectedSet.size) process.exitCode = 1;
}

void main().catch((error: unknown) => {
  console.error(errorText(error));
  process.exitCode = 1;
});
