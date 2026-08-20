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

export type { CompiledProject } from "./compile-result";
export {
  compileMotionProjectV1,
  buildCompileCacheKeyV1,
  detectScheduleCycles,
  COMPILER_VERSION_V1,
  type CompileV1Options,
  type CompileV1Profile,
} from "./compile-v1";
export {
  layerAnimationsToPropertyAnimations,
  componentPropKeyframesToPropertyAnimations,
} from "./compile-v1/to-property-animations";
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
export { layerPoseFromAtoms, type LayerPoseSnapshot } from "./layer-pose";
export {
  defaultTextMeasurementProvider,
  estimateTextSize,
  type TextMeasurementProvider,
  type TextMeasureRequest,
  type TextMeasureResult,
} from "./text-layout";
export {
  bakeMotionRecipe,
  isMotionRecipe,
  MOTION_RECIPE_IDS,
  type MotionRecipeId,
  type RecipeBakeInput,
  type BakedRecipe,
} from "./recipe-registry";
export {
  compileProtocolV2,
  compileProtocolV2ToPaintCommands,
  type CompileProtocolV2Options,
} from "./compile-v2";
