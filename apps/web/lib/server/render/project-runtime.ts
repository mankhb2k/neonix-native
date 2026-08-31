import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { compileProtocol } from "@motionvideo/motion-compiler";
import { prepareRuntimeProjectV3Text, type RuntimeProjectV3 } from "@motionvideo/motion-runtime";
import type { MotionProtocolV2 } from "@motionvideo/motion-protocol/v2";

function repoRoot(): string {
  return process.cwd().replace(/\\/g, "/").endsWith("/apps/web") ? path.resolve(process.cwd(), "../..") : process.cwd();
}

async function loadFont(uri: string): Promise<Buffer | null> {
  const relative = uri.replace(/^\/+/, "");
  try { return await readFile(path.join(repoRoot(), "apps/web/public", relative)); } catch { return null; }
}

export async function compileAndPrepareRuntimeProjectV3(document: MotionProtocolV2): Promise<RuntimeProjectV3> {
  const compiled = compileProtocol(document);
  if (!compiled.visual.nodes.some((node) => node.content.kind === "text")) return compiled;
  const moduleUrl = pathToFileURL(path.join(repoRoot(), "apps/web/public/vendor/harfbuzz/index.mjs")).href;
  const harfbuzz = await import(moduleUrl) as typeof import("harfbuzzjs");
  const prepared = await prepareRuntimeProjectV3Text(
    compiled,
    (font) => loadFont(font.uri),
    () => Promise.resolve(harfbuzz),
  );
  const errors = prepared.diagnostics.filter((diagnostic) => diagnostic.severity === "error");
  if (errors.length > 0) {
    throw new Error(errors.map((diagnostic) => diagnostic.message).join(" | "));
  }
  return prepared.project;
}
