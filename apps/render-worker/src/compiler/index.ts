import {
  compileMotionProject,
  COMPILED_PRESET_IDS,
  isCompiledPreset,
  type CompileOptions,
  type CompiledPresetId,
  type CompiledProject,
  type NormalizedMotionProjectV2,
} from "@motionvideo/motion-compiler";

/**
 * Phase 4: canonical `compileMotionProject` is now version-aware and routes
 * v3 projects through the v3 pipeline automatically. This bridge re-exports
 * it for backward compatibility in render-worker.
 */
export { compileMotionProject };

export {
  COMPILED_PRESET_IDS,
  isCompiledPreset,
  type CompileOptions,
  type CompiledPresetId,
  type CompiledProject,
};
