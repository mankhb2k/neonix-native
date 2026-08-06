import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  createRenderJob,
  getRenderJob,
  assertJobOwner,
} from "@/lib/server/render/job-store";

describe("persistent render job store", () => {
  const previous = process.env.MOTIONVIDEO_RENDER_JOBS_DIR;
  let dir: string;

  afterEach(async () => {
    if (previous === undefined) delete process.env.MOTIONVIDEO_RENDER_JOBS_DIR;
    else process.env.MOTIONVIDEO_RENDER_JOBS_DIR = previous;
    if (dir) await rm(dir, { recursive: true, force: true });
  });

  it("survives re-read from disk (restart simulation)", async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "mv-render-jobs-"));
    process.env.MOTIONVIDEO_RENDER_JOBS_DIR = dir;
    const { job } = await createRenderJob({
      userId: "u1",
      projectId: "p1",
      projectRevision: 1,
      idempotencyKey: "u1:p1:1:export-1080p",
    });
    const again = await getRenderJob(job.jobId);
    expect(again?.jobId).toBe(job.jobId);
    expect(again?.projectId).toBe("p1");
  });

  it("does not double-create for the same idempotency key", async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "mv-render-jobs-"));
    process.env.MOTIONVIDEO_RENDER_JOBS_DIR = dir;
    const key = "idem-1";
    const first = await createRenderJob({
      userId: "u1",
      projectId: "p1",
      projectRevision: 2,
      idempotencyKey: key,
    });
    const second = await createRenderJob({
      userId: "u1",
      projectId: "p1",
      projectRevision: 2,
      idempotencyKey: key,
    });
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.job.jobId).toBe(first.job.jobId);
  });

  it("denies cross-user ownership", async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "mv-render-jobs-"));
    process.env.MOTIONVIDEO_RENDER_JOBS_DIR = dir;
    const { job } = await createRenderJob({
      userId: "owner",
      projectId: "p1",
      projectRevision: 0,
      idempotencyKey: "owner-key",
    });
    expect(() => assertJobOwner(job, "other")).toThrow(/FORBIDDEN/);
  });
});
