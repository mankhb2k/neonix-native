/**
 * V3 Normalizer tests — migration layer for legacy data.
 */
import { describe, expect, it } from "vitest";
import { normalizeMotionProjectV3, needsNormalization } from "../normalize";

// ── needsNormalization ─────────────────────────────────────────────────

describe("needsNormalization", () => {
  it("returns false for a clean project", () => {
    expect(needsNormalization({})).toBe(false);
    expect(needsNormalization({ components: [] })).toBe(false);
    expect(needsNormalization({ bindings: [] })).toBe(false);
  });

  it("returns true when a component has record-style variants", () => {
    expect(
      needsNormalization({
        components: [
          {
            id: "test",
            variants: { primary: { color: "red" } },
          },
        ],
      }),
    ).toBe(true);
  });

  it("returns false when all variants are arrays", () => {
    expect(
      needsNormalization({
        components: [
          {
            id: "test",
            variants: [{ id: "primary", name: "Primary", params: {} }],
          },
        ],
      }),
    ).toBe(false);
  });

  it("returns true when a binding uses legacy nodeId/property", () => {
    expect(
      needsNormalization({
        bindings: [
          {
            id: "b1",
            target: {
              kind: "component",
              componentId: "c1",
              nodeId: "n1",
              property: "p",
            },
          },
        ],
      }),
    ).toBe(true);
  });

  it("returns false when all component bindings use targetId", () => {
    expect(
      needsNormalization({
        bindings: [
          {
            id: "b1",
            target: { kind: "component", componentId: "c1", targetId: "t1" },
          },
        ],
      }),
    ).toBe(false);
  });

  it("returns false when a visual clip uses a plain component source", () => {
    expect(
      needsNormalization({
        timeline: {
          visualTracks: [
            {
              id: "t1",
              clips: [
                {
                  id: "c1",
                  source: { kind: "component", componentId: "logo-reveal" },
                },
              ],
            },
          ],
        },
      }),
    ).toBe(false);
  });

  it("returns false when visual clips are scene-only", () => {
    expect(
      needsNormalization({
        timeline: {
          visualTracks: [
            {
              id: "t1",
              clips: [{ id: "c1", source: { kind: "scene", sceneId: "s1" } }],
            },
          ],
        },
      }),
    ).toBe(false);
  });
});

// ── Variant normalization ──────────────────────────────────────────────

describe("normalizeMotionProjectV3 — variants", () => {
  it("converts record-style variants to array", () => {
    const { project, issues } = normalizeMotionProjectV3({
      components: [
        {
          id: "button",
          variants: {
            primary: { color: "#ff6b35", size: "lg" },
            outline: { color: "#ff6b35", border: true },
          },
        },
      ],
    });

    const comp = project.components![0]!;
    const variants = comp.variants;
    expect(Array.isArray(variants)).toBe(true);
    if (!Array.isArray(variants)) throw new Error("Expected variants array");
    expect(variants).toHaveLength(2);
    expect(variants[0]).toMatchObject({
      id: "primary",
      name: "primary",
      params: { color: "#ff6b35", size: "lg" },
    });
    expect(variants[1]).toMatchObject({
      id: "outline",
      name: "outline",
      params: { color: "#ff6b35", border: true },
    });
    expect(issues.some((i) => i.message.includes("Migrated"))).toBe(true);
  });

  it("keeps array variants unchanged", () => {
    const { project, issues } = normalizeMotionProjectV3({
      components: [
        {
          id: "button",
          variants: [
            { id: "primary", name: "Primary", params: { color: "red" } },
          ],
        },
      ],
    });

    expect(Array.isArray(project.components![0]!.variants)).toBe(true);
    expect(project.components![0]!.variants).toHaveLength(1);
    expect(issues).toHaveLength(0);
  });

  it("handles empty variants record", () => {
    const { project } = normalizeMotionProjectV3({
      components: [{ id: "button", variants: {} }],
    });

    expect(project.components![0]!.variants).toEqual([]);
  });
});

// ── Binding normalization ──────────────────────────────────────────────

describe("normalizeMotionProjectV3 — bindings", () => {
  it("converts legacy nodeId/property binding to targetId (matched publicTarget)", () => {
    const { project, issues } = normalizeMotionProjectV3({
      components: [
        {
          id: "button",
          publicTargets: [
            {
              id: "label",
              nodeId: "text-node",
              property: "payload.content.text",
            },
          ],
        },
      ],
      bindings: [
        {
          id: "b1",
          source: { kind: "variable", variableId: "v1" },
          target: {
            kind: "component",
            componentId: "button",
            nodeId: "text-node",
            property: "payload.content.text",
          },
        },
      ],
    });

    const binding = project.bindings![0]!;
    expect(binding.target).not.toHaveProperty("nodeId");
    expect(binding.target).not.toHaveProperty("property");
    expect((binding.target as Record<string, unknown>).targetId).toBe("label");
    expect(issues.some((i) => i.message.includes("Migrated binding"))).toBe(
      true,
    );
  });

  it("does not auto-generate publicTarget when no match found by default", () => {
    const { project, issues } = normalizeMotionProjectV3({
      components: [
        {
          id: "button",
          publicTargets: [],
        },
      ],
      bindings: [
        {
          id: "b1",
          source: { kind: "variable", variableId: "v1" },
          target: {
            kind: "component",
            componentId: "button",
            nodeId: "bg-node",
            property: "payload.color",
          },
        },
      ],
    });

    const comp = project.components![0]!;
    expect(comp.publicTargets).toHaveLength(0);

    const binding = project.bindings![0]!;
    expect(binding.target).toHaveProperty("nodeId");
    expect(binding.target).toHaveProperty("property");
    expect(issues.some((i) => i.severity === "warn")).toBe(true);
  });

  it("auto-generates publicTarget when compatibility option is enabled", () => {
    const { project, issues } = normalizeMotionProjectV3(
      {
        components: [
          {
            id: "button",
            publicTargets: [],
          },
        ],
        bindings: [
          {
            id: "b1",
            source: { kind: "variable", variableId: "v1" },
            target: {
              kind: "component",
              componentId: "button",
              nodeId: "bg-node",
              property: "payload.color",
            },
          },
        ],
      },
      { allowAutoPublicTargets: true },
    );

    const comp = project.components![0]!;
    expect(comp.publicTargets).toHaveLength(1);
    expect(comp.publicTargets![0]!.id).toBe("auto-bg-node-payload-color");
    expect(comp.publicTargets![0]!.nodeId).toBe("bg-node");
    expect(comp.publicTargets![0]!.property).toBe("payload.color");

    const binding = project.bindings![0]!;
    expect((binding.target as Record<string, unknown>).targetId).toBe(
      "auto-bg-node-payload-color",
    );
    expect(issues.some((i) => i.severity === "warn")).toBe(true);
  });

  it("keeps targetId bindings unchanged", () => {
    const { project, issues } = normalizeMotionProjectV3({
      components: [
        {
          id: "button",
          publicTargets: [{ id: "label", nodeId: "n1", property: "p" }],
        },
      ],
      bindings: [
        {
          id: "b1",
          source: { kind: "variable", variableId: "v1" },
          target: {
            kind: "component",
            componentId: "button",
            targetId: "label",
          },
        },
      ],
    });

    const binding = project.bindings![0]!;
    expect((binding.target as Record<string, unknown>).targetId).toBe("label");
    expect(issues).toHaveLength(0);
  });

  it("warns when migrating binding for unknown component", () => {
    const { issues } = normalizeMotionProjectV3({
      components: [],
      bindings: [
        {
          id: "b1",
          source: { kind: "variable", variableId: "v1" },
          target: {
            kind: "component",
            componentId: "missing",
            nodeId: "n1",
            property: "p",
          },
        },
      ],
    });

    expect(
      issues.some(
        (i) => i.severity === "warn" && i.message.includes("not found"),
      ),
    ).toBe(true);
  });

  it("ignores scene bindings", () => {
    const { project, issues } = normalizeMotionProjectV3({
      bindings: [
        {
          id: "b1",
          source: { kind: "variable", variableId: "v1" },
          target: { kind: "scene", sceneId: "s1", nodeId: "n1", property: "p" },
        },
      ],
    });

    const binding = project.bindings![0]!;
    expect(binding.target).toHaveProperty("nodeId");
    expect(issues).toHaveLength(0);
  });

  it("does not mutate the input", () => {
    const input = {
      components: [
        {
          id: "button",
          variants: { primary: { color: "red" } },
        },
      ],
    };
    const original = JSON.stringify(input);
    normalizeMotionProjectV3(input);
    expect(JSON.stringify(input)).toBe(original);
  });
});

// ── Component clip migration ──────────────────────────────────────────

describe("normalizeMotionProjectV3 — component clips", () => {
  type LegacyClip = {
    id: string;
    source: { kind: string; componentId: string };
    start: number;
    duration: number;
    opacity: number;
    loop: boolean;
    instanceTransform?: Record<string, unknown>;
    instanceTransformTracks?: Array<Record<string, unknown>>;
  };

  const legacyClipProject = (): {
    timeline: {
      visualTracks: Array<{
        id: string;
        order: number;
        muted: boolean;
        clips: LegacyClip[];
      }>;
      audioTracks: unknown[];
      captionTracks: unknown[];
    };
    scenes?: Array<{
      id: string;
      nodes: Array<Record<string, unknown>>;
      clips: Array<Record<string, unknown>>;
    }>;
  } => ({
    timeline: {
      visualTracks: [
        {
          id: "main-track",
          order: 0,
          muted: false,
          clips: [
            {
              id: "clip-logo",
              source: { kind: "component", componentId: "logo-reveal" },
              start: 0,
              duration: 4,
              opacity: 1,
              loop: false,
              instanceTransform: { x: 100, y: 200, width: 256, height: 256 },
              instanceTransformTracks: [
                {
                  property: "transform.x",
                  valueKind: "number",
                  keys: [
                    { t: 0, value: 0 },
                    { t: 2, value: 300 },
                  ],
                },
              ],
            },
          ],
        },
      ],
      audioTracks: [],
      captionTracks: [],
    },
  });

  it("leaves component clips untouched by default", () => {
    const input = legacyClipProject();
    const { project, issues } = normalizeMotionProjectV3(input);

    expect(project.scenes).toBeUndefined();
    const clip = project.timeline!.visualTracks![0]!.clips![0]!;
    expect(clip.source).toEqual({
      kind: "component",
      componentId: "logo-reveal",
    });
    expect(issues).toHaveLength(0);
  });

  it("migrates component clips to scenes when opted in", () => {
    const { project, issues } = normalizeMotionProjectV3(legacyClipProject(), {
      migrateComponentClipsToScenes: true,
    });

    // Scene synthesized with a component node.
    expect(project.scenes).toHaveLength(1);
    const scene = project.scenes![0]!;
    expect(scene.id).toBe("component-scene__main-track__clip-logo");
    expect(scene.duration).toBe(4);
    expect(scene.nodes).toHaveLength(1);
    expect(scene.nodes![0]).toMatchObject({
      id: "component-instance__clip-logo",
      type: "component",
      payload: { componentId: "logo-reveal" },
    });
    expect(scene.nodes![0]!.transform).toMatchObject({
      x: 100,
      y: 200,
      width: 256,
      height: 256,
    });

    // instanceTransformTracks → scene-local motion clips.
    expect(scene.clips).toHaveLength(1);
    expect(scene.clips![0]).toMatchObject({
      id: "component-instance__clip-logo__motion",
      targetId: "component-instance__clip-logo",
      source: {
        kind: "tracks",
        tracks: [
          {
            targetId: "component-instance__clip-logo",
            property: "transform.x",
            valueKind: "number",
          },
        ],
      },
    });

    // Visual clip rewritten to scene source.
    const clip = project.timeline!.visualTracks![0]!.clips![0]!;
    expect(clip.source).toEqual({
      kind: "scene",
      sceneId: "component-scene__main-track__clip-logo",
    });
    expect(clip).not.toHaveProperty("instanceTransform");
    expect(clip).not.toHaveProperty("instanceTransformTracks");

    expect(issues.some((i) => i.message.includes("Migrated component"))).toBe(
      true,
    );
  });

  it("produces deterministic scene ids for two components", () => {
    const input = legacyClipProject();
    input.timeline.visualTracks[0]!.clips!.push({
      id: "clip-lower-third",
      source: { kind: "component", componentId: "lower-third" },
      start: 4,
      duration: 2,
      opacity: 1,
      loop: false,
    });

    const { project } = normalizeMotionProjectV3(input, {
      migrateComponentClipsToScenes: true,
    });

    expect(project.scenes!.map((s) => s.id)).toEqual([
      "component-scene__main-track__clip-logo",
      "component-scene__main-track__clip-lower-third",
    ]);
  });

  it("migrates two clips using the same component into distinct scenes", () => {
    const input = legacyClipProject();
    input.timeline.visualTracks[0]!.clips!.push({
      id: "clip-logo-again",
      source: { kind: "component", componentId: "logo-reveal" },
      start: 4,
      duration: 2,
      opacity: 1,
      loop: false,
    });

    const { project } = normalizeMotionProjectV3(input, {
      migrateComponentClipsToScenes: true,
    });

    const sceneIds = project.scenes!.map((s) => s.id);
    expect(sceneIds).toEqual([
      "component-scene__main-track__clip-logo",
      "component-scene__main-track__clip-logo-again",
    ]);
    const nodeIds = project.scenes!.map((s) => s.nodes![0]!.id);
    expect(nodeIds).toEqual([
      "component-instance__clip-logo",
      "component-instance__clip-logo-again",
    ]);
  });

  it("appends a deterministic suffix on pre-existing scene id collision", () => {
    const input = legacyClipProject();
    // Pre-existing scene uses the same id the migration would synthesize.
    input.scenes = [
      { id: "component-scene__main-track__clip-logo", nodes: [], clips: [] },
    ];

    const { project } = normalizeMotionProjectV3(input, {
      migrateComponentClipsToScenes: true,
    });

    expect(project.scenes!.map((s) => s.id)).toEqual([
      "component-scene__main-track__clip-logo",
      "component-scene__main-track__clip-logo__2",
    ]);
  });

  it("opt-in migration removes all component clip sources", () => {
    const input = legacyClipProject();
    // Legacy component clip source requires normalization…
    expect(needsNormalization(input)).toBe(true);

    const { project } = normalizeMotionProjectV3(input, {
      migrateComponentClipsToScenes: true,
    });

    // …but after opt-in migration no component clip source remains.
    expect(needsNormalization(project)).toBe(false);
  });

  it("does not mutate the input", () => {
    const input = legacyClipProject();
    const original = JSON.stringify(input);
    normalizeMotionProjectV3(input, { migrateComponentClipsToScenes: true });
    expect(JSON.stringify(input)).toBe(original);
  });
});
