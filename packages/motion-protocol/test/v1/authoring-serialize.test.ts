/**
 * Authoring serializer — semantic key order + prune empty + layer ordering.
 *
 * Canonical serializer (alphabetical) stays in canonical-hash.test.ts; file này
 * kiểm tra shape authoring (JSON panel / save file / AI output).
 */
import { describe, expect, it } from "vitest";
import {
  MotionProjectV1Schema,
  normalizeAuthoringProjectV1,
  serializeMotionProjectV1Authoring,
} from "../../src/v1/index";
import { parseMotionProjectV1 } from "../../src/v1/parse";

function solidLayer(
  id: string,
  zIndex: number,
  start = 0,
  parentLayerId: string | null = null,
): Record<string, unknown> {
  return {
    id,
    type: "solid",
    parentLayerId,
    zIndex,
    frame: { width: 100, height: 100 },
    transform: {
      translate: { x: 0, y: 0 },
      rotate: { z: 0 },
      scale: { x: 1, y: 1 },
      skew: { x: 0, y: 0 },
      origin: { x: 0.5, y: 0.5 },
      depth: 0,
    },
    timing: { start, duration: 1 },
    payload: { color: "#111111" },
  };
}

function groupLayer(
  id: string,
  zIndex: number,
  children: Record<string, unknown>[],
): Record<string, unknown> {
  return {
    id,
    type: "group",
    parentLayerId: null,
    zIndex,
    frame: { width: 100, height: 100 },
    transform: {
      translate: { x: 0, y: 0 },
      rotate: { z: 0 },
      scale: { x: 1, y: 1 },
      skew: { x: 0, y: 0 },
      origin: { x: 0.5, y: 0.5 },
      depth: 0,
    },
    timing: { start: 0, duration: 1 },
    children,
  };
}

function baseProject(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    format: "motion-project",
    formatVersion: 1,
    metadata: {
      id: "proj-test",
      name: "Test Project",
      locale: "vi-VN",
    },
    composition: { width: 1080, height: 1920, fps: 30 },
    layers: [],
    ...overrides,
  };
}

function parseAndNormalize(input: Record<string, unknown>) {
  const parsed = parseMotionProjectV1(input);
  return {
    parsed,
    normalized: normalizeAuthoringProjectV1(parsed),
    json: serializeMotionProjectV1Authoring(parsed),
  };
}

describe("serializeMotionProjectV1Authoring — root order", () => {
  it("emits root keys in the fixed semantic order", () => {
    const { normalized } = parseAndNormalize(baseProject());
    expect(Object.keys(normalized)).toEqual([
      "format",
      "formatVersion",
      "metadata",
      "composition",
      "layers",
    ]);
  });

  it("places populated registries after layers", () => {
    const { normalized } = parseAndNormalize(
      baseProject({
        assets: [
          {
            id: "a1",
            assetType: "image",
            uri: "asset://x",
            mimeType: "image/png",
            width: 10,
            height: 10,
          },
        ],
        components: [
          {
            id: "btn",
            version: "1.0.0",
            integrity: "sha256:btn",
            props: [],
            variants: [],
            propBindings: [],
            layers: [solidLayer("label", 0)],
          },
        ],
      }),
    );
    expect(Object.keys(normalized)).toEqual([
      "format",
      "formatVersion",
      "metadata",
      "composition",
      "layers",
      "assets",
      "components",
    ]);
  });
});

describe("serializeMotionProjectV1Authoring — prune empty", () => {
  it("omits empty collections/objects that are optional with defaults", () => {
    const { normalized } = parseAndNormalize(baseProject());
    expect(normalized).not.toHaveProperty("assets");
    expect(normalized).not.toHaveProperty("components");
  });

  it("keeps metadata to id, name, locale only", () => {
    const { normalized } = parseAndNormalize(baseProject());
    const metadata = normalized.metadata as Record<string, unknown>;
    expect(metadata).toEqual({
      id: "proj-test",
      name: "Test Project",
      locale: "vi-VN",
    });
  });
});

describe("serializeMotionProjectV1Authoring — layer ordering", () => {
  it("sorts root layers by zIndex desc", () => {
    const { normalized } = parseAndNormalize(
      baseProject({
        layers: [solidLayer("a", 0), solidLayer("b", 2), solidLayer("c", 1)],
      }),
    );
    const ids = (normalized.layers as Array<{ id: string }>).map((l) => l.id);
    expect(ids).toEqual(["b", "c", "a"]);
  });

  it("recursively sorts group children", () => {
    const { normalized } = parseAndNormalize(
      baseProject({
        layers: [
          groupLayer("g", 0, [
            solidLayer("g-low", 0, 0, "g"),
            solidLayer("g-high", 3, 0, "g"),
            solidLayer("g-mid", 2, 0, "g"),
          ]),
        ],
      }),
    );
    const group = (
      normalized.layers as Array<{
        id: string;
        children?: Array<{ id: string }>;
      }>
    )[0]!;
    expect(group.children!.map((c) => c.id)).toEqual([
      "g-high",
      "g-mid",
      "g-low",
    ]);
  });

  it("does not mutate the input project", () => {
    const input = baseProject({
      layers: [solidLayer("a", 0), solidLayer("b", 2)],
    });
    const parsed = parseMotionProjectV1(input);
    const before = JSON.stringify(parsed.layers);
    normalizeAuthoringProjectV1(parsed);
    expect(JSON.stringify(parsed.layers)).toBe(before);
  });
});

describe("serializeMotionProjectV1Authoring — round-trip", () => {
  it("output still parses as a valid MotionProjectV1", () => {
    const { json } = parseAndNormalize(
      baseProject({
        layers: [solidLayer("a", 0)],
      }),
    );
    const reparsed = parseMotionProjectV1(JSON.parse(json));
    expect(reparsed.layers.map((l) => l.id)).toEqual(["a"]);
    expect(MotionProjectV1Schema.safeParse(JSON.parse(json)).success).toBe(
      true,
    );
  });
});
