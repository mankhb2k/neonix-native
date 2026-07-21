import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import type { AspectRatio } from "@motionvideo/shared";
import type { RenderResult } from "../runtime";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../../..");

export type EncodedFile = {
  path: string;
  aspectRatio: AspectRatio;
};

function resolveFfmpegPath(): string {
  const fromEnv = process.env.FFMPEG_BIN;
  if (fromEnv) return fromEnv;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const bin = require("ffmpeg-static") as string | null;
  if (!bin) {
    throw new Error(
      "ffmpeg-static binary missing — run: node node_modules/ffmpeg-static/install.js",
    );
  }
  return bin;
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
): Promise<EncodedFile[]> {
  const ffmpeg = resolveFfmpegPath();
  const outDir = path.join(REPO_ROOT, "tmp");
  await mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, `${renderResult.projectId}.mp4`);
  const pattern = path.join(renderResult.framesDir, "frame_%06d.png");

  await run(ffmpeg, [
    "-y",
    "-framerate",
    String(renderResult.fps),
    "-i",
    pattern,
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
