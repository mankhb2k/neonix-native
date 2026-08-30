import { createHash } from "node:crypto";
import { execFile as nodeExecFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createFfprobeMediaProbeV3, type MediaProbeRecordV3, type MediaDerivativeV3 } from "./media-probe-v3";

const execFile = promisify(nodeExecFile);
export const MEDIA_PIPELINE_VERSION = 1;

export type MediaPrepareRequest = {
  jobId: string;
  assetId: string;
  sourceKey: string;
  sourceMimeType: string;
  sourceIntegrity: string;
  callbackUrl: string;
  pipelineVersion?: number;
};

export type MediaPrepareResult = {
  jobId: string;
  assetId: string;
  status: "ready" | "partial" | "failed";
  sourceIntegrity: string;
  sourceContentHash?: string;
  pipelineVersion: number;
  streams: MediaProbeRecordV3["streams"];
  derivatives: MediaDerivativeV3[];
  error?: string;
};

export type MediaObjectStore = {
  getObject(key: string): Promise<Buffer | null>;
  putObject(input: { key: string; body: Buffer; contentType: string }): Promise<void>;
};

export type MediaWorkerDependencies = {
  store: MediaObjectStore;
  probe: (sourcePath: string, assetId: string) => Promise<MediaProbeRecordV3>;
  runFfmpeg: (args: readonly string[]) => Promise<void>;
  callback: (url: string, payload: MediaPrepareResult) => Promise<void>;
};

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function safeAssetId(assetId: string): string {
  if (!/^[a-zA-Z0-9._-]+$/.test(assetId)) throw new Error("Invalid asset id");
  return assetId;
}

function derivativeKey(assetId: string, kind: "poster" | "audio"): string {
  const id = safeAssetId(assetId);
  return kind === "poster" ? `${id}/poster.webp` : `${id}/audio.m4a`;
}

function hashBuffer(body: Buffer): string {
  return `sha256:${createHash("sha256").update(body).digest("hex")}`;
}

async function hashFile(path: string): Promise<{ integrity: string; byteSize: number }> {
  const body = await readFile(path);
  return { integrity: hashBuffer(body), byteSize: body.byteLength };
}

function createDefaultStore(): MediaObjectStore {
  const client = new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT?.trim() || `https://${requiredEnv("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: requiredEnv("R2_ACCESS_KEY_ID"),
      secretAccessKey: requiredEnv("R2_SECRET_ACCESS_KEY"),
    },
  });
  const bucket = process.env.R2_USER_ASSETS_BUCKET?.trim() || requiredEnv("R2_BUCKET");
  return {
    async getObject(key) {
      try {
        const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        return result.Body ? Buffer.from(await result.Body.transformToByteArray()) : null;
      } catch {
        return null;
      }
    },
    async putObject(input) {
      await client.send(new PutObjectCommand({ Bucket: bucket, Key: input.key, Body: input.body, ContentType: input.contentType }));
    },
  };
}

function outputDerivative(input: {
  assetId: string;
  kind: "poster" | "audio";
  path: string;
  mimeType: string;
  pipelineVersion: number;
}): Promise<MediaDerivativeV3> {
  return hashFile(input.path).then(({ integrity, byteSize }) => ({
    derivativeId: `${safeAssetId(input.assetId)}:${input.kind}:v${input.pipelineVersion}`,
    kind: input.kind === "poster" ? "poster" : "audio",
    uri: derivativeKey(input.assetId, input.kind),
    mimeType: input.mimeType,
    integrity,
    byteSize,
    version: input.pipelineVersion,
  }));
}

export async function prepareMediaJob(
  input: MediaPrepareRequest,
  dependencies: Partial<MediaWorkerDependencies> = {},
): Promise<MediaPrepareResult> {
  const defaultProbe = dependencies.probe ?? createFfprobeMediaProbeV3();
  const deps: MediaWorkerDependencies = {
    store: dependencies.store ?? createDefaultStore(),
    probe: defaultProbe,
    runFfmpeg: dependencies.runFfmpeg ?? (async (args) => {
      await execFile(process.env.FFMPEG_PATH?.trim() || "ffmpeg", args, { maxBuffer: 4 * 1024 * 1024 });
    }),
    callback: dependencies.callback ?? (async (url, payload) => {
      const token = process.env.INTERNAL_WORKER_TOKEN?.trim();
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(token ? { "x-internal-worker-token": token } : {}),
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(`callback returned HTTP ${response.status}`);
    }),
  };
  const pipelineVersion = input.pipelineVersion ?? MEDIA_PIPELINE_VERSION;
  const base = {
    jobId: input.jobId,
    assetId: input.assetId,
    sourceIntegrity: input.sourceIntegrity,
    pipelineVersion,
    streams: [] as MediaProbeRecordV3["streams"],
    derivatives: [] as MediaDerivativeV3[],
  };
  let workDir: string | undefined;
  try {
    const source = await deps.store.getObject(input.sourceKey);
    if (!source) throw new Error("origin object not found");
    console.log("[media-worker] origin loaded", { jobId: input.jobId, assetId: input.assetId, sourceKey: input.sourceKey, bytes: source.byteLength });
    workDir = await mkdtemp(join(tmpdir(), "neonix-media-"));
    const sourcePath = join(workDir, "origin.media");
    const posterPath = join(workDir, "poster.webp");
    const audioPath = join(workDir, "audio.m4a");
    await writeFile(sourcePath, source);
    const sourceContentHash = hashBuffer(source);
    const probe = await deps.probe(sourcePath, input.assetId);
    const streams = probe.streams;
    console.log("[media-worker] probe complete", { jobId: input.jobId, assetId: input.assetId, streams: streams.map((stream) => stream.kind) });
    if (!streams.some((stream) => stream.kind === "video")) throw new Error("origin has no video stream");
    const hasAudio = streams.some((stream) => stream.kind === "audio");
    const errors: string[] = [];

    try {
      const existingPoster = await deps.store.getObject(derivativeKey(input.assetId, "poster"));
      const posterReused = Boolean(existingPoster && existingPoster.byteLength > 0);
      if (posterReused) {
        await writeFile(posterPath, existingPoster!);
        console.log("[media-worker] poster reused", { jobId: input.jobId, assetId: input.assetId, key: derivativeKey(input.assetId, "poster") });
      } else {
        await deps.runFfmpeg(["-y", "-hide_banner", "-loglevel", "error", "-i", sourcePath, "-map", "0:v:0", "-frames:v", "1", "-c:v", "libwebp", "-quality", "82", posterPath]);
        console.log("[media-worker] poster fallback generated", { jobId: input.jobId, assetId: input.assetId });
      }
      const derivative = await outputDerivative({ assetId: input.assetId, kind: "poster", path: posterPath, mimeType: "image/webp", pipelineVersion });
      if (!posterReused) await deps.store.putObject({ key: derivative.uri, body: await readFile(posterPath), contentType: derivative.mimeType });
      base.derivatives.push(derivative);
    } catch (error) {
      errors.push(`poster: ${error instanceof Error ? error.message : String(error)}`);
      console.error("[media-worker] poster failed", { jobId: input.jobId, assetId: input.assetId, error });
    }

    if (hasAudio) {
      try {
        await deps.runFfmpeg(["-y", "-hide_banner", "-loglevel", "error", "-i", sourcePath, "-map", "0:a:0", "-vn", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", audioPath]);
        const derivative = await outputDerivative({ assetId: input.assetId, kind: "audio", path: audioPath, mimeType: "audio/mp4", pipelineVersion });
        await deps.store.putObject({ key: derivative.uri, body: await readFile(audioPath), contentType: derivative.mimeType });
        base.derivatives.push(derivative);
        console.log("[media-worker] audio uploaded", { jobId: input.jobId, assetId: input.assetId, key: derivative.uri, bytes: derivative.byteSize });
      } catch (error) {
        errors.push(`audio: ${error instanceof Error ? error.message : String(error)}`);
        console.error("[media-worker] audio failed", { jobId: input.jobId, assetId: input.assetId, error });
      }
    }

    const requiredCount = hasAudio ? 2 : 1;
    const status: MediaPrepareResult["status"] = base.derivatives.length === requiredCount
      ? "ready"
      : base.derivatives.length > 0
        ? "partial"
        : "failed";
    const result: MediaPrepareResult = { ...base, status, sourceContentHash, streams, ...(errors.length ? { error: errors.join("; ") } : {}) };
    await deps.callback(input.callbackUrl, result);
    console.log("[media-worker] job completed", { jobId: input.jobId, assetId: input.assetId, status, derivatives: result.derivatives.map((derivative) => derivative.kind) });
    return result;
  } catch (error) {
    const result: MediaPrepareResult = {
      ...base,
      status: "failed",
      ...(workDir ? { sourceContentHash: undefined } : {}),
      error: error instanceof Error ? error.message : String(error),
    };
    await deps.callback(input.callbackUrl, result);
    console.error("[media-worker] job failed", { jobId: input.jobId, assetId: input.assetId, error: result.error });
    return result;
  } finally {
    if (workDir) await rm(workDir, { recursive: true, force: true });
  }
}
