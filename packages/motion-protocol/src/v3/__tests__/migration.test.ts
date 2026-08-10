/**
 * Phase 3 — v2 → v3 migration tests.
 *
 * Golden tests compare `migrateMotionProjectV2ToV3(parseV2(in))` against
 * stored `.out.json` fixtures. Set `UPDATE_GOLDENS=1` to (re)generate the
 * outputs. Also covers determinism, diagnostics and round-trip validity.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseMotionProjectV2 } from "../../v2/parse";
import { MotionProjectV3Schema } from "../index";
import { migrateMotionProjectV2ToV3 } from "../migrations/v2-to-v3";
import type { MigrationDiagnosticCode } from "../migrations/diagnostics";

const MIGRATION_DIR = join(__dirname, "..", "__fixtures__", "migration");
const UPDATE_GOLDENS = process.env.UPDATE_GOLDENS === "1";

function loadJson(name: string): unknown {
  return JSON.parse(readFileSync(join(MIGRATION_DIR, name), "utf8"));
}

function writeGolden(name: string, value: unknown): void {
  const file = join(MIGRATION_DIR, name);
  if (!existsSync(dirname(file))) mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

const GOLDEN_CASES: Array<{ name: string; options?: Parameters<typeof migrateMotionProjectV2ToV3>[1] }> = [
  { name: "v2-minimal" },
  { name: "scene-order" },
  { name: "transition" },
  { name: "brand" },
  { name: "audio" },
];

describe("v2 → v3 migration goldens", () => {
  for (const { name, options } of GOLDEN_CASES) {
    it(`migrates ${name} deterministically`, () => {
      const input = parseMotionProjectV2(loadJson(`${name}.in.json`));
      const { project } = migrateMotionProjectV2ToV3(input, options);
      if (UPDATE_GOLDENS) {
        writeGolden(`${name}.out.json`, project);
        return;
      }
      const golden = loadJson(`${name}.out.json`);
      expect(project).toEqual(golden);
    });
  }
});

describe("migration determinism", () => {
  it("same input produces byte-identical output twice", () => {
    const input = parseMotionProjectV2(loadJson("scene-order.in.json"));
    const first = migrateMotionProjectV2ToV3(input);
    const second = migrateMotionProjectV2ToV3(input);
    expect(second.project).toEqual(first.project);
    expect(second.diagnostics).toEqual(first.diagnostics);
  });
});

describe("migration round-trip validity", () => {
  it("every migrated project parses via MotionProjectV3Schema", () => {
    for (const { name, options } of GOLDEN_CASES) {
      const input = parseMotionProjectV2(loadJson(`${name}.in.json`));
      const { project } = migrateMotionProjectV2ToV3(input, options);
      expect(MotionProjectV3Schema.safeParse(project).success).toBe(true);
    }
  });

  it("migrated sceneOrder becomes a main visual track with sequential starts", () => {
    const input = parseMotionProjectV2(loadJson("scene-order.in.json"));
    const { project } = migrateMotionProjectV2ToV3(input);
    const track = project.timeline.visualTracks[0]!;
    expect(track.role).toBe("main");
    expect(track.order).toBe(0);
    expect(track.clips.map((clip) => clip.source)).toEqual([
      { kind: "scene", sceneId: "intro" },
      { kind: "scene", sceneId: "outro" },
    ]);
    expect(track.clips.map((clip) => clip.start)).toEqual([0, 3]);
    expect(track.clips.map((clip) => clip.duration)).toEqual([3, 2]);
  });
});

describe("migration diagnostics", () => {
  function codesFor(diagnostics: Array<{ code: MigrationDiagnosticCode }>): string[] {
    return diagnostics.map((d) => d.code).sort();
  }

  it("MIG_SCENE_ORDER_EMPTY when sceneOrder is empty", () => {
    const input = parseMotionProjectV2(loadJson("v2-minimal.in.json"));
    const { diagnostics } = migrateMotionProjectV2ToV3(input);
    expect(codesFor(diagnostics)).toContain("MIG_SCENE_ORDER_EMPTY");
  });

  it("MIG_ASPECT_PRESET_AMBIGUOUS when defaultComposition overrides dimensions", () => {
    const input = parseMotionProjectV2(loadJson("v2-minimal.in.json"));
    const { diagnostics } = migrateMotionProjectV2ToV3(input, {
      defaultComposition: { width: 720, height: 1280 },
    });
    expect(codesFor(diagnostics)).toContain("MIG_ASPECT_PRESET_AMBIGUOUS");
  });

  it("MIG_MISSING_AUDIO_DURATION when duration cannot be resolved", () => {
    const input = parseMotionProjectV2(loadJson("audio.in.json"));
    const modified = {
      ...input,
      timeline: {
        ...input.timeline,
        audioTracks: [
          { ...input.timeline.audioTracks[0]!, assetId: "no-such-asset" },
        ],
      },
    };
    const { diagnostics, project } = migrateMotionProjectV2ToV3(modified, {
      assetMetadataResolver: () => undefined,
    });
    expect(codesFor(diagnostics)).toContain("MIG_MISSING_AUDIO_DURATION");
    expect(project.timeline.audioTracks[0]!.duration).toBe(1);
  });

  it("MIG_TRANSITION_OVERFLOW when transition exceeds scene duration", () => {
    const input = parseMotionProjectV2(loadJson("transition.in.json")) as ReturnType<
      typeof parseMotionProjectV2
    >;
    const scene = input.scenes.find((s) => s.id === "a")!;
    scene.transition = {
      type: "fade",
      duration: 10,
      color: "#000000",
      easing: "easeInOut",
    };
    const { diagnostics } = migrateMotionProjectV2ToV3(input);
    expect(codesFor(diagnostics)).toContain("MIG_TRANSITION_OVERFLOW");
  });

  it("MIG_UNSUPPORTED_COMPONENT for component nodes and component-action clips", () => {
    const input = parseMotionProjectV2(loadJson("v2-minimal.in.json"));
    const modified = {
      ...input,
      dependencies: {
        components: [
          {
            componentId: "logo-reveal",
            version: "1.0.0",
            source: "logo-reveal",
            integrity: "sha256:logo-reveal-1.0.0",
          },
        ],
      },
      scenes: [
        {
          id: "s1",
          duration: 2,
          nodes: [
            {
              id: "inst",
              type: "component",
              parentId: null,
              transform: {
                x: 0,
                y: 0,
                width: 10,
                height: 10,
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
                componentVersion: "1.0.0",
                props: {},
              },
            },
          ],
          clips: [],
        },
      ],
      timeline: { sceneOrder: ["s1"], audioTracks: [], captionTracks: [] },
    } as unknown as Parameters<typeof migrateMotionProjectV2ToV3>[0];
    const { diagnostics, project } = migrateMotionProjectV2ToV3(modified);
    expect(codesFor(diagnostics)).toContain("MIG_UNSUPPORTED_COMPONENT");
    expect(project.scenes[0]!.nodes).toHaveLength(0);
  });

  it("MIG_BRAND_FONT_UNRESOLVED when brand font has no font asset", () => {
    const input = parseMotionProjectV2(loadJson("brand.in.json"));
    const modified = {
      ...input,
      metadata: {
        ...input.metadata,
        brand: { ...input.metadata.brand, fontFamily: "Missing-Font" },
      },
    };
    const { diagnostics } = migrateMotionProjectV2ToV3(modified);
    expect(codesFor(diagnostics)).toContain("MIG_BRAND_FONT_UNRESOLVED");
  });
});
