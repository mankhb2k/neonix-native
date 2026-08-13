/**
 * Committed JSON Schema gates.
 *
 * Freshness is a **required** protocol gate: every `pnpm test` regenerates
 * `schema/v1.json` from Zod in-memory and fails if the committed file drifts.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { serializeMotionProjectV1JsonSchema } from "../../scripts/v1-json-schema";

const SCHEMA_DIR = join(__dirname, "..", "..", "schema");
const V1_SCHEMA_PATH = join(SCHEMA_DIR, "v1.json");

function loadSchema(name: string): {
  $ref: string;
  definitions: Record<string, { properties?: Record<string, unknown> }>;
} {
  return JSON.parse(readFileSync(join(SCHEMA_DIR, name), "utf8"));
}

type JsonSchemaNode = Record<string, unknown>;

function isOpenJsonSchema(value: unknown): boolean {
  if (value === true) return true;
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const record = value as JsonSchemaNode;
  const keys = Object.keys(record);
  if (keys.length === 0) return true;
  return keys.length === 1 && record.type === true;
}

function decodePointerToken(token: string): string {
  return token.replace(/~1/g, "/").replace(/~0/g, "~");
}

function deref(
  document: unknown,
  node: unknown,
  seen: Set<string> = new Set(),
): unknown {
  if (!node || typeof node !== "object" || Array.isArray(node)) return node;
  const rec = node as JsonSchemaNode;
  if (typeof rec.$ref !== "string") return node;
  // Document wrappers keep `$ref` beside `definitions`; only follow pure refs.
  const keys = Object.keys(rec).filter((key) => key !== "$schema");
  if (keys.some((key) => key !== "$ref")) return node;
  const pointer = rec.$ref;
  if (seen.has(pointer)) return node;
  seen.add(pointer);
  return deref(document, getByPointer(document, pointer, seen), seen);
}

function getByPointer(
  document: unknown,
  pointer: string,
  seen: Set<string> = new Set(),
): unknown {
  if (pointer === "" || pointer === "#") return document;
  const path = pointer.startsWith("#/")
    ? pointer.slice(2)
    : pointer.replace(/^\//, "");
  let current: unknown = document;
  for (const token of path.split("/").map(decodePointerToken)) {
    current = deref(document, current, seen);
    if (Array.isArray(current)) {
      current = current[Number(token)];
    } else if (current && typeof current === "object") {
      current = (current as JsonSchemaNode)[token];
    } else {
      return undefined;
    }
  }
  return deref(document, current, seen);
}

function getPath(
  document: unknown,
  start: unknown,
  keys: string[],
): unknown {
  let current: unknown = start;
  for (const key of keys) {
    current = deref(document, current);
    if (Array.isArray(current)) {
      current = current[Number(key)];
    } else if (current && typeof current === "object") {
      current = (current as JsonSchemaNode)[key];
    } else {
      return undefined;
    }
  }
  return deref(document, current);
}

function findComponentLayerSchema(
  document: unknown,
  layersItems: unknown,
): JsonSchemaNode {
  const resolved = deref(document, layersItems) as
    | { anyOf?: unknown[] }
    | undefined;
  const anyOf = resolved?.anyOf;
  expect(anyOf, "layers.items must be a union").toEqual(expect.any(Array));
  const component = anyOf!.find((entry) => {
    const rec = deref(document, entry) as {
      properties?: { type?: { const?: string } };
    };
    return rec.properties?.type?.const === "component";
  });
  expect(component, "component layer branch in layers.anyOf").toBeDefined();
  return deref(document, component) as JsonSchemaNode;
}

describe("committed JSON schemas", () => {
  it("schema/v1.json exists", () => {
    expect(existsSync(V1_SCHEMA_PATH)).toBe(true);
  });

  it("schema/v1.json matches Zod source (required artifact sync gate)", () => {
    const committed = readFileSync(V1_SCHEMA_PATH, "utf8");
    const generated = serializeMotionProjectV1JsonSchema();
    expect(
      committed,
      "schema/v1.json is stale. Run: pnpm --filter @motionvideo/motion-protocol generate:schema",
    ).toBe(generated);
  });

  it("v1 schema is draft-07 compatible and has all root fields", () => {
    const schema = loadSchema("v1.json");
    expect(schema.$ref).toBe("#/definitions/MotionProjectV1");
    const definition = schema.definitions.MotionProjectV1;
    expect(definition.properties).toBeDefined();
    const fields = Object.keys(definition.properties!);
    expect(fields.sort()).toEqual(
      [
        "assets",
        "bindings",
        "capabilities",
        "components",
        "composition",
        "dependencies",
        "extensions",
        "format",
        "formatVersion",
        "metadata",
        "provenance",
        "layers",
        "timeline",
        "tokens",
        "variables",
      ].sort(),
    );
  });

  it("v1 schema encodes timeline metadata only (no tracks)", () => {
    const schema = loadSchema("v1.json");
    const timeline = schema.definitions.MotionProjectV1.properties!
      .timeline as unknown as {
      properties?: Record<string, unknown>;
    };
    const timelineProps = Object.keys(timeline.properties ?? {});
    expect(timelineProps).toEqual(
      expect.arrayContaining(["duration", "workArea", "markers"]),
    );
    expect(timelineProps).not.toContain("sceneOrder");
    expect(timelineProps).not.toContain("visualTracks");
    expect(timelineProps).not.toContain("audioTracks");
    expect(timelineProps).not.toContain("captionTracks");
  });

  it("v1 schema root is layers, not scenes", () => {
    const schema = loadSchema("v1.json");
    const props = schema.definitions.MotionProjectV1.properties!;
    expect(props.layers).toBeDefined();
    expect(props.scenes).toBeUndefined();
  });

  it("does not warn recursive-any while generating schema/v1.json", () => {
    const warnings: string[] = [];
    const originalWarn = console.warn;
    console.warn = (...args: unknown[]) => {
      warnings.push(String(args[0] ?? ""));
      originalWarn.apply(console, args);
    };
    try {
      serializeMotionProjectV1JsonSchema();
    } finally {
      console.warn = originalWarn;
    }
    expect(
      warnings.filter((warning) => warning.includes("Defaulting to any")),
    ).toEqual([]);
  });

  it("contract prop paths are not open any / {} / true schemas", () => {
    const schema = loadSchema("v1.json");
    const assertClosed = (value: unknown, label: string) => {
      expect(value, label).toBeDefined();
      expect(isOpenJsonSchema(value), `${label} must not be open any`).toBe(
        false,
      );
    };

    assertClosed(schema.definitions.JsonValue, "JsonValue");
    assertClosed(schema.definitions.ListField, "ListField");
    assertClosed(schema.definitions.ComponentPropValue, "ComponentPropValue");
    assertClosed(schema.definitions.PropKeyframesValue, "PropKeyframesValue");
    assertClosed(
      getByPointer(schema, "#/definitions/ListField/properties/itemSchema"),
      "ListField.itemSchema",
    );
    assertClosed(
      getByPointer(
        schema,
        "#/definitions/PropKeyframesValue/properties/keys/items/properties/value",
      ),
      "PropKeyframesValue.keys[].value",
    );
    assertClosed(
      getByPointer(
        schema,
        "#/definitions/MotionProjectV1/properties/components/items/properties/props/items/properties/default",
      ),
      "components.items.props.items.default",
    );
    assertClosed(
      getByPointer(
        schema,
        "#/definitions/MotionProjectV1/properties/components/items/properties/variants/items/properties/props/additionalProperties",
      ),
      "components.items.variants.items.props.additionalProperties",
    );

    const componentLayers = getByPointer(
      schema,
      "#/definitions/MotionProjectV1/properties/components/items/properties/layers/items",
    );
    const componentLayer = findComponentLayerSchema(schema, componentLayers);
    assertClosed(
      getPath(schema, componentLayer, [
        "properties",
        "payload",
        "properties",
        "props",
        "additionalProperties",
      ]),
      "component layer payload.props.additionalProperties",
    );

    const projectLayers = getByPointer(
      schema,
      "#/definitions/MotionProjectV1/properties/layers/items",
    );
    const projectComponentLayer = findComponentLayerSchema(schema, projectLayers);
    assertClosed(
      getPath(schema, projectComponentLayer, [
        "properties",
        "payload",
        "properties",
        "props",
        "additionalProperties",
      ]),
      "layers.items component payload.props.additionalProperties",
    );
  });
});

// ── Phase 7 — V1 naming gate ────────────────────────────────────────

import * as Protocol from "../index";
import type {
  LayerTiming,
  ProceduralDriver,
  MotionPoint,
  MotionPathSegment,
  MotionPathContour,
  MotionPathMorphTarget,
} from "../index";

describe("Phase 7 — public API V1 naming", () => {
  it("every V2-named schema/value export has a neutral counterpart", () => {
    // Only runtime values (Zod schemas, constants, functions), not types.
    const runtimeExports = Object.keys(Protocol);

    const requiredNeutralValues = [
      "EffectSchema",
      "TransformSchema",
      "ImageAssetSchema",
      "SvgAssetSchema",
      "VideoAssetSchema",
      "AudioAssetSchema",
      "FontAssetSchema",
      "AssetSchema",
      "VariableSchema",
      "ProjectBindingV1Schema",
      "PointSchema",
      "PathSegmentSchema",
      "PathContourSchema",
      "PathMorphTargetSchema",
      "LayerTimingSchema",
      "GroupLayerSchema",
      "BoneLayerSchema",
      "TextLayerSchema",
      "ShapeLayerSchema",
      "PathLayerSchema",
      "ImageLayerSchema",
      "SvgLayerSchema",
      "VideoLayerSchema",
      "CameraLayerSchema",
      "SolidLayerSchema",
      "AdjustmentLayerSchema",
      "LayerSchema",
      "KeyframeEasingSchema",
      "ProceduralDriverSchema",
    ];

    for (const name of requiredNeutralValues) {
      expect(runtimeExports, `Missing neutral export: ${name}`).toContain(name);
    }

    expect(runtimeExports).not.toContain("normalizeMotionProjectV1");
    expect(runtimeExports).not.toContain("needsNormalization");
  });

  it("type-only neutral names are importable", () => {
    // Compile-time check: if these types didn't exist, TS would fail here.
    // Declare dummy vars to suppress no-unused-vars.
    void (null as unknown as LayerTiming);
    void (null as unknown as ProceduralDriver);
    void (null as unknown as MotionPoint);
    void (null as unknown as MotionPathSegment);
    void (null as unknown as MotionPathContour);
    void (null as unknown as MotionPathMorphTarget);

    // If we got this far, the types imported successfully.
    // Also check MotionTransform, MotionEffect which already exist.
  });
});

// ── Phase 8 — package.json exports gate ─────────────────────────────

describe("Phase 8 — package.json exports", () => {
  it("does not expose compat/ in public exports", () => {
    const pkgJsonPath = join(__dirname, "..", "..", "package.json");
    const pkg = JSON.parse(readFileSync(pkgJsonPath, "utf8")) as {
      exports?: Record<string, string>;
    };

    const exportKeys = Object.keys(pkg.exports ?? {});
    expect(exportKeys).not.toContain("./compat");
    expect(exportKeys).not.toContain("./compat/*");

    // Only the root export should remain
    expect(exportKeys).toEqual(["."]);
  });
});
