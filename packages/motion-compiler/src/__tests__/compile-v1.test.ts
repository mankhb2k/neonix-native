/**
 * Compiler V1 — nested project.layers compile to a runtime layer graph.
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
  it("compiles a minimal empty project to an empty layer graph", () => {
    const result = compileMotionProjectV1(minimal);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const parsed = MotionRuntimeProjectSchema.parse(result.project);
    expect(parsed.layers).toEqual([]);
    expect(parsed.tracks).toEqual([]);
    expect(parsed.timeline.duration).toBe(0);
  });

  it("compiles representative layers into one runtime layer graph", () => {
    const result = compileMotionProjectV1(representative);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.project.layers.length).toBeGreaterThan(0);
    expect(result.project.timeline.duration).toBeGreaterThan(0);
    expect(
      result.project.layers.every((layer) => layer.type !== undefined),
    ).toBe(true);
  });

  it("maps root audio layers onto runtime audio layers", () => {
    const result = compileMotionProjectV1(audio);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const audioLayers = result.project.layers.filter(
      (layer) => layer.type === "audio",
    );
    expect(audioLayers.length).toBeGreaterThan(0);
    expect(audioLayers.every((layer) => layer.zIndex < 0)).toBe(true);
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
    expect(result.project.layers.some((layer) => layer.id === "badge" || layer.type === "group")).toBe(
      true,
    );
  });

  it("produces a stable compile cache key", () => {
    const a = buildCompileCacheKeyV1(representative);
    const b = buildCompileCacheKeyV1(representative);
    expect(a).toBe(b);
  });
});
