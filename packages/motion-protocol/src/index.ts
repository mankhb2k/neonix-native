/** Public Protocol V2 API. */

import {
  MotionProtocolV2Schema,
  type MotionProtocolV2,
} from "./v2";

export * from "./v2";

export const MOTION_FORMAT_VERSION = 2 as const;

export function parseMotionProtocol(input: unknown): MotionProtocolV2 {
  return MotionProtocolV2Schema.parse(input);
}

export function serializeMotionProtocol(project: MotionProtocolV2): string {
  return JSON.stringify(project);
}
