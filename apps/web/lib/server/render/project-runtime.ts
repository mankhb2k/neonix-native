import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { compileProtocol } from "@motionvideo/motion-compiler";
import { prepareRuntimeProjectV3Text, type RuntimeProjectV3 } from "@motionvideo/motion-runtime";
import type { MotionProtocolV2 } from "@motionvideo/motion-protocol/v2";

function repoRoot(): string {
  const cwd = path.resolve(process.cwd());
  const normalized = cwd.replace(/\\/g, "/");
  if (normalized.endsWith("/apps/web") || normalized.endsWith("/packages/export-renderer")) {
    return path.resolve(cwd, "../..");
  }
  return cwd;
}

async function loadFont(uri: string): Promise<Buffer | null> {
  const relative = uri.replace(/^\/+/, "");
  const localCandidates = [
    path.join(repoRoot(), "apps/web/public", relative),
    path.join(process.cwd(), "public", relative),
  ];

  for (const candidate of localCandidates) {
    try { return await readFile(candidate); } catch { /* try the next source */ }
  }

  // Serverless deployments do not expose the repository's public directory
  // as a normal filesystem path. Fetch the same public CDN URL used by the
  // browser so export text shaping remains deterministic in production.
  try {
    const requestedUrl = /^https?:\/\//i.test(uri)
      ? uri
      : new URL(`/${relative}`, process.env.NEXT_PUBLIC_MARKETING_URL?.trim() || "https://www.neonix.video").href;
    const response = await fetch(requestedUrl, { cache: "force-cache" });
    if (response.ok) return Buffer.from(await response.arrayBuffer());
  } catch { /* the compiler will report the missing font as a diagnostic */ }

  return null;
}

async function loadHarfBuzz(): Promise<typeof import("harfbuzzjs")> {
  const candidates = [
    path.join(process.cwd(), "node_modules/harfbuzzjs/dist/index.mjs"),
    path.join(process.cwd(), "apps/web/node_modules/harfbuzzjs/dist/index.mjs"),
    path.join(repoRoot(), "apps/web/node_modules/harfbuzzjs/dist/index.mjs"),
  ];

  const nativeImport = new Function("specifier", "return import(specifier)") as (specifier: string) => Promise<typeof import("harfbuzzjs")>;
  for (const candidate of candidates) {
    try {
      await readFile(candidate);
      return nativeImport(pathToFileURL(candidate).href);
    } catch { /* try the next deployment layout */ }
  }

  // The package is a production dependency of the web app. This fallback is
  // useful when the platform places traced dependencies outside the cwd.
  return nativeImport("harfbuzzjs");
}

export async function compileAndPrepareRuntimeProjectV3(document: MotionProtocolV2): Promise<RuntimeProjectV3> {
  const compiled = compileProtocol(document, { collectStats: true });
  if (!compiled.visual.nodes.some((node) => node.content.kind === "text")) return compiled;
  const harfbuzz = await loadHarfBuzz();
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
