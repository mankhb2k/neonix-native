import {
  compileMotionProjectV3,
  COMPILED_PRESET_IDS,
  isCompiledPreset,
  type CompileV3Options,
  type CompiledPresetId,
  type MotionRuntimeProject,
} from "@motionvideo/motion-compiler";
import type { MotionProjectV3 } from "@motionvideo/motion-protocol";

/**
 * Phase 10: V3-only compiler bridge. All projects are V3 format.
 * compileMotionProjectV3 is used directly — no v2 routing.
 */
export function compileProject(project: MotionProjectV3): MotionRuntimeProject {
  const result = compileMotionProjectV3(project);
  if (!result.ok) {
    const msgs = result.diagnostics
      .map((d) => `${d.code}: ${d.message}`)
      .join("; ");
    throw new Error(`Compilation failed: ${msgs}`);
  }
  return result.project;
}

export {
  COMPILED_PRESET_IDS,
  isCompiledPreset,
  type CompileV3Options,
  type CompiledPresetId,
  type MotionRuntimeProject,
};

/** @deprecated Use MotionRuntimeProject directly */
export type CompiledProject = MotionRuntimeProject;
