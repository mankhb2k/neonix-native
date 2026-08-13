/**
 * Compiler V1 — nested project.layers compile to a synthetic runtime scene.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { MotionRuntimeProjectSchema, V1 } from "@motionvideo/motion-protocol";
import {
  buildCompileCacheKeyV1,
  compileMotionProjectV1,
} from "../index";

const fixtureDir = fileURLToPath(
  new URL("../../../motion-protocol/src/v1/__fixtures__", import.meta.url),
);

function loadV1Fixture(name: string): V1.MotionProjectV1 {
  const raw = readFileSync(`${fixtureDir}/${name}`, "utf8");
  return V1.MotionProjectV1Schema.parse(JSON.parse(raw));
}

const minimal = loadV1Fixture("minimal-empty.project.json");
const representative = loadV1Fixture("representative.project.json");
const audio = loadV1Fixture("audio.project.json");

describe("compileMotionProjectV1", () => {
  it("compiles a minimal empty project to a synthetic root scene", () => {
    const result = compileMotionProjectV1(minimal);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const parsed = MotionRuntimeProjectSchema.parse(result.project);
    expect(parsed.scenes).toEqual([]);
    expect(parsed.timeline.visualTracks).toHaveLength(1);
    expect(parsed.timeline.visualTracks[0]!.clips).toEqual([]);
    expect(parsed.timeline.captionTracks).toEqual([]);
  });

  it("compiles representative layers into one runtime scene", () => {
    const result = compileMotionProjectV1(representative);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.project.scenes.map((scene) => scene.id)).toEqual(["root"]);
    expect(result.project.timeline.visualTracks).toHaveLength(1);
    expect(result.project.timeline.visualTracks[0]!.clips[0]!.source).toEqual({
      kind: "scene",
      sceneId: "root",
    });
    expect(result.project.scenes[0]!.layers.length).toBeGreaterThan(0);
  });

  it("maps root audio layers onto runtime audioTracks", () => {
    const result = compileMotionProjectV1(audio);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.project.timeline.audioTracks.length).toBeGreaterThan(0);
    expect(
      result.project.timeline.audioTracks.every((track) => track.order < 0),
    ).toBe(true);
    expect(result.project.timeline.captionTracks).toEqual([]);
  });

  it("places a component instance as a leaf on the project tree", () => {
    const project = structuredClone(representative);
    const maxZ = Math.max(
      ...project.layers
        .filter((layer) => layer.zIndex !== undefined && layer.zIndex >= 0)
        .map((layer) => layer.zIndex!),
      -1,
    );
    project.layers.push({
      id: "badge",
      type: "component",
      parentLayerId: null,
      zIndex: maxZ + 1,
      timing: { start: 0, duration: 4 },
      visible: true,
      locked: false,
      transform: {
        x: 100,
        y: 200,
        width: 256,
        height: 256,
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
      payload: {
        componentId: "logo-reveal",
        props: {},
      },
    });
    const result = compileMotionProjectV1(project);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.project.scenes).toHaveLength(1);
    expect(
      result.project.scenes[0]!.layers.some(
        (layer) => layer.id === "badge" || layer.type === "group",
      ),
    ).toBe(true);
  });

  it("produces a stable compile cache key", () => {
    const a = buildCompileCacheKeyV1(representative);
    const b = buildCompileCacheKeyV1(representative);
    expect(a).toBe(b);
  });
});
