import { describe, expect, it } from "vitest";
import type { RuntimeProjectV3 } from "@motionvideo/motion-runtime";
import {
  assertContiguousRenderChunkManifest,
  buildRenderChunkManifest,
  toRenderJobChunkRows,
} from "../src/render/chunk-manifest";

function runtime(overrides: Partial<RuntimeProjectV3> = {}): RuntimeProjectV3 {
  return {
    format: "motion-runtime",
    runtimeVersion: 3,
    projectId: "phase5-fixture",
    durationUs: 60_000_000,
    visual: {
      composition: { width: 1920, height: 1080, fps: 30, duration: 60, background: "#000", graphId: "phase5-fixture" },
      view: { worldToClipMatrix: new Float64Array(16) },
      nodes: [],
    },
    mediaCatalog: { assets: [] },
    videoTimeline: { instances: [] },
    audioTimeline: { sampleRate: 48000, tracks: [] },
    ...overrides,
  };
}

describe("render chunk manifest", () => {
  it("covers a 60-second 30fps composition with stable boundaries", () => {
    const manifest = buildRenderChunkManifest(runtime(), { chunkSize: 300, parallelism: 4 });

    expect(manifest.composition.totalFrames).toBe(1800);
    expect(manifest.chunks).toHaveLength(6);
    expect(manifest.chunks[0]).toMatchObject({ chunkId: "chunk-0", startFrame: 0, endFrameExclusive: 300, attempt: 1 });
    expect(manifest.chunks[5]).toMatchObject({ chunkId: "chunk-5", startFrame: 1500, endFrameExclusive: 1800 });
    expect(manifest.runtimeChecksum).toMatch(/^[a-f0-9]{32}$/);
    expect(manifest.checksum).toMatch(/^[a-f0-9]{64}$/);
    expect(() => assertContiguousRenderChunkManifest(manifest)).not.toThrow();
  });

  it("is deterministic and turns the manifest into queued database rows", () => {
    const first = buildRenderChunkManifest(runtime(), { chunkSize: 300, parallelism: 4 });
    const second = buildRenderChunkManifest(runtime(), { chunkSize: 300, parallelism: 4 });
    const rows = toRenderJobChunkRows("job-1", first);

    expect(first).toEqual(second);
    expect(rows).toHaveLength(6);
    expect(rows[1]).toMatchObject({ render_job_id: "job-1", chunk_index: 1, start_frame: 300, end_frame_exclusive: 600, status: "queued", attempt: 1 });
    expect(rows[1]?.runtime_checksum).toBe(first.runtimeChecksum);
  });

  it("changes the runtime checksum when the immutable runtime changes", () => {
    const first = buildRenderChunkManifest(runtime());
    const second = buildRenderChunkManifest(runtime({ projectId: "phase5-fixture-v2" }));

    expect(second.runtimeChecksum).not.toBe(first.runtimeChecksum);
    expect(second.checksum).not.toBe(first.checksum);
  });

  it("rejects invalid planner options", () => {
    expect(() => buildRenderChunkManifest(runtime(), { chunkSize: 0 })).toThrow(RangeError);
    expect(() => buildRenderChunkManifest(runtime(), { parallelism: 0 })).toThrow(RangeError);
  });
});
