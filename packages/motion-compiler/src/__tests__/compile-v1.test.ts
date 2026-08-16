/**
 * Compiler V1 — nested project.layers compile to a runtime layer graph.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  V1,
  visualLayerAtoms,
} from "@motionvideo/motion-protocol";
import {
  MotionRuntimeProjectSchema,
} from "@motionvideo/motion-protocol/runtime";
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
      ...visualLayerAtoms({ x: 100, y: 200, width: 256, height: 256, rotation: 0, scaleX: 1, scaleY: 1, originX: 0.5, originY: 0.5, opacity: 100, visible: true }),
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

  it("requires assetUrlResolver for managed assets", () => {
    const project = structuredClone(minimal);
    project.assets = [
      {
        id: "managed.logo",
        assetType: "image",
        mimeType: "image/png",
        width: 64,
        height: 64,
        integrity: "sha256:abc",
        sizeBytes: 100,
        storage: {
          managed: true,
          provider: "r2",
          key: "assets/managed.logo.png",
          retention: "temporary",
        },
      },
    ];
    const missing = compileMotionProjectV1(project);
    expect(missing.ok).toBe(false);
    if (missing.ok) return;
    expect(
      missing.diagnostics.some((d) => d.code === "CMP_ASSET_URI_UNRESOLVED"),
    ).toBe(true);

    const ok = compileMotionProjectV1(project, {
      assetUrlResolver: (id) =>
        id === "managed.logo" ? "https://signed.example/logo.png" : undefined,
    });
    expect(ok.ok).toBe(true);
    if (!ok.ok) return;
    expect(ok.project.assets[0]?.uri).toBe("https://signed.example/logo.png");
  });

  it("compiles timeline.clips into runtime tracks", () => {
    const project = structuredClone(representative);
    const layer = project.layers.find((item) => item.type === "text");
    expect(layer).toBeDefined();
    if (!layer) return;
    project.timeline.clips = [
      {
        id: "fade",
        layerId: layer.id,
        property: "appearance.opacity",
        kind: "keyframes",
        keys: [
          { t: 0, value: 0 },
          { t: 1, value: 100 },
        ],
        interpolation: "linear",
      },
    ];
    const result = compileMotionProjectV1(project);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(
      result.project.tracks.some(
        (track) =>
          track.layerId === layer.id && track.property === "appearance.opacity",
      ),
    ).toBe(true);
  });
});
