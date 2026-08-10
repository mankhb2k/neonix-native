/**
 * Phase 1 — v2 schema freeze / migration guard.
 *
 * These tests pin the v2 schema surface so that v3 work cannot accidentally
 * change the meaning of the current authoring format:
 *  - root schema shape is frozen (no silent field additions/removals)
 *  - `formatVersion: 2` always routes through the v2 parser
 *  - `formatVersion: 3` can never parse through the v2 parser
 */
import { describe, expect, it } from "vitest";
import { MotionProjectV2Schema } from "../project";
import { MOTION_PROJECT_FORMAT_VERSION } from "../common";
import { parseMotionProjectV2 } from "../parse";

describe("v2 schema freeze", () => {
  it("MOTION_PROJECT_FORMAT_VERSION stays 2", () => {
    expect(MOTION_PROJECT_FORMAT_VERSION).toBe(2);
  });

  it("root schema shape is frozen", () => {
    const shape = MotionProjectV2Schema.shape as Record<string, unknown>;
    expect(Object.keys(shape).sort()).toEqual(
      [
        "assets",
        "bindings",
        "dependencies",
        "extensions",
        "format",
        "formatVersion",
        "metadata",
        "scenes",
        "timeline",
        "variables",
      ].sort(),
    );
  });

  it("timeline schema shape is frozen (sceneOrder still canonical)", () => {
    const timelineShape = (
      MotionProjectV2Schema.shape.timeline as unknown as {
        shape: Record<string, unknown>;
      }
    ).shape;
    expect(Object.keys(timelineShape).sort()).toEqual(
      ["audioTracks", "captionTracks", "sceneOrder"].sort(),
    );
  });

  it("metadata schema shape is frozen", () => {
    const metadataShape = (
      MotionProjectV2Schema.shape.metadata as unknown as {
        shape: Record<string, unknown>;
      }
    ).shape;
    expect(Object.keys(metadataShape).sort()).toContain("aspectRatio");
    expect(Object.keys(metadataShape).sort()).toContain("fps");
    expect(Object.keys(metadataShape).sort()).toContain("brand");
    expect(Object.keys(metadataShape).sort()).toContain("locale");
  });

  it("scene schema still allows transition (v2 semantic kept)", () => {
    const sceneSchema = (
      MotionProjectV2Schema.shape.scenes as unknown as {
        element: { shape: Record<string, unknown> };
      }
    ).element;
    const sceneShape = sceneSchema.shape as Record<string, unknown>;
    expect(sceneShape.transition).toBeDefined();
  });
});

describe("v2 migration guard", () => {
  const validV2 = {
    format: "motion-project",
    formatVersion: 2,
    metadata: {
      id: "guard",
      name: "Guard",
      aspectRatio: "16:9",
      fps: 30,
      locale: "vi-VN",
      brand: { name: "Default" },
    },
    dependencies: { components: [] },
    assets: [],
    variables: [],
    timeline: { sceneOrder: [], audioTracks: [], captionTracks: [] },
    scenes: [],
    bindings: [],
    extensions: { constraints: [], events: [] },
  };

  it("formatVersion: 2 parses through the v2 parser", () => {
    expect(parseMotionProjectV2(validV2).formatVersion).toBe(2);
  });

  it("formatVersion: 3 never parses through the v2 parser", () => {
    expect(() =>
      parseMotionProjectV2({ ...validV2, formatVersion: 3 }),
    ).toThrow();
  });

  it("v2 meaning must not change in place (unknown root field rejected)", () => {
    expect(() =>
      parseMotionProjectV2({ ...validV2, composition: {} }),
    ).toThrow();
  });
});
