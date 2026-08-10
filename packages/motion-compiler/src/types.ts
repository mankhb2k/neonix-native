/**
 * Compiler-internal type definitions.
 *
 * Phase 10: `ComponentInput` replaces the V2 `MotionComponentV2` import
 * so the compiler has zero dependencies on legacy/ schemas.
 */
import type { MotionNode } from "@motionvideo/motion-protocol";

/** Minimal view of a component definition needed by the compiler. */
export interface ComponentInput {
  componentId: string;
  componentVersion: string;
  variables: Array<{ id: string; value: unknown }>;
  publicAPI: Array<{ id: string; variableId: string }>;
  nodes: MotionNode[];
}
