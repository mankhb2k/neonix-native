import {
  MotionProtocolV2Schema,
  type MotionProtocolV2,
} from "@motionvideo/motion-protocol/v2";

/** Parse only the strict Atomic Protocol V2 document shape. */
export function parseProjectInput(input: unknown): MotionProtocolV2 {
  return MotionProtocolV2Schema.parse(input);
}
