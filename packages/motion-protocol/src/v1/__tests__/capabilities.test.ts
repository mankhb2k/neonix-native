/**
 * Phase 11 — Capability preflight tests.
 *
 * Validates that `preflightProjectCapabilities()` and
 * `inspectProjectCapabilities()` correctly detect capability usage
 * from a V1 project shape.
 */
import { describe, expect, it } from "vitest";
import {
  preflightProjectCapabilities,
  inspectProjectCapabilities,
  CAPABILITY_MANIFEST_VERSION_V1,
} from "../capabilities";

describe("inspectProjectCapabilities", () => {
  it("returns empty set for empty project", () => {
    const caps = inspectProjectCapabilities({});
    expect(caps.size).toBe(0);
  });

  it("detects text layers", () => {
    const caps = inspectProjectCapabilities({
      scenes: [{ layers: [{ type: "text" }] }],
    });
    expect(caps.has("primitive.text")).toBe(true);
  });

  it("detects image layers", () => {
    const caps = inspectProjectCapabilities({
      scenes: [{ layers: [{ type: "image" }] }],
    });
    expect(caps.has("primitive.image")).toBe(true);
  });

  it("detects video layers", () => {
    const caps = inspectProjectCapabilities({
      scenes: [{ layers: [{ type: "video" }] }],
    });
    expect(caps.has("primitive.video")).toBe(true);
  });

  it("detects svg layers", () => {
    const caps = inspectProjectCapabilities({
      scenes: [{ layers: [{ type: "svg" }] }],
    });
    expect(caps.has("primitive.svg")).toBe(true);
  });

  it("detects shape layers", () => {
    const caps = inspectProjectCapabilities({
      scenes: [{ layers: [{ type: "shape" }] }],
    });
    expect(caps.has("primitive.shape")).toBe(true);
  });

  it("detects path layers", () => {
    const caps = inspectProjectCapabilities({
      scenes: [{ layers: [{ type: "path" }] }],
    });
    expect(caps.has("primitive.path")).toBe(true);
  });

  it("detects group layers", () => {
    const caps = inspectProjectCapabilities({
      scenes: [{ layers: [{ type: "group" }] }],
    });
    expect(caps.has("primitive.group")).toBe(true);
  });

  it("detects camera layers as orthographic", () => {
    const caps = inspectProjectCapabilities({
      scenes: [{ layers: [{ type: "camera" }] }],
    });
    expect(caps.has("camera.orthographic")).toBe(true);
  });

  it("detects adjustment layers as color-adjust effect", () => {
    const caps = inspectProjectCapabilities({
      scenes: [{ layers: [{ type: "adjustment" }] }],
    });
    expect(caps.has("effect.color-adjust")).toBe(true);
  });

  it("detects multiple node types at once", () => {
    const caps = inspectProjectCapabilities({
      scenes: [
        {
          layers: [
            { type: "text" },
            { type: "image" },
            { type: "shape" },
            { type: "group" },
          ],
        },
      ],
    });
    expect(caps.size).toBe(4);
    expect(caps.has("primitive.text")).toBe(true);
    expect(caps.has("primitive.image")).toBe(true);
    expect(caps.has("primitive.shape")).toBe(true);
    expect(caps.has("primitive.group")).toBe(true);
  });

  it("detects component embedding from components array", () => {
    const caps = inspectProjectCapabilities({
      components: [{ layers: [{ type: "text" }] }],
    });
    expect(caps.has("component.embedding")).toBe(true);
    expect(caps.has("primitive.text")).toBe(true);
  });

  it("detects audio capabilities from audio tracks", () => {
    const caps = inspectProjectCapabilities({
      timeline: { audioTracks: [{}] },
    });
    expect(caps.has("audio.render-plan")).toBe(true);
  });

  it("detects caption capabilities from caption tracks", () => {
    const caps = inspectProjectCapabilities({
      timeline: { captionTracks: [{}] },
    });
    expect(caps.has("caption.track")).toBe(true);
  });

  it("does not emit transition capabilities; embedding from scene component layers", () => {
    const caps = inspectProjectCapabilities({
      scenes: [{ layers: [{ type: "component" }] }],
      timeline: {
        visualTracks: [
          {
            clips: [{ source: { kind: "scene" } }],
          },
        ],
      },
    });
    expect([...caps].some((c) => c.startsWith("transition."))).toBe(false);
    expect(caps.has("component.embedding")).toBe(true);
  });
});

describe("preflightProjectCapabilities", () => {
  it("passes when project has no scenes (no capabilities used)", () => {
    const result = preflightProjectCapabilities({});
    expect(result.ok).toBe(true);
    expect(result.used).toEqual([]);
    expect(result.undeclared).toEqual([]);
  });

  it("detects undeclared capabilities used by scenes", () => {
    const result = preflightProjectCapabilities({
      scenes: [{ layers: [{ type: "text" }, { type: "image" }] }],
      capabilities: { required: [] },
    });
    expect(result.ok).toBe(false);
    expect(result.used).toEqual(
      expect.arrayContaining(["primitive.text", "primitive.image"]),
    );
    expect(result.undeclared).toEqual(
      expect.arrayContaining(["primitive.text", "primitive.image"]),
    );
  });

  it("passes when all used capabilities are declared", () => {
    const result = preflightProjectCapabilities({
      scenes: [{ layers: [{ type: "text" }] }],
      capabilities: { required: ["primitive.text"] },
    });
    expect(result.ok).toBe(true);
    expect(result.undeclared).toEqual([]);
  });

  it("passes when declared capabilities include unused ones", () => {
    const result = preflightProjectCapabilities({
      scenes: [{ layers: [{ type: "text" }] }],
      capabilities: {
        required: ["primitive.text", "primitive.video", "effect.blur"],
      },
    });
    expect(result.ok).toBe(true);
    expect(result.undeclared).toEqual([]);
  });

  it("detects experimental capabilities in use", () => {
    const result = preflightProjectCapabilities({
      scenes: [{ layers: [{ type: "text" }] }],
      capabilities: {
        required: ["primitive.text"],
        experimental: ["primitive.text"],
      },
    });
    expect(result.ok).toBe(false);
    expect(result.experimentalInUse).toEqual(["primitive.text"]);
  });

  it("passes when experimental capabilities are not actually used", () => {
    const result = preflightProjectCapabilities({
      scenes: [{ layers: [{ type: "text" }] }],
      capabilities: {
        required: ["primitive.text"],
        experimental: ["effect.blur"],
      },
    });
    expect(result.ok).toBe(true);
    expect(result.experimentalInUse).toEqual([]);
  });

  it("sorts used and declared arrays", () => {
    const result = preflightProjectCapabilities({
      scenes: [{ layers: [{ type: "image" }, { type: "text" }] }],
      capabilities: { required: [] },
    });
    expect(result.used).toEqual(["primitive.image", "primitive.text"]);
  });

  it("does not treat removed transition fields as used capabilities", () => {
    const result = preflightProjectCapabilities({
      scenes: [{ layers: [{ type: "group" }] }],
      timeline: {
        visualTracks: [
          {
            clips: [{ source: { kind: "scene" } }],
          },
        ],
      },
      capabilities: {
        required: ["primitive.group"],
      },
    });
    expect(result.ok).toBe(true);
    expect(result.undeclared.some((c) => c.startsWith("transition."))).toBe(
      false,
    );
  });
});

describe("CAPABILITY_MANIFEST_VERSION_V1", () => {
  it("is a non-empty string", () => {
    expect(typeof CAPABILITY_MANIFEST_VERSION_V1).toBe("string");
    expect(CAPABILITY_MANIFEST_VERSION_V1.length).toBeGreaterThan(0);
  });

  it("follows semver-like pattern", () => {
    expect(CAPABILITY_MANIFEST_VERSION_V1).toMatch(/^v\d+\.\d+$/);
  });
});
