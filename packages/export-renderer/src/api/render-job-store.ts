import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { RenderJobStatus } from "../contracts/render-job";
import type { ExportRenderStats } from "../render/types";

export type RendererRenderJob = {
  jobId: string;
  status: RenderJobStatus;
  progress: number;
  stage?: string;
  error?: string;
  outputName: string;
  artifactUrl?: string;
  artifactPath?: string;
  checksum?: string;
  stats?: Pick<ExportRenderStats, "frames" | "durationSeconds" | "outputBytes" | "renderMilliseconds" | "encodeMilliseconds" | "scheduler" | "encodeBreakdown" | "renderBreakdown" | "backendIdentity"> & {
    verifiedFrames?: number;
    verifiedDurationSeconds?: number;
    verifiedCodec?: string;
    audioStreams?: number;
  };
  attempt?: number;
  createdAt: number;
  updatedAt: number;
};

function safeJobId(jobId: string): string {
  if (!/^[a-zA-Z0-9._-]+$/.test(jobId)) throw new Error("Invalid render job id");
  return jobId;
}

export class FileRenderJobStore {
  constructor(private readonly root: string) {}

  private filePath(jobId: string): string {
    return path.join(this.root, `${safeJobId(jobId)}.json`);
  }

  async get(jobId: string): Promise<RendererRenderJob | null> {
    try {
      return JSON.parse(await readFile(this.filePath(jobId), "utf8")) as RendererRenderJob;
    } catch {
      return null;
    }
  }

  async create(input: { jobId: string; outputName: string; attempt?: number }): Promise<{ job: RendererRenderJob; created: boolean }> {
    const existing = await this.get(input.jobId);
    const attempt = Math.max(1, Math.floor(input.attempt ?? 1));
    const existingAttempt = existing?.attempt ?? 1;
    if (existing && attempt <= existingAttempt) return { job: existing, created: false };
    if (existing) {
      const retry: RendererRenderJob = {
        ...existing,
        status: "queued",
        progress: 0,
        stage: "queued",
        error: undefined,
        artifactUrl: undefined,
        artifactPath: undefined,
        checksum: undefined,
        stats: undefined,
        attempt,
        updatedAt: Date.now(),
      };
      await this.save(retry);
      return { job: retry, created: true };
    }
    const now = Date.now();
    const job: RendererRenderJob = {
      jobId: safeJobId(input.jobId),
      status: "queued",
      progress: 0,
      outputName: input.outputName,
      attempt,
      createdAt: now,
      updatedAt: now,
    };
    await this.save(job);
    return { job, created: true };
  }

  async update(jobId: string, patch: Partial<RendererRenderJob>): Promise<RendererRenderJob | null> {
    const current = await this.get(jobId);
    if (!current) return null;
    const next: RendererRenderJob = { ...current, ...patch, jobId: current.jobId, updatedAt: Date.now() };
    await this.save(next);
    return next;
  }

  private async save(job: RendererRenderJob): Promise<void> {
    await mkdir(this.root, { recursive: true });
    const target = this.filePath(job.jobId);
    const temporary = `${target}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(temporary, `${JSON.stringify(job, null, 2)}\n`, "utf8");
    await rename(temporary, target);
  }
}
