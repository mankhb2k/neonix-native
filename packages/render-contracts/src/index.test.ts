import { describe, expect, it } from "vitest";
import {
  parseRenderManifest,
  RenderJobProgressSchema,
  RenderJobStatusSchema,
} from "./index";

describe("render-contracts", () => {
  it("parses job status", () => {
    expect(RenderJobStatusSchema.parse("queued")).toBe("queued");
    expect(RenderJobStatusSchema.parse("done")).toBe("done");
  });

  it("parses job progress", () => {
    const progress = RenderJobProgressSchema.parse({
      jobId: "j1",
      status: "rendering",
      progress: 0.5,
      createdAt: 1,
      updatedAt: 2,
    });
    expect(progress.jobId).toBe("j1");
  });

  it("parses minimal render manifest", () => {
    const manifest = parseRenderManifest({
      format: "moticlip-render-manifest",
      formatVersion: 1,
      projectId: "p1",
      projectRevision: 0,
      versions: {
        schema: 2,
        compiler: "0.0.1",
        runtime: "0.0.1",
        remotion: "4.0.506",
        capabilityManifest: "wave-1",
      },
      composition: {
        width: 1080,
        height: 1920,
        fps: 30,
        durationInFrames: 90,
        background: "#000000",
      },
    });
    expect(manifest.composition.fps).toBe(30);
  });
});
