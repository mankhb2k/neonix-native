/**
 * V1 schema — nested project.layers, no scenes/tracks.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  MOTION_PROJECT_V1_FORMAT_VERSION,
  MotionProjectV1Schema,
} from "../../src/v1/index";
import { parseMotionProjectV1 } from "../../src/v1/parse";
import { visualLayerAtoms } from "../../src/v1/layer-atoms";

const FIXTURES_DIR = join(__dirname, "..", "..", "src", "v1", "__fixtures__");

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

const ATOMS = visualLayerAtoms({ width: 100, height: 100 });

function solidChild(parentId: string, id = "child") {
  return {
    id,
    type: "solid" as const,
    parentLayerId: parentId,
    zIndex: 0,
    timing: { start: 0, duration: 1 },
    ...ATOMS,
    payload: { color: "#111111" },
  };
}

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
            ...ATOMS,
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
            ...ATOMS,
          },
          {
            id: "b",
            type: "group",
            parentLayerId: null,
            zIndex: 0,
            timing: { start: 0, duration: 1 },
            ...ATOMS,
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

  it("rejects appearance on an audio layer", () => {
    const result = MotionProjectV1Schema.safeParse(
      baseProject({
        layers: [
          {
            id: "music",
            type: "audio",
            parentLayerId: null,
            zIndex: -1,
            timing: { start: 0, duration: 8 },
            appearance: { visible: true, opacity: 100 },
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
            ...ATOMS,
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
            ...ATOMS,
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
            ...ATOMS,
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
            ...ATOMS,
          },
          {
            id: "title",
            type: "text",
            parentLayerId: "main",
            zIndex: 1,
            timing: { start: 0, duration: 1 },
            ...ATOMS,
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
            ...ATOMS,
            children: [
              {
                id: "title",
                type: "text",
                parentLayerId: "other",
                zIndex: 0,
                timing: { start: 0, duration: 1 },
                ...ATOMS,
                payload: { text: "Hi", fontSize: 24 },
              },
            ],
          },
        ],
      }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects nested layer missing zIndex", () => {
    const result = MotionProjectV1Schema.safeParse(
      baseProject({
        layers: [
          {
            id: "main",
            type: "group",
            parentLayerId: null,
            zIndex: 0,
            timing: { start: 0, duration: 4 },
            ...ATOMS,
            children: [
              {
                id: "title",
                type: "text",
                parentLayerId: "main",
                timing: { start: 0, duration: 1 },
                ...ATOMS,
                payload: {
                  content: { kind: "plain", text: "Hi" },
                  fontSize: 24,
                  color: "#111111",
                  alignment: "center",
                },
              },
            ],
          },
        ],
      }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects nested layer missing timing", () => {
    const result = MotionProjectV1Schema.safeParse(
      baseProject({
        layers: [
          {
            id: "main",
            type: "group",
            parentLayerId: null,
            zIndex: 0,
            timing: { start: 0, duration: 4 },
            ...ATOMS,
            children: [
              {
                id: "title",
                type: "text",
                parentLayerId: "main",
                zIndex: 0,
                ...ATOMS,
                payload: {
                  content: { kind: "plain", text: "Hi" },
                  fontSize: 24,
                  color: "#111111",
                  alignment: "center",
                },
              },
            ],
          },
        ],
      }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects duplicate sibling zIndex under a group", () => {
    const result = MotionProjectV1Schema.safeParse(
      baseProject({
        layers: [
          {
            id: "main",
            type: "group",
            parentLayerId: null,
            zIndex: 0,
            timing: { start: 0, duration: 4 },
            ...ATOMS,
            children: [
              {
                id: "a",
                type: "text",
                parentLayerId: "main",
                zIndex: 0,
                timing: { start: 0, duration: 1 },
                ...ATOMS,
                payload: {
                  content: { kind: "plain", text: "A" },
                  fontSize: 24,
                  color: "#111111",
                  alignment: "center",
                },
              },
              {
                id: "b",
                type: "text",
                parentLayerId: "main",
                zIndex: 0,
                timing: { start: 0, duration: 1 },
                ...ATOMS,
                payload: {
                  content: { kind: "plain", text: "B" },
                  fontSize: 24,
                  color: "#111111",
                  alignment: "center",
                },
              },
            ],
          },
        ],
      }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects child timing that exceeds parent duration", () => {
    const result = MotionProjectV1Schema.safeParse(
      baseProject({
        layers: [
          {
            id: "main",
            type: "group",
            parentLayerId: null,
            zIndex: 0,
            timing: { start: 0, duration: 2 },
            ...ATOMS,
            children: [
              {
                id: "title",
                type: "text",
                parentLayerId: "main",
                zIndex: 0,
                timing: { start: 0, duration: 3 },
                ...ATOMS,
                payload: {
                  content: { kind: "plain", text: "Hi" },
                  fontSize: 24,
                  color: "#111111",
                  alignment: "center",
                },
              },
            ],
          },
        ],
      }),
    );
    expect(result.success).toBe(false);
  });

  it("strips legacy locked from authoring JSON", () => {
    const project = parseMotionProjectV1(
      baseProject({
        layers: [
          {
            id: "main",
            type: "group",
            parentLayerId: null,
            zIndex: 0,
            timing: { start: 0, duration: 1 },
            locked: true,
            ...ATOMS,
            children: [solidChild("main")],
          },
        ],
      }),
    );
    expect("locked" in project.layers[0]!).toBe(false);
  });

  it("rejects an empty group", () => {
    const result = MotionProjectV1Schema.safeParse(
      baseProject({
        layers: [
          {
            id: "main",
            type: "group",
            parentLayerId: null,
            zIndex: 0,
            timing: { start: 0, duration: 1 },
            ...ATOMS,
            children: [],
          },
        ],
      }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects a group without frame", () => {
    expect(() =>
      parseMotionProjectV1(
        baseProject({
          layers: [
            {
              id: "main",
              type: "group",
              parentLayerId: null,
              zIndex: 0,
              timing: { start: 0, duration: 1 },
              transform: ATOMS.transform,
              appearance: ATOMS.appearance,
              children: [solidChild("main")],
            },
          ],
        }),
      ),
    ).toThrow(/frame/);
  });

  it("rejects layout wrap and layoutItem grow", () => {
    expect(
      MotionProjectV1Schema.safeParse(
        baseProject({
          layers: [
            {
              id: "stack",
              type: "group",
              parentLayerId: null,
              zIndex: 0,
              timing: { start: 0, duration: 1 },
              ...ATOMS,
              layout: { mode: "column", wrap: "wrap" },
              children: [solidChild("stack")],
            },
          ],
        }),
      ).success,
    ).toBe(false);
    expect(
      MotionProjectV1Schema.safeParse(
        baseProject({
          layers: [
            {
              id: "stack",
              type: "group",
              parentLayerId: null,
              zIndex: 0,
              timing: { start: 0, duration: 1 },
              ...ATOMS,
              layout: { mode: "column" },
              children: [
                { ...solidChild("stack"), layoutItem: { grow: 1 } },
              ],
            },
          ],
        }),
      ).success,
    ).toBe(false);
  });

  it("rejects text without frame", () => {
    expect(() =>
      parseMotionProjectV1(
        baseProject({
          layers: [
            {
              id: "title",
              type: "text",
              parentLayerId: null,
              zIndex: 0,
              timing: { start: 0, duration: 1 },
              transform: ATOMS.transform,
              appearance: ATOMS.appearance,
              payload: {
                content: { kind: "plain", text: "Hi" },
                fontSize: 24,
                color: "#111111",
                alignment: "center",
              },
            },
          ],
        }),
      ),
    ).toThrow(/frame/);
  });

  it("rejects component actions (props-only surface)", () => {
    const result = MotionProjectV1Schema.safeParse(
      baseProject({
        components: [
          {
            id: "btn",
            version: "1.0.0",
            integrity: "sha256:btn",
            props: [],
            variants: [],
            propBindings: [],
            layers: [
              {
                id: "label",
                type: "text",
                parentLayerId: null,
                zIndex: 0,
                timing: { start: 0, duration: 1 },
                ...ATOMS,
                payload: {
                  content: { kind: "plain", text: "Hi" },
                  fontSize: 24,
                  color: "#111111",
                  alignment: "center",
                },
              },
            ],
            actions: [{ id: "tap", animations: [] }],
          },
        ],
        layers: [
          {
            id: "inst",
            type: "component",
            parentLayerId: null,
            zIndex: 0,
            timing: { start: 0, duration: 1 },
            ...ATOMS,
            payload: { componentId: "btn" },
          },
        ],
      }),
    );
    expect(result.success).toBe(false);
  });

  it("accepts wrapper atoms on a component instance", () => {
    const project = MotionProjectV1Schema.parse(
      baseProject({
        components: [
          {
            id: "btn",
            version: "1.0.0",
            integrity: "sha256:btn",
            props: [],
            variants: [],
            propBindings: [],
            layers: [
              {
                id: "label",
                type: "text",
                parentLayerId: null,
                zIndex: 0,
                timing: { start: 0, duration: 1 },
                ...ATOMS,
                payload: {
                  content: { kind: "plain", text: "Hi" },
                  fontSize: 24,
                  color: "#111111",
                  alignment: "center",
                },
              },
            ],
          },
        ],
        layers: [
          {
            id: "inst",
            type: "component",
            parentLayerId: null,
            zIndex: 2,
            timing: { start: 0, duration: 1 },
            ...ATOMS,
            appearance: { visible: true, opacity: 80 },
            compositing: { "blend-mode": "multiply" },
            effects: [{ id: "fx", type: "blur", radius: 4 }],
            semantic: { role: "cta" },
            payload: { componentId: "btn", props: {} },
          },
        ],
      }),
    );
    expect(project.layers[0]?.type).toBe("component");
  });

  it("rejects a variant that tries to replace internal layers", () => {
    const result = MotionProjectV1Schema.safeParse(
      baseProject({
        components: [
          {
            id: "btn",
            version: "1.0.0",
            integrity: "sha256:btn",
            props: [],
            variants: [
              {
                id: "alt",
                name: "Alt",
                props: {},
                layers: [],
              },
            ],
            propBindings: [],
            layers: [
              {
                id: "label",
                type: "text",
                parentLayerId: null,
                zIndex: 0,
                timing: { start: 0, duration: 1 },
                ...ATOMS,
                payload: {
                  content: { kind: "plain", text: "Hi" },
                  fontSize: 24,
                  color: "#111111",
                  alignment: "center",
                },
              },
            ],
          },
        ],
        layers: [
          {
            id: "inst",
            type: "component",
            parentLayerId: null,
            zIndex: 0,
            timing: { start: 0, duration: 1 },
            ...ATOMS,
            payload: { componentId: "btn" },
          },
        ],
      }),
    );
    expect(result.success).toBe(false);
  });

  it("accepts native group.layout and child.layoutItem hug", () => {
    const project = MotionProjectV1Schema.parse(
      baseProject({
        layers: [
          {
            id: "stack",
            type: "group",
            parentLayerId: null,
            zIndex: 0,
            timing: { start: 0, duration: 1 },
            ...ATOMS,
            layout: { mode: "column", gap: 8, align: "stretch" },
            children: [
              {
                ...solidChild("stack"),
                layoutItem: { width: "fill", height: "hug" },
              },
            ],
          },
        ],
      }),
    );
    expect(project.layers[0]?.type).toBe("group");
  });

  it("rejects layout on a non-group layer", () => {
    const result = MotionProjectV1Schema.safeParse(
      baseProject({
        layers: [
          {
            id: "box",
            type: "solid",
            parentLayerId: null,
            zIndex: 0,
            timing: { start: 0, duration: 1 },
            ...ATOMS,
            layout: { mode: "row" },
            payload: { color: "#111111" },
          },
        ],
      }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects layoutItem on a root layer", () => {
    expect(() =>
      parseMotionProjectV1(
        baseProject({
          layers: [
            {
              id: "box",
              type: "solid",
              parentLayerId: null,
              zIndex: 0,
              timing: { start: 0, duration: 1 },
              ...ATOMS,
              layoutItem: { width: "fill" },
              payload: { color: "#111111" },
            },
          ],
        }),
      ),
    ).toThrow(/layoutItem/);
  });

  it("rejects layoutItem when the parent group has no layout", () => {
    expect(() =>
      parseMotionProjectV1(
        baseProject({
          layers: [
            {
              id: "stack",
              type: "group",
              parentLayerId: null,
              zIndex: 0,
              timing: { start: 0, duration: 1 },
              ...ATOMS,
              children: [
                {
                  ...solidChild("stack"),
                  layoutItem: { width: "fill" },
                },
              ],
            },
          ],
        }),
      ),
    ).toThrow(/layoutItem/);
  });

  it("rejects modifiers on authoring layers", () => {
    const result = MotionProjectV1Schema.safeParse(
      baseProject({
        layers: [
          {
            id: "box",
            type: "solid",
            parentLayerId: null,
            zIndex: 0,
            timing: { start: 0, duration: 1 },
            ...ATOMS,
            modifiers: [
              { id: "m1", type: "parallax", factor: 1 },
            ],
            payload: { color: "#111111" },
          },
        ],
      }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects duplicate effect ids on a layer", () => {
    expect(() =>
      parseMotionProjectV1(
        baseProject({
          layers: [
            {
              id: "box",
              type: "solid",
              parentLayerId: null,
              zIndex: 0,
              timing: { start: 0, duration: 1 },
              ...ATOMS,
              effects: [
                { id: "fx", type: "blur", radius: 4 },
                { id: "fx", type: "blur", radius: 8 },
              ],
              payload: { color: "#111111" },
            },
          ],
        }),
      ),
    ).toThrow(/effect id/);
  });

  it("rejects effects on a camera layer", () => {
    const result = MotionProjectV1Schema.safeParse(
      baseProject({
        layers: [
          {
            id: "cam",
            type: "camera",
            parentLayerId: null,
            zIndex: 0,
            timing: { start: 0, duration: 1 },
            transform: ATOMS.transform,
            appearance: ATOMS.appearance,
            effects: [{ id: "fx", type: "blur", radius: 4 }],
            payload: { projection: "orthographic" },
          },
        ],
      }),
    );
    expect(result.success).toBe(false);
  });
});
