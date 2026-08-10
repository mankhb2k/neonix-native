/**
 * Phase 4 — unified parse API tests.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  MotionProjectParseError,
  parseMotionProjectAny,
} from "../parse-any";
import { parseMotionProjectV3, serializeMotionProjectV3 } from "../v3/parse";
import { MotionV3ReferenceError } from "../v3/references/types";
import { parseMotionProjectV2 } from "../v2/parse";

const FIXTURES = join(__dirname, "..", "__fixtures__", "v2");
const V3_FIXTURES = join(__dirname, "..", "v3", "__fixtures__");

function loadV2(name: string): unknown {
  return JSON.parse(readFileSync(join(FIXTURES, name), "utf8"));
}

function loadV3(name: string): unknown {
  return JSON.parse(readFileSync(join(V3_FIXTURES, name), "utf8"));
}

describe("parseMotionProjectAny", () => {
  it("routes v2 projects to the v2 parser", () => {
    const result = parseMotionProjectAny(loadV2("single-scene.project.json"));
    expect(result.version).toBe(2);
    if (result.version === 2) {
      expect(result.project.formatVersion).toBe(2);
    }
  });

  it("routes v3 projects to the v3 parser", () => {
    const result = parseMotionProjectAny(loadV3("representative.project.json"));
    expect(result.version).toBe(3);
    if (result.version === 3) {
      expect(result.project.formatVersion).toBe(3);
      expect(result.project.timeline.visualTracks).toHaveLength(1);
    }
  });

  it("throws MotionProjectParseError for non-object input", () => {
    expect(() => parseMotionProjectAny(null)).toThrow(MotionProjectParseError);
    expect(() => parseMotionProjectAny("nope")).toThrow(MotionProjectParseError);
  });

  it("throws invalid_input for wrong format", () => {
    try {
      parseMotionProjectAny({ format: "motion-component", formatVersion: 2 });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(MotionProjectParseError);
      expect((error as MotionProjectParseError).code).toBe("invalid_input");
    }
  });

  it("throws unsupported_version for unknown formatVersion", () => {
    try {
      parseMotionProjectAny({
        format: "motion-project",
        formatVersion: 4,
        metadata: {},
      });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(MotionProjectParseError);
      expect((error as MotionProjectParseError).code).toBe(
        "unsupported_version",
      );
    }
  });

  it("wraps v3 validation failures as parse_failed with issues", () => {
    const input = loadV3("minimal-empty.project.json") as Record<string, unknown>;
    try {
      parseMotionProjectAny({
        ...input,
        composition: { ...(input.composition as Record<string, unknown>), width: 0 },
      });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(MotionProjectParseError);
      const parseError = error as MotionProjectParseError;
      expect(parseError.code).toBe("parse_failed");
      expect(parseError.issues.length).toBeGreaterThan(0);
      expect(parseError.issues[0]!.path).toContain("width");
    }
  });

  it("v3 never falls through to the v2 parser", () => {
    const input = loadV3("minimal-empty.project.json");
    const result = parseMotionProjectAny(input);
    expect(result.version).toBe(3);
  });
});

describe("parseMotionProjectV3", () => {
  it("parses and validates representative fixture", () => {
    const project = parseMotionProjectV3(loadV3("representative.project.json"));
    expect(project.formatVersion).toBe(3);
  });

  it("accepts legacy text payload via shared normalizer", () => {
    const input = loadV3("minimal-empty.project.json") as Record<string, unknown>;
    const project = parseMotionProjectV3({
      ...input,
      scenes: [
        {
          id: "s1",
          duration: 2,
          nodes: [
            {
              id: "t1",
              type: "text",
              parentId: null,
              transform: {
                x: 0,
                y: 0,
                width: 100,
                height: 40,
                rotation: 0,
                scaleX: 1,
                scaleY: 1,
                anchorX: 0.5,
                anchorY: 0.5,
                opacity: 1,
                visible: true,
                flipX: false,
                flipY: false,
              },
              payload: { text: "Legacy text", fontSize: 24 },
            },
          ],
          clips: [],
        },
      ],
      timeline: {
        ...(input.timeline as Record<string, unknown>),
        visualTracks: [
          {
            id: "t-main",
            role: "main",
            order: 0,
            clips: [
              {
                id: "c1",
                source: { kind: "scene", sceneId: "s1" },
                start: 0,
                duration: 2,
              },
            ],
          },
        ],
      },
    });
    const node = project.scenes[0]!.nodes[0]!;
    expect(node.type).toBe("text");
    if (node.type === "text") {
      expect(node.payload.content).toEqual({ kind: "plain", text: "Legacy text" });
    }
  });

  it("throws MotionV3ReferenceError for bad binding targets", () => {
    const input = loadV3("minimal-empty.project.json") as Record<string, unknown>;
    expect(() =>
      parseMotionProjectV3({
        ...input,
        variables: [{ id: "v1", name: "V", type: "string", value: "x" }],
        bindings: [
          {
            id: "b1",
            source: { kind: "variable", variableId: "v1" },
            target: { kind: "scene", sceneId: "ghost", nodeId: "ghost", property: "transform.x" },
          },
        ],
      }),
    ).toThrow(MotionV3ReferenceError);
  });

  it("round-trips through serializeMotionProjectV3", () => {
    const project = parseMotionProjectV3(loadV3("representative.project.json"));
    const serialized = serializeMotionProjectV3(project);
    const reparsed = parseMotionProjectV3(JSON.parse(serialized));
    expect(reparsed).toEqual(project);
  });

  it("serializes canonically (sorted keys, deterministic)", () => {
    const project = parseMotionProjectV3(loadV3("representative.project.json"));
    const first = serializeMotionProjectV3(project);
    const second = serializeMotionProjectV3(project);
    expect(first).toBe(second);
    const parsed = JSON.parse(first) as Record<string, unknown>;
    expect(Object.keys(parsed)).toEqual(Object.keys(parsed).sort());
    expect(
      Object.keys((parsed.composition as Record<string, unknown>)).sort(),
    ).toEqual(Object.keys(parsed.composition as Record<string, unknown>));
  });

  it("parses output of parseMotionProjectV2-via-migration style documents", () => {
    // A v2 project parsed by v2 parser then serialized with v3 serializer
    // must still be re-parseable by the v3 parser (shape compatibility).
    const v2 = parseMotionProjectV2(loadV2("minimal-empty.project.json"));
    const migrated = {
      format: "motion-project",
      formatVersion: 3,
      metadata: { id: v2.metadata.id, name: v2.metadata.name, locale: "vi-VN" },
      composition: { width: 1920, height: 1080, fps: 30 },
      capabilities: {},
      dependencies: { compiler: { range: ">=1.0.0" }, components: [] },
      tokens: {},
      variables: [],
      assets: [],
      components: [],
      scenes: [],
      timeline: { visualTracks: [], audioTracks: [], captionTracks: [] },
      bindings: [],
    };
    expect(() => parseMotionProjectV3(migrated)).not.toThrow();
  });
});
