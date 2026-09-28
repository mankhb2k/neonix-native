import { mkdir, stat, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import type {
  PaintCommandBuffer,
  RuntimeProjectV3,
} from "@motionvideo/motion-runtime";
import {
  evaluatePreparedRuntimeProjectV3,
  prepareRuntimeProjectV3,
} from "@motionvideo/motion-runtime";
import {
  renderRuntimeProjectV3,
  resolveLocalPreviewAssetPath,
  SkiaFrameAssetResolver,
  type SkiaAssetResolverStats,
} from "@motionvideo/render-native";
import type { SkiaAsset } from "../../../packages/canvaskit-preview/src";
import { PREVIEW_LAB_CASES } from "../lib/docs/preview-lab";
import { compileAndPrepareRuntimeProjectV3 } from "../lib/server/render/project-runtime";

type PatternName = "sequential" | "random-seek" | "reverse" | "loop";

type PatternResult = {
  name: PatternName;
  mediaTimes: number[];
  elapsedMilliseconds: number[];
  percentiles: { p50: number; p95: number; min: number; max: number };
  resolver: SkiaAssetResolverStats;
  cacheHitRate: number;
};

function repoRoot(): string {
  const cwd = resolve(process.cwd());
  return basename(cwd).toLowerCase() === "web" ? resolve(cwd, "../..") : cwd;
}

function requiredVideoProject() {
  const fixture = PREVIEW_LAB_CASES.find(
    (candidate) => candidate.id === "video.frame-seek",
  );
  if (!fixture)
    throw new Error("Preview fixture 'video.frame-seek' was not found.");
  return fixture.project;
}

function percentile(values: number[], ratio: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * ratio) - 1),
  );
  return sorted[index] ?? 0;
}

function summarize(values: number[]): PatternResult["percentiles"] {
  return {
    p50: percentile(values, 0.5),
    p95: percentile(values, 0.95),
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

function videoCommand(
  project: RuntimeProjectV3,
  mediaTime: number,
): PaintCommandBuffer {
  const asset = project.mediaCatalog.assets.find(
    (candidate) => candidate.video?.length,
  );
  if (!asset) throw new Error("Compiled project has no video asset.");
  const stream = asset.video?.[0];
  if (!stream)
    throw new Error("Compiled project has no video stream metadata.");
  return {
    version: 1,
    diagnostics: [],
    commands: [
      {
        op: "drawVideo",
        key: "video-benchmark",
        layerId: "video-benchmark",
        assetId: asset.mediaId,
        uri: stream.resource.uri,
        width: 1920,
        height: 1080,
        fit: "cover",
        mediaTime,
        mediaVisible: true,
        muted: true,
      },
    ],
  };
}

function encodedHash(
  buffer: PaintCommandBuffer,
  assets: ReadonlyMap<string, SkiaAsset>,
): string {
  const command = buffer.commands.find(
    (candidate) => candidate.op === "drawVideo",
  );
  if (!command || command.op !== "drawVideo")
    throw new Error("Benchmark command has no video draw.");
  const asset = assets.get(command.assetId);
  if (!asset)
    throw new Error(`Benchmark did not resolve asset '${command.assetId}'.`);
  if (!asset.encoded)
    throw new Error(
      `Benchmark asset '${command.assetId}' has no encoded bytes.`,
    );
  return createHash("sha256").update(asset.encoded).digest("hex");
}

async function checkFrameParity(
  project: RuntimeProjectV3,
  assetRoot: string,
  ffmpegPath: string,
): Promise<{ timestamps: number[]; matches: boolean[] }> {
  const timestamps = [0, 1 / 30, 2 / 30];
  const accurate = new SkiaFrameAssetResolver({
    assetRoot,
    ffmpegPath,
    videoSeekMode: "accurate",
  });
  const optimized = new SkiaFrameAssetResolver({
    assetRoot,
    ffmpegPath,
    videoSeekMode: "fast",
  });
  const matches: boolean[] = [];
  try {
    for (const timestamp of timestamps) {
      const command = videoCommand(project, timestamp);
      const [accurateAssets, optimizedAssets] = await Promise.all([
        accurate.resolveFrameAssets(project, command),
        optimized.resolveFrameAssets(project, command),
      ]);
      matches.push(
        encodedHash(command, accurateAssets) ===
          encodedHash(command, optimizedAssets),
      );
    }
    return { timestamps, matches };
  } finally {
    accurate.dispose();
    optimized.dispose();
  }
}

async function runPattern(
  project: RuntimeProjectV3,
  assetRoot: string,
  ffmpegPath: string,
  name: PatternName,
  mediaTimes: number[],
): Promise<PatternResult> {
  const resolver = new SkiaFrameAssetResolver({ assetRoot, ffmpegPath });
  const elapsedMilliseconds: number[] = [];
  for (const mediaTime of mediaTimes) {
    const startedAt = performance.now();
    await resolver.resolveFrameAssets(
      project,
      videoCommand(project, mediaTime),
    );
    elapsedMilliseconds.push(performance.now() - startedAt);
  }
  const resolverStats = resolver.getStats();
  resolver.dispose();
  const lookups = resolverStats.videoCacheHits + resolverStats.videoCacheMisses;
  return {
    name,
    mediaTimes,
    elapsedMilliseconds,
    percentiles: summarize(elapsedMilliseconds),
    resolver: resolverStats,
    cacheHitRate: lookups === 0 ? 0 : resolverStats.videoCacheHits / lookups,
  };
}

function runProcess(
  command: string,
  args: string[],
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolveProcess, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.once("error", reject);
    child.once("close", (code) =>
      resolveProcess({ code: code ?? 1, stdout, stderr }),
    );
  });
}

async function probeVideo(
  ffprobePath: string,
  filePath: string,
): Promise<unknown> {
  const result = await runProcess(ffprobePath, [
    "-v",
    "error",
    "-show_entries",
    "format=duration,size:stream=index,codec_type,width,height,avg_frame_rate",
    "-of",
    "json",
    filePath,
  ]);
  if (result.code !== 0) return { error: result.stderr.trim() };
  try {
    return JSON.parse(result.stdout);
  } catch {
    return { raw: result.stdout.trim() };
  }
}

async function main(): Promise<void> {
  const root = repoRoot();
  const assetRoot = join(root, "apps", "web", "public");
  const outputRoot = join(root, "tmp", "video-access-benchmark");
  const ffmpegPath = process.env.FFMPEG_PATH?.trim() || "ffmpeg";
  const ffprobePath = process.env.FFPROBE_PATH?.trim() || "ffprobe";
  const fixture = requiredVideoProject();
  const runtime = await compileAndPrepareRuntimeProjectV3(fixture);
  const prepared = prepareRuntimeProjectV3(runtime);
  const videoAsset = runtime.mediaCatalog.assets.find(
    (asset) => asset.video?.length,
  );
  if (!videoAsset || !videoAsset.video?.[0]) {
    throw new Error("Benchmark runtime is missing video metadata.");
  }
  const videoPath = resolveLocalPreviewAssetPath(
    videoAsset.video[0].resource.uri,
    assetRoot,
  );
  const sourceStats = await stat(videoPath);

  const patterns: Array<[PatternName, number[]]> = [
    ["sequential", [0, 1 / 30, 2 / 30, 3 / 30, 4 / 30, 5 / 30]],
    ["random-seek", [3.8, 0.2, 4.4, 1.1, 2.7, 0.2]],
    ["reverse", [4.4, 3.8, 3.2, 2.6, 2, 1.4]],
    ["loop", [1, 1.5, 2, 1, 1.5, 2]],
  ];

  const evaluatorSamples: number[] = [];
  for (let frame = 0; frame < 30; frame += 1) {
    const startedAt = performance.now();
    evaluatePreparedRuntimeProjectV3(prepared, frame);
    evaluatorSamples.push(performance.now() - startedAt);
  }

  const patternResults: PatternResult[] = [];
  for (const [name, mediaTimes] of patterns) {
    patternResults.push(
      await runPattern(runtime, assetRoot, ffmpegPath, name, mediaTimes),
    );
  }
  const frameParity = await checkFrameParity(runtime, assetRoot, ffmpegPath);

  await mkdir(outputRoot, { recursive: true });
  const e2eOutputPath = join(outputRoot, "e2e-sequential-3-frames.mp4");
  const e2eStartedAt = performance.now();
  const e2e = await renderRuntimeProjectV3(runtime, {
    outputPath: e2eOutputPath,
    frameCount: 3,
    assetRoot,
    ffmpegPath,
    ffmpegLogLevel: "error",
  });
  const report = {
    generatedAt: new Date().toISOString(),
    fixture: "video.frame-seek",
    source: {
      path: videoPath,
      bytes: sourceStats.size,
      probe: await probeVideo(ffprobePath, videoPath),
      note: "The fixture metadata says 60.5s, but this local MP4 is approximately 5s; all benchmark seeks stay within the real source duration.",
    },
    runtime: {
      composition: runtime.visual.composition,
      evaluatorMilliseconds: summarize(evaluatorSamples),
      evaluatorSamples,
    },
    patterns: patternResults,
    frameParity,
    e2e: {
      wallMilliseconds: performance.now() - e2eStartedAt,
      ...e2e,
    },
  };
  await writeFile(
    join(outputRoot, "report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8",
  );
  console.log(JSON.stringify(report, null, 2));
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
