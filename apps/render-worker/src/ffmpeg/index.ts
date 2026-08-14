import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import type { AspectRatio } from "@motionvideo/motion-protocol";
import type {
  MotionRuntimeProject,
} from "@motionvideo/motion-protocol/runtime";
import {
  buildAudioRenderPlan,
  sampleAudioVolumeAtFrame,
  type AudioRenderLayer,
  type AudioRenderPlan,
} from "@motionvideo/motion-runtime";
import type { RenderResult } from "../runtime";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../../..");

export type EncodedFile = {
  path: string;
  aspectRatio: AspectRatio;
};

export type AudioMixProject = Pick<MotionRuntimeProject, "assets" | "timeline">;

export function resolveFfmpegPath(): string {
  const fromEnv = process.env.FFMPEG_BIN;
  if (fromEnv) return fromEnv;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const bin = require("ffmpeg-static") as string | null;
  return bin && existsSync(bin) ? bin : "ffmpeg";
}

function run(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (d: Buffer) => {
      stderr += d.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited ${code}\n${stderr.slice(-2000)}`));
    });
  });
}

/**
 * Chain atempo filters — ffmpeg atempo only accepts 0.5..2.0 per filter.
 */
export function atempoChain(playbackRate: number): string[] {
  const rate = Math.max(0.01, playbackRate);
  if (Math.abs(rate - 1) < 1e-6) return [];
  const parts: string[] = [];
  let remaining = rate;
  while (remaining > 2) {
    parts.push("atempo=2");
    remaining /= 2;
  }
  while (remaining < 0.5) {
    parts.push("atempo=0.5");
    remaining /= 0.5;
  }
  parts.push(`atempo=${Number(remaining.toFixed(6))}`);
  return parts;
}

/**
 * Build per-clip ffmpeg audio filter graphs from an AudioRenderPlan (SoT).
 * Returns filter strings labeled `[a0]`, `[a1]`, … plus optional amix.
 */
export function buildFfmpegAudioMixFilters(
  plan: AudioRenderPlan,
): { filters: string[]; hasAudio: boolean } {
  const fps = Math.max(1, plan.fps);
  if (plan.layers.length === 0) return { filters: [], hasAudio: false };

  const filters = plan.layers.map((layer, index) =>
    layerToFfmpegFilter(layer, index, fps),
  );
  const mix = `${plan.layers.map((_, index) => `[a${index}]`).join("")}amix=inputs=${plan.layers.length}:duration=longest:normalize=0[aout]`;
  return { filters: [...filters, mix], hasAudio: true };
}

function layerToFfmpegFilter(
  layer: AudioRenderLayer,
  index: number,
  fps: number,
): string {
  const startSec = layer.fromFrame / fps;
  const playDurationSec = layer.durationInFrames / fps;
  const trimStart = Math.max(0, layer.trimStartSeconds);
  const trimEnd = Math.max(
    trimStart,
    layer.trimEndSeconds > 0 ? layer.trimEndSeconds : trimStart + playDurationSec,
  );
  const sourceNeeded = playDurationSec * Math.max(0.01, layer.playbackRate);
  const atrimEnd = Math.min(trimEnd, trimStart + sourceNeeded);

  const midFrame = layer.fromFrame + Math.floor(layer.durationInFrames / 2);
  const volume = layer.muted
    ? 0
    : sampleAudioVolumeAtFrame(layer.volumeEnvelope, midFrame);

  const chain = [
    `atrim=start=${trimStart}:end=${Math.max(trimStart, atrimEnd)}`,
    "asetpts=PTS-STARTPTS",
    ...atempoChain(layer.playbackRate),
    `atrim=start=0:end=${Math.max(0, playDurationSec)}`,
    "asetpts=PTS-STARTPTS",
    `adelay=${Math.round(startSec * 1000)}:all=1`,
    `volume=${volume}`,
  ];

  return `[${index + 1}:a]${chain.join(",")}[a${index}]`;
}

/** Encode PNG sequence → H.264 MP4 via ffmpeg-static */
export async function encodeOutputs(
  renderResult: RenderResult,
  aspectRatio: AspectRatio,
  audioProject?: AudioMixProject,
  assetBaseDir = REPO_ROOT,
): Promise<EncodedFile[]> {
  const ffmpeg = resolveFfmpegPath();
  const outDir = process.env.MOTIONVIDEO_EXPORT_OUT_DIR
    ? path.resolve(process.env.MOTIONVIDEO_EXPORT_OUT_DIR)
    : path.join(REPO_ROOT, "tmp");
  await mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, `${renderResult.projectId}.mp4`);
  const pattern = path.join(renderResult.framesDir, "frame_%06d.png");

  const fps = Math.max(1, renderResult.fps);
  const durationInFrames = Math.max(
    1,
    Math.round(renderResult.durationSec * fps),
  );

  const plan =
    audioProject !== undefined
      ? buildAudioRenderPlan({
          runtime: audioProject as MotionRuntimeProject,
          fps,
          durationInFrames,
        })
      : { fps, layers: [] as AudioRenderLayer[] };

  const audioArgs = plan.layers.flatMap((layer) => {
    const input = path.resolve(assetBaseDir, layer.uri);
    return layer.loop ? ["-stream_loop", "-1", "-i", input] : ["-i", input];
  });
  const { filters, hasAudio } = buildFfmpegAudioMixFilters(plan);

  await run(ffmpeg, [
    "-y",
    "-framerate",
    String(fps),
    "-i",
    pattern,
    ...audioArgs,
    ...(hasAudio ? ["-filter_complex", filters.join(";")] : []),
    "-t",
    String(renderResult.durationSec),
    "-map",
    "0:v",
    ...(hasAudio ? ["-map", "[aout]", "-c:a", "aac"] : []),
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    outPath,
  ]);

  return [{ path: outPath, aspectRatio }];
}
