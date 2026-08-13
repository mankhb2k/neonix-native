/**
 * Phase 12 — Determinism & Hashing Tests.
 *
 * Validates that:
 * - Same semantic V1 project → same projectHash (timestamps/provenance stripped)
 * - Same compile input → same runtimeHash
 * - Key order doesn't affect hash
 * - Cache key is deterministic
 * - deepSortKeys and canonicalJson are stable
 */
import { describe, expect, it } from "vitest";
import {
  canonicalJson,
  deepSortKeys,
  computeProjectHash,
  computeProjectHashShort,
  computeRuntimeHash,
  computeContentHash,
  shortHash,
  hashesMatch,
  buildCapabilityFingerprint,
  RENDER_MANIFEST_VERSION,
} from "../canonical-hash";

// ── canonicalJson ─────────────────────────────────────────────────────

describe("canonicalJson", () => {
  it("returns consistent output for same input", () => {
    const obj = { b: 2, a: 1, c: [3, 1, 2] };
    expect(canonicalJson(obj)).toBe(canonicalJson(obj));
  });

  it("sorts object keys alphabetically", () => {
    const a = { zebra: 1, apple: 2, banana: 3 };
    const b = { banana: 3, zebra: 1, apple: 2 };
    expect(canonicalJson(a)).toBe(canonicalJson(b));
  });

  it("preserves array order (arrays are semantically ordered)", () => {
    const a = { items: [1, 2, 3] };
    const b = { items: [3, 2, 1] };
    expect(canonicalJson(a)).not.toBe(canonicalJson(b));
  });

  it("handles nested objects", () => {
    const a = { outer: { inner: { c: 3, b: 2, a: 1 } } };
    const b = { outer: { inner: { a: 1, b: 2, c: 3 } } };
    expect(canonicalJson(a)).toBe(canonicalJson(b));
  });

  it("handles null and undefined", () => {
    expect(canonicalJson(null)).toBe("null");
    expect(canonicalJson(undefined)).toBe("null");
  });

  it("handles primitive values", () => {
    expect(canonicalJson(42)).toBe("42");
    expect(canonicalJson("hello")).toBe('"hello"');
    expect(canonicalJson(true)).toBe("true");
  });
});

// ── deepSortKeys ──────────────────────────────────────────────────────

describe("deepSortKeys", () => {
  it("sorts top-level keys", () => {
    const sorted = deepSortKeys({ b: 2, a: 1, c: 3 });
    expect(Object.keys(sorted)).toEqual(["a", "b", "c"]);
  });

  it("sorts nested keys recursively", () => {
    const sorted = deepSortKeys({
      b: { d: 4, c: 3 },
      a: { f: 6, e: 5 },
    });
    expect(Object.keys(sorted)).toEqual(["a", "b"]);
    expect(
      Object.keys((sorted as Record<string, unknown>).b as object),
    ).toEqual(["c", "d"]);
    expect(
      Object.keys((sorted as Record<string, unknown>).a as object),
    ).toEqual(["e", "f"]);
  });

  it("preserves array order", () => {
    const sorted = deepSortKeys({ items: [3, 1, 2] });
    expect((sorted as Record<string, unknown>).items).toEqual([3, 1, 2]);
  });

  it("handles null gracefully", () => {
    const sorted = deepSortKeys({ a: null, b: 2 });
    expect(Object.keys(sorted)).toEqual(["a", "b"]);
  });
});

// ── computeProjectHash ────────────────────────────────────────────────

describe("computeProjectHash", () => {
  const baseProject = {
    format: "motion-project",
    formatVersion: 1,
    metadata: {
      id: "test-1",
      name: "Test Project",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-06-01T00:00:00Z",
      generator: "moticlip-editor",
    },
    composition: {
      width: 1920,
      height: 1080,
      fps: 30,
      background: "#000000",
    },
    dependencies: {
      compiler: { range: ">=1.0.0" },
      components: [],
    },
    capabilities: { required: ["primitive.text"] },
    timeline: {
      duration: 8,
    },
    components: [],
    layers: [],
    variables: [],
    assets: [],
    bindings: [],
    tokens: {},
  };

  it("returns 64-char hex string", () => {
    const hash = computeProjectHash(baseProject);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces same hash for same semantic project", () => {
    const h1 = computeProjectHash(baseProject);
    const h2 = computeProjectHash(baseProject);
    expect(h1).toBe(h2);
  });

  it("timestamps do not affect hash", () => {
    const p1 = {
      ...baseProject,
      metadata: { ...baseProject.metadata, createdAt: "2026-01-01T00:00:00Z" },
    };
    const p2 = {
      ...baseProject,
      metadata: { ...baseProject.metadata, createdAt: "2027-12-31T23:59:59Z" },
    };
    expect(computeProjectHash(p1)).toBe(computeProjectHash(p2));
  });

  it("provenance does not affect hash", () => {
    const p1 = { ...baseProject };
    const p2 = {
      ...baseProject,
      provenance: {
        workspaceId: "ws-123",
        source: { app: "editor", version: "2.1.0" },
      },
    };
    expect(computeProjectHash(p1)).toBe(computeProjectHash(p2));
  });

  it("extensions do not affect hash", () => {
    const p1 = { ...baseProject };
    const p2 = {
      ...baseProject,
      extensions: { "com.moticlip.ai-hints": { genre: "social" } },
    };
    expect(computeProjectHash(p1)).toBe(computeProjectHash(p2));
  });

  it("metadata.name change DOES affect hash", () => {
    const p1 = baseProject;
    const p2 = {
      ...baseProject,
      metadata: { ...baseProject.metadata, name: "Different" },
    };
    expect(computeProjectHash(p1)).not.toBe(computeProjectHash(p2));
  });

  it("composition change affects hash", () => {
    const p1 = baseProject;
    const p2 = {
      ...baseProject,
      composition: { ...baseProject.composition, width: 1280 },
    };
    expect(computeProjectHash(p1)).not.toBe(computeProjectHash(p2));
  });

  it("layer change affects hash", () => {
    const p1 = baseProject;
    const p2 = {
      ...baseProject,
      layers: [
        {
          id: "title",
          type: "text",
          parentLayerId: null,
          zIndex: 0,
          timing: { start: 0, duration: 5 },
          transform: {},
          payload: {},
        },
      ],
    };
    expect(computeProjectHash(p1)).not.toBe(computeProjectHash(p2));
  });

  it("capabilities change affects hash", () => {
    const p1 = baseProject;
    const p2 = {
      ...baseProject,
      capabilities: { required: ["primitive.video"] },
    };
    expect(computeProjectHash(p1)).not.toBe(computeProjectHash(p2));
  });

  it("metadata.generator does not affect hash", () => {
    const p1 = {
      ...baseProject,
      metadata: { ...baseProject.metadata, generator: "moticlip-editor" },
    };
    const p2 = {
      ...baseProject,
      metadata: { ...baseProject.metadata, generator: "ai-planner" },
    };
    expect(computeProjectHash(p1)).toBe(computeProjectHash(p2));
  });
});

// ── computeProjectHashShort ───────────────────────────────────────────

describe("computeProjectHashShort", () => {
  it("returns 16-char hex", () => {
    const hash = computeProjectHashShort({
      format: "motion-project",
      formatVersion: 1,
      metadata: { id: "test", name: "Test", createdAt: "", updatedAt: "" },
      composition: { width: 1920, height: 1080, fps: 30, background: "#000" },
      dependencies: { compiler: { range: ">=1" }, components: [] },
      capabilities: { required: [] },
      timeline: { duration: 8 },
      components: [],
      layers: [],
      variables: [],
      assets: [],
      bindings: [],
      tokens: {},
    });
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
  });
});

// ── computeRuntimeHash ────────────────────────────────────────────────

describe("computeRuntimeHash", () => {
  const baseIR = {
    format: "motion-runtime",
    formatVersion: 2,
    metadata: {
      id: "test",
      name: "Test",
      aspectRatio: "16:9" as const,
      fps: 30,
      brand: { name: "Default" },
    },
    assets: [],
    timeline: {
      visualTracks: [],
      audioTracks: [],
      captionTracks: [],
    },
    scenes: [],
    composition: {
      width: 1920,
      height: 1080,
      fps: 30,
      background: "#000",
      colorSpace: "srgb" as const,
      audioSampleRate: 44100,
    },
    compilerVersion: "3.0.0-phase12",
    capabilityFingerprint: "abc123def4567890",
  };

  it("returns 32-char hex string", () => {
    const hash = computeRuntimeHash(baseIR);
    expect(hash).toMatch(/^[0-9a-f]{32}$/);
  });

  it("same IR produces same hash", () => {
    expect(computeRuntimeHash(baseIR)).toBe(computeRuntimeHash(baseIR));
  });

  it("runtimeHash field is excluded (self-strip)", () => {
    const withHash = { ...baseIR, runtimeHash: "some-old-hash" };
    expect(computeRuntimeHash(withHash)).toBe(computeRuntimeHash(baseIR));
  });

  it("different IR produces different hash", () => {
    const ir2 = {
      ...baseIR,
      scenes: [{ id: "s1", duration: 5, layers: [], clips: [] }],
    };
    expect(computeRuntimeHash(baseIR)).not.toBe(computeRuntimeHash(ir2));
  });

  it("key order does not affect hash", () => {
    const a = {
      b: 2,
      a: 1,
      format: "motion-runtime",
      formatVersion: 2,
      metadata: baseIR.metadata,
      assets: [],
      timeline: baseIR.timeline,
      scenes: [],
      composition: baseIR.composition,
      compilerVersion: baseIR.compilerVersion,
      capabilityFingerprint: baseIR.capabilityFingerprint,
    };
    const b = {
      format: "motion-runtime",
      formatVersion: 2,
      metadata: baseIR.metadata,
      assets: baseIR.assets,
      timeline: baseIR.timeline,
      scenes: baseIR.scenes,
      composition: baseIR.composition,
      compilerVersion: baseIR.compilerVersion,
      capabilityFingerprint: baseIR.capabilityFingerprint,
      a: 1,
      b: 2,
    };
    expect(computeRuntimeHash(a)).toBe(computeRuntimeHash(b));
  });
});

// ── computeContentHash ────────────────────────────────────────────────

describe("computeContentHash", () => {
  it("returns 64-char hex", () => {
    const hash = computeContentHash({ hello: "world" });
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("same content = same hash", () => {
    expect(computeContentHash({ a: 1, b: 2 })).toBe(
      computeContentHash({ b: 2, a: 1 }),
    );
  });

  it("deeply nested produces stable hash", () => {
    const deep = { a: { b: { c: { d: { e: 1 } } } } };
    expect(computeContentHash(deep)).toBe(computeContentHash(deep));
  });
});

// ── shortHash ─────────────────────────────────────────────────────────

describe("shortHash", () => {
  it("returns first 16 chars", () => {
    expect(shortHash("abcdef1234567890fedcba0987654321abcdef12")).toBe(
      "abcdef1234567890",
    );
  });
});

// ── hashesMatch ───────────────────────────────────────────────────────

describe("hashesMatch", () => {
  it("returns true for equal hashes", () => {
    expect(hashesMatch("abc123", "abc123")).toBe(true);
  });

  it("returns false for different hashes", () => {
    expect(hashesMatch("abc123", "def456")).toBe(false);
  });

  it("returns false for different length hashes", () => {
    expect(hashesMatch("abc", "abcdef")).toBe(false);
  });
});

// ── buildCapabilityFingerprint ────────────────────────────────────────

describe("buildCapabilityFingerprint", () => {
  it("returns 16-char hex", () => {
    const fp = buildCapabilityFingerprint("v1.1");
    expect(fp).toMatch(/^[0-9a-f]{16}$/);
  });

  it("different version gives different fingerprint", () => {
    expect(buildCapabilityFingerprint("v1.1")).not.toBe(
      buildCapabilityFingerprint("v4.0"),
    );
  });

  it("same version gives same fingerprint", () => {
    expect(buildCapabilityFingerprint("v1.1")).toBe(
      buildCapabilityFingerprint("v1.1"),
    );
  });
});

// ── RENDER_MANIFEST_VERSION ───────────────────────────────────────────

describe("RENDER_MANIFEST_VERSION", () => {
  it("is a positive integer", () => {
    expect(RENDER_MANIFEST_VERSION).toBeGreaterThan(0);
    expect(Number.isInteger(RENDER_MANIFEST_VERSION)).toBe(true);
  });
});
