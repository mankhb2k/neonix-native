import { describe, expect, it } from "vitest";
import {
  parseRenderManifest,
  RenderJobProgressSchema,
  RenderJobStatusSchema,
} from "../contracts/index";
import {
  GROUP_COMPOSITING_MODES,
  type GroupCompositingMode,
  type ProviderCapabilities,
} from "../contracts/provider";

describe("export-renderer contracts", () => {
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
      manifestVersion: 2,
      projectId: "p1",
      projectRevision: 0,
      versions: {
        schema: 2,
        compiler: "0.0.1",
        runtime: "0.0.1",
        exportRenderer: "0.0.1",
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
    expect(manifest.versions.exportRenderer).toBe("0.0.1");
    expect(manifest.manifestVersion).toBe(2);
    expect(manifest.contentHash).toHaveLength(64);
    expect(manifest.determinism.hashAlgorithm).toBe("sha256");
  });
});

// ── Phase 8: Group compositing contract ──────────────────────────────

describe("Phase 8 — group compositing contract", () => {
  it("GROUP_COMPOSITING_MODES includes pass-through and isolate", () => {
    expect(GROUP_COMPOSITING_MODES).toContain("pass-through");
    expect(GROUP_COMPOSITING_MODES).toContain("isolate");
    expect(GROUP_COMPOSITING_MODES).toHaveLength(2);
  });

  it("GroupCompositingMode type is a string union", () => {
    const pass: GroupCompositingMode = "pass-through";
    const isolate: GroupCompositingMode = "isolate";
    expect(pass).toBe("pass-through");
    expect(isolate).toBe("isolate");
  });

  it("ProviderCapabilities should declare supportedGroupCompositingModes", () => {
    const caps: ProviderCapabilities = {
      providerId: "test-provider",
      displayName: "Test",
      version: "1.0.0",
      backend: "canvas",
      supportedNodeTypes: ["group", "text", "image"],
      supportedEffects: [],
      supportedTransitions: [],
      supportedGroupCompositingModes: ["pass-through", "isolate"],
      maxResolution: { width: 1920, height: 1080 },
      supportsAlpha: true,
      supportsAudio: false,
      supportsFinalExport: true,
    };
    expect(caps.supportedGroupCompositingModes).toEqual([
      "pass-through",
      "isolate",
    ]);
  });

  it("pass-through does not require offscreen surface", () => {
    // Providers must NOT create offscreen for pass-through groups.
    // This is a contract assertion, not a runtime test.
    const passOnly: ProviderCapabilities = {
      providerId: "simple-provider",
      displayName: "Simple",
      version: "1.0.0",
      backend: "canvas",
      supportedNodeTypes: ["group", "text"],
      supportedEffects: [],
      supportedTransitions: [],
      supportedGroupCompositingModes: ["pass-through"],
      maxResolution: { width: 1920, height: 1080 },
      supportsAlpha: false,
      supportsAudio: false,
      supportsFinalExport: true,
    };
    expect(passOnly.supportedGroupCompositingModes).not.toContain("isolate");
  });
});
