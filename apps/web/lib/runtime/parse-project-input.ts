import {
  migrateMotionProjectV2ToV3,
  parseMotionProject,
  type MotionProjectV3,
} from "@motionvideo/motion-protocol";

/**
 * Phase 3: canonical projects are v3. Pre-cutover saves / legacy fixtures are
 * still v2 — load them through the official v2→v3 migration instead of
 * rejecting them. Only v2-shaped records take the migration path; v3 and
 * corrupt input behave exactly like `parseMotionProject`.
 */
export function parseProjectInput(input: unknown): MotionProjectV3 {
  const maybe = input as { formatVersion?: unknown } | null | undefined;
  if (
    input &&
    typeof input === "object" &&
    maybe?.formatVersion === 2
  ) {
    return migrateMotionProjectV2ToV3(input as never).project;
  }
  return parseMotionProject(input);
}
