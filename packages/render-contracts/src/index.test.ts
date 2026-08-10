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

  it("parses full render manifest (§6.1 + Phase 10)", () => {
    const manifest = parseRenderManifest({
      format: "moticlip-render-manifest",
      formatVersion: 2,
      projectId: "p1",
      projectRevision: 0,
      versions: {
        schema: 2,
        compiler: "0.0.1",
        runtime: "0.0.1",
        remotion: "4.0.506",
        capabilityManifest: "wave-1",
      },
      contentHash: "a".repeat(64),
      determinism: {
        version: 1,
        frameEpsilon: 1.7763568394002505e-15,
        geometryEpsilon: 1e-12,
        lengthEpsilon: 1e-9,
        hashAlgorithm: "sha256",
        canonicalJson: true,
      },
      composition: {
        width: 1080,
        height: 1920,
        fps: 30,
        durationInFrames: 90,
        background: "#000000",
      },
      runtime: {
        url: "https://cdn.example/runtime.json",
        sha256: "abc",
      },
      assets: [
        {
          id: "a1",
          url: "https://cdn.example/a.png",
          sha256: "def",
          mimeType: "image/png",
        },
      ],
      output: {
        codec: "h264",
        pixelFormat: "yuv420p",
        privacy: "private",
      },
    });
    expect(manifest.composition.fps).toBe(30);
    expect(manifest.assets).toHaveLength(1);
    expect(manifest.versions.remotion).toBe("4.0.506");
    expect(manifest.formatVersion).toBe(2);
    expect(manifest.contentHash).toHaveLength(64);
    expect(manifest.determinism.hashAlgorithm).toBe("sha256");
  });
});
