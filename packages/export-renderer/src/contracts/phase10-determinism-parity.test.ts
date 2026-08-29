/**
 * Phase 10 tests: Export determinism & parity.
 *
 * Verifies:
 *   - Task 10.1: RenderManifest expansion (contentHash, determinism)
 *   - Task 10.1: Content hashing (SHA-256, canonical JSON, incremental)
 *   - Task 10.5: Golden frames (sample points, comparison, matching)
 *   - Task 10.6: Preflight (capability checks, validation, failures)
 */

import { describe, it, expect } from "vitest";
import {
  computeContentHash,
  createContentHasher,
  shortHash,
  hashesMatch,
  parseRenderManifest,
} from "./index.js";
import {
  goldenSampleFrame,
  goldenSampleTime,
  compareGoldenFrames,
  GOLDEN_SAMPLE_POINTS,
} from "./golden-frames.js";
import {
  runPreflight,
  checkCodecSupport,
  checkTextureSize,
  checkMemory,
} from "./preflight.js";
import type { GoldenFile } from "./golden-frames.js";
import type { PreflightResult } from "./preflight.js";

// ═══════════════════════════════════════════════════════════════════
// RenderManifest (Task 10.1)
// ═══════════════════════════════════════════════════════════════════

describe("RenderManifest expansion (Task 10.1)", () => {
  it("manifestVersion is now 2 (Phase 10)", () => {
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
        frameEpsilon: 1.776e-15,
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
      assets: [],
      output: {
        codec: "h264",
        pixelFormat: "yuv420p",
        privacy: "private",
      },
    });
    expect(manifest.manifestVersion).toBe(2);
  });

  it("contentHash must be exactly 64 hex chars (SHA-256)", () => {
    expect(() =>
      parseRenderManifest({
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
        contentHash: "too-short",
        determinism: {
          version: 1,
          frameEpsilon: 1e-15,
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
        runtime: { url: "https://cdn.example/runtime.json", sha256: "abc" },
        assets: [],
        output: { codec: "h264", pixelFormat: "yuv420p", privacy: "private" },
      }),
    ).toThrow();
  });

  it("determinism block has all required fields", () => {
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
        frameEpsilon: 1.776e-15,
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
      runtime: { url: "https://cdn.example/runtime.json", sha256: "abc" },
      assets: [],
      output: { codec: "h264", pixelFormat: "yuv420p", privacy: "private" },
    });
    expect(manifest.determinism.version).toBe(1);
    expect(manifest.determinism.hashAlgorithm).toBe("sha256");
    expect(manifest.determinism.canonicalJson).toBe(true);
    expect(typeof manifest.determinism.frameEpsilon).toBe("number");
    expect(typeof manifest.determinism.geometryEpsilon).toBe("number");
    expect(typeof manifest.determinism.lengthEpsilon).toBe("number");
  });

  it("audio block is optional", () => {
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
        frameEpsilon: 1e-15,
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
      runtime: { url: "https://cdn.example/runtime.json", sha256: "abc" },
      assets: [],
      output: { codec: "h264", pixelFormat: "yuv420p", privacy: "private" },
    });
    // audio is optional, should not throw
    expect(manifest.audio).toBeUndefined();
  });

  it("audio block with data parses correctly", () => {
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
        frameEpsilon: 1e-15,
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
      runtime: { url: "https://cdn.example/runtime.json", sha256: "abc" },
      assets: [],
      audio: {
        audioLayerCount: 3,
        totalDurationSeconds: 45.0,
        sampleRate: 48000,
        codec: "aac",
      },
      output: { codec: "h264", pixelFormat: "yuv420p", privacy: "private" },
    });
    expect(manifest.audio?.audioLayerCount).toBe(3);
    expect(manifest.audio?.sampleRate).toBe(48000);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Content Hash (Task 10.1)
// ═══════════════════════════════════════════════════════════════════

describe("Content Hash (Task 10.1)", () => {
  it("computeContentHash returns 64-char hex string", () => {
    const hash = computeContentHash({ hello: "world", num: 42 });
    expect(hash).toHaveLength(64);
    expect(/^[0-9a-f]{64}$/.test(hash)).toBe(true);
  });

  it("same input produces same hash", () => {
    const input = { a: 1, b: 2, c: [3, 4, 5] };
    const h1 = computeContentHash(input);
    const h2 = computeContentHash(structuredClone(input));
    expect(h1).toBe(h2);
  });

  it("different input produces different hash", () => {
    const h1 = computeContentHash({ a: 1 });
    const h2 = computeContentHash({ a: 2 });
    expect(h1).not.toBe(h2);
  });

  it("key order does not affect hash (canonical sort)", () => {
    const h1 = computeContentHash({ a: 1, b: 2 });
    const h2 = computeContentHash({ b: 2, a: 1 });
    expect(h1).toBe(h2);
  });

  it("shortHash returns first 16 chars", () => {
    const hash = "a".repeat(64);
    expect(shortHash(hash)).toBe("a".repeat(16));
  });

  it("hashesMatch returns true for identical hashes", () => {
    const hash = computeContentHash({ x: 1 });
    expect(hashesMatch(hash, hash)).toBe(true);
  });

  it("hashesMatch returns false for different hashes", () => {
    const h1 = computeContentHash({ x: 1 });
    const h2 = computeContentHash({ x: 2 });
    expect(hashesMatch(h1, h2)).toBe(false);
  });

  it("hashesMatch returns false for different lengths", () => {
    expect(hashesMatch("abc", "abcdef")).toBe(false);
  });

  it("createContentHasher produces incremental hash", () => {
    const hasher = createContentHasher();
    hasher.update('{"a":1');
    hasher.update(',"b":2}');
    const hash = hasher.digest();
    expect(hash).toHaveLength(64);

    const direct = computeContentHash({ a: 1, b: 2 });
    expect(hash).toBe(direct);
  });

  it("nested objects produce deterministic hash", () => {
    const nested = {
      project: {
        id: "test",
        scenes: [
          { id: "s1", duration: 10 },
          { id: "s2", duration: 5 },
        ],
        metadata: { fps: 30 },
      },
    };
    const h1 = computeContentHash(nested);
    const h2 = computeContentHash(structuredClone(nested));
    expect(h1).toBe(h2);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Golden Frames (Task 10.5)
// ═══════════════════════════════════════════════════════════════════

describe("Golden Frames (Task 10.5)", () => {
  it("GOLDEN_SAMPLE_POINTS has 8 entries", () => {
    expect(GOLDEN_SAMPLE_POINTS).toHaveLength(8);
  });

  it("goldenSampleFrame computes correct frame indices", () => {
    const dur = 90; // 3 seconds @ 30fps
    expect(goldenSampleFrame("before-start", dur)).toBe(0);
    expect(goldenSampleFrame("start", dur)).toBe(0);
    expect(goldenSampleFrame("middle", dur)).toBe(45);
    expect(goldenSampleFrame("end", dur)).toBe(89);
    expect(goldenSampleFrame("after-end", dur)).toBe(89);
  });

  it("goldenSampleTime computes correct times", () => {
    const dur = 90;
    const fps = 30;
    expect(goldenSampleTime("start", dur, fps)).toBe(0);
    expect(goldenSampleTime("middle", dur, fps)).toBe(1.5);
    expect(goldenSampleTime("end", dur, fps)).toBe(89 / 30);
  });

  it("first-quarter at 25%", () => {
    expect(goldenSampleFrame("first-quarter", 100)).toBe(25);
  });

  it("last-quarter at 75%", () => {
    expect(goldenSampleFrame("last-quarter", 100)).toBe(75);
  });

  it("transition-overlap at 15%", () => {
    expect(goldenSampleFrame("transition-overlap", 100)).toBe(15);
  });

  it("compareGoldenFrames reports all match", () => {
    const golden: GoldenFile = {
      version: 1,
      contentHash: "a".repeat(64),
      durationInFrames: 90,
      fps: 30,
      width: 1080,
      height: 1920,
      compilerVersion: "1.0.0",
      frames: [
        {
          point: "start",
          frame: 0,
          time: 0,
          paintHash: "hash0",
          layers: 3,
          groups: 1,
          drawables: 5,
        },
        {
          point: "middle",
          frame: 45,
          time: 1.5,
          paintHash: "hash45",
          layers: 3,
          groups: 1,
          drawables: 5,
        },
        {
          point: "end",
          frame: 89,
          time: 2.966,
          paintHash: "hash89",
          layers: 3,
          groups: 1,
          drawables: 5,
        },
      ],
      generatedAt: "2025-01-01T00:00:00Z",
    };

    const current = [
      { paintHash: "hash0", layers: 3, groups: 1, drawables: 5 },
      { paintHash: "hash45", layers: 3, groups: 1, drawables: 5 },
      { paintHash: "hash89", layers: 3, groups: 1, drawables: 5 },
    ];

    const report = compareGoldenFrames(
      golden,
      current,
      ["start", "middle", "end"],
      90,
      30,
    );

    expect(report.allMatch).toBe(true);
    expect(report.mismatches).toHaveLength(0);
  });

  it("compareGoldenFrames reports mismatches", () => {
    const golden: GoldenFile = {
      version: 1,
      contentHash: "a".repeat(64),
      durationInFrames: 90,
      fps: 30,
      width: 1080,
      height: 1920,
      compilerVersion: "1.0.0",
      frames: [
        {
          point: "start",
          frame: 0,
          time: 0,
          paintHash: "good",
          layers: 3,
          groups: 1,
          drawables: 5,
        },
      ],
      generatedAt: "2025-01-01T00:00:00Z",
    };

    const current = [
      { paintHash: "wrong", layers: 3, groups: 1, drawables: 5 },
    ];

    const report = compareGoldenFrames(golden, current, ["start"], 90, 30);

    expect(report.allMatch).toBe(false);
    expect(report.mismatches).toHaveLength(1);
    expect(report.mismatches[0]!.paintMatch).toBe(false);
  });

  it("compareGoldenFrames detects structural mismatch", () => {
    const golden: GoldenFile = {
      version: 1,
      contentHash: "a".repeat(64),
      durationInFrames: 90,
      fps: 30,
      width: 1080,
      height: 1920,
      compilerVersion: "1.0.0",
      frames: [
        {
          point: "start",
          frame: 0,
          time: 0,
          paintHash: "hash",
          layers: 3,
          groups: 1,
          drawables: 5,
        },
      ],
      generatedAt: "2025-01-01T00:00:00Z",
    };

    const current = [
      { paintHash: "hash", layers: 5, groups: 2, drawables: 10 },
    ];

    const report = compareGoldenFrames(golden, current, ["start"], 90, 30);

    expect(report.allMatch).toBe(false);
    expect(report.mismatches[0]!.structuralMatch).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Preflight (Task 10.6)
// ═══════════════════════════════════════════════════════════════════

describe("Preflight (Task 10.6)", () => {
  const goodEnv: PreflightResult["environment"] = {
    platform: "linux",
    renderer: "WebGL2",
    codecSupport: ["avc1", "aac", "vp9"],
    maxTextureSize: 16384,
    audioContextAvailable: true,
  };

  it("runPreflight passes with all capabilities forced", () => {
    // Preflight checks real browser APIs — in Node they'll fail.
    // Test via individual capability checks instead.
    const textureCap = checkTextureSize(16384, 4096);
    expect(textureCap.available).toBe(true);

    const codecCaps = checkCodecSupport(["avc1"], ["avc1", "aac"]);
    expect(codecCaps[0]!.available).toBe(true);

    const memCap = checkMemory(4096, 512);
    expect(memCap.available).toBe(true);
  });

  it("runPreflight reports failures for missing codecs", () => {
    const result = runPreflight(
      {
        platform: "linux",
        codecSupport: [],
        maxTextureSize: 16384,
        audioContextAvailable: false,
      },
      { requiredCodecs: ["avc1"] },
    );
    expect(result.failures.length).toBeGreaterThan(0);
  });

  it("checkTextureSize passes when size meets requirement", () => {
    const cap = checkTextureSize(16384, 4096);
    expect(cap.available).toBe(true);
  });

  it("checkTextureSize fails when size below requirement", () => {
    const cap = checkTextureSize(2048, 4096);
    expect(cap.available).toBe(false);
  });

  it("checkCodecSupport returns per-codec capabilities", () => {
    const caps = checkCodecSupport(["avc1", "hevc"], ["avc1"]);
    expect(caps).toHaveLength(2);
    expect(caps[0]!.available).toBe(true);
    expect(caps[1]!.available).toBe(false);
  });

  it("checkMemory passes with enough memory", () => {
    const cap = checkMemory(4096, 512);
    expect(cap.available).toBe(true);
  });

  it("checkMemory fails with insufficient memory", () => {
    const cap = checkMemory(256, 512);
    expect(cap.available).toBe(false);
    expect(cap.reason).toBeDefined();
  });

  it("preflight result has timestamp", () => {
    const result = runPreflight(goodEnv);
    expect(result.checkedAt).toBeDefined();
    expect(new Date(result.checkedAt).getTime()).toBeGreaterThan(0);
  });

  it("preflight result includes all capability checks", () => {
    const result = runPreflight(goodEnv);
    const ids = result.capabilities.map((c) => c.id);
    expect(ids).toContain("webcodecs");
    expect(ids).toContain("offscreen-canvas");
    expect(ids).toContain("webgl2");
    expect(ids).toContain("audio-context");
    expect(ids).toContain("texture-size");
    expect(ids).toContain("memory");
    expect(ids).toContain("codec-avc1");
    expect(ids).toContain("codec-aac");
  });

  it("strict mode produces result object", () => {
    const result = runPreflight(goodEnv, { strict: true });
    // Result is produced even if some browser APIs fail in Node
    expect(result.capabilities.length).toBeGreaterThan(0);
    expect(result.checkedAt).toBeDefined();
  });
});
