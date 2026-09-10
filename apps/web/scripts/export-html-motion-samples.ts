import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import type { MotionProtocolV2 } from "@motionvideo/motion-protocol/v2";
import { renderRuntimeProjectV3, type ExportRenderStats } from "@motionvideo/export-renderer";
import { compileDocument, type HtmlCompilerDiagnostic } from "@motionvideo/html-compiler";
import { HTML_COMPILER_PREVIEW_FONT_ASSETS } from "../lib/docs/html-compiler-preview";
import { compileAndPrepareRuntimeProjectV3 } from "../lib/server/render/project-runtime";

type SampleDefinition = {
  id: string;
  title: string;
  sourceFile: string;
};

type SampleManifest = {
  id: string;
  title: string;
  sourceFile: string;
  protocolFile: string;
  videoFile: string;
  composition: MotionProtocolV2["composition"];
  compilerDiagnostics: HtmlCompilerDiagnostic[];
  render: ExportRenderStats;
};

const samples: SampleDefinition[] = [
  { id: "marketing-launch", title: "Marketing launch", sourceFile: "marketing-launch.html" },
  { id: "product-story", title: "Product story", sourceFile: "product-story.html" },
  { id: "creative-brand", title: "Creative brand", sourceFile: "creative-brand.html" },
];

function repoRoot(): string {
  const cwd = resolve(process.cwd());
  return basename(cwd).toLowerCase() === "web" ? resolve(cwd, "../..") : cwd;
}

function requiredProtocol(result: ReturnType<typeof compileDocument>, sourceFile: string): MotionProtocolV2 {
  const errors = result.diagnostics.filter((diagnostic) => diagnostic.severity === "error");
  if (result.status !== "success" || !result.protocol || errors.length > 0) {
    const details = result.diagnostics.map((diagnostic) => `${diagnostic.code}: ${diagnostic.message}`).join(" | ");
    throw new Error(`Unable to compile ${sourceFile}: ${details || "unknown compiler error"}`);
  }
  return result.protocol;
}

async function main(): Promise<void> {
  const root = repoRoot();
  const sourceRoot = join(root, "docs", "preview", "html-compiler", "export-samples");
  const outputRoot = join(root, "tmp", "html-motion-exports");
  const publicRoot = join(root, "apps", "web", "public");
  const requestedFrameCount = process.env.HTML_MOTION_FRAME_COUNT
    ? Math.max(1, Number(process.env.HTML_MOTION_FRAME_COUNT))
    : undefined;

  await mkdir(outputRoot, { recursive: true });
  const exports: SampleManifest[] = [];

  for (const sample of samples) {
    const sourceFile = join(sourceRoot, sample.sourceFile);
    const html = await readFile(sourceFile, "utf8");
    const result = compileDocument(
      { html, fontAssets: HTML_COMPILER_PREVIEW_FONT_ASSETS },
      { composition: { durationMs: 10_000, id: `html-motion-${sample.id}` } },
    );
    const protocol = requiredProtocol(result, sample.sourceFile);
    const protocolFile = join(outputRoot, `${sample.id}.json`);
    const videoFile = join(outputRoot, `${sample.id}.mp4`);
    await writeFile(protocolFile, `${JSON.stringify(protocol, null, 2)}\n`, "utf8");

    const runtime = await compileAndPrepareRuntimeProjectV3(protocol);
    const render = await renderRuntimeProjectV3(runtime, {
      outputPath: videoFile,
      ...(requestedFrameCount === undefined ? {} : { frameCount: requestedFrameCount }),
      assetRoot: publicRoot,
      ffmpegLogLevel: "error",
    });

    exports.push({
      id: sample.id,
      title: sample.title,
      sourceFile: sample.sourceFile,
      protocolFile: protocolFile.replace(`${root}${process.platform === "win32" ? "\\" : "/"}`, ""),
      videoFile: videoFile.replace(`${root}${process.platform === "win32" ? "\\" : "/"}`, ""),
      composition: protocol.composition,
      compilerDiagnostics: result.diagnostics,
      render,
    });
  }

  const manifest = {
    contract: "html-document -> Protocol V2 -> Skia WASM -> MP4",
    durationSeconds: 10,
    requestedFrameCount: requestedFrameCount ?? "full",
    samples: exports,
  };
  await writeFile(join(outputRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(manifest, null, 2));
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
