import { spawn } from "node:child_process";
import { mkdir, stat } from "node:fs/promises";
import { dirname } from "node:path";
import { ExportRendererError } from "../errors";

export async function encodeRgbaFramesToMp4(options: {
  ffmpegPath: string;
  outputPath: string;
  width: number;
  height: number;
  fps: number;
  frames: AsyncIterable<Buffer>;
  audioInputs?: Array<{ path: string }>;
  audioFilterComplex?: string;
  durationSeconds?: number;
  logLevel?: "quiet" | "error" | "warning" | "info";
}): Promise<{ outputBytes: number; encodeMilliseconds: number }> {
  await mkdir(dirname(options.outputPath), { recursive: true });
  const started = performance.now();
  const args = [
    "-y", "-hide_banner", "-loglevel", options.logLevel ?? "error",
    "-f", "rawvideo", "-pix_fmt", "rgba", "-s", `${options.width}x${options.height}`,
    "-r", String(options.fps), "-i", "pipe:0",
    ...(options.audioInputs ?? []).flatMap((input) => ["-i", input.path]),
    ...(options.audioFilterComplex && options.audioInputs?.length
      ? ["-filter_complex", options.audioFilterComplex, "-map", "0:v:0", "-map", "[aout]", "-c:a", "aac", "-b:a", "192k"]
      : ["-map", "0:v:0", "-an"]),
    "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p",
    ...(options.durationSeconds ? ["-t", String(options.durationSeconds)] : []),
    "-movflags", "+faststart", options.outputPath,
  ];
  const child = spawn(options.ffmpegPath, args, { stdio: ["pipe", "ignore", "pipe"] });
  let stderr = "";
  child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
  const exit = new Promise<number>((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code) => resolve(code ?? 1));
  });
  try {
    for await (const frame of options.frames) {
      if (!child.stdin.write(frame)) await new Promise<void>((resolve) => child.stdin.once("drain", resolve));
    }
    child.stdin.end();
    const code = await exit;
    if (code !== 0) throw new ExportRendererError(`FFmpeg failed: ${stderr.trim()}`, "FFMPEG_FAILED", { code, stderr });
    const output = await stat(options.outputPath);
    return { outputBytes: output.size, encodeMilliseconds: performance.now() - started };
  } catch (error) {
    child.kill();
    if (error instanceof ExportRendererError) throw error;
    throw new ExportRendererError(`Could not encode MP4: ${String(error)}`, "FFMPEG_FAILED");
  }
}
