import {
  parseMotionProject,
  type MotionProject,
} from "@motionvideo/motion-protocol";

/** Parse editor/web project JSON. Only V1 (`formatVersion: 1`) is accepted. */
export function parseProjectInput(input: unknown): MotionProject {
  return parseMotionProject(input);
}
