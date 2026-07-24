export * from "./v2";
export * from "./legacy-v1";
export * from "./migrate-v1";

import { parseMotionProjectV1 } from "./legacy-v1";
import { migrateMotionProjectV1ToV2 } from "./migrate-v1";
import {
  parseMotionProjectV2,
  MotionProjectV2Schema,
  serializeMotionProjectV2,
  type MotionProjectV2,
  type MotionNode,
  type MotionScene,
} from "./v2";

/** Canonical application model. V1 is accepted only as an import format. */
export type MotionProject = MotionProjectV2;
export type Node = MotionNode;
export type Scene = MotionScene;

export const MotionProjectSchema = MotionProjectV2Schema;
export const MOTION_FORMAT_VERSION = 2 as const;

export function parseMotionProject(input: unknown): MotionProject {
  if (input !== null && typeof input === "object" && "version" in input) {
    return migrateMotionProjectV1ToV2(parseMotionProjectV1(input));
  }
  return parseMotionProjectV2(input);
}

export function serializeMotionProject(project: MotionProject): string {
  return serializeMotionProjectV2(project);
}
