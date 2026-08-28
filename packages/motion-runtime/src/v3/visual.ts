import { evaluateRuntimeProjectV2 } from "./legacy/evaluate";
import type { RuntimeProjectV2 } from "./legacy/types";
import { assertRuntimeFrameV2 } from "./legacy/validate";
import { prepareRuntimeProjectV2Text, type RuntimeTextFontResolverV2, type RuntimeTextShaperLoaderV2 } from "./legacy/text-layout";
import { validateRuntimeVisualProjectV3 } from "./validate";
import type { RuntimeFrameV3, RuntimeProjectV3 } from "./types";

/**
 * Evaluate the canonical V3 visual projection.
 *
 * V3 deliberately keeps the certified visual node semantics from V2. The
 * compatibility evaluator is used only as an implementation bridge here; the
 * public input is the V3 visual projection and the returned frame is tagged
 * with runtime version 3. Media/audio playback is resolved separately by the
 * V3 timeline functions.
 */
export function evaluateRuntimeProjectV3(
  project: RuntimeProjectV3,
  frame: number,
  options: { time?: number } = {},
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

  const visualProject: RuntimeProjectV2 = {
    format: "motion-runtime",
    formatVersion: 2,
    id: project.projectId,
    composition: project.visual.composition,
    view: project.visual.view,
    nodes: project.visual.nodes,
  };
  const frameV2 = evaluateRuntimeProjectV2(visualProject, frame, options);
  return { ...frameV2, runtimeVersion: 3 };
}

/** Backend-neutral V3 name for visual frame evaluation. */
export const evaluateVisualFrame = evaluateRuntimeProjectV3;

/** Validate the V3-tagged visual frame without re-exposing a V2 public API. */
export function assertRuntimeFrameV3(input: unknown): asserts input is RuntimeFrameV3 {
  if (!input || typeof input !== "object" || (input as { runtimeVersion?: unknown }).runtimeVersion !== 3) {
    throw new Error("Runtime frame must carry runtimeVersion 3");
  }
  assertRuntimeFrameV2({ ...(input as RuntimeFrameV3), runtimeVersion: 2 });
}

export type RuntimeTextFontResolverV3 = RuntimeTextFontResolverV2;
export type RuntimeTextShaperLoaderV3 = RuntimeTextShaperLoaderV2;

/** V3 text preparation preserves the certified visual shaper behind the V3 boundary. */
export async function prepareRuntimeProjectV3Text(project: RuntimeProjectV3, resolveFont: RuntimeTextFontResolverV3, loadHarfBuzz: RuntimeTextShaperLoaderV3): Promise<{ project: RuntimeProjectV3; diagnostics: Awaited<ReturnType<typeof prepareRuntimeProjectV2Text>>["diagnostics"] }> {
  const prepared = await prepareRuntimeProjectV2Text({ format: "motion-runtime", formatVersion: 2, id: project.projectId, composition: project.visual.composition, view: project.visual.view, nodes: project.visual.nodes }, resolveFont, loadHarfBuzz);
  return { project: { ...project, visual: { ...project.visual, composition: prepared.project.composition, view: prepared.project.view, nodes: prepared.project.nodes } }, diagnostics: prepared.diagnostics };
}
