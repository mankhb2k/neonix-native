import { compileMotionProjectV1 } from "@motionvideo/motion-compiler";
import type {
  MotionProjectV1,
} from "@motionvideo/motion-protocol";
import type {
  MotionRuntimeProject,
} from "@motionvideo/motion-protocol/runtime";

/**
 * Compile a v1 authoring project into the runtime IR, throwing on failure.
 *
 * Phase 12 helper: uses `compileMotionProjectV1` directly. All V1 fixtures
 * must go through the v1 compiler and have `.project` unwrapped.
 */
export function compileProjectV1(
  project: MotionProjectV1,
): MotionRuntimeProject {
  const result = compileMotionProjectV1(project);
  if (!result.ok) {
    throw new Error(
      `compileProjectV1 failed: ${result.diagnostics
        .map((d) => `${d.code}: ${d.message}`)
        .join(" | ")}`,
    );
  }
  return result.project;
}
