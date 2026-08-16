/**
 * Barrel animation V1 — easing / drivers (JSON / runtime evaluate).
 * Interpolation is not an authoring field; see `@motionvideo/motion-protocol/runtime`.
 */

// Easing
export {
  KeyframeEasingNamedSchema,
  KeyframeEasingCubicSchema,
  KeyframeEasingSpringSchema,
  KeyframeEasingSchema,
  type KeyframeEasingV1,
} from "./easing";

export { ProceduralDriverSchema, type ProceduralDriver } from "./drivers";
