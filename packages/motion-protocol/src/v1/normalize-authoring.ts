/**
 * Authoring JSON shape — semantic key order + prune empty (core only).
 */
import type { LayerV1 } from "./layers";
import type { ProjectMetadataV1 } from "./metadata";
import type { MotionProjectV1 } from "./types";

const ROOT_KEY_ORDER = [
  "format",
  "formatVersion",
  "metadata",
  "composition",
  "layers",
  "assets",
  "components",
] as const;

const METADATA_KEY_ORDER = ["id", "name", "locale"] as const;

const COMPOSITION_KEY_ORDER = [
  "width",
  "height",
  "fps",
  "background",
  "colorSpace",
  "pixelAspectRatio",
  "audioSampleRate",
  "motionBlur",
] as const;

function isEmptyArray(value: unknown): boolean {
  return Array.isArray(value) && value.length === 0;
}

function reorderKeys(
  value: Record<string, unknown>,
  order: readonly string[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of order) {
    if (key in value) out[key] = value[key];
  }
  for (const key of Object.keys(value)) {
    if (!(key in out)) out[key] = value[key];
  }
  return out;
}

function normalizeMetadata(
  metadata: ProjectMetadataV1,
): Record<string, unknown> {
  return reorderKeys(
    metadata as Record<string, unknown>,
    METADATA_KEY_ORDER,
  );
}

function compareLayers(a: LayerV1, b: LayerV1): number {
  if (a.zIndex !== b.zIndex) return b.zIndex - a.zIndex;
  if (a.timing.start !== b.timing.start) return a.timing.start - b.timing.start;
  if (a.id !== b.id) return a.id < b.id ? -1 : 1;
  return 0;
}

function pruneEmptyAnimations(layer: LayerV1): LayerV1 {
  if (layer.type === "audio") return layer;
  if (!isEmptyArray(layer.animations)) return layer;
  const { animations: _omitted, ...rest } = layer;
  return rest as LayerV1;
}

function sortLayers(layers: LayerV1[]): LayerV1[] {
  return [...layers]
    .sort(compareLayers)
    .map((layer) => {
      const next =
        layer.type === "group"
          ? { ...layer, children: sortLayers(layer.children) }
          : layer;
      return pruneEmptyAnimations(next);
    });
}

export function normalizeAuthoringProjectV1(
  project: MotionProjectV1,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  out.format = project.format;
  out.formatVersion = project.formatVersion;
  out.metadata = normalizeMetadata(project.metadata);
  out.composition = reorderKeys(
    project.composition as unknown as Record<string, unknown>,
    COMPOSITION_KEY_ORDER,
  );
  out.layers = sortLayers(project.layers);

  if (!isEmptyArray(project.assets)) out.assets = project.assets;
  if (!isEmptyArray(project.components)) out.components = project.components;

  return reorderKeys(out, ROOT_KEY_ORDER);
}

export function serializeMotionProjectV1Authoring(
  project: MotionProjectV1,
): string {
  return `${JSON.stringify(normalizeAuthoringProjectV1(project), null, 2)}\n`;
}
