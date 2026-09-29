import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { spawn } from "node:child_process";
import { stat } from "node:fs/promises";

// Verifying a render's own output (frame count, duration, audio presence,
// codec) is part of doing the render correctly, not job/queue orchestration
// - it stays in render-native alongside the rendering call itself. Whoever
// orchestrates the job (packages/render-worker) calls this after
// renderRuntimeProjectV3() and before publishing the artifact anywhere.

export type VerifiedRenderOutput = {
  bytes: number;
  checksum: string;
  frames: number;
  durationSeconds: number;
  codec: string;
  audioStreams: number;
};

function runProcess(command: string, args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolveProcess, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
    child.once("error", reject);
    child.once("close", (code) => resolveProcess({ code: code ?? 1, stdout, stderr }));
  });
}

async function checksumFile(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  await new Promise<void>((resolveHash, reject) => {
    const stream = createReadStream(filePath);
    stream.on("data", (chunk: string | Buffer) => hash.update(chunk));
    stream.once("error", reject);
    stream.once("end", () => resolveHash());
  });
  return hash.digest("hex");
}

export async function verifyRenderOutput(filePath: string, expectedFrames: number, expectedAudio: boolean): Promise<VerifiedRenderOutput> {
  const probe = await runProcess(process.env.FFPROBE_PATH?.trim() || "ffprobe", [
    "-v", "error",
    "-count_frames",
    "-show_entries", "stream=codec_type,codec_name,nb_read_frames,duration:format=duration",
    "-of", "json",
    filePath,
  ]);
  if (probe.code !== 0) throw new Error(`ffprobe verification failed: ${probe.stderr.trim()}`);
  const parsed = JSON.parse(probe.stdout) as {
    streams?: Array<{ codec_type?: string; codec_name?: string; nb_read_frames?: string; duration?: string }>;
    format?: { duration?: string };
  };
  const video = parsed.streams?.find((stream) => stream.codec_type === "video");
  const audio = parsed.streams?.filter((stream) => stream.codec_type === "audio") ?? [];
  const frames = Number(video?.nb_read_frames ?? 0);
  const durationSeconds = Number(parsed.format?.duration ?? 0);
  const details = await stat(filePath);
  if (!video?.codec_name || frames !== expectedFrames || !Number.isFinite(durationSeconds) || durationSeconds <= 0
    || (expectedAudio && audio.length === 0)) {
    throw new Error(`render output verification mismatch: frames=${frames}/${expectedFrames} duration=${durationSeconds} audio=${audio.length}`);
  }
  return {
    bytes: details.size,
    checksum: await checksumFile(filePath),
    frames,
    durationSeconds,
    codec: video.codec_name,
    audioStreams: audio.length,
  };
}
