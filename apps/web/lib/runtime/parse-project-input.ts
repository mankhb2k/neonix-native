import {
  parseMotionProject,
  type MotionProject,
} from "@motionvideo/motion-protocol";

/**
 * Phase 7: V2 is no longer accepted. Only V3 projects parse successfully.
 * V2 inputs are rejected with a clear error directing users to migrate.
 */
export function parseProjectInput(input: unknown): MotionProject {
  const maybe = input as { formatVersion?: unknown } | null | undefined;
  if (input && typeof input === "object" && maybe?.formatVersion === 2) {
    throw new Error(
      "V2 motion projects are no longer supported. " +
        "Please migrate your project to V3 using the legacy migration helper " +
        "in packages/motion-protocol/src/v3/migrations/v2-to-v3.",
    );
  }
  return parseMotionProject(input);
}
