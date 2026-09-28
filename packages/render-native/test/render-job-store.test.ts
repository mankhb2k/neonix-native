import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { FileRenderJobStore } from "../src/api/render-job-store";

describe("file render job attempts", () => {
  let root = "";

  afterEach(async () => {
    if (root) await rm(root, { recursive: true, force: true });
  });

  it("creates a new attempt after a failed worker attempt", async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "mv-renderer-jobs-"));
    const store = new FileRenderJobStore(root);

    const first = await store.create({ jobId: "attempt-job", outputName: "attempt-job.mp4", attempt: 1 });
    await store.update("attempt-job", { status: "failed", error: "transient" });
    const retry = await store.create({ jobId: "attempt-job", outputName: "attempt-job.mp4", attempt: 2 });

    expect(first.created).toBe(true);
    expect(retry.created).toBe(true);
    expect(retry.job.attempt).toBe(2);
    expect(retry.job.status).toBe("queued");
    expect(retry.job.error).toBeUndefined();
  });

  it("keeps an active attempt idempotent", async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "mv-renderer-jobs-"));
    const store = new FileRenderJobStore(root);

    const first = await store.create({ jobId: "active-job", outputName: "active-job.mp4", attempt: 1 });
    const duplicate = await store.create({ jobId: "active-job", outputName: "active-job.mp4", attempt: 1 });

    expect(first.created).toBe(true);
    expect(duplicate.created).toBe(false);
    expect(duplicate.job.attempt).toBe(1);
  });
});
