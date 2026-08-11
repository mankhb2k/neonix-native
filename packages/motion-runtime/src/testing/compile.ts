import {
  compileMotionProjectV3,
  type MotionRuntimeProject,
} from "@motionvideo/motion-compiler";
import type { MotionProjectV3 } from "@motionvideo/motion-protocol";

/**
 * Compile a v3 authoring project into the runtime IR, throwing on failure.
 *
 * Phase 12 helper: uses `compileMotionProjectV3` directly. All V3 fixtures
 * must go through the v3 compiler and have `.project` unwrapped.
 */
export function compileProjectV3(
  project: MotionProjectV3,
): MotionRuntimeProject {
  const result = compileMotionProjectV3(project);
  if (!result.ok) {
    throw new Error(
      `compileProjectV3 failed: ${result.diagnostics
        .map((d) => `${d.code}: ${d.message}`)
        .join(" | ")}`,
    );
  }
  return result.project;
}
