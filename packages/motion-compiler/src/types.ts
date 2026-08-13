/**
 * Compiler-internal type definitions.
 *
 * `ComponentInput` keeps the compiler decoupled from authoring schema modules.
 */
import type { MotionLayer } from "@motionvideo/motion-protocol";

/** Minimal view of a component definition needed by the compiler. */
export interface ComponentInput {
  componentId: string;
  componentVersion: string;
  variables: Array<{ id: string; value: unknown }>;
  publicAPI: Array<{ id: string; variableId: string }>;
  layers: MotionLayer[];
}
