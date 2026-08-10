export * from "./v2";
export * from "./capabilities";
export * from "./scene-registry";
export * from "./ai-schema-capability";
export * as V3 from "./v3";

import {
  parseMotionProjectV2,
  MotionProjectV2Schema,
  serializeMotionProjectV2,
  type MotionProjectV2,
  type MotionNode,
  type MotionScene,
} from "./v2";

/** Canonical application model. */
export type MotionProject = MotionProjectV2;
export type Node = MotionNode;
export type Scene = MotionScene;

export const MotionProjectSchema = MotionProjectV2Schema;
export const MOTION_FORMAT_VERSION = 2 as const;

export function parseMotionProject(input: unknown): MotionProject {
  return parseMotionProjectV2(input);
}

export function serializeMotionProject(project: MotionProject): string {
  return serializeMotionProjectV2(project);
}
