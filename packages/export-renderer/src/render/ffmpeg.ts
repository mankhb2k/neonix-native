import { spawn } from "node:child_process";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
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
  preset?: string;
  crf?: number;
  threads?: number;
  logLevel?: "quiet" | "error" | "warning" | "info";
  signal?: AbortSignal;
}): Promise<{ outputBytes: number; encodeMilliseconds: number; framesSubmitted: number; pipeWriteMilliseconds: number; backpressureWaitMilliseconds: number; finalizeMilliseconds: number }> {
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
    "-c:v", "libx264", "-preset", options.preset ?? "veryfast",
    "-threads", String(Number.isInteger(options.threads) && (options.threads as number) > 0
      ? options.threads
      : Number.isInteger(Number(process.env.EXPORT_RENDERER_FFMPEG_THREADS)) && Number(process.env.EXPORT_RENDERER_FFMPEG_THREADS) > 0
        ? Number(process.env.EXPORT_RENDERER_FFMPEG_THREADS)
        : 1),
    ...(options.crf === undefined ? [] : ["-crf", String(options.crf)]),
    "-pix_fmt", "yuv420p",
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
  const abort = () => child.kill();
  if (options.signal?.aborted) abort();
  options.signal?.addEventListener("abort", abort, { once: true });
  let framesSubmitted = 0;
  let pipeWriteMilliseconds = 0;
  let backpressureWaitMilliseconds = 0;
  try {
    for await (const frame of options.frames) {
      if (options.signal?.aborted) throw new ExportRendererError("Encoding was cancelled.", "CANCELLED");
      const writeStarted = performance.now();
      const accepted = child.stdin.write(frame);
      pipeWriteMilliseconds += performance.now() - writeStarted;
      framesSubmitted += 1;
      if (!accepted) {
        const drainStarted = performance.now();
        await new Promise<void>((resolve) => child.stdin.once("drain", resolve));
        backpressureWaitMilliseconds += performance.now() - drainStarted;
      }
    }
    child.stdin.end();
    const finalizeStarted = performance.now();
    const code = await exit;
    const finalizeMilliseconds = performance.now() - finalizeStarted;
    if (code !== 0) throw new ExportRendererError(`FFmpeg failed: ${stderr.trim()}`, "FFMPEG_FAILED", { code, stderr });
    const output = await stat(options.outputPath);
    return { outputBytes: output.size, encodeMilliseconds: performance.now() - started, framesSubmitted, pipeWriteMilliseconds, backpressureWaitMilliseconds, finalizeMilliseconds };
  } catch (error) {
    child.kill();
    if (error instanceof ExportRendererError) throw error;
    throw new ExportRendererError(`Could not encode MP4: ${String(error)}`, "FFMPEG_FAILED");
  } finally {
    options.signal?.removeEventListener("abort", abort);
  }
}

export async function concatMp4Segments(options: {
  ffmpegPath: string;
  segmentPaths: string[];
  outputPath: string;
  logLevel?: "quiet" | "error" | "warning" | "info";
  signal?: AbortSignal;
}): Promise<{ outputBytes: number; encodeMilliseconds: number }> {
  if (options.segmentPaths.length === 0) {
    throw new ExportRendererError("Cannot concatenate an empty segment list.", "OUTPUT_FAILED");
  }
  await mkdir(dirname(options.outputPath), { recursive: true });
  const listPath = `${options.outputPath}.concat.txt`;
  const list = options.segmentPaths
    .map((segmentPath) => `file '${resolve(segmentPath).replaceAll("'", "'\\''")}'`)
    .join("\n");
  await writeFile(listPath, `${list}\n`, "utf8");

  const started = performance.now();
  const child = spawn(options.ffmpegPath, [
    "-y", "-hide_banner", "-loglevel", options.logLevel ?? "error",
    "-f", "concat", "-safe", "0", "-i", listPath,
    "-c", "copy", "-movflags", "+faststart", options.outputPath,
  ], { stdio: ["ignore", "ignore", "pipe"] });
  let stderr = "";
  child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
  const exit = new Promise<number>((resolveExit, reject) => {
    child.once("error", reject);
    child.once("close", (code) => resolveExit(code ?? 1));
  });
  const abort = () => child.kill();
  if (options.signal?.aborted) abort();
  options.signal?.addEventListener("abort", abort, { once: true });
  try {
    const code = await exit;
    if (code !== 0) {
      throw new ExportRendererError(`FFmpeg concat failed: ${stderr.trim()}`, "FFMPEG_FAILED", { code, stderr });
    }
    const output = await stat(options.outputPath);
    return { outputBytes: output.size, encodeMilliseconds: performance.now() - started };
  } catch (error) {
    child.kill();
    if (error instanceof ExportRendererError) throw error;
    throw new ExportRendererError(`Could not concatenate MP4 segments: ${String(error)}`, "FFMPEG_FAILED");
  } finally {
    options.signal?.removeEventListener("abort", abort);
  }
}

export async function muxVideoWithAudio(options: {
  ffmpegPath: string;
  videoPath: string;
  audioInputs: Array<{ path: string }>;
  audioFilterComplex: string;
  outputPath: string;
  durationSeconds?: number;
  logLevel?: "quiet" | "error" | "warning" | "info";
  signal?: AbortSignal;
}): Promise<{ outputBytes: number; muxMilliseconds: number }> {
  if (options.audioInputs.length === 0) throw new ExportRendererError("Cannot mux without audio inputs.", "OUTPUT_FAILED");
  await mkdir(dirname(options.outputPath), { recursive: true });
  const started = performance.now();
  const args = [
    "-y", "-hide_banner", "-loglevel", options.logLevel ?? "error",
    "-i", options.videoPath,
    ...options.audioInputs.flatMap((input) => ["-i", input.path]),
    "-filter_complex", options.audioFilterComplex,
    "-map", "0:v:0", "-map", "[aout]",
    "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ac", "2",
    ...(options.durationSeconds ? ["-t", String(options.durationSeconds)] : []),
    "-movflags", "+faststart", options.outputPath,
  ];
  const child = spawn(options.ffmpegPath, args, { stdio: ["ignore", "ignore", "pipe"] });
  let stderr = "";
  child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
  const exit = new Promise<number>((resolveExit, reject) => {
    child.once("error", reject);
    child.once("close", (code) => resolveExit(code ?? 1));
  });
  const abort = () => child.kill();
  if (options.signal?.aborted) abort();
  options.signal?.addEventListener("abort", abort, { once: true });
  try {
    const code = await exit;
    if (code !== 0) throw new ExportRendererError(`FFmpeg audio mux failed: ${stderr.trim()}`, "FFMPEG_FAILED", { code, stderr });
    const output = await stat(options.outputPath);
    return { outputBytes: output.size, muxMilliseconds: performance.now() - started };
  } catch (error) {
    child.kill();
    if (error instanceof ExportRendererError) throw error;
    throw new ExportRendererError(`Could not mux video/audio: ${String(error)}`, "FFMPEG_FAILED");
  } finally {
    options.signal?.removeEventListener("abort", abort);
  }
}
