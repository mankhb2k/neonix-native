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
  it("schema/v2.json and schema/v3.json exist", () => {
    expect(existsSync(join(SCHEMA_DIR, "v2.json"))).toBe(true);
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

  it("v2 schema still encodes sceneOrder", () => {
    const schema = loadSchema("v2.json");
    const definition = schema.definitions.MotionProjectV2;
    const timeline = definition.properties!.timeline as unknown as {
      properties?: Record<string, unknown>;
    };
    expect(Object.keys(timeline.properties ?? {})).toContain("sceneOrder");
  });
});
