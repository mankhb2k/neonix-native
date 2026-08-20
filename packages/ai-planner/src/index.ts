import {
  MotionProtocolV2Schema,
  type MotionProtocolV2,
} from "@motionvideo/motion-protocol/v2";
import { compileProtocolV2 } from "@motionvideo/motion-compiler";
import { applyMotionProtocolV2Patch, type MotionProtocolV2Patch } from "@motionvideo/motion-mcp";

export type V2ValidationResult = {
  valid: boolean;
  project: MotionProtocolV2 | null;
  diagnostics: Array<{ path: string; message: string }>;
};

/** AI tooling boundary: accept Atomic Protocol V2 only. */
export function validateAtomicProtocolV2(input: unknown): V2ValidationResult {
  const result = MotionProtocolV2Schema.safeParse(input);
  if (!result.success) {
    return {
      valid: false,
      project: null,
      diagnostics: result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    };
  }
  return { valid: true, project: result.data, diagnostics: [] };
}

export function applyAtomicProtocolV2Patch(
  project: MotionProtocolV2,
  patch: MotionProtocolV2Patch,
) {
  return applyMotionProtocolV2Patch(project, patch);
}

export function compileAtomicProtocolV2(project: unknown) {
  return compileProtocolV2(project);
}

/** High-level generation is intentionally unavailable until V2 atoms are certified. */
export function createHighLevelPlannerUnavailableError(): Error {
  return new Error("High-level AI authoring is not available until Protocol V2 atoms are certified");
}
