import { frameIndexAtTime } from "../foundation/clock";
import { evaluateVisualRuntimeProject } from "../visual/evaluate";
import { normalizeVisualRuntimeProject } from "../visual/validate";
import type { VisualRuntimeProject } from "../visual/types";
import { assertVisualRuntimeFrame } from "../visual/validate";
import { prepareVisualRuntimeProjectText, type VisualRuntimeTextFontResolver, type VisualRuntimeTextShaperLoader } from "../visual/text-layout";
import { validateRuntimeVisualProjectV3 } from "./validate";
import type { RuntimeFrameV3, RuntimeProjectV3 } from "./types";

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

function visualAtFrame(
  project: RuntimeProjectV3,
  frame: number,
  time: number | undefined,
): RuntimeProjectV3["visual"] {
  const timeline = project.visualTimeline;
  if (!timeline?.frames.length) return project.visual;
  const requestedFrame = time === undefined
    ? frame
    : frameIndexAtTime(time, project.visual.composition.fps);
  const frameIndex = Math.max(0, Math.min(timeline.frames.length - 1, requestedFrame));
  const delta = timeline.frames[frameIndex];
  if (!delta?.nodes.length) return project.visual;
  const replacements = new Map(delta.nodes.map((node) => [node.id, node]));
  return {
    ...project.visual,
    nodes: project.visual.nodes.map((node) => {
      const replacement = replacements.get(node.id);
      return replacement ? { ...node, ...replacement, id: node.id } : node;
    }),
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
  const validation = validateRuntimeVisualProjectV3(project);
  if (!validation.ok) {
    throw new Error(
      `Runtime V3 validation failed: ${validation.diagnostics
        .filter((diagnostic) => diagnostic.severity === "error")
        .map((diagnostic) => diagnostic.message)
        .join(" | ")}`,
    );
  }

  const visual = visualAtFrame(project, frame, options.time);
  const visualProject: VisualRuntimeProject = {
    format: "motion-runtime",
    formatVersion: 2,
    id: project.projectId,
    composition: visual.composition,
    view: visual.view,
    nodes: visual.nodes,
  };
  const frameV2 = evaluateVisualRuntimeProject(visualProject, frame, options);
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
