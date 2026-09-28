import "server-only";

import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { getUserExportsProvider } from "@/lib/server/r2";
import { buildHtmlRenderOutputKey, updateHtmlRenderJob } from "./html-job-store";

/**
 * Kiến trúc B (HTML Frame Render) — see ARCHITECHTURE.md "Hai kiến trúc
 * render độc lập". Shells out to packages/render-html/render_neonix_video.py
 * (headless Chromium via Playwright, frame-by-frame, muxed with ffmpeg).
 * Deliberately does not touch Protocol/Compiler/Runtime/PaintCommandBuffer —
 * those belong to Kiến trúc A only.
 *
 * Runs as a fire-and-forget background task from the caller's perspective
 * (see `dispatchHtmlRenderInBackground`): the calling MCP tool returns a
 * "queued" job immediately and the caller polls get_export. This only
 * actually backgrounds correctly on a persistent Node process (dev server,
 * a long-lived container); an ephemeral serverless function that freezes
 * right after responding would kill this mid-render — a real production
 * deployment needs a separate worker process, not this same request handler.
 */

/** Matches project-runtime.ts's own repoRoot() — process.cwd() survives bundling, __dirname does not. */
function repoRoot(): string {
  const cwd = resolve(process.cwd());
  const normalized = cwd.replace(/\\/g, "/");
  if (normalized.endsWith("/apps/web")) return resolve(cwd, "..", "..");
  return cwd;
}

function renderScriptPath(): string {
  return join(repoRoot(), "packages", "render-html", "render_neonix_video.py");
}

function findPython(): string {
  return process.env.NEONIX_RENDER_HTML_PYTHON?.trim() || "python3";
}

function runProcess(command: string, args: string[]): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString("utf8"); });
    child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString("utf8"); });
    child.on("error", reject);
    child.on("close", (code) => resolvePromise({ code, stdout, stderr }));
  });
}

export type HtmlRenderComposition = {
  width: number;
  height: number;
  fps: number;
  durationMs: number;
};

export type HtmlRenderInput = {
  jobId: string;
  workspaceId: string;
  html: string;
  composition: HtmlRenderComposition;
};

async function renderAndUpload(input: HtmlRenderInput): Promise<void> {
  const workDir = await mkdtemp(join(tmpdir(), "neonix-html-render-"));
  const htmlPath = join(workDir, "input.html");
  const outputPath = join(workDir, "output.mp4");
  try {
    await writeFile(htmlPath, input.html, "utf8");
    const durationSeconds = input.composition.durationMs / 1000;
    const args = [
      renderScriptPath(),
      "--html", htmlPath,
      "--out", outputPath,
      "--width", String(input.composition.width),
      "--height", String(input.composition.height),
      "--fps", String(input.composition.fps),
      "--duration", String(durationSeconds),
    ];
    const result = await runProcess(findPython(), args);
    if (result.code !== 0) {
      const detail = result.stderr.trim() || result.stdout.trim() || `render process exited with code ${result.code}`;
      throw new Error(detail.slice(0, 2000));
    }

    const video = await readFile(outputPath);
    const outputKey = buildHtmlRenderOutputKey(input.workspaceId, input.jobId);
    await getUserExportsProvider().putObject({ key: outputKey, body: video, contentType: "video/mp4" });
    await updateHtmlRenderJob(input.jobId, { status: "done", outputKey, finished: true });
  } catch (error) {
    await updateHtmlRenderJob(input.jobId, {
      status: "failed",
      errorMessage: error instanceof Error ? error.message : String(error),
      finished: true,
    });
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

/**
 * Starts the render without waiting for it to finish. The caller (an MCP
 * tool handler) should return a "queued" job right after calling this, not
 * await it — a single render can take many minutes (see the script's own
 * benchmark notes), far longer than any HTTP/MCP transport timeout.
 */
export function dispatchHtmlRenderInBackground(input: HtmlRenderInput): void {
  void updateHtmlRenderJob(input.jobId, { status: "rendering" })
    .then(() => renderAndUpload(input))
    .catch(async (error) => {
      await updateHtmlRenderJob(input.jobId, {
        status: "failed",
        errorMessage: error instanceof Error ? error.message : String(error),
        finished: true,
      }).catch(() => undefined);
    });
}
