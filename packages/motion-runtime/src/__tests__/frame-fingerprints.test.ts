/**
 * Phase 3 — runtime frame fingerprints.
 *
 * Every v1 fixture is compiled to runtime IR and evaluated at three key
 * frames (first / middle / last). The structural fingerprint of each frame
 * is compared against a checked-in golden file, guaranteeing that v1 work
 * cannot silently change current runtime output.
 *
 * Goldens can be refreshed with `UPDATE_GOLDENS=1`.
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { compileMotionProjectV1 } from "@motionvideo/motion-compiler";
import { parseMotionProjectV1 } from "@motionvideo/motion-protocol";
import {
  evaluateCompositionFrameV1,
  timelineTotalDuration,
  type EvaluatedCompositionFrame,
} from "../index";

const projectFixtureDir = fileURLToPath(
  new URL("../../../motion-protocol/src/__fixtures__/v1", import.meta.url),
);
const goldenDir = fileURLToPath(
  new URL("../__fixtures__/runtime-frame-goldens", import.meta.url),
);

const UPDATE_GOLDENS = process.env.UPDATE_GOLDENS === "1";

const FIXTURE_NAMES = [
  "single-root",
  "multi-asset",
  "clips-and-tracks",
  "captions",
  "transition",
  "variables-bindings",
  "component-instance",
] as const;

function loadJson(name: string, suffix: string): unknown {
  const file = path.join(projectFixtureDir, `${name}.${suffix}`);
  return JSON.parse(readFileSync(file, "utf8")) as unknown;
}

/** Deterministic JSON serialization (sorted object keys). */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(
      ([key, nested]) => `${JSON.stringify(key)}:${stableStringify(nested)}`,
    );
  return `{${entries.join(",")}}`;
}

/** Structural fingerprint — only deterministic render-relevant fields. */
function frameFingerprint(frame: EvaluatedCompositionFrame | null): string {
  if (!frame) return "null";
  return stableStringify({
    contractVersion: frame.contractVersion,
    compositionFrame: frame.compositionFrame,
    compositionTime: frame.compositionTime,
    fps: frame.fps,
    viewport: frame.viewport,
    layers: frame.layers.map((layer) => ({
      layerKey: layer.layerKey,
      graphId: layer.graphId,
      layerId: layer.layerId,
      composition: layer.composition,
      interactionItems: layer.interaction.items.map((item) => ({
        key: item.key,
        layerId: item.layerId,
        nodeType: item.nodeType,
        worldMatrix: item.worldMatrix,
        worldOpacity: item.worldOpacity,
        visible: item.visible,
      })),
      paintCommands: layer.paint.commands,
    })),
    audio: frame.audio,
    media: frame.media,
    projection: frame.projection,
  });
}

/** Composition viewport derived from v2 aspect ratio. */
function viewportForAspectRatio(aspectRatio: string): {
  width: number;
  height: number;
} {
  switch (aspectRatio) {
    case "9:16":
      return { width: 1080, height: 1920 };
    case "1:1":
      return { width: 1080, height: 1080 };
    default:
      return { width: 1920, height: 1080 };
  }
}

function keyFrames(totalDuration: number, fps: number): number[] {
  const lastFrame = Math.max(0, Math.floor(totalDuration * fps) - 1);
  const middleFrame = Math.floor((totalDuration / 2) * fps);
  return [0, middleFrame, lastFrame];
}

function evaluateFixture(name: string): {
  fingerprints: string[];
  frameNumbers: number[];
} {
  const input = loadJson(name, "project.json");
  const project = parseMotionProjectV1(input);
  const result = compileMotionProjectV1(project);
  if (!result.ok) {
    throw new Error(
      `Compile failed for ${name}: ${result.diagnostics
        .map((diagnostic) => diagnostic.message)
        .join("; ")}`,
    );
  }
  const runtime = result.project;
  const fps = runtime.metadata.fps;
  const { width, height } = viewportForAspectRatio(
    runtime.metadata.aspectRatio,
  );
  const totalDuration = timelineTotalDuration(runtime);
  const frames = keyFrames(totalDuration, fps);
  return {
    frameNumbers: frames,
    fingerprints: frames.map((frame) =>
      frameFingerprint(
        evaluateCompositionFrameV1(runtime, frame, fps, width, height),
      ),
    ),
  };
}

function normalizeGolden(json: string): string {
  return `${json.replace(/\s+$/u, "")}\n`;
}

function readGolden(name: string): string | undefined {
  const file = path.join(goldenDir, `${name}.fingerprint.json`);
  if (!existsSync(file)) return undefined;
  return readFileSync(file, "utf8");
}

function writeGolden(name: string, json: string): void {
  mkdirSync(goldenDir, { recursive: true });
  writeFileSync(
    path.join(goldenDir, `${name}.fingerprint.json`),
    normalizeGolden(json),
    "utf8",
  );
}

describe("v2 runtime frame fingerprints", () => {
  for (const name of FIXTURE_NAMES) {
    it(`evaluates ${name}.project.json deterministically`, () => {
      const first = evaluateFixture(name);
      const second = evaluateFixture(name);
      expect(second.fingerprints).toEqual(first.fingerprints);
    });

    it(`matches golden fingerprints for ${name}.project.json`, () => {
      const { fingerprints, frameNumbers } = evaluateFixture(name);
      const golden = readGolden(name);
      const json = JSON.stringify({ frameNumbers, fingerprints }, null, 2);
      if (golden === undefined || UPDATE_GOLDENS) {
        writeGolden(name, json);
        return; // First run (or refresh) records the golden.
      }
      expect(normalizeGolden(json)).toBe(golden);
    });
  }
});
