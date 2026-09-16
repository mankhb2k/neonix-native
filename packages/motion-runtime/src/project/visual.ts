import { frameIndexAtTime } from "../foundation/clock";
import {
  evaluatePreparedVisualRuntimeProject,
  prepareVisualRuntimeProject,
  type PreparedVisualRuntimeProject,
  type VisualRuntimeNodeOverride,
} from "../visual/evaluate";
import { normalizeVisualRuntimeProject } from "../visual/validate";
import { assertVisualRuntimeFrame } from "../visual/validate";
import { prepareVisualRuntimeProjectText, type VisualRuntimeTextFontResolver, type VisualRuntimeTextShaperLoader } from "../visual/text-layout";
import { validateRuntimeProjectV3 } from "./validate";
import type { RuntimeFrameV3, RuntimeNodeV3, RuntimeProjectV3, RuntimeVisualNodeDeltaV3 } from "./types";

function normalizedDeltaMatrix(value: unknown): unknown {
  if (value instanceof Float64Array) return value;
  if (Array.isArray(value) && value.length === 16 && value.every((item) => typeof item === "number")) {
    return new Float64Array(value);
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const values = Array.from({ length: 16 }, (_, index) => record[String(index)]);
    if (values.every((item) => typeof item === "number")) return new Float64Array(values as number[]);
  }
  return value;
}

/** Rehydrate the visual matrices after a JSON transport boundary. */
export function normalizeRuntimeProjectV3(project: RuntimeProjectV3): RuntimeProjectV3 {
  const normalized = normalizeVisualRuntimeProject({
    format: "motion-runtime",
    formatVersion: 2,
    id: project.projectId,
    composition: project.visual.composition,
    view: project.visual.view,
    nodes: project.visual.nodes,
  });
  const normalizedTimeline = project.visualTimeline
    ? {
        frames: project.visualTimeline.frames.map((frame) => ({
          nodes: frame.nodes.map((node) => ({
            ...node,
            ...(node.localMatrix === undefined ? {} : { localMatrix: normalizedDeltaMatrix(node.localMatrix) as typeof node.localMatrix }),
            ...(node.worldMatrix === undefined ? {} : { worldMatrix: normalizedDeltaMatrix(node.worldMatrix) as typeof node.worldMatrix }),
          })),
        })),
      }
    : undefined;
  return {
    ...project,
    visual: {
      ...project.visual,
      composition: normalized.composition,
      view: normalized.view,
      nodes: normalized.nodes,
    },
    ...(normalizedTimeline ? { visualTimeline: normalizedTimeline } : {}),
  };
}

export type PreparedRuntimeProjectV3 = {
  project: RuntimeProjectV3;
  visual: PreparedVisualRuntimeProject;
  nodeById: ReadonlyMap<string, RuntimeNodeV3>;
  orderedNodes: readonly RuntimeNodeV3[];
  animatedNodeIds: ReadonlySet<string>;
  assetReferences: ReadonlyMap<string, readonly string[]>;
  textNodeIds: ReadonlySet<string>;
  effectNodeIds: ReadonlySet<string>;
  timelineFrames: readonly ReadonlyMap<string, RuntimeVisualNodeDeltaV3>[];
};

function stableRuntimeNodeOrder(nodes: readonly RuntimeNodeV3[]): RuntimeNodeV3[] {
  return [...nodes].sort(
    (left, right) =>
      left.order - right.order ||
      (left.id < right.id ? -1 : left.id > right.id ? 1 : 0),
  );
}

/** Validate, normalize and index a Runtime V3 project once per render job. */
export function prepareRuntimeProjectV3(project: RuntimeProjectV3): PreparedRuntimeProjectV3 {
  const normalized = normalizeRuntimeProjectV3(project);
  const validation = validateRuntimeProjectV3(normalized);
  if (!validation.ok) {
    throw new Error(
      `Runtime V3 validation failed: ${validation.diagnostics
        .filter((diagnostic) => diagnostic.severity === "error")
        .map((diagnostic) => diagnostic.message)
        .join(" | ")}`,
    );
  }
  const nodeById = new Map(normalized.visual.nodes.map((node) => [node.id, node]));
  const orderedNodes = stableRuntimeNodeOrder(normalized.visual.nodes);
  const assetReferences = new Map<string, string[]>();
  const textNodeIds = new Set<string>();
  const effectNodeIds = new Set<string>();
  for (const node of normalized.visual.nodes) {
    if (node.content.kind === "text") textNodeIds.add(node.id);
    const assetId = node.content.kind === "image" || node.content.kind === "video" ? node.content.assetId : undefined;
    if (assetId) assetReferences.set(assetId, [...(assetReferences.get(assetId) ?? []), node.id]);
    if (
      node.content.effects !== undefined ||
      node.backdropEffects !== undefined ||
      node.clipPath !== undefined ||
      node.mask !== undefined
    ) effectNodeIds.add(node.id);
  }
  const timelineFrames = normalized.visualTimeline?.frames.map((frame) =>
    new Map<string, RuntimeVisualNodeDeltaV3>(frame.nodes.map((node) => [node.id, node])),
  ) ?? [];
  const animatedNodeIds = new Set<string>();
  for (const frame of timelineFrames) for (const id of frame.keys()) animatedNodeIds.add(id);
  const visual = prepareVisualRuntimeProject({
    format: "motion-runtime",
    formatVersion: 2,
    id: normalized.projectId,
    composition: normalized.visual.composition,
    view: normalized.visual.view,
    nodes: normalized.visual.nodes,
  });
  return {
    project: normalized,
    visual,
    nodeById,
    orderedNodes,
    animatedNodeIds,
    assetReferences,
    textNodeIds,
    effectNodeIds,
    timelineFrames,
  };
}

/**
 * Evaluate the canonical V3 visual projection.
 *
 * V3 deliberately keeps the certified visual node semantics from V2. The
 * certified visual evaluator is used only behind this boundary; the
 * public input is the V3 visual projection and the returned frame is tagged
 * with runtime version 3. Media/audio playback is resolved separately by the
 * V3 timeline functions.
 */
export function evaluateRuntimeProjectV3(
  project: RuntimeProjectV3,
  frame: number,
  options: { time?: number; outputScale?: number } = {},
): RuntimeFrameV3 {
  return evaluatePreparedRuntimeProjectV3(prepareRuntimeProjectV3(project), frame, options);
}

/** Evaluate a prepared V3 project without per-frame validation or scene cloning. */
export function evaluatePreparedRuntimeProjectV3(
  prepared: PreparedRuntimeProjectV3,
  frame: number,
  options: { time?: number; outputScale?: number } = {},
): RuntimeFrameV3 {
  const timeline = prepared.timelineFrames;
  const requestedFrame = options.time === undefined
    ? frame
    : frameIndexAtTime(options.time, prepared.project.visual.composition.fps);
  const frameIndex = timeline.length === 0
    ? 0
    : Math.max(0, Math.min(timeline.length - 1, requestedFrame));
  const overrides = timeline[frameIndex] as ReadonlyMap<string, VisualRuntimeNodeOverride> | undefined;
  const frameV2 = evaluatePreparedVisualRuntimeProject(prepared.visual, frame, options, overrides);
  return { ...frameV2, runtimeVersion: 3 };
}

/** Backend-neutral V3 name for visual frame evaluation. */
export const evaluateVisualFrame = evaluateRuntimeProjectV3;

/** Validate the V3-tagged visual frame without re-exposing a V2 public API. */
export function assertRuntimeFrameV3(input: unknown): asserts input is RuntimeFrameV3 {
  if (!input || typeof input !== "object" || (input as { runtimeVersion?: unknown }).runtimeVersion !== 3) {
    throw new Error("Runtime frame must carry runtimeVersion 3");
  }
  assertVisualRuntimeFrame({ ...(input as RuntimeFrameV3), runtimeVersion: 2 });
}

export type RuntimeTextFontResolverV3 = VisualRuntimeTextFontResolver;
export type RuntimeTextShaperLoaderV3 = VisualRuntimeTextShaperLoader;

/** V3 text preparation preserves the certified visual shaper behind the V3 boundary. */
export async function prepareRuntimeProjectV3Text(project: RuntimeProjectV3, resolveFont: RuntimeTextFontResolverV3, loadHarfBuzz: RuntimeTextShaperLoaderV3): Promise<{ project: RuntimeProjectV3; diagnostics: Awaited<ReturnType<typeof prepareVisualRuntimeProjectText>>["diagnostics"] }> {
  const prepared = await prepareVisualRuntimeProjectText({ format: "motion-runtime", formatVersion: 2, id: project.projectId, composition: project.visual.composition, view: project.visual.view, nodes: project.visual.nodes }, resolveFont, loadHarfBuzz);
  const preparedById = new Map(prepared.project.nodes.map((node) => [node.id, node]));
  const visualTimeline = project.visualTimeline
    ? {
        frames: project.visualTimeline.frames.map((frame) => ({
          nodes: frame.nodes.map((node) => {
            const preparedNode = preparedById.get(node.id);
            if (node.content?.kind !== "text" || preparedNode?.content.kind !== "text") return node;
            return {
              ...node,
              content: {
                ...node.content,
                layout: preparedNode.content.layout,
              },
            };
          }),
        })),
      }
    : undefined;
  return {
    project: {
      ...project,
      visual: { ...project.visual, composition: prepared.project.composition, view: prepared.project.view, nodes: prepared.project.nodes },
      ...(visualTimeline ? { visualTimeline } : {}),
    },
    diagnostics: prepared.diagnostics,
  };
}
