import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import type { AspectRatio } from "@motionvideo/shared";
import type { NormalizedMotionProjectV2 } from "@motionvideo/motion-schema";
import type { RenderResult } from "../runtime";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../../..");

export type EncodedFile = {
  path: string;
  aspectRatio: AspectRatio;
};

export type AudioMixProject = Pick<NormalizedMotionProjectV2, "assets" | "timeline">;

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

/** Encode PNG sequence → H.264 MP4 via ffmpeg-static */
export async function encodeOutputs(
  renderResult: RenderResult,
  aspectRatio: AspectRatio,
  audioProject?: AudioMixProject,
  assetBaseDir = REPO_ROOT,
): Promise<EncodedFile[]> {
  const ffmpeg = resolveFfmpegPath();
  const outDir = path.join(REPO_ROOT, "tmp");
  await mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, `${renderResult.projectId}.mp4`);
  const pattern = path.join(renderResult.framesDir, "frame_%06d.png");

  const audioTracks = audioProject?.timeline.audioTracks ?? [];
  const audioAssets = new Map(audioProject?.assets.filter((asset) => asset.assetType === "audio").map((asset) => [asset.id, asset]) ?? []);
  const audioArgs = audioTracks.flatMap((track) => {
    const asset = audioAssets.get(track.assetId);
    if (!asset) throw new Error(`Audio mix asset missing: ${track.assetId}`);
    const input = path.resolve(assetBaseDir, asset.uri);
    return track.loop ? ["-stream_loop", "-1", "-i", input] : ["-i", input];
  });
  const filters = audioTracks.map((track, index) => {
    const end = renderResult.durationSec - track.start;
    const fadeOutStart = Math.max(0, end - track.fadeOut);
    return `[${index + 1}:a]atrim=start=${track.trimStart}:end=${Math.max(0, end)},asetpts=PTS-STARTPTS,adelay=${Math.round(track.start * 1000)}:all=1,volume=${track.volume}${track.fadeIn ? `,afade=t=in:st=0:d=${track.fadeIn}` : ""}${track.fadeOut ? `,afade=t=out:st=${fadeOutStart}:d=${track.fadeOut}` : ""}[a${index}]`;
  });
  const mix = audioTracks.length > 0 ? [...filters, `${audioTracks.map((_, index) => `[a${index}]`).join("")}amix=inputs=${audioTracks.length}:duration=longest:normalize=0[aout]`] : [];

  await run(ffmpeg, [
    "-y",
    "-framerate",
    String(renderResult.fps),
    "-i",
    pattern,
    ...audioArgs,
    ...(mix.length > 0 ? ["-filter_complex", mix.join(";")] : []),
    "-t",
    String(renderResult.durationSec),
    "-map",
    "0:v",
    ...(mix.length > 0 ? ["-map", "[aout]", "-c:a", "aac"] : []),
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
