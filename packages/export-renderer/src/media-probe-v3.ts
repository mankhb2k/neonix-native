import { execFile as nodeExecFile } from "node:child_process";
import { promisify } from "node:util";

const execFile = promisify(nodeExecFile);

export type MediaProbeStatusV3 = "queued" | "probing" | "processing" | "ready" | "partial" | "failed";
export type MediaStreamKindV3 = "video" | "audio";
export type MediaStreamProbeV3 = {
  streamId: string;
  kind: MediaStreamKindV3;
  codec?: string;
  codecConfig?: string;
  durationUs?: number;
  durationSamples?: number;
  sampleRate?: number;
  channels?: number;
  width?: number;
  height?: number;
  frameRate?: number;
  timeBase?: string;
  disposition?: Readonly<Record<string, number>>;
};
export type MediaDerivativeV3 = {
  derivativeId: string;
  kind: "audio" | "poster" | "video-proxy";
  uri: string;
  mimeType: string;
  integrity?: string;
  byteSize?: number;
  version: number;
  manifestUri?: string;
  indexUri?: string;
  codec?: string;
  sampleRate?: number;
  channels?: number;
};
export type MediaProbeRecordV3 = {
  assetId: string;
  status: MediaProbeStatusV3;
  sourceIntegrity?: string;
  streams: MediaStreamProbeV3[];
  derivatives: MediaDerivativeV3[];
  error?: string;
  updatedAt: string;
  version: number;
};
export type MediaProbeJobV3 = {
  jobId: string;
  assetId: string;
  idempotencyKey: string;
  status: MediaProbeStatusV3;
  createdAt: string;
};
export type MediaProbeStoreV3 = {
  get(assetId: string): Promise<MediaProbeRecordV3 | null>;
  put(record: MediaProbeRecordV3): Promise<void>;
  enqueue(job: MediaProbeJobV3): Promise<MediaProbeJobV3>;
};
export type MediaDerivativeGeneratorV3 = {
  generateAudioDerivative(assetId: string, sourceUri: string): Promise<MediaDerivativeV3>;
  generatePoster?(assetId: string, sourceUri: string): Promise<MediaDerivativeV3>;
};
export type MediaDerivativeVerifierV3 = (derivative: MediaDerivativeV3) => Promise<{ ok: boolean; integrity?: string; byteSize?: number }>;

export class MemoryMediaProbeStoreV3 implements MediaProbeStoreV3 {
  private readonly records = new Map<string, MediaProbeRecordV3>();
  private readonly jobs = new Map<string, MediaProbeJobV3>();
  async get(assetId: string) { return this.records.get(assetId) ?? null; }
  async put(record: MediaProbeRecordV3) { this.records.set(record.assetId, structuredClone(record)); }
  async enqueue(job: MediaProbeJobV3) { const existing = this.jobs.get(job.idempotencyKey); if (existing) return existing; this.jobs.set(job.idempotencyKey, job); return job; }
}

export function transitionMediaProbeStatusV3(from: MediaProbeStatusV3, to: MediaProbeStatusV3): boolean {
  if (from === to) return true;
  const allowed: Record<MediaProbeStatusV3, readonly MediaProbeStatusV3[]> = {
    queued: ["probing", "failed"],
    probing: ["processing", "failed"],
    processing: ["ready", "partial", "failed"],
    partial: ["processing", "ready", "failed"],
    ready: ["processing"],
    failed: ["queued", "probing"],
  };
  return allowed[from].includes(to);
}

function withStatus(record: MediaProbeRecordV3, status: MediaProbeStatusV3, error?: string): MediaProbeRecordV3 {
  return { ...record, status, ...(error ? { error } : { error: undefined }), version: record.version + 1, updatedAt: new Date().toISOString() };
}

export async function runMediaProbeJobV3(
  store: MediaProbeStoreV3,
  job: MediaProbeJobV3,
  probe: () => Promise<MediaProbeRecordV3>,
): Promise<MediaProbeRecordV3> {
  const existing = await store.get(job.assetId);
  const seed: MediaProbeRecordV3 = existing ?? { assetId: job.assetId, status: "queued", streams: [], derivatives: [], version: 0, updatedAt: new Date(0).toISOString() };
  const probing = withStatus(seed, "probing");
  await store.put(probing);
  try {
    const result = await probe();
    const normalized: MediaProbeRecordV3 = { ...result, assetId: job.assetId, version: probing.version, updatedAt: new Date().toISOString() };
    await store.put(normalized);
    return normalized;
  } catch (error) {
    const failed = withStatus(probing, "failed", error instanceof Error ? error.message : String(error));
    await store.put(failed);
    return failed;
  }
}

export async function runMediaDerivativeJobsV3(
  store: MediaProbeStoreV3,
  record: MediaProbeRecordV3,
  sourceUri: string,
  generator: MediaDerivativeGeneratorV3,
  verify?: MediaDerivativeVerifierV3,
): Promise<MediaProbeRecordV3> {
  const current = withStatus(record, "processing");
  await store.put(current);
  const derivatives = [...current.derivatives];
  const failures: string[] = [];
  const jobs: Array<Promise<MediaDerivativeV3 | undefined>> = [generator.generateAudioDerivative(current.assetId, sourceUri)];
  if (generator.generatePoster) jobs.push(generator.generatePoster(current.assetId, sourceUri));
  for (const task of jobs) {
    try {
      const derivative = await task;
      if (!derivative || (verify && !(await verify(derivative)).ok)) throw new Error("derivative verification failed");
      const existing = derivatives.findIndex((item) => item.derivativeId === derivative.derivativeId);
      if (existing >= 0) derivatives[existing] = derivative; else derivatives.push(derivative);
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error));
    }
  }
  const hasAudio = derivatives.some((item) => item.kind === "audio");
  const next = withStatus({ ...current, derivatives }, hasAudio && failures.length === 0 ? "ready" : hasAudio ? "partial" : "failed", failures[0]);
  await store.put(next);
  return next;
}

export type FfprobeRunnerV3 = (args: readonly string[]) => Promise<string>;
export type FfprobeMediaProbeOptionsV3 = { ffprobePath?: string; run?: FfprobeRunnerV3; sampleRate?: number };

/** Node adapter used only by the VPS media worker. */
export function createFfprobeMediaProbeV3(options: FfprobeMediaProbeOptionsV3 = {}) {
  const run = options.run ?? (async (args: readonly string[]) => (await execFile(options.ffprobePath ?? "ffprobe", args, { maxBuffer: 4 * 1024 * 1024 })).stdout);
  const sampleRate = options.sampleRate ?? 48000;
  return async (sourcePath: string, assetId = sourcePath): Promise<MediaProbeRecordV3> => {
    const output = JSON.parse(await run(["-v", "error", "-show_streams", "-show_format", "-of", "json", sourcePath])) as { streams?: Array<Record<string, unknown>> };
    const streams = (output.streams ?? []).flatMap((raw, index): MediaStreamProbeV3[] => {
      const kind = raw.codec_type === "audio" ? "audio" : raw.codec_type === "video" ? "video" : undefined;
      if (!kind) return [];
      const durationSec = Number(raw.duration ?? 0);
      const stream: MediaStreamProbeV3 = { streamId: `${assetId}:${kind}:${index}`, kind, codec: typeof raw.codec_name === "string" ? raw.codec_name : undefined, codecConfig: typeof raw.extradata === "string" ? raw.extradata : undefined, durationUs: durationSec > 0 ? Math.round(durationSec * 1e6) : undefined, timeBase: typeof raw.time_base === "string" ? raw.time_base : undefined, disposition: typeof raw.disposition === "object" && raw.disposition ? raw.disposition as Record<string, number> : undefined };
      if (kind === "audio") Object.assign(stream, { sampleRate: Number(raw.sample_rate) || sampleRate, channels: Number(raw.channels) || 2, durationSamples: Math.round(durationSec * (Number(raw.sample_rate) || sampleRate)) });
      else Object.assign(stream, { width: Number(raw.width) || 1, height: Number(raw.height) || 1, frameRate: parseRate(raw.r_frame_rate) });
      return [stream];
    });
    return { assetId, status: "processing", streams, derivatives: [], version: 0, updatedAt: new Date().toISOString() };
  };
}

function parseRate(value: unknown): number | undefined {
  if (typeof value !== "string") return undefined;
  const [a, b] = value.split("/").map(Number);
  return Number.isFinite(a) && Number.isFinite(b) && b !== 0 ? a / b : Number.isFinite(a) ? a : undefined;
}
