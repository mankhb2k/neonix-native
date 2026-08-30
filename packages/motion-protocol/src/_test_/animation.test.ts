import { describe, expect, it } from "vitest";
import { MotionProtocolV2Schema } from "../v2/project";
import { V2TrackListSchema, V2TrackSchema } from "../v2/animation";

const baseShape = {
  type: "shape" as const,
  id: "card",
  parentLayerId: null,
  order: 0,
  frame: { width: 320, height: 180 },
  transform: {
    translate: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    rotate: { x: 0, y: 0, z: 0 },
    skew: { x: 0, y: 0 },
    anchor: { x: 0, y: 0, z: 0 },
  },
  opacity: 1,
  timing: { start: 0, duration: 2000 },
  style: { fill: "#101820" },
  payload: { shape: "rectangle" as const },
};

const baseProject = (layer: unknown) => ({
  format: "motion-protocol" as const,
  formatVersion: 2 as const,
  id: "animated-v2",
  composition: {
    width: 320,
    height: 180,
    fps: 30,
    background: "#000000",
    colorSpace: "srgb" as const,
    view: {
      projection: { kind: "orthographic" as const, zoom: 1, near: 1, far: 4000 },
      transform: {
        translate: { x: 0, y: 0, z: 0 },
        rotate: { x: 0, y: 0, z: 0 },
      },
    },
  },
  assets: [],
  layers: [layer],
  audio: { sampleRate: 48000, tracks: [] },
});

describe("Protocol V2 keyframe tracks", () => {
  it("accepts typed, strictly ordered keyframes", () => {
    const track = V2TrackSchema.parse({
      id: "move-x",
      path: "transform.translate.x",
      keyframes: [
        { time: 0, value: { type: "number", value: -120 } },
        { time: 600, value: { type: "number", value: 0 }, easing: { type: "linear" } },
      ],
    });
    expect(track.keyframes).toHaveLength(2);
    expect(() => V2TrackSchema.parse({
      ...track,
      keyframes: [track.keyframes[1], track.keyframes[0]],
    })).toThrow(/strictly increasing/);
  });

  it("rejects duplicate track ids and property paths per layer", () => {
    const track = {
      id: "opacity",
      path: "opacity",
      keyframes: [{ time: 0, value: { type: "number", value: 1 } }],
    };
    expect(() => V2TrackListSchema.parse([track, { ...track }])).toThrow(/Duplicate layer track id/);
    expect(() => V2TrackListSchema.parse([track, { ...track, id: "opacity-2" }])).toThrow(/Duplicate animated property path/);
  });

  it("accepts layer-local animation tracks and stable effect-id paths", () => {
    const layer = {
      ...baseShape,
      effects: [{ id: "soften", type: "blur" as const, radius: 20 }],
      tracks: [
        {
          id: "fade",
          path: "opacity",
          keyframes: [
            { time: 0, value: { type: "number" as const, value: 0 } },
            { time: 1000, value: { type: "number" as const, value: 1 } },
          ],
        },
        {
          id: "blur-radius",
          path: "effects.soften.radius",
          keyframes: [{ time: 0, value: { type: "number" as const, value: 20 } }],
        },
      ],
    };
    expect(MotionProtocolV2Schema.parse(baseProject(layer)).layers[0]).toMatchObject({
      tracks: layer.tracks,
    });
  });

  it("rejects unknown paths, mismatched value types, and out-of-range local times", () => {
    const invalid = (track: unknown) =>
      MotionProtocolV2Schema.parse(baseProject({ ...baseShape, tracks: [track] }));
    expect(() => invalid({
      id: "unknown",
      path: "style.notAProperty",
      keyframes: [{ time: 0, value: { type: "number", value: 1 } }],
    })).toThrow(/animatable property/);
    expect(() => invalid({
      id: "wrong-kind",
      path: "opacity",
      keyframes: [{ time: 0, value: { type: "color", value: [1, 1, 1, 1] } }],
    })).toThrow(/value type does not match/);
    expect(() => invalid({
      id: "late",
      path: "opacity",
      keyframes: [{ time: 2100, value: { type: "number", value: 1 } }],
    })).toThrow(/cannot exceed layer duration/);
  });
});
