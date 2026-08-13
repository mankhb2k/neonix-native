/**
 * V1 schema — nested project.layers, no scenes/tracks.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  MOTION_PROJECT_V1_FORMAT_VERSION,
  MotionProjectV1Schema,
} from "../index";
import { parseMotionProjectV1 } from "../parse";

const FIXTURES_DIR = join(__dirname, "..", "__fixtures__");

function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(join(FIXTURES_DIR, name), "utf8"));
}

function baseProject(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    format: "motion-project",
    formatVersion: 1,
    metadata: { id: "test", name: "Test", locale: "vi-VN" },
    composition: { width: 1080, height: 1920, fps: 30 },
    capabilities: {},
    dependencies: { compiler: { range: ">=1.0.0" }, components: [] },
    tokens: {},
    variables: [],
    assets: [],
    components: [],
    layers: [],
    timeline: { duration: 8 },
    bindings: [],
    ...overrides,
  };
}

const TRANSFORM = {
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
  anchorX: 0.5,
  anchorY: 0.5,
  opacity: 1,
  visible: true,
  flipX: false,
  flipY: false,
};

describe("v1 schema — positive fixtures", () => {
  it("parses minimal-empty project", () => {
    const project = MotionProjectV1Schema.parse(loadFixture("minimal-empty.project.json"));
    expect(project.formatVersion).toBe(MOTION_PROJECT_V1_FORMAT_VERSION);
    expect(project.layers).toEqual([]);
    expect(project.timeline.duration).toBeUndefined();
  });

  it("parses representative project as nested layers", () => {
    const project = parseMotionProjectV1(loadFixture("representative.project.json"));
    expect(project.layers.length).toBeGreaterThan(0);
    expect(project.layers.every((layer) => layer.parentLayerId === null)).toBe(
      true,
    );
    const types = new Set(project.layers.map((layer) => layer.type));
    expect(types.has("audio") || types.has("group") || types.has("text")).toBe(
      true,
    );
  });

  it("parses audio as root layers with negative zIndex", () => {
    const project = parseMotionProjectV1(loadFixture("audio.project.json"));
    const audio = project.layers.filter((layer) => layer.type === "audio");
    expect(audio.length).toBeGreaterThan(0);
    for (const layer of audio) {
      expect(layer.parentLayerId).toBeNull();
      expect(layer.zIndex).toBeLessThan(0);
    }
  });

  it("parses caption fixture as group + text children", () => {
    const project = parseMotionProjectV1(loadFixture("caption.project.json"));
    const groups = project.layers.filter((layer) => layer.type === "group");
    expect(groups.length).toBeGreaterThan(0);
  });
});

describe("v1 schema — reject old contract", () => {
  it("rejects scenes", () => {
    const result = MotionProjectV1Schema.safeParse(
      baseProject({ scenes: [] }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects timeline.visualTracks", () => {
    const result = MotionProjectV1Schema.safeParse(
      baseProject({ timeline: { duration: 8, visualTracks: [] } }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects timeline.audioTracks", () => {
    const result = MotionProjectV1Schema.safeParse(
      baseProject({ timeline: { duration: 8, audioTracks: [] } }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects timeline.captionTracks", () => {
    const result = MotionProjectV1Schema.safeParse(
      baseProject({ timeline: { duration: 8, captionTracks: [] } }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects layer kind discriminator", () => {
    const result = MotionProjectV1Schema.safeParse(
      baseProject({
        layers: [
          {
            id: "bad",
            kind: "group",
            type: "group",
            parentLayerId: null,
            zIndex: 0,
            timing: { start: 0, duration: 1 },
            transform: TRANSFORM,
          },
        ],
      }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects duplicate root zIndex", () => {
    const result = MotionProjectV1Schema.safeParse(
      baseProject({
        layers: [
          {
            id: "a",
            type: "group",
            parentLayerId: null,
            zIndex: 0,
            timing: { start: 0, duration: 1 },
            transform: TRANSFORM,
          },
          {
            id: "b",
            type: "group",
            parentLayerId: null,
            zIndex: 0,
            timing: { start: 0, duration: 1 },
            transform: TRANSFORM,
          },
        ],
      }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects audio layer zIndex >= 0", () => {
    const result = MotionProjectV1Schema.safeParse(
      baseProject({
        layers: [
          {
            id: "music",
            type: "audio",
            parentLayerId: null,
            zIndex: 0,
            timing: { start: 0, duration: 8 },
            payload: { assetId: "music-1" },
          },
        ],
      }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects visual root zIndex < 0", () => {
    const result = MotionProjectV1Schema.safeParse(
      baseProject({
        layers: [
          {
            id: "main",
            type: "group",
            parentLayerId: null,
            zIndex: -1,
            timing: { start: 0, duration: 1 },
            transform: TRANSFORM,
          },
        ],
      }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects root layer missing timing", () => {
    const result = MotionProjectV1Schema.safeParse(
      baseProject({
        layers: [
          {
            id: "main",
            type: "group",
            parentLayerId: null,
            zIndex: 0,
            transform: TRANSFORM,
          },
        ],
      }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects nested audio", () => {
    const result = MotionProjectV1Schema.safeParse(
      baseProject({
        layers: [
          {
            id: "main",
            type: "group",
            parentLayerId: null,
            zIndex: 0,
            timing: { start: 0, duration: 8 },
            transform: TRANSFORM,
            children: [
              {
                id: "music",
                type: "audio",
                parentLayerId: "main",
                zIndex: -1,
                timing: { start: 0, duration: 8 },
                payload: { assetId: "music-1" },
              },
            ],
          },
        ],
      }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects a child listed at root", () => {
    const result = MotionProjectV1Schema.safeParse(
      baseProject({
        layers: [
          {
            id: "main",
            type: "group",
            parentLayerId: null,
            zIndex: 0,
            timing: { start: 0, duration: 1 },
            transform: TRANSFORM,
          },
          {
            id: "title",
            type: "text",
            parentLayerId: "main",
            zIndex: 1,
            timing: { start: 0, duration: 1 },
            transform: TRANSFORM,
            payload: { text: "Hi", fontSize: 24 },
          },
        ],
      }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects wrong parentLayerId on nested child", () => {
    const result = MotionProjectV1Schema.safeParse(
      baseProject({
        layers: [
          {
            id: "main",
            type: "group",
            parentLayerId: null,
            zIndex: 0,
            timing: { start: 0, duration: 1 },
            transform: TRANSFORM,
            children: [
              {
                id: "title",
                type: "text",
                parentLayerId: "other",
                zIndex: 0,
                timing: { start: 0, duration: 1 },
                transform: TRANSFORM,
                payload: { text: "Hi", fontSize: 24 },
              },
            ],
          },
        ],
      }),
    );
    expect(result.success).toBe(false);
  });
});
