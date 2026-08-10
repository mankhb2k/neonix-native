/**
 * Phase 2 — v3 protocol schema tests.
 *
 * Covers positive fixture parsing, negative rejection, isolation from the
 * v2 parser, format discriminator routing, and namespaced extensions.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  MOTION_PROJECT_V3_FORMAT_VERSION,
  MotionProjectV3Schema,
} from "../index";
import { parseMotionProjectV2 } from "../../v2/parse";

const FIXTURES_DIR = join(__dirname, "..", "__fixtures__");

function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(join(FIXTURES_DIR, name), "utf8"));
}

describe("v3 schema — positive fixtures", () => {
  it("parses minimal-empty project", () => {
    const input = loadFixture("minimal-empty.project.json");
    const project = MotionProjectV3Schema.parse(input);
    expect(project.formatVersion).toBe(MOTION_PROJECT_V3_FORMAT_VERSION);
    expect(project.format).toBe("motion-project");
    expect(project.scenes).toEqual([]);
    expect(project.timeline.visualTracks).toEqual([]);
  });

  it("parses representative project with defaults applied", () => {
    const input = loadFixture("representative.project.json");
    const project = MotionProjectV3Schema.parse(input);
    expect(project.composition.background).toBe("#ffffff");
    expect(project.composition.audioSampleRate).toBe(48000);
    expect(project.composition.colorSpace).toBe("srgb");
    expect(project.timeline.visualTracks).toHaveLength(1);
    expect(project.timeline.visualTracks[0]!.clips).toHaveLength(2);
    expect(project.timeline.audioTracks).toHaveLength(1);
    expect(project.timeline.captionTracks).toHaveLength(1);
    expect(project.components).toHaveLength(1);
    expect(project.variables).toHaveLength(4);
    expect(project.bindings).toHaveLength(2);
  });

  it("keeps scene transition out of v3 scenes (timeline carries it)", () => {
    const input = loadFixture("representative.project.json");
    const project = MotionProjectV3Schema.parse(input);
    for (const scene of project.scenes) {
      expect(scene).not.toHaveProperty("transition");
    }
    const introClip = project.timeline.visualTracks[0]!.clips[0]!;
    expect(introClip.transitionOut?.type).toBe("fade");
  });

  it("validates activeCameraId references a camera node", () => {
    const input = loadFixture("representative.project.json");
    const project = MotionProjectV3Schema.parse(input);
    const intro = project.scenes.find((scene) => scene.id === "intro")!;
    const cam = intro.nodes.find((node) => node.id === "cam")!;
    expect(cam.type).toBe("camera");
  });
});

describe("v3 schema — negative fixtures", () => {
  it("rejects v2-style sceneOrder timeline (visualTracks required)", () => {
    const input = loadFixture("invalid-timeline.project.json");
    expect(() => MotionProjectV3Schema.parse(input)).toThrow();
  });

  it("rejects unknown root fields", () => {
    const input = loadFixture("minimal-empty.project.json") as Record<string, unknown>;
    expect(() =>
      MotionProjectV3Schema.parse({ ...input, unexpected: true }),
    ).toThrow();
  });

  it("rejects missing composition width", () => {
    const input = loadFixture("minimal-empty.project.json") as Record<string, unknown>;
    const { width: _width, ...withoutWidth } = input.composition as Record<string, unknown>;
    void _width;
    expect(() =>
      MotionProjectV3Schema.parse({
        ...input,
        composition: withoutWidth,
      }),
    ).toThrow();
  });

  it("rejects invalid enum value in visual track role", () => {
    const input = loadFixture("minimal-empty.project.json") as Record<string, unknown>;
    expect(() =>
      MotionProjectV3Schema.parse({
        ...input,
        timeline: {
          ...(input.timeline as Record<string, unknown>),
          visualTracks: [
            {
              id: "track-1",
              role: "bogus",
              order: 0,
              clips: [
                {
                  id: "clip-1",
                  source: { kind: "scene", sceneId: "s1" },
                  start: 0,
                  duration: 1,
                },
              ],
            },
          ],
        },
      }),
    ).toThrow();
  });

  it("rejects invalid capability id shape", () => {
    const input = loadFixture("minimal-empty.project.json") as Record<string, unknown>;
    expect(() =>
      MotionProjectV3Schema.parse({
        ...input,
        capabilities: { required: ["UPPER_CASE_INVALID"] },
      }),
    ).toThrow();
  });

  it("rejects negative composition dimensions", () => {
    const input = loadFixture("minimal-empty.project.json") as Record<string, unknown>;
    expect(() =>
      MotionProjectV3Schema.parse({
        ...input,
        composition: {
          ...(input.composition as Record<string, unknown>),
          width: 0,
        },
      }),
    ).toThrow();
  });
});

describe("v3 isolation from v2 parser", () => {
  it("formatVersion 3 never parses through parseMotionProjectV2", () => {
    const input = loadFixture("minimal-empty.project.json");
    expect(() => parseMotionProjectV2(input)).toThrow();
  });

  it("formatVersion 2 never parses through MotionProjectV3Schema", () => {
    const input = loadFixture("minimal-empty.project.json") as Record<string, unknown>;
    expect(() =>
      MotionProjectV3Schema.parse({ ...input, formatVersion: 2 }),
    ).toThrow();
  });

  it("discriminates on format + formatVersion", () => {
    const input = loadFixture("minimal-empty.project.json");
    const parsed = MotionProjectV3Schema.safeParse(input);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.formatVersion).toBe(3);
    }
  });
});

describe("v3 extensions — namespaced keys", () => {
  it("accepts valid namespaced extensions", () => {
    const input = loadFixture("minimal-empty.project.json") as Record<string, unknown>;
    const project = MotionProjectV3Schema.parse({
      ...input,
      extensions: { "com.moticlip.constraints": [{ maxDuration: 10 }] },
    });
    expect(project.extensions["com.moticlip.constraints"]).toEqual([
      { maxDuration: 10 },
    ]);
  });

  it("rejects non-namespaced extension keys", () => {
    const input = loadFixture("minimal-empty.project.json") as Record<string, unknown>;
    expect(() =>
      MotionProjectV3Schema.parse({
        ...input,
        extensions: { constraints: [] },
      }),
    ).toThrow();
  });
});
