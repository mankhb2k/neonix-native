import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createReadStream } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { isAbsolute, join, resolve } from "node:path";
import { renderRuntimeProjectV3 } from "./render";
import type { RuntimeProjectV3 } from "@motionvideo/motion-runtime";

const port = Number(process.env.EXPORT_RENDERER_PORT ?? 8787);
const workspaceRoot = resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const outputRoot = resolve(process.env.EXPORT_RENDERER_OUTPUT_ROOT ?? join(workspaceRoot, "tmp", "export-renderer"));

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function json(response: ServerResponse, status: number, body: unknown): void {
  response.statusCode = status;
  response.setHeader("content-type", "application/json");
  response.end(JSON.stringify(body));
}

function safeOutputName(name: string | undefined, projectId: string): string {
  const safeName = (name ?? `${projectId}-${Date.now()}.mp4`).replaceAll("\\", "/");
  if (isAbsolute(safeName) || safeName.includes("..") || !safeName.endsWith(".mp4")) throw new Error("outputName must be a relative .mp4 filename");
  return safeName;
}

function localOutputPath(name: string | undefined, projectId: string): { name: string; path: string } {
  const safeName = safeOutputName(name, projectId);
  return { name: safeName, path: join(outputRoot, safeName) };
}

function outputToken(outputName: string): string {
  return Buffer.from(outputName, "utf8").toString("base64url");
}

function outputNameFromToken(token: string): string {
  const outputName = Buffer.from(token, "base64url").toString("utf8");
  return safeOutputName(outputName, "output");
}

export function createExportRendererServer() {
  return createServer(async (request, response) => {
    try {
      if (request.method === "GET" && ["/health", "/healthz", "/readyz"].includes(request.url ?? "")) {
        json(response, 200, { ok: true, service: "export-renderer", renderer: "native-svg-ffmpeg" });
        return;
      }
      const requestUrl = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
      if (request.method === "GET" && requestUrl.pathname.startsWith("/v1/outputs/")) {
        const token = requestUrl.pathname.slice("/v1/outputs/".length);
        const outputName = outputNameFromToken(token);
        const outputPath = join(outputRoot, outputName);
        const output = await stat(outputPath).catch(() => null);
        if (!output?.isFile()) {
          json(response, 404, { error: "output_not_found" });
          return;
        }
        response.statusCode = 200;
        response.setHeader("content-type", "video/mp4");
        response.setHeader("content-length", String(output.size));
        createReadStream(outputPath).pipe(response);
        return;
      }
      if (request.method !== "POST" || request.url !== "/v1/renders") {
        json(response, 404, { error: "not_found" });
        return;
      }
      const body = await readJson(request) as { project?: RuntimeProjectV3; outputName?: string; frameCount?: number };
      if (!body.project) {
        json(response, 400, { error: "project_required" });
        return;
      }
      const output = localOutputPath(body.outputName, body.project.projectId);
      const stats = await renderRuntimeProjectV3(body.project, { outputPath: output.path, ...(body.frameCount ? { frameCount: body.frameCount } : {}) });
      json(response, 200, { ok: true, stats, outputName: output.name, downloadUrl: `/v1/outputs/${outputToken(output.name)}` });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      json(response, 500, { ok: false, error: message });
    }
  });
}

if (process.argv[1]?.endsWith("server.ts")) {
  await mkdir(outputRoot, { recursive: true });
  createExportRendererServer().listen(port, "0.0.0.0", () => {
    console.log(`export-renderer listening on http://0.0.0.0:${port}`);
    console.log(`local output root: ${outputRoot}`);
  });
}
