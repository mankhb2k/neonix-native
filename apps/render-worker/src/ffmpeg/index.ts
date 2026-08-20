import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import type { AspectRatio } from "@motionvideo/motion-protocol";
import type { RenderResult } from "../runtime";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../../..");

export type EncodedFile = {
  path: string;
  aspectRatio: AspectRatio;
};

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
    child.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited ${code}\n${stderr.slice(-2000)}`));
    });
  });
}

/** Encode the V2 Runtime IR PNG sequence into an H.264 MP4. */
export async function encodeOutputs(
  renderResult: RenderResult,
  aspectRatio: AspectRatio,
): Promise<EncodedFile[]> {
  const ffmpeg = resolveFfmpegPath();
  const outDir = process.env.MOTIONVIDEO_EXPORT_OUT_DIR
    ? path.resolve(process.env.MOTIONVIDEO_EXPORT_OUT_DIR)
    : path.join(REPO_ROOT, "tmp");
  await mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, `${renderResult.projectId}.mp4`);
  const pattern = path.join(renderResult.framesDir, "frame_%06d.png");

  await run(ffmpeg, [
    "-y",
    "-framerate",
    String(Math.max(1, renderResult.fps)),
    "-i",
    pattern,
    "-t",
    String(renderResult.durationSec),
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
