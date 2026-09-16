import { execFile as nodeExecFile } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { performance } from "node:perf_hooks";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { promisify } from "node:util";
import { Readable } from "node:stream";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { renderRuntimeProjectV3 } from "@motionvideo/export-renderer";
import type { RuntimeProjectV3 } from "@motionvideo/motion-runtime";

const execFile = promisify(nodeExecFile);
const DEMO_MUSIC_KEY = "media/8e92be38-57a1-4518-9fd1-cde40de5b2d7/d25c3c5f-3e15-4296-ba18-0782bc2aff88/origin.mp3";
const DEMO_VIDEO_KEY = "media/8e92be38-57a1-4518-9fd1-cde40de5b2d7/68ec4e22-45b8-4b89-a442-3423ca06c208/origin.mp4";

function repoRoot(): string {
  const cwd = resolve(process.cwd());
  return basename(cwd).toLowerCase() === "web" ? resolve(cwd, "../..") : cwd;
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

async function loadLocalRendererEnv(root: string): Promise<void> {
  const file = join(root, "packages", "export-renderer", ".env");
  const contents = await readFile(file, "utf8").catch(() => "");
  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match?.[1] && process.env[match[1]] === undefined) process.env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, "");
  }
}

function createR2Client(): { client: S3Client; bucket: string } {
  const bucket = process.env.R2_USER_ASSETS_BUCKET?.trim() || requiredEnv("R2_BUCKET");
  return {
    bucket,
    client: new S3Client({
      region: "auto",
      endpoint: process.env.R2_ENDPOINT?.trim() || `https://${requiredEnv("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: requiredEnv("R2_ACCESS_KEY_ID"), secretAccessKey: requiredEnv("R2_SECRET_ACCESS_KEY") },
    }),
  };
}

async function downloadObject(client: S3Client, bucket: string, key: string, target: string): Promise<void> {
  const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!result.Body) throw new Error(`R2 object has no body: ${key}`);
  await pipeline(ReadableFromSdkBody(result.Body), createWriteStream(target));
}

function ReadableFromSdkBody(body: unknown): NodeJS.ReadableStream {
  const candidate = body as { transformToWebStream?: () => ReadableStream<Uint8Array> };
  if (typeof candidate.transformToWebStream === "function") {
    return requireReadableFromWeb(candidate.transformToWebStream());
  }
  return body as NodeJS.ReadableStream;
}

function requireReadableFromWeb(stream: ReadableStream<Uint8Array>): NodeJS.ReadableStream {
  return Readable.fromWeb(stream as Parameters<typeof Readable.fromWeb>[0]);
}

async function probeAudio(path: string): Promise<{ durationSamples: number; sampleRate: number; channels: number }> {
  const { stdout } = await execFile(process.env.FFPROBE_PATH?.trim() || "ffprobe", [
    "-v", "error", "-select_streams", "a:0", "-show_entries", "stream=duration,sample_rate,channels", "-of", "json", path,
  ], { maxBuffer: 2 * 1024 * 1024 });
  const parsed = JSON.parse(stdout) as { streams?: Array<{ duration?: string; sample_rate?: string; channels?: number }> };
  const stream = parsed.streams?.[0];
  if (!stream) throw new Error(`No audio stream found in ${path}`);
  const sampleRate = Number(stream.sample_rate) || 48_000;
  const durationSeconds = Number(stream.duration);
  if (!(durationSeconds > 0)) throw new Error(`Audio duration missing in ${path}`);
  return { durationSamples: Math.floor(durationSeconds * sampleRate), sampleRate, channels: Number(stream.channels) || 2 };
}

async function probeOutput(path: string): Promise<{
  durationSeconds: number;
  videoFrames: number;
  videoCodec: string;
  audioStreams: number;
  audioCodecs: string[];
}> {
  const { stdout } = await execFile(process.env.FFPROBE_PATH?.trim() || "ffprobe", [
    "-v", "error", "-count_frames",
    "-show_entries", "stream=codec_type,codec_name,nb_read_frames:format=duration",
    "-of", "json", path,
  ], { maxBuffer: 2 * 1024 * 1024 });
  const parsed = JSON.parse(stdout) as {
    streams?: Array<{ codec_type?: string; codec_name?: string; nb_read_frames?: string }>;
    format?: { duration?: string };
  };
  const video = parsed.streams?.find((stream) => stream.codec_type === "video");
  const audio = parsed.streams?.filter((stream) => stream.codec_type === "audio") ?? [];
  return {
    durationSeconds: Number(parsed.format?.duration ?? 0),
    videoFrames: Number(video?.nb_read_frames ?? 0),
    videoCodec: video?.codec_name ?? "unknown",
    audioStreams: audio.length,
    audioCodecs: audio.map((stream) => stream.codec_name ?? "unknown"),
  };
}

function withAudio(project: RuntimeProjectV3, music: ReturnType<typeof probeAudio> extends Promise<infer T> ? T : never, video: ReturnType<typeof probeAudio> extends Promise<infer T> ? T : never, musicKey: string, videoKey: string): RuntimeProjectV3 {
  const compositionSamples = 10 * 48_000;
  const videoStart = 2 * 48_000;
  const videoDuration = Math.min(8 * 48_000, video.durationSamples);
  const musicDuration = Math.min(compositionSamples, music.durationSamples);
  return {
    ...project,
    projectId: "neonix-r2-audio-mix-10s",
    mediaCatalog: {
      assets: [
        {
          mediaId: "r2-demo-music",
          audio: [{ streamId: "r2-demo-music:audio", resource: { resourceId: "r2-demo-music:audio", role: "original", uri: `r2://${musicKey}`, mimeType: "audio/mpeg" }, durationSamples: music.durationSamples, sampleRate: music.sampleRate, channels: music.channels, codec: "mp3" }],
        },
        {
          mediaId: "r2-demo-video",
          audio: [{ streamId: "r2-demo-video:audio", resource: { resourceId: "r2-demo-video:audio", role: "original", uri: `r2://${videoKey}`, mimeType: "video/mp4" }, durationSamples: video.durationSamples, sampleRate: video.sampleRate, channels: video.channels, codec: "aac" }],
        },
      ],
    },
    audioTimeline: {
      sampleRate: 48_000,
      tracks: [
        {
          trackId: "r2-music-track",
          gainLinear: 1,
          pan: 0,
          muted: false,
          clips: [{
            clipId: "r2-music-clip",
            trackId: "r2-music-track",
            source: { mediaId: "r2-demo-music", streamId: "r2-demo-music:audio" },
            timelineStartSample: 0,
            timelineDurationSamples: musicDuration,
            sourceStartSample: 0,
            sourceEndSample: musicDuration,
            playbackRate: 1,
            gainLinear: 0.35,
            pan: -0.25,
            muted: false,
            fadeIn: { durationSamples: Math.min(48_000, musicDuration), curve: "equal-power" },
            fadeOut: { durationSamples: Math.min(48_000, musicDuration), curve: "linear" },
            origin: { kind: "standalone-audio", authoringId: "r2-demo-music" },
          }],
        },
        {
          trackId: "r2-video-audio-track",
          gainLinear: 1,
          pan: 0,
          muted: false,
          clips: [{
            clipId: "r2-video-audio-clip",
            trackId: "r2-video-audio-track",
            source: { mediaId: "r2-demo-video", streamId: "r2-demo-video:audio" },
            timelineStartSample: videoStart,
            timelineDurationSamples: videoDuration,
            sourceStartSample: 0,
            sourceEndSample: videoDuration,
            playbackRate: 1,
            gainLinear: 0.25,
            pan: 0.25,
            muted: false,
            fadeIn: { durationSamples: Math.min(24_000, videoDuration), curve: "linear" },
            fadeOut: { durationSamples: Math.min(24_000, videoDuration), curve: "equal-power" },
            origin: { kind: "video", authoringId: "r2-demo-video" },
          }],
        },
      ],
    },
  };
}

async function main(): Promise<void> {
  const root = repoRoot();
  await loadLocalRendererEnv(root);
  const outputRoot = join(root, "tmp");
  const sourceRoot = join(outputRoot, "phase6-r2-audio-fixture-sources");
  await mkdir(sourceRoot, { recursive: true });
  const musicKey = process.env.PHASE6_R2_MUSIC_KEY?.trim() || DEMO_MUSIC_KEY;
  const videoKey = process.env.PHASE6_R2_VIDEO_KEY?.trim() || DEMO_VIDEO_KEY;
  const { client, bucket } = createR2Client();
  const musicPath = join(sourceRoot, "music.mp3");
  const videoPath = join(sourceRoot, "video.mp4");
  const downloadStarted = performance.now();
  await Promise.all([
    downloadObject(client, bucket, musicKey, musicPath),
    downloadObject(client, bucket, videoKey, videoPath),
  ]);
  client.destroy();
  const downloadMilliseconds = performance.now() - downloadStarted;
  const [music, video] = await Promise.all([probeAudio(musicPath), probeAudio(videoPath)]);
  const runtime = JSON.parse(await readFile(join(outputRoot, "neonix-overview-60s.runtime.json"), "utf8")) as RuntimeProjectV3;
  const fixture = withAudio(runtime, music, video, musicKey, videoKey);
  const runtimeFile = join(outputRoot, "neonix-r2-audio-mix-10s.runtime.json");
  const outputPath = join(outputRoot, "phase6-r2-audio-mix-10s.mp4");
  await writeFile(runtimeFile, `${JSON.stringify(fixture, null, 2)}\n`, "utf8");
  const renderStarted = performance.now();
  const stats = await renderRuntimeProjectV3(fixture, {
    outputPath,
    frameCount: 300,
    parallelism: 1,
    assetRoot: join(root, "apps", "web", "public"),
    ffmpegLogLevel: "error",
  });
  const outputProbe = await probeOutput(outputPath);
  if (outputProbe.videoFrames !== stats.frames || outputProbe.audioStreams < 1 || outputProbe.durationSeconds <= 0) {
    throw new Error(`Fixture output verification failed: ${JSON.stringify(outputProbe)}`);
  }
  const benchmark = {
    fixture: "neonix-r2-audio-mix-10s",
    sourceBucket: bucket,
    sourceKeys: { music: musicKey, video: videoKey },
    sourceProbe: { music, video },
    downloadMilliseconds: Math.round(downloadMilliseconds),
    renderEndToEndMilliseconds: Math.round(performance.now() - renderStarted),
    stats,
    outputProbe,
    artifact: outputPath,
  };
  await writeFile(join(outputRoot, "neonix-r2-audio-mix-10s.benchmark.json"), `${JSON.stringify(benchmark, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(benchmark, null, 2));
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
