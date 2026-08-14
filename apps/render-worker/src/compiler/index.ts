import {
  compileMotionProjectV1,
  COMPILED_PRESET_IDS,
  isCompiledPreset,
  type CompileV1Options,
  type CompiledPresetId,
} from "@motionvideo/motion-compiler";
import type {
  MotionProjectV1,
} from "@motionvideo/motion-protocol";
import type {
  MotionRuntimeProject,
} from "@motionvideo/motion-protocol/runtime";

/**
 * Phase 10: V1-only compiler bridge. All projects are V1 format.
 * compileMotionProjectV1 is used directly — no v2 routing.
 */
export function compileProject(project: MotionProjectV1): MotionRuntimeProject {
  const result = compileMotionProjectV1(project);
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
  type CompileV1Options,
  type CompiledPresetId,
  type MotionRuntimeProject,
};

/** @deprecated Use MotionRuntimeProject directly */
export type CompiledProject = MotionRuntimeProject;
