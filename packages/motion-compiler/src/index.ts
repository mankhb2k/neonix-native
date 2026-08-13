import { type MotionProject, type MotionRuntimeProject } from "@motionvideo/motion-protocol";
import type { ComponentInput } from "./types";
import { compileMotionProjectV3 } from "./compile-v3";

export type CompileOptions = {
  components?: ComponentInput[];
};

/** Closed allowlist of Clip.source.presetId values the compiler expands. Unknown IDs throw. */
export {
  COMPILED_PRESET_IDS,
  isCompiledPreset,
  expandMotionPreset,
  type CompiledPresetId,
} from "./presets";
export {
  validateMotionProjectPresets,
  type UnknownPresetRef,
  type PresetValidationResult,
} from "./validate-presets";

export function compileMotionProject(
  project: MotionProject,
  options: CompileOptions = {},
): MotionRuntimeProject {
  const result = compileMotionProjectV3(
    project as Parameters<typeof compileMotionProjectV3>[0],
    options as unknown as Parameters<typeof compileMotionProjectV3>[1],
  );
  if (!result.ok) {
    throw new Error(
      `compileMotionProject failed: ${result.diagnostics
        .map(
          (d: { code: string; message: string }) => `${d.code}: ${d.message}`,
        )
        .join(" | ")}`,
    );
  }
  return result.project;
}

export type { CompiledProject } from "./compile-result";
export {
  compileMotionProjectV3,
  buildCompileCacheKeyV3,
  detectScheduleCycles,
  COMPILER_VERSION_V3,
  type CompileV3Options,
  type CompileV3Profile,
} from "./compile-v3";
export { compileSceneToRuntime } from "./compile-scene";
export {
  DiagnosticCollector,
  CompileDiagnosticError,
  compileSuccess,
  compileFailure,
  type CompileDiagnostic,
  type DiagnosticSeverity,
  type DiagnosticCode,
  type CompileResult,
  type CompileSuccess,
  type CompileFailure,
} from "./compile-result";
export {
  CompileCache,
  COMPILER_VERSION,
  hashComponentDeps,
  buildCompileCacheKey,
  type CacheEntry,
} from "./compile-cache";

export { applyLayoutConstraints } from "./layout-solver";
export {
  defaultTextMeasurementProvider,
  estimateTextSize,
  type TextMeasurementProvider,
  type TextMeasureRequest,
  type TextMeasureResult,
} from "./text-layout";
export {
  compileCaptionTracks,
  evaluateCaptionStateAtTime,
  type CompiledCaptionTrack,
  type CompiledCaptionCue,
  type ActiveCaptionState,
} from "./caption-compiler";
export {
  bakeMotionRecipe,
  isMotionRecipe,
  MOTION_RECIPE_IDS,
  type MotionRecipeId,
  type RecipeBakeInput,
  type BakedRecipe,
} from "./recipe-registry";
