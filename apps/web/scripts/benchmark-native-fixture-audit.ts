import { performance } from "node:perf_hooks";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { compileDocument } from "@motionvideo/html-compiler";
import { evaluateRuntimeProjectV3 } from "@motionvideo/motion-runtime";
import { HTML_COMPILER_PREVIEW_FONT_ASSETS } from "../lib/docs/html-compiler-preview";
import { compileAndPrepareRuntimeProjectV3 } from "../lib/server/render/project-runtime";

type Manifest = {
  composition: { width: number; height: number; fps: number };
  fixtures: Array<{ id: string; source: string; durationMs: number; frameCount: number; mediaAssets?: Array<{ uri: string; kind: "image" | "video" | "audio"; width?: number; height?: number; duration?: number; fps?: number; sampleRate?: number; channels?: number; mimeType?: string }> }>;
};

// Opcode coverage is reported separately from visual parity. The native POC
// can now consume these structural/path/text commands; effects and media still
// require dedicated feature gates before a fixture is accepted as parity.
const nativeCommandBufferOps = new Set([
  "beginFrame", "setTransform", "beginGroup", "endGroup", "beginLayer", "endLayer",
  "drawShape", "drawSolid", "drawPath", "drawText", "endFrame",
]);

function repoRoot(): string {
  const cwd = resolve(process.cwd());
  return basename(cwd).toLowerCase() === "web" ? resolve(cwd, "../..") : cwd;
}

function countOps(commands: ReturnType<typeof evaluateRuntimeProjectV3>): Record<string, number> {
  return commands.commands.reduce<Record<string, number>>((counts, command) => {
    counts[command.op] = (counts[command.op] ?? 0) + 1;
    return counts;
  }, {});
}

function featureGaps(commands: ReturnType<typeof evaluateRuntimeProjectV3>): string[] {
  const gaps = new Set<string>();
  for (const command of commands.commands) {
    if (command.op === "beginLayer") {
      if (command.effectProgram) gaps.add("effectProgram");
      if (command.backdropEffectProgram) gaps.add("backdropEffectProgram");
      if (command.blendMode) gaps.add("blendMode");
      if (command.clipPath) gaps.add("clipPath");
      if (command.mask) gaps.add("mask");
    }
    if (command.op === "drawShape" || command.op === "drawPath") {
      const fills = command.op === "drawShape" ? [command.fillPaint, command.strokePaint] : [command.fillPaint, command.strokePaint];
      if (fills.some((paint) => paint && paint.type !== "solid" && paint.type !== "none")) gaps.add("paintFill");
      if (command.op === "drawPath" && (command.mesh || command.strokeMesh || command.markers?.length)) gaps.add("pathLowering");
    }
    if (command.op === "drawText" && command.glyphs?.some((glyph) => glyph.colorGlyph)) gaps.add("colorGlyph");
    if (command.op === "drawImage") gaps.add("imageDecode");
    if (command.op === "drawVideo") gaps.add("videoDecode");
  }
  return [...gaps].sort();
}

async function main(): Promise<void> {
  const root = repoRoot();
  const fixtureRoot = join(root, "apps", "web", "public", "docs", "benchmark");
  const manifest = JSON.parse(await readFile(join(fixtureRoot, "neonix-native-benchmark-fixtures.json"), "utf8")) as Manifest;
  const report = [];

  for (const fixture of manifest.fixtures) {
    const html = await readFile(join(fixtureRoot, fixture.source), "utf8");
    const compileStarted = performance.now();
    const compiled = compileDocument(
      { html, fontAssets: HTML_COMPILER_PREVIEW_FONT_ASSETS, mediaAssets: fixture.mediaAssets },
      { composition: { durationMs: fixture.durationMs, id: fixture.id } },
    );
    const compileMilliseconds = performance.now() - compileStarted;
    const errors = compiled.diagnostics.filter((diagnostic) => diagnostic.severity === "error");
    if (compiled.status !== "success" || !compiled.protocol || errors.length > 0) {
      report.push({ id: fixture.id, status: "compile-error", compileMilliseconds, diagnostics: compiled.diagnostics });
      continue;
    }
    const prepareStarted = performance.now();
    const runtime = await compileAndPrepareRuntimeProjectV3(compiled.protocol);
    const prepareMilliseconds = performance.now() - prepareStarted;
    const sampleFrames = [...new Set([0, Math.floor((fixture.frameCount - 1) / 2), fixture.frameCount - 1])];
    const sampledOps = sampleFrames.map((frame) => {
      const commands = evaluateRuntimeProjectV3(runtime, frame);
      const ops = countOps(commands);
      const unsupportedOps = Object.keys(ops).filter((op) => !nativeCommandBufferOps.has(op));
      return { frame, commandCount: commands.commands.length, ops, unsupportedOps, featureGaps: featureGaps(commands) };
    });
    const allOps = [...new Set(sampledOps.flatMap((sample) => Object.keys(sample.ops)))];
    const allFeatureGaps = [...new Set(sampledOps.flatMap((sample) => sample.featureGaps))];
    report.push({
      id: fixture.id,
      status: "ready",
      durationMs: fixture.durationMs,
      frameCount: fixture.frameCount,
      compileMilliseconds: Number(compileMilliseconds.toFixed(3)),
      prepareMilliseconds: Number(prepareMilliseconds.toFixed(3)),
      assets: compiled.protocol.assets.map((asset) => ({ id: asset.id, kind: asset.kind, uri: asset.uri })),
      sampledOps,
      nativeReplayOpcodeReady: allOps.every((op) => nativeCommandBufferOps.has(op)),
      nativeParityReady: allOps.every((op) => nativeCommandBufferOps.has(op)) && allFeatureGaps.length === 0,
      featureGaps: allFeatureGaps,
    });
  }

  const output = {
    benchmark: "native-skia-cpu-fixture-audit",
    environment: { requestedBackend: "skia-native-raster", cpu: "Cloud Run 4 vCPU", gpu: false, composition: manifest.composition },
    nativeCommandBufferOps: [...nativeCommandBufferOps],
    fixtures: report,
  };
  const outputPath = process.env.BENCHMARK_AUDIT_OUTPUT?.trim();
  if (outputPath) {
    const absoluteOutputPath = resolve(root, outputPath);
    await mkdir(dirname(absoluteOutputPath), { recursive: true });
    await writeFile(absoluteOutputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  }
  console.log(JSON.stringify(output, null, 2));
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
