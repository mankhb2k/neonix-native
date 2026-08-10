import {
  compileMotionProjectV3,
  COMPILED_PRESET_IDS,
  isCompiledPreset,
  type CompileOptions,
  type CompiledPresetId,
  type CompiledProject,
  type NormalizedMotionProjectV2,
} from "@motionvideo/motion-compiler";
import type { MotionProjectV3 } from "@motionvideo/motion-protocol";

/**
 * Phase 3 bridge: render-worker authored projects are now `MotionProjectV3`,
 * but the runtime IR is the normalized v2 shape. `compileMotionProject` (v2
 * path) reads `timeline.sceneOrder` and throws on real v3 data, so we go
 * through the v3 compiler and unwrap the result.
 */
export function compileMotionProject(
  project: MotionProjectV3,
  options?: CompileOptions,
): NormalizedMotionProjectV2 {
  const result = compileMotionProjectV3(project, options);
  if (!result.ok) {
    throw new Error(
      `compileMotionProject failed: ${result.diagnostics
        .map((d) => `${d.code}: ${d.message}`)
        .join(" | ")}`,
    );
  }
  return result.project;
}

export {
  COMPILED_PRESET_IDS,
  isCompiledPreset,
  type CompileOptions,
  type CompiledPresetId,
  type CompiledProject,
};
