/**
 * Phase 4 — committed JSON Schema sanity tests.
 *
 * Full freshness is enforced by CI (regenerate + `git diff --exit-code`);
 * these tests keep the committed artifacts honest at the structural level.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SCHEMA_DIR = join(__dirname, "..", "..", "schema");

function loadSchema(name: string): {
  $ref: string;
  definitions: Record<string, { properties?: Record<string, unknown> }>;
} {
  return JSON.parse(readFileSync(join(SCHEMA_DIR, name), "utf8"));
}

describe("committed JSON schemas", () => {
  it("schema/v3.json exists", () => {
    expect(existsSync(join(SCHEMA_DIR, "v3.json"))).toBe(true);
  });

  it("v3 schema is draft-07 compatible and has all root fields", () => {
    const schema = loadSchema("v3.json");
    expect(schema.$ref).toBe("#/definitions/MotionProjectV3");
    const definition = schema.definitions.MotionProjectV3;
    expect(definition.properties).toBeDefined();
    const fields = Object.keys(definition.properties!);
    expect(fields.sort()).toEqual(
      [
        "assets",
        "bindings",
        "capabilities",
        "components",
        "composition",
        "dependencies",
        "extensions",
        "format",
        "formatVersion",
        "metadata",
        "provenance",
        "scenes",
        "timeline",
        "tokens",
        "variables",
      ].sort(),
    );
  });

  it("v3 schema encodes visualTracks (timeline no longer sceneOrder)", () => {
    const schema = loadSchema("v3.json");
    const timeline = schema.definitions.MotionProjectV3.properties!
      .timeline as unknown as {
      properties?: Record<string, unknown>;
    };
    const timelineProps = Object.keys(timeline.properties ?? {});
    expect(timelineProps).toContain("visualTracks");
    expect(timelineProps).not.toContain("sceneOrder");
  });

  it("v3 schema visual clips are scene-only (no role, no transition, no component source)", () => {
    const schema = loadSchema("v3.json");
    const timeline = schema.definitions.MotionProjectV3.properties!
      .timeline as {
      properties?: {
        visualTracks?: {
          items?: {
            properties?: Record<string, unknown>;
            required?: string[];
          };
        };
      };
    };
    const track = timeline.properties?.visualTracks?.items;
    const trackProps = Object.keys(track?.properties ?? {});
    expect(trackProps).not.toContain("role");
    expect(track?.required ?? []).not.toContain("role");

    const clips = track?.properties?.clips as {
      items?: {
        properties?: Record<string, unknown>;
      };
    };
    const clipProps = Object.keys(clips?.items?.properties ?? {});
    expect(clipProps).not.toContain("transitionIn");
    expect(clipProps).not.toContain("transitionOut");

    const source = clips?.items?.properties?.source as {
      anyOf?: Array<{ properties?: { kind?: { const?: string } } }>;
      properties?: { kind?: { const?: string } };
    };
    const kinds = source?.anyOf
      ? source.anyOf.map((entry) => entry.properties?.kind?.const)
      : [source?.properties?.kind?.const];
    expect(kinds).toEqual(["scene"]);

    const audioTrack = timeline.properties?.audioTracks as {
      items?: {
        properties?: Record<string, unknown>;
        required?: string[];
      };
    };
    expect(audioTrack?.items?.required ?? []).toContain("order");
    const audioOrder = audioTrack?.items?.properties?.order as {
      exclusiveMaximum?: boolean;
      maximum?: number;
    };
    expect(audioOrder?.exclusiveMaximum).toBe(true);
    expect(audioOrder?.maximum).toBe(0);
  });
});

// ── Phase 7 — V3 naming gate ────────────────────────────────────────

import * as Protocol from "../index";
import type {
  NodeTiming,
  ProceduralDriver,
  MotionPoint,
  MotionPathSegment,
  MotionPathContour,
  MotionPathMorphTarget,
} from "../index";

describe("Phase 7 — public API V3 naming", () => {
  it("every V2-named schema/value export has a neutral counterpart", () => {
    // Only runtime values (Zod schemas, constants, functions), not types.
    const runtimeExports = Object.keys(Protocol);

    const requiredNeutralValues = [
      "EffectSchema",
      "TransformSchema",
      "ImageAssetSchema",
      "SvgAssetSchema",
      "VideoAssetSchema",
      "AudioAssetSchema",
      "FontAssetSchema",
      "AssetSchema",
      "VariableSchema",
      "PublicParamSchema",
      "PointSchema",
      "PathSegmentSchema",
      "PathContourSchema",
      "PathMorphTargetSchema",
      "NodeTimingSchema",
      "GroupNodeSchema",
      "BoneNodeSchema",
      "TextNodeSchema",
      "ShapeNodeSchema",
      "PathNodeSchema",
      "ImageNodeSchema",
      "SvgNodeSchema",
      "VideoNodeSchema",
      "CameraNodeSchema",
      "SolidNodeSchema",
      "AdjustmentNodeSchema",
      "NodeSchema",
      "KeyframeEasingSchema",
      "ProceduralDriverSchema",
    ];

    for (const name of requiredNeutralValues) {
      expect(runtimeExports, `Missing neutral export: ${name}`).toContain(name);
    }
  });

  it("type-only neutral names are importable", () => {
    // Compile-time check: if these types didn't exist, TS would fail here.
    // Declare dummy vars to suppress no-unused-vars.
    void (null as unknown as NodeTiming);
    void (null as unknown as ProceduralDriver);
    void (null as unknown as MotionPoint);
    void (null as unknown as MotionPathSegment);
    void (null as unknown as MotionPathContour);
    void (null as unknown as MotionPathMorphTarget);

    // If we got this far, the types imported successfully.
    // Also check MotionTransform, MotionEffect which already exist.
  });
});

// ── Phase 8 — package.json exports gate ─────────────────────────────

describe("Phase 8 — package.json exports", () => {
  it("does not expose compat/ in public exports", () => {
    const pkgJsonPath = join(__dirname, "..", "..", "package.json");
    const pkg = JSON.parse(readFileSync(pkgJsonPath, "utf8")) as {
      exports?: Record<string, string>;
    };

    const exportKeys = Object.keys(pkg.exports ?? {});
    expect(exportKeys).not.toContain("./compat");
    expect(exportKeys).not.toContain("./compat/*");

    // Only the root export should remain
    expect(exportKeys).toEqual(["."]);
  });
});
